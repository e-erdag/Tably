from music21 import note
import copy

from .constants import (
    OPEN_STRING_PITCHES,
    MAX_FRET,
    MAX_SPREAD,
    MAX_MIDI_PITCH,
    MIN_MIDI_PITCH,
    PITCH_SHIFT,
    StringFret,
)

def shift_pitches_to_range(midi_pitches: list[int]) -> tuple[list[int], int]:
    if not midi_pitches:
        return midi_pitches, 0
    
    best_shift = 0
    best_cost = float('inf')
    
    for shift in [-24, -12, 0, 12, 24]:
        cost = 0.0
        for p in midi_pitches:
            shifted_p = p + shift
            if shifted_p < MIN_MIDI_PITCH:
                cost += (MIN_MIDI_PITCH - shifted_p) * 10
            elif shifted_p > MAX_MIDI_PITCH:
                cost += (shifted_p - MAX_MIDI_PITCH) * 10
            else:
                lowest_fret = MAX_FRET + 1
                for open_pitch in OPEN_STRING_PITCHES.values():
                    fret = shifted_p - open_pitch.midi
                    if 0 <= fret <= MAX_FRET:
                        lowest_fret = min(lowest_fret, fret)
                if lowest_fret <= MAX_FRET:
                    cost += lowest_fret
        if cost <  best_cost:
            best_cost = cost
            best_shift = shift
            
    print("Best Shift:", best_shift)
    
    if best_shift == 0:
        return midi_pitches, 0
    return [p + best_shift for p in midi_pitches], best_shift
    
def get_frets(midi_pitch: int) -> list[StringFret]:
    string_frets = []
    for string, open_pitch in OPEN_STRING_PITCHES.items():
        fret = midi_pitch - open_pitch.midi
        if 0 <= fret <= MAX_FRET:
            string_frets.append(StringFret(string, fret))
    return string_frets


def get_closest_string_fret(midi_pitch: int) -> StringFret:
    """Fallback for out-of-range pitches. Clamps to nearest valid position."""
    candidates = get_frets(midi_pitch)
    if candidates:
        sf = candidates[0]
        return sf
    # Shift into range
    p = midi_pitch
    while p < MIN_MIDI_PITCH:
        p += 12
    while p > MAX_MIDI_PITCH:
        p -= 12
    candidates = get_frets(p)
    if candidates:
        sf = candidates[0]
        return sf
    # Last resort
    return StringFret(6, 0)


def note_cost(prev: StringFret, curr: StringFret) -> float:
    if prev.fret > 0 and curr.fret > 0:
        fret_dist = abs(prev.fret - curr.fret)
    else:
        fret_dist = 0
    # string_dist = abs(prev.string - curr.string)

    fret_cost = fret_dist * 4
        
    open = -8 if curr.fret == 0 else 0
    
    pos_cost = 1.2 ** curr.fret
    
    return fret_cost  + pos_cost + open

def chord_cost(assignment: list[tuple[note.Note, StringFret]], anchor_fret: int) -> float:
    # If two string-fret assignments are on the same string, this
    #  cannot be a valid chord
    strings = [sf.string for _, sf in assignment]
    if len(set(strings)) < len(strings):
        return float('inf')
    
    frets = [sf.fret for _, sf in assignment if sf.fret > 0]
    span = (max(frets) - min(frets)) if frets else 0

    if span > MAX_SPREAD:
        return float('inf')
    
    min_fret = min(frets) if frets else 0
    span_cost = span * max(2, 10 - min_fret)
    
    pos_cost = sum(sf.fret * 2 for _, sf in assignment)
    anchor_cost = 0
    for _, sf in assignment:
        if sf.fret > 0 and anchor_fret > 0:
            dist = abs(sf.fret - anchor_fret)
            if dist > MAX_SPREAD + 2:
                return float('inf')
            anchor_cost += dist * 5 
    
    # The farther away the hand is from the nut, the less open strings should 
    #  be counted as a bonus
    open_bonus = 0
    for _, sf in assignment:
        if sf.fret == 0:
            if anchor_fret <= 4:
                open_bonus += 8
            else:
                open_bonus += max(0, 8 - anchor_fret)
    
    return span_cost + pos_cost + anchor_cost - open_bonus

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
            
            for prev_sf in candidates[i - 1]:
                curr_cost = prev_costs[prev_sf] + note_cost(prev_sf, curr_sf)
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


def assign_chord_strings(chord_notes: list[note.Note], anchor_fret: int = 0):
    """ Assign one note per string if we encounter a chord. In practice, anchor_fret
        is retrieved by first passing the highest note in the chord to the 
        Viterbi algorithm to anchor the fret around the previous notes.
        Args:
            chord_notes: notes in the chord
            anchor_fret: fret position to bias toward        
        Returns: [(cloned_note, string, fret)]
    """
    # sort low pitch to high pitch
    sorted_notes = sorted(chord_notes, key=lambda n: n.pitch.midi)

    # If the chord is just an octave, simplify to the single note
    if len(sorted_notes) == 2:
        interval = abs(sorted_notes[1].pitch.midi - sorted_notes[0].pitch.midi)
        if interval == 12:
            # Here, we use the lower note since it works better with 
            #  the overall algorithm
            keep = sorted_notes[1]
            sf = get_closest_string_fret(keep.pitch.midi + PITCH_SHIFT)
            result = [(copy.deepcopy(keep), sf)]
            return result

    # build candidate strings for each note
    note_candidates: list[tuple[note.Note, list[StringFret]]] = []
    for n in sorted_notes:
        candidates: list[StringFret] = []
        for string_num, open_pitch in OPEN_STRING_PITCHES.items():
            fret = n.pitch.midi - open_pitch.midi + PITCH_SHIFT
            if 0 <= fret <= MAX_FRET:
                candidates.append(StringFret(string_num, int(fret)))
        if not candidates:
            candidates.append(get_closest_string_fret(n.pitch.midi))
        note_candidates.append((n, candidates))

    best_assignment: list[tuple[note.Note, StringFret]] | None = None
    best_score: float | None = None

    # pick a note, try putting it on a string, move to next note, 
    # if its impossible, go back and try another string
    def backtrack(idx: int, used_strings: set[int], current: list[tuple[note.Note, StringFret]]):
        nonlocal best_assignment, best_score

        if idx == len(note_candidates):
            frets = [sf.fret for _, sf in current if sf.fret > 0]
            span = (max(frets) - min(frets)) if frets else 0

            if span > MAX_SPREAD:
                return

            score = chord_cost(current, anchor_fret)

            if best_score is None or score < best_score:
                best_score = score
                best_assignment = current[:]
            return

        orig_note, candidates = note_candidates[idx]

        # Prefer keeping lower notes on lower-pitched strings
        candidates = sorted(candidates, key=lambda sf: (-sf.string, sf.fret))

        for sf in candidates:
            if sf.string in used_strings:
                continue

            current.append((orig_note, sf))
            used_strings.add(sf.string)

            backtrack(idx + 1, used_strings, current)

            used_strings.remove(sf.string)
            current.pop()

    backtrack(0, set(), [])

    if best_assignment is None:
        # fallback. assign by closest to anchor
        used_strings = set()
        fallback: list[tuple[note.Note, StringFret]] = []
        for orig_note, candidates in note_candidates:
            chosen = None
            for sf in sorted(candidates, key=lambda sf: (abs(sf.fret - anchor_fret), -sf.string)):
                if sf.string not in used_strings:
                    chosen = (orig_note, sf)
                    break
            if chosen is None:
                # raise ValueError(f"Could not assign playable string for chord note {orig_note.pitch}")
                continue
            used_strings.add(chosen[1].string)
            fallback.append(chosen)
        best_assignment = fallback

    if not best_assignment:
        highest_note = max(sorted_notes, key=lambda n: n.pitch.midi)
        sf = get_closest_string_fret(highest_note.pitch.midi)
        best_assignment = [(highest_note, sf)]


    # clone here once
    result: list[tuple[note.Note, StringFret]] = []
    for orig_note, sf in best_assignment:
        new_note = copy.deepcopy(orig_note)
        result.append((new_note, sf))

    return result