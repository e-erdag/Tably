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
import math
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

def closest_string(n: note.Note | pitch.Pitch):
    if isinstance(n, note.Note):
        p = n.pitch
    elif isinstance(n, pitch.Pitch):
        p = n
    
    best_string = 6
    best_semitone = 100
    
    for string, string_pitch in OPEN_STRING_PITCHES.items():
        i = interval.Interval(string_pitch, p)
        if i.semitones >= 0 and i.semitones < best_semitone:
            best_string = string
            best_semitone = i.semitones

    fret = math.floor(best_semitone + 0.5)

    return (best_string, fret)



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
    
    return score, score_info

# Breaks down with more complex songs. Will probably need to update
# to create a fresh score instead of updating the old one
def get_musicxml_tab(xml_path: Path | str):
    score, score_info = parse_score(xml_path)
    old_part = score.parts[0]
    
    tab = stream.Score()
    tab.insert(0, metadata.Metadata())
    tab.metadata.title = score_info.title
    tab.metadata.composer = score_info.composer
    
    part = stream.Part()
    part.insert(0, instrument.Guitar())
    
    old_measures: list[stream.Measure] = list(old_part.getElementsByClass('Measure'))

    # The indices of the notes in a chord (besides the first one)
    chord_indices: list[int] = []
    note_index = 0
    for i, old_measure in enumerate(old_measures):
        measure = stream.Measure(number=i+1)
        if i+1 == 1:
            measure.insert(0, score_info.time_signature)
            measure.insert(0, score_info.key_signature)

        # Insert the tempo marking (bpm) into the measure
        mm = old_measure.getElementsByClass('MetronomeMark').first()
        if mm:
            quarter_bpm = mm.getQuarterBPM()
            new_mm = tempo.MetronomeMark(number=quarter_bpm)
            measure.insert(0, new_mm)

        for ele in old_measure.recurse().notesAndRests:
            if isinstance(ele, chord.Chord):
                for n_i, n in enumerate(ele.notes):
                    string, fret = closest_string(n)
                    n.articulations.append(articulations.StringIndication(string))
                    n.articulations.append(articulations.FretIndication(fret))            
                
                    # Preserve the offset between notes in a chord
                    # For example, if offset = 0 for the first note, offset = 0
                    #  for every other note in the chord.
                    # This helps alphatab render the chord properly 
                    measure.insert(ele.offset, n)

                    if n_i > 0:
                        chord_indices.append(note_index)

                    note_index += 1

            elif isinstance(ele, note.Note):
                string, fret = closest_string(ele)
                
                ele.articulations.append(articulations.StringIndication(string))
                ele.articulations.append(articulations.FretIndication(fret))

                measure.append(ele)

                note_index += 1
            elif isinstance(ele, note.Rest):
                measure.append(ele)

                note_index += 1
    
        part.append(measure)
    
    tab.append(part)
            
    tree = add_staff_details(tab)

    root: ET.Element = tree.getroot()

    # Inject <chord /> into all of the marked "chord" notes manually
    #  so that it renders properly on alphaTab
    all_notes = root.findall('.//note')
    for i in chord_indices:
        n = all_notes[i]
        n.insert(0, ET.Element('chord'))   

    return ET.ElementTree(root)
