from music21 import pitch, key, meter
from dataclasses import dataclass, field

OPEN_STRING_PITCHES = {
    1: pitch.Pitch('E4'), # 'e'
    2: pitch.Pitch('B3'), # 'B'
    3: pitch.Pitch('G3'), # 'G'
    4: pitch.Pitch('D3'), # 'D'
    5: pitch.Pitch('A2'), # 'A'
    6: pitch.Pitch('E2'), # 'E'
}

E_STANDARD_MIDI = {
    1: pitch.Pitch('E4').midi,
    2: pitch.Pitch('B3').midi,
    3: pitch.Pitch('G3').midi,
    4: pitch.Pitch('D3').midi,
    5: pitch.Pitch('A2').midi,
    6: pitch.Pitch('E2').midi,
}

MAX_FRET = 24
MAX_SPREAD = 5 # max fret spread in one chord
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
    time_signature: meter.TimeSignature = field(default_factory=lambda: meter.TimeSignature('4/4'))

@dataclass(frozen=True)
class StringFret:
    string: int = 6
    fret: int = 0