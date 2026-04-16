from music21 import (
    stream,
    clef,
    note,
    articulations,
    metadata,
    tempo,
    instrument,
    chord,
    spanner,
    bar,
    expressions,
    converter
)
import copy
import xml.etree.ElementTree as ET
from pathlib import Path

from .constants import (
    E_STANDARD_GUITAR,
    E_STANDARD_MIDI,
    MAX_FRET,
    ScoreInfo,
    StringFret,
)
from .score_parse import (
    parse_score,
    is_grand_staff_score,
    should_keep_element,
    collect_midi_pitches,
)
from .fret_assign import (
    get_closest_string_fret,
    viterbi,
    shift_pitches_to_range,
    assign_chord_strings,
)


def add_staff_details(score: stream.Score) -> ET.ElementTree:
    """ Manually inject <staff-details> element into the xml tree 
    so that the file can be interpreted as a guitar tab by alphaTab

    Args:
        score (stream.Score): The music21 score to be converted into an xml tree
        and be injected with <staff-details>

    Returns:
        ET.ElementTree: The xml tree with <staff-details> 
    """
    part = score.parts[0]

    first_measure = part.getElementsByClass(stream.Measure)[0]
    
    first_measure.insert(0, clef.TabClef())
    
    first_measure.staffLines = 6
    
    # Keep the score in memory
    xml_string = score.write('musicxml').read_text(encoding='UTF-8')
    
    root = ET.fromstring(xml_string)
    attributes = next(root.iter('attributes'))

    staff_details = attributes.find('staff-details')
    if staff_details is not None:
        for line, step, octave in E_STANDARD_GUITAR:
            st = ET.SubElement(staff_details, 'staff-tuning')
            st.set('line', str(line))
            ET.SubElement(st, 'tuning-step').text = step
            ET.SubElement(st, 'tuning-octave').text = octave

    tree = ET.ElementTree(root)
    # Make the file look nice at the end
    ET.indent(tree, '  ')            
    return tree


def build_tab_score(score_info: ScoreInfo) -> tuple[stream.Score, stream.Part]:
    tab = stream.Score()
    tab.insert(0, metadata.Metadata())
    tab.metadata.title = score_info.title
    tab.metadata.composer = score_info.composer
    part = stream.Part()
    part.insert(0, instrument.Guitar())
    return tab, part


def build_measure(
    i: int,
    old_measure: stream.Measure,
    pitch_shift: int,
    string_frets: list[StringFret],
    sf_idx: int,
    score_info: ScoreInfo,
    use_upper_staff_only: bool,
    prev_fret: int = 0,
    open_streak: int = 0,
) -> tuple[stream.Measure, int, int, int]:
    """Build a new tab measure from an old measure."""
    measure = stream.Measure(number=i + 1)

    if i == 0:
        measure.insert(0, score_info.key_signature)
        measure.insert(0, score_info.time_signature)

    mm = old_measure.getElementsByClass('MetronomeMark').first()
    if mm:
        quarter_bpm = mm.getQuarterBPM()
        new_mm = tempo.MetronomeMark(number=quarter_bpm)
        measure.insert(0, new_mm)
    
    for ele in old_measure.recurse():
        if not should_keep_element(ele, use_upper_staff_only):
            continue

        if isinstance(ele, bar.Repeat):
            if ele.direction == 'start':
                measure.leftBarline = ele
            else:
                measure.rightBarline = ele
                
        elif isinstance(ele, chord.Chord):
            # Use the viterbi-assigned position for the highest note
            #  of this chord
            if sf_idx < len(string_frets):
                sf = string_frets[sf_idx]
                sf_idx += 1
            else:
                sf = get_closest_string_fret(ele.notes[0].pitch.midi + pitch_shift)                
            
            shifted_notes = []
            for n in ele.notes:
                n.transpose(pitch_shift, inPlace=True)
                # shifted = note.Note(n.pitch.midi + pitch_shift, quarterLength=ele.quarterLength)
                shifted_notes.append(n)
            
            anchor_fret = sf.fret if sf.fret > 0 else prev_fret
            if anchor_fret == 0:
                # Try to do what we can to make anchor_fret anything but 0, unless that
                #  is truly the optimal place for the anchor
                nonzero_frets = []
                for n in shifted_notes:
                    for open_pitch_midi in E_STANDARD_MIDI:
                        fret = n.pitch.midi - open_pitch_midi
                        if 0 < fret <= MAX_FRET:
                            nonzero_frets.append(fret)
                if nonzero_frets:
                    anchor_fret = round(sum(nonzero_frets) / len(nonzero_frets))
            
            assignments = assign_chord_strings(shifted_notes, anchor_fret=anchor_fret)

            for n_i, (n, sf) in enumerate(assignments):
                n.articulations.append(articulations.StringIndication(sf.string))
                n.articulations.append(articulations.FretIndication(sf.fret))
                n.style.absoluteX = int(ele.offset * 10000)
                # Preserve the offset between notes in a chord
                # For example, if offset = 0 for the first note, offset = 0
                #  for every other note in the chord.
                # This helps alphatab render the chord properly
                measure.insert(ele.offset, n)

            
            fretted = [sf.fret for _, sf in assignments if sf.fret > 0]
            if fretted:
                open_streak = 0
                # Set previous fret to be the average of the fretted notes only
                prev_fret = round(sum(fretted) / len(fretted))


        elif isinstance(ele, note.Note):
            if sf_idx < len(string_frets):
                sf = string_frets[sf_idx]
                sf_idx += 1
            else:
                # Fallback if we somehow run out of assignments
                sf = get_closest_string_fret(ele.pitch.midi)

            ele.articulations.append(articulations.StringIndication(sf.string))
            ele.articulations.append(articulations.FretIndication(sf.fret))
            ele.style.absoluteX = int(ele.offset * 10000)
            measure.append(ele)
            
            if sf.fret > 0:
                prev_fret = sf.fret
                open_streak = 0
            else:
                # If we have a long enough streak of open notes, then
                #  consider that as the guitarist having enough time to
                #  shift their hand anywhere on the guitar
                open_streak += 1
                if open_streak >= 4:
                    prev_fret = 0

        elif isinstance(ele, note.Rest):
            # Deep copy rests to avoid music21 stream ownership issues
            n = copy.deepcopy(ele)
            measure.append(n)
            
    return measure, sf_idx, prev_fret, open_streak

# def describe(n: ET.Element, root) -> str:
#     # rest?
#     if n.find('rest') is not None:
#         return f'REST dur={n.findtext("duration")}'
#     # pitch
#     step = n.findtext('pitch/step')
#     octave = n.findtext('pitch/octave')
#     alter = n.findtext('pitch/alter') or ''
#     alter_sym = {'1': '#', '-1': 'b', '2': '##', '-2': 'bb'}.get(alter, '')
#     pitch = f'{step}{alter_sym}{octave}' if step else '?'
#     # duration & voice
#     dur = n.findtext('duration')
#     voice = n.findtext('voice')
#     # is it already a chord member?
#     is_chord = n.find('chord') is not None
#     # tab articulations (your pipeline adds these)
#     string = n.findtext('.//string')
#     fret = n.findtext('.//fret')
#     # find parent measure
#     parent_measure = None
#     for m in root.iter('measure'):
#         if n in list(m):
#             parent_measure = m.get('number')
#             break
#     return (f'm{parent_measure} {pitch:>5} dur={dur} v={voice} '
#             f'str={string} fret={fret}{" [chord]" if is_chord else ""}')

def inject_chords(tree: ET.ElementTree) -> ET.ElementTree:
    root = tree.getroot()
    assert root is not None
 
    for measure in root.findall('.//measure'):
        prev_x = None
        prev_grace = None
        for n in measure.findall('note'):
            if n.find('rest') is not None:
                prev_x = None
                prev_grace = None
                continue
 
            dx = n.get('default-x')
            if dx is None:
                prev_x = None
                prev_grace = None
                continue
 
            is_grace = n.find('grace') is not None

            if is_grace != prev_grace:
                prev_x = None
 
            if dx == prev_x:
                n.insert(0, ET.Element('chord'))
 
            prev_x = dx
            prev_grace = is_grace
 
    return ET.ElementTree(root)


# Breaks down with more complex songs. Will probably need to update
# to create a fresh score instead of updating the old one
def get_musicxml_tab(xml_path: Path | str):
    score, score_info, xml_root = parse_score(xml_path)
    old_part = score.parts[0]
    use_upper_staff = is_grand_staff_score(xml_root)
    old_measures = list(old_part.getElementsByClass('Measure'))

    midi_pitches = collect_midi_pitches(old_measures, use_upper_staff)
    midi_pitches, pitch_shift = shift_pitches_to_range(midi_pitches)
    string_frets = viterbi(midi_pitches)

    tab, part = build_tab_score(score_info)
    
    sf_idx = 0
    prev_fret = 0
    open_streak = 0
    for i, old_measure in enumerate(old_measures):
        measure, sf_idx, prev_fret, open_streak = build_measure(
            i, 
            old_measure, 
            pitch_shift,
            string_frets, 
            sf_idx,
            score_info, 
            use_upper_staff,
            prev_fret,
            open_streak
        )
        part.append(measure)  
    
    tab.append(part)
    tree = add_staff_details(tab)
    tree = inject_chords(tree)    
    return tree