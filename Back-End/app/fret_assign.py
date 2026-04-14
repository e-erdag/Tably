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
    if max(midi_pitches) > MAX_MIDI_PITCH:
        return [p - 12 for p in midi_pitches], -12
    elif min(midi_pitches) < MIN_MIDI_PITCH:
        return [p + 12 for p in midi_pitches], 12
    return midi_pitches, 0

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

    fret_cost = fret_dist * 2 
        
    open = -8 if curr.fret == 0 else 0
    
    pos_cost_base = 1.2   
    pos_cost = pos_cost_base ** curr.fret
    
    return fret_cost + pos_cost + open

def chord_cost(assignment: list[tuple[note.Note, StringFret]], anchor_fret: int) -> tuple[float, float, float]:
    # If two string-fret assignments are on the same string, this
    #  cannot be a valid chord
    strings = [sf.string for _, sf in assignment]
    if len(set(strings)) < len(strings):
        return (float('inf'), float('inf'), float('inf'))
    
    frets = [sf.fret for _, sf in assignment if sf.fret > 0]
    span = (max(frets) - min(frets)) if frets else 0
    
    def rel_pos(f):
        if abs(f - anchor_fret) > 5 and f != 0 and anchor_fret != 0:
            return float('inf')
        else:
            return abs(f - anchor_fret)
    
    abs_post_cost = sum(1.2 ** sf.fret for _, sf in assignment)
    rel_pos_cost = sum(1.2 ** rel_pos(sf.fret) for _, sf in assignment)
    open_count = sum(8 for _, sf in assignment if sf.fret == 0)
    
    return (span, abs_post_cost * 2 + rel_pos_cost, -open_count)

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

    # build candidate strings for each note
    note_candidates: list[tuple[note.Note, list[StringFret]]] = []
    for n in sorted_notes:
        candidates: list[StringFret] = []
        for string_num, open_pitch in OPEN_STRING_PITCHES.items():
            fret = n.pitch.midi - open_pitch.midi + PITCH_SHIFT
            # if fret > MAX_FRET:
            #     fret -= 12
            if 0 <= fret <= MAX_FRET:
                candidates.append(StringFret(string_num, int(fret)))
        if not candidates:
            candidates.append(get_closest_string_fret(n.pitch.midi))
        note_candidates.append((n, candidates))

    best_assignment: list[tuple[note.Note, StringFret]] | None = None
    best_score: tuple[float, float, float] | None = None

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