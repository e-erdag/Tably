from music21 import (
    stream,
    converter,
    note,
    meter,
    chord,
    expressions
)
import xml.etree.ElementTree as ET
from pathlib import Path

from .constants import ScoreInfo


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
        ks = score.analyze('key')
    
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


def collect_midi_pitches(old_measures, use_upper_staff_only) -> list[int]:
    """Collect MIDI pitches from all measures using recurse() to dig into voices."""
    midi_pitches = []
    for old_measure in old_measures:
        # Use recurse() to match the second pass in build_measure
        for ele in old_measure.recurse().notesAndRests:
            if not should_keep_element(ele, use_upper_staff_only):
                continue
            if isinstance(ele, note.Note):
                midi_pitches.append(ele.pitch.midi)
            elif isinstance(ele, chord.Chord):
                # get the midi pitch of the highest note, for now
                midi_pitches.append(ele.notes[-1].pitch.midi)
    return midi_pitches


def parse_score(xml_path: Path | str):
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