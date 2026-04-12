from music21 import (
    stream, 
    clef,
    converter,
    note, 
    pitch, 
    interval, 
    note, 
    articulations, 
    meter, 
    key,
    metadata,
    tempo,
    instrument,
    chord
)
import math, copy
from dataclasses import dataclass, field
import xml.etree.ElementTree as ET
from pathlib import Path

OPEN_STRING_PITCHES = {
    1: pitch.Pitch('E4'), # 'e'
    2: pitch.Pitch('B3'), # 'B'
    3: pitch.Pitch('G3'), # 'G'
    4: pitch.Pitch('D3'), # 'D'
    5: pitch.Pitch('A2'), # 'A'
    6: pitch.Pitch('E2'), # 'E'
}

MAX_FRET = 24
MAX_SPREAD = 5 # max fret spead in one chord
MAX_MIDI_PITCH = OPEN_STRING_PITCHES[1].midi + MAX_FRET
MIN_MIDI_PITCH = OPEN_STRING_PITCHES[6].midi

PITCH_SHIFT = 0

E_STANDARD_GUITAR = [
    (1, 'E', '2'),
    (2, 'A', '2'),
    (3, 'D', '3'),
    (4, 'G', '3'),
    (5, 'B', '3'),
    (6, 'E', '4'),
]

@dataclass
class ScoreInfo:
    title: str = 'Unknown'
    composer: str = 'Unknown'
    key_signature: key.KeySignature = field(default_factory=lambda: key.KeySignature(0))
    # Not being used currently, but could be useful for figuring out 
    #  fret placements or chord placements
    time_signature: meter.TimeSignature = field(default_factory=lambda: meter.TimeSignature('4/4'))

@dataclass(frozen=True)
class StringFret:
    string: int = 6
    fret: int = 0

def add_staff_details(score: stream.Score) -> ET.ElementTree:
    """ Manually inject \<staff-details\> element into the xml tree 
    so that the file can be interpreted as a guitar tab by alphaTab

    Args:
        score (stream.Score): The music21 score to be converted into an xml tree
        and be injected with \<staff-details\>

    Returns:
        ET.ElementTree: The xml tree with \<staff-details\> 
    """
    part = score.parts[0]

    first_measure = part.getElementsByClass(stream.Measure)[0]
    
    first_measure.insert(0, clef.TabClef())
    
    first_measure.staffLines = 6
    
    # Keep the score in memory
    xml_string = score.write('musicxml').read_text(encoding='UTF-8')
    
    root = ET.fromstring(xml_string)
    attributes = next(root.iter(f'attributes'))

    staff_details = attributes.find(f'staff-details')
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

def get_frets(midi_pitch: int) -> list[StringFret]:
    string_frets = []
    for string, open_pitch in OPEN_STRING_PITCHES.items():
        fret = midi_pitch - open_pitch.midi
        if 0 <= fret <= MAX_FRET:
            string_frets.append(StringFret(string, fret))

    if string_frets:
        return string_frets

    # HOMR can emit pitches slightly outside standard guitar range.
    # Fall back to the closest clamped string/fret position so we still
    # produce playable-looking tablature instead of failing the upload.
    best_string = 6
    best_fret = 0
    best_error: tuple[int, int, int] | None = None
    for string, open_pitch in E_STANDARD_MIDI.items():
        raw_fret = midi_pitch - open_pitch
        clamped_fret = max(0, min(MAX_FRET, raw_fret))
        error = abs(raw_fret - clamped_fret)
        score = (error, clamped_fret, string)
        if best_error is None or score < best_error:
            best_error = score
            best_string = string
            best_fret = clamped_fret

    return [StringFret(best_string, best_fret)]

def get_closest_string_fret(midi_pitch: int) -> tuple[int, int]:
    fallback = get_frets(midi_pitch)[0]
    return fallback.string, fallback.fret

def cost(prev: StringFret, curr: StringFret) -> float:
    if prev.fret > 0 and curr.fret > 0:
        fret_dist = abs(prev.fret - curr.fret)
    else:
        fret_dist = 0
    # string_dist = abs(prev.string - curr.string)

    fret_cost = fret_dist * 2 
        
    open = -8 if curr.fret == 0 else 0
    
    pos_cost_base = 1.2   
    pos_cost = pos_cost_base ** curr.fret
    
    return fret_cost + pos_cost + open

def viterbi(midi_pitches: list[int]) -> list[StringFret]:
    if not midi_pitches: return []
    
    candidates = [get_frets(p + PITCH_SHIFT) for p in midi_pitches]
    
    # Hotfix for if the pitches of a song fall outside the range of the guitar
    for i, c in enumerate(candidates):
        if not c:
            p = midi_pitches[i]
            while p < MIN_MIDI_PITCH:
                p += 12 
            while p > MAX_MIDI_PITCH:
                p -= 12 
            midi_pitches[i] = p
            
            candidates[i] = get_frets(p)
            
    prev_costs = {}
    # Initialize prev_costs with the candidates for the first string_fret pair 
    for sf in candidates[0]:
        prev_costs[sf] = sf.fret
        
    backpointers = [{}]
    
    for i in range(1, len(midi_pitches)):
        curr_costs: dict[StringFret, float] = {}
        backpointers.append({})
        
        for curr_sf in candidates[i]:
            best_cost = float('inf')
            best_prev = None
            
            for prev_sf in prev_costs:
                curr_cost = prev_costs[prev_sf] + cost(prev_sf, curr_sf)
                if curr_cost < best_cost:
                    best_cost = curr_cost 
                    best_prev = prev_sf
                    
            curr_costs[curr_sf] = best_cost
            backpointers[i][curr_sf] = best_prev
        
        prev_costs = curr_costs
        
    best_final = min(prev_costs, key=lambda k: prev_costs[k])
    path = [best_final]
    for i in range(len(midi_pitches) - 1, 0, -1):
        path.append(backpointers[i][path[-1]])
    path.reverse()
    
    return path

<<<<<<< HEAD
=======
def closest_string(n: note.Note | pitch.Pitch):
    if isinstance(n, note.Note):
        p = n.pitch
    elif isinstance(n, pitch.Pitch):
        p = n

    candidates = []
    
    for string, open_pitch in OPEN_STRING_PITCHES.items():

    # return (best_string, fret)
        semitones = p.midi - open_pitch.midi
        if 0 <= semitones <= MAX_FRET:
            candidates.append((string, semitones))
    if not candidates:
        raise ValueError(f"Pitch {p} is out of guitar range")
    # this prefers the lowest fret, if its tied, prefer lowest string number
    string_num, fret = min(candidates, key=lambda x: (x[1], x[0]))
    return string_num, int(fret)

>>>>>>> 6b5aada9f94441da08a772976ad88e0cb663ea97
def assign_chord_strings(chord_notes: list[note.Note]):
    """ assign one note per string if we encounter a chord
        Returns: [(cloned_note, string, fret)]
    """
    if len(chord_notes) > len(OPEN_STRING_PITCHES):
        chord_notes = chord_notes[-len(OPEN_STRING_PITCHES):]

    # sort low pitch to high pitch
    sorted_notes = sorted(chord_notes, key=lambda n: n.pitch.midi)

    # build candidate strings for each note
    note_candidates = []
    for n in sorted_notes:
        candidates = []
        for string_num, open_pitch in OPEN_STRING_PITCHES.items():
            fret = n.pitch.midi - open_pitch.midi + PITCH_SHIFT
            if fret > MAX_FRET:
                fret -= 12
            if 0 <= fret <= MAX_FRET:
                candidates.append((string_num, int(fret)))
        if not candidates:
            candidates.append(get_closest_string_fret(n.pitch.midi))
        note_candidates.append((n, candidates))

    best_assignment = None
    best_score = None

    # pick a note, try putting it on a string, move to next note, if its impossible, go back and try another string
    def backtrack(idx, used_strings, current):
        nonlocal best_assignment, best_score

        if idx == len(note_candidates):
            frets = [fret for _, _, fret in current if fret > 0]
            span = (max(frets) - min(frets)) if frets else 0

            if span > MAX_SPREAD:
                return

            # scoring:
            # 1. minimize fret span
            # 2. minimize average fret
            # 3. prefer more open strings
            avg_fret = sum(f for _, _, f in current) / len(current)
            open_count = sum(1 for _, _, f in current if f == 0)
            score = (span, avg_fret, -open_count)

            if best_score is None or score < best_score:
                best_score = score
                best_assignment = current[:]
            return

        orig_note, candidates = note_candidates[idx]

        # Prefer keeping lower notes on lower-pitched strings
        # larger string numbers first for lower notes
        candidates = sorted(candidates, key=lambda x: (-x[0], x[1]))

        for string_num, fret in candidates:
            if string_num in used_strings:
                continue

            current.append((orig_note, string_num, fret))
            used_strings.add(string_num)

            backtrack(idx + 1, used_strings, current)

            used_strings.remove(string_num)
            current.pop()

    backtrack(0, set(), [])

    if best_assignment is None:
        # fallback. assign by closest available string
        used_strings = set()
        fallback = []
        for orig_note, candidates in note_candidates:
            chosen = None
            for string_num, fret in sorted(candidates, key=lambda x: (x[1], -x[0])):
                if string_num not in used_strings:
                    chosen = (orig_note, string_num, fret)
                    break
            if chosen is None:
                continue
            used_strings.add(chosen[1])
            fallback.append(chosen)
        best_assignment = fallback

    if not best_assignment:
        highest_note = max(sorted_notes, key=lambda n: n.pitch.midi)
        string_num, fret = get_closest_string_fret(highest_note.pitch.midi)
        best_assignment = [(highest_note, string_num, fret)]

    # clone here once
    result = []
    for orig_note, string_num, fret in best_assignment:
        new_note = copy.deepcopy(orig_note)
        result.append((new_note, string_num, fret))

    return result

def get_score_info(score: stream.Score, xml_root: ET.Element) -> ScoreInfo:
    score_info = ScoreInfo()

    credits = {}
    for credit in xml_root.findall('credit'):
        ct = credit.find('credit-type')
        cw = credit.find('credit-words')
        if ct is not None and cw is not None:
            credits[ct.text] = cw.text
    
    if not score.metadata.title:
        if credits.get('title'):
            score_info.title = credits['title']
    else:
        score_info.title = score.metadata.title

    if not score.metadata.composer:
        if credits.get('composer'):
            score_info.composer = credits['composer']
    else:
        score_info.composer = score.metadata.composer
        
    
    computed_ts = score.flatten().getElementsByClass(meter.TimeSignature).first() 
    
    if computed_ts:
        score_info.time_signature = computed_ts                        
    
    ks = score.recurse().getElementsByClass('KeySignature').first()
    if not ks:
        ks  = score.analyze('key')
    
    if ks:
        score_info.key_signature = ks
    
    return score_info

# detect if the music provided is for piano (2 staffs)
def is_grand_staff_score(xml_root: ET.Element) -> bool:
    for attributes in xml_root.findall('.//attributes'):
        staves = attributes.findtext('staves')
        if staves and staves.isdigit() and int(staves) > 1:
            return True

        clef_signs = {
            clef_element.findtext('sign')
            for clef_element in attributes.findall('clef')
            if clef_element.findtext('sign')
        }
        if 'G' in clef_signs and 'F' in clef_signs:
            return True

    staff_numbers = {
        staff.text
        for staff in xml_root.findall('.//note/staff')
        if staff.text
    }
    return '1' in staff_numbers and '2' in staff_numbers


def element_staff_number(ele: note.GeneralNote | chord.Chord) -> int | None:
    if getattr(ele, 'staffNumber', None) is not None:
        return ele.staffNumber

    for note_in_chord in getattr(ele, 'notes', []):
        if getattr(note_in_chord, 'staffNumber', None) is not None:
            return note_in_chord.staffNumber

    return None

# if given more than 1 staff, use only the upper staff because 
# the upper staff is "usually" the melody
def should_keep_element(ele: note.GeneralNote | chord.Chord, use_upper_staff_only: bool) -> bool:
    if not use_upper_staff_only:
        return True

    staff_number = element_staff_number(ele)
    return staff_number in (None, 1)


def parse_score(xml_path: Path | str):
    score_info = ScoreInfo()
    
    res = converter.parse(xml_path, format='musicxml')
    if isinstance(res, stream.Score):
        score = res
    elif isinstance(res, stream.Part):
        score = stream.Score()
        score.insert(0, res)
    elif isinstance(res, stream.Opus):
        score = res.scores[0]
    else:
        raise ValueError(f'Result after music21 parsing is not of type (Score | Path | Opus): {type(res).__name__}')
    
    xml_tree = ET.parse(xml_path)
    xml_root = xml_tree.getroot()
    
    score_info = get_score_info(score, xml_root)
    
    return score, score_info, xml_root

# Breaks down with more complex songs. Will probably need to update
# to create a fresh score instead of updating the old one
def get_musicxml_tab(xml_path: Path | str):
    score, score_info, xml_root = parse_score(xml_path)
    old_part = score.parts[0]
    use_upper_staff_only = is_grand_staff_score(xml_root)
    
    tab = stream.Score()
    tab.insert(0, metadata.Metadata())
    tab.metadata.title = score_info.title
    tab.metadata.composer = score_info.composer
    
    part = stream.Part()
    part.insert(0, instrument.Guitar())
    
    old_measures: list[stream.Measure] = list(old_part.getElementsByClass('Measure'))

    # Collect all the pitches to iterate over
    midi_pitches: list[int] = []
    for old_measure in old_measures:
        for ele in old_measure.notesAndRests:
            if not should_keep_element(ele, use_upper_staff_only): #for piano scores
                continue
            if isinstance(ele, note.Note):
                midi_pitches.append(ele.pitch.midi)
            elif isinstance(ele, chord.Chord):
                # get the midi pitch of the highest note, for now
                midi_pitches.append(ele.notes[-1].pitch.midi)
    
    # print(min(midi_pitches), max(midi_pitches))
    
    if max(midi_pitches) > MAX_MIDI_PITCH:
        midi_pitches = [p-12 for p in midi_pitches]
    elif min(midi_pitches) < MIN_MIDI_PITCH:
        midi_pitches = [p+12 for p in midi_pitches]
    
    string_frets = viterbi(midi_pitches=midi_pitches)

    chord_indices = []
    pitched_note_idx = 0
    sf_idx = 0
    for i, old_measure in enumerate(old_measures):
        measure = stream.Measure(number=i+1)

        if i+1 == 1:
            measure.insert(0, score_info.key_signature)
            measure.insert(0, score_info.time_signature)

        # Insert the tempo marking (bpm) into the measure
        mm = old_measure.getElementsByClass('MetronomeMark').first()
        if mm:
            quarter_bpm = mm.getQuarterBPM()
            new_mm = tempo.MetronomeMark(number=quarter_bpm)
            measure.insert(0, new_mm)

        for ele in old_measure.recurse().notesAndRests:
            if not should_keep_element(ele, use_upper_staff_only): #for piano scores
                continue
            if isinstance(ele, chord.Chord):
                assignments = assign_chord_strings(ele.notes)

                for n_i, (n, string, fret) in enumerate(assignments):

                    n.articulations.append(articulations.StringIndication(string))
                    n.articulations.append(articulations.FretIndication(fret))            
 
                    # Preserve the offset between notes in a chord
                    # For example, if offset = 0 for the first note, offset = 0
                    #  for every other note in the chord.
                    # This helps alphatab render the chord properly 
                    measure.insert(ele.offset, n)

                    if n_i > 0:
                        chord_indices.append(pitched_note_idx)
                
                    pitched_note_idx += 1
                # sf = string_frets[sf_idx]
                
                # n = ele.notes[-1]
                
                # n.articulations.append(articulations.StringIndication(sf.string))
                # n.articulations.append(articulations.FretIndication(sf.fret))
                
                # measure.append(n)
                
                sf_idx += 1

            elif isinstance(ele, note.Note):
                if sf_idx < len(string_frets):
                    sf = string_frets[sf_idx]
                    sf_idx += 1
                else:
                    string_num, fret = get_closest_string_fret(ele.pitch.midi)
                    sf = StringFret(string_num, fret)
                
                ele.articulations.append(articulations.StringIndication(sf.string))
                ele.articulations.append(articulations.FretIndication(sf.fret))

                measure.append(ele)
                pitched_note_idx += 1
                
            elif isinstance(ele, note.Rest):
                n = copy.deepcopy(ele)
                measure.append(n)
    
        part.append(measure)
    
    tab.append(part)
            
    tree = add_staff_details(tab)

    root: ET.Element = tree.getroot()

    # Inject <chord /> into all of the marked "chord" notes manually
    #  so that it renders properly on alphaTab
    all_notes = root.findall('.//note')
    for i in chord_indices:
        if i >= len(all_notes):
            continue
        n = all_notes[i]
        n.insert(0, ET.Element('chord'))   

    return ET.ElementTree(root)
