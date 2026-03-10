from music21 import meter, note, pitch, interval, note, stream, articulations, tempo
import math

def ascii_note(note: note.Note, ts: meter.TimeSignature):
    """ Some shitty function I made to convert an Ode to Joy music sheet to tab. 
        Every note is above E4 (open high e string pitch), so that's 
        what it's expecting
    """

    chars_per_beat = 4
    chars_per_measure = ts.numerator * chars_per_beat

    e = pitch.Pitch('E4') # open high e string
    p = pitch.Pitch(note.nameWithOctave)
    fret = interval.Interval(e, p).semitones
    
    padding = '-' * (int(note.duration.quarterLength * chars_per_beat) - 1)
    
    return f'{fret}{padding}'

OPEN_STRING_PITCHES = {
    1: pitch.Pitch('E4'), # 'e'
    2: pitch.Pitch('B3'), # 'B'
    3: pitch.Pitch('G3'), # 'G'
    4: pitch.Pitch('D3'), # 'D'
    5: pitch.Pitch('A2'), # 'A'
    6: pitch.Pitch('E2'), # 'E'
}

def closest_string(n: note.Note):
    p = n.pitch
    
    closest_string = 6
    closest_semitone = 100
    
    for string, string_pitch in OPEN_STRING_PITCHES.items():
        i = interval.Interval(string_pitch, p)
        if i.semitones >= 0 and i.semitones < closest_semitone:
            closest_string = string
            closest_semitone = i.semitones

    fret = math.floor(closest_semitone + 0.5)

    return (closest_string, fret)

def add_tab(score: stream.Score):
    part = score.parts[0]
    
    mark = score.flatten().getElementsByClass(tempo.MetronomeMark).first()       
    bpm = mark.number if mark else 120
    default_ts = meter.TimeSignature('4/4')
    computed_ts = score.flatten().getElementsByClass(meter.TimeSignature).first() 
    
    ts = computed_ts if computed_ts else default_ts
    
    print(bpm, f"{ts.numerator}/{ts.denominator}")                
    
    notes = part.flatten().notesAndRests
    for n in notes:
        if(isinstance(n, note.Note)):
            string, fret = closest_string(n)
            print(n.nameWithOctave, n.duration.type, string, fret)
            
            n.articulations.append(articulations.StringIndication(string))
            n.articulations.append(articulations.FretIndication(fret))
    
    return score
