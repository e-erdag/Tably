from music21 import note, pitch, articulations
import copy

from .constants import (
    OPEN_STRING_PITCHES,
    E_STANDARD_MIDI,
    MAX_FRET,
    MAX_SPREAD,
    MAX_MIDI_PITCH,
    MIN_MIDI_PITCH,
    PITCH_SHIFT,
    StringFret,
)


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
    # for i, c in enumerate(candidates):
    #     if not c:
    #         p = midi_pitches[i]
    #         while p < MIN_MIDI_PITCH:
    #             p += 12 
    #         while p > MAX_MIDI_PITCH:
    #             p -= 12 
    #         midi_pitches[i] = p
            
    #         candidates[i] = get_frets(p)
            
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


def shift_pitches_to_range(midi_pitches: list[int]) -> list[int]:
    if not midi_pitches:
        return midi_pitches
    if max(midi_pitches) > MAX_MIDI_PITCH:
        return [p - 12 for p in midi_pitches]
    elif min(midi_pitches) < MIN_MIDI_PITCH:
        return [p + 12 for p in midi_pitches]
    return midi_pitches


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
            fret = n.pitch.midi - open_pitch.midi
            if 0 <= fret <= MAX_FRET:
                candidates.append((string_num, int(fret)))
        if not candidates:
            candidates.append(get_closest_string_fret(n.pitch.midi))
        note_candidates.append((n, candidates))

    best_assignment = None
    best_score = None

    # pick a note, try putting it on a string, move to next note, 
    # if its impossible, go back and try another string
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