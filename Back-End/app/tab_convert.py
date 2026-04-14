from music21 import (
    stream,
    clef,
    note,
    articulations,
    metadata,
    tempo,
    instrument,
    chord,
)
import copy
import xml.etree.ElementTree as ET
from pathlib import Path

from .constants import (
    E_STANDARD_GUITAR,
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
    chord_indices: list[int],
    note_idx: int,
    score_info: ScoreInfo,
    use_upper_staff_only: bool,
) -> tuple[stream.Measure, int, int]:
    """Build a new tab measure from an old measure.
    
    Returns:
        (measure, updated sf_idx, updated note_idx)
    """
    measure = stream.Measure(number=i + 1)

    if i == 0:
        measure.insert(0, score_info.key_signature)
        measure.insert(0, score_info.time_signature)

    mm = old_measure.getElementsByClass('MetronomeMark').first()
    if mm:
        quarter_bpm = mm.getQuarterBPM()
        new_mm = tempo.MetronomeMark(number=quarter_bpm)
        measure.insert(0, new_mm)

    for ele in old_measure.recurse().notesAndRests:
        if not should_keep_element(ele, use_upper_staff_only):
            continue

        if isinstance(ele, chord.Chord):
            # Use the viterbi-assigned position for the highest note
            #  of this chord
            if sf_idx < len(string_frets):
                sf = string_frets[sf_idx]
                sf_idx += 1
            else:
                sf = get_closest_string_fret(ele.notes[-1].pitch.midi + pitch_shift)
            
            shifted_notes = []
            for n in ele.notes:
                shifted = note.Note(n.pitch.midi + pitch_shift, quarterLength=ele.quarterLength)
                shifted_notes.append(shifted)
            
            assignments = assign_chord_strings(shifted_notes, anchor_fret=sf.fret)

            for n_i, (n, sf) in enumerate(assignments):
                if i+1 in range(28, 34):
                    print(f"  measure={i+1} n_i={n_i}, pitch={n.pitch}, string={sf.string}, fret={sf.fret}, offset={ele.offset}")

                n.articulations.append(articulations.StringIndication(sf.string))
                n.articulations.append(articulations.FretIndication(sf.fret))

                # Preserve the offset between notes in a chord
                # For example, if offset = 0 for the first note, offset = 0
                #  for every other note in the chord.
                # This helps alphatab render the chord properly
                measure.insert(ele.offset, n)

                # Mark chord members (not the first note) for 
                # post-processing <chord/> injection
                if n_i > 0:
                    chord_indices.append(note_idx)

                note_idx += 1

            # Consume one Viterbi slot since we added one pitch 
            # per chord in collect_midi_pitches
            # sf = string_frets[sf_idx]
            
            # ele.notes[-1].articulations.append(articulations.StringIndication(sf.string))
            # ele.notes[-1].articulations.append(articulations.FretIndication(sf.fret))
            
            # measure.append(ele.notes[-1])
            
            # sf_idx += 1


        elif isinstance(ele, note.Note):
            if sf_idx < len(string_frets):
                sf = string_frets[sf_idx]
                sf_idx += 1
            else:
                # Fallback if we somehow run out of assignments
                sf = get_closest_string_fret(ele.pitch.midi)

            ele.articulations.append(articulations.StringIndication(sf.string))
            ele.articulations.append(articulations.FretIndication(sf.fret))

            measure.append(ele)
            note_idx += 1

        elif isinstance(ele, note.Rest):
            # Deep copy rests to avoid music21 stream ownership issues
            n = copy.deepcopy(ele)
            measure.append(n)

            # Increment note_idx for rests because MusicXML <note> 
            # elements include rests, so chord_indices must account for them
            note_idx += 1

    return measure, sf_idx, note_idx


def inject_chords(tree: ET.ElementTree, chord_indices: list[int]) -> ET.ElementTree:
    root = tree.getroot()
    assert root is not None
    all_notes = root.findall('.//note')
    
    for i in chord_indices:
        if i >= len(all_notes):
            continue
        n = all_notes[i]
        n.insert(0, ET.Element('chord'))
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
    
    chord_indices: list[int] = []
    sf_idx = 0
    note_idx = 0
    for i, old_measure in enumerate(old_measures):
        measure, sf_idx, note_idx = build_measure(
            i, 
            old_measure, 
            pitch_shift,
            string_frets, 
            sf_idx,
            chord_indices, 
            note_idx,
            score_info, 
            use_upper_staff
        )
        part.append(measure)
    
    tab.append(part)
    tree = add_staff_details(tab)
    tree = inject_chords(tree, chord_indices)
    return tree