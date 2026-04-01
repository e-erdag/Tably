from music21 import (
    stream, 
    clef,
    converter,
    note, 
    pitch, 
    interval, 
    note, 
    articulations, 
)
import math
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

def add_staff_details(score: stream.Score):
    part = score.parts[0]

    first_measure = part.getElementsByClass(stream.Measure)[0]
    
    first_measure.remove(first_measure.getElementsByClass(clef.Clef)[0])
    first_measure.insert(0, clef.TabClef())
    
    first_measure.staffLines = 6
    
    # Keep the score in memory
    xml_string = score.write('musicxml').read_text()
    
    root = ET.fromstring(xml_string)
        
    for attributes in root.iter(f'attributes'):
        staff_details = attributes.find(f'staff-details')
        if staff_details is not None:
            for line, step, octave in E_STANDARD_GUITAR:
                st = ET.SubElement(staff_details, 'staff-tuning')
                st.set('line', str(line))
                ET.SubElement(st, 'tuning-step').text = step
                ET.SubElement(st, 'tuning-octave').text = octave
    
    tree = ET.ElementTree(root)
                
    return tree

def closest_string(n: note.Note):
    p = n.pitch
    
    best_string = 6
    best_semitone = 100
    
    for string, string_pitch in OPEN_STRING_PITCHES.items():
        i = interval.Interval(string_pitch, p)
        if i.semitones >= 0 and i.semitones < best_semitone:
            best_string = string
            best_semitone = i.semitones

    fret = math.floor(best_semitone + 0.5)

    return (best_string, fret)


def get_musicxml_tab(xml_path: Path | str):
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
    
    part = score.parts[0]
    
    # mark = score.flatten().getElementsByClass(tempo.MetronomeMark).first()       
    # bpm = mark.number if mark else 120
    # default_ts = meter.TimeSignature('4/4')
    # computed_ts = score.flatten().getElementsByClass(meter.TimeSignature).first() 
    
    # ts = computed_ts if computed_ts else default_ts
    
    # print(bpm, f"{ts.numerator}/{ts.denominator}")                        
    
    notes = part.flatten().notesAndRests
    for n in notes:
        if(isinstance(n, note.Note)):
            string, fret = closest_string(n)
            print(n.nameWithOctave, n.duration.type, string, fret)
            
            # This part makes alphatab render weirdly. I'll figure out why later
            n.articulations.append(articulations.StringIndication(string))
            n.articulations.append(articulations.FretIndication(fret))
            
    tree = add_staff_details(score)

    return tree
