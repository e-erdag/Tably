
import defusedxml 
defusedxml.defuse_stdlib()

from music21 import note
from music21 import corpus

s = corpus.parse('bach/bwv66.6')
# print(s.analyze('key'))

f = note.Note('F5')
print(f"{f.name}{f.octave}")

bflat = note.Note('b-5')
acc = bflat.pitch.accidental
assert acc is not None
print(f"{bflat.name[:-1]}{acc.name}", acc.alter)

bflat.transpose('m3', inPlace=True)
print(bflat)

print(s)