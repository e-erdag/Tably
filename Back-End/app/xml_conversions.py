import os
import subprocess
from pathlib import Path
from .tab_convert import get_musicxml_tab
import xml.etree.ElementTree as ET

MUSESCORE_PATH = os.getenv("MUSESCORE_PATH", "/Applications/MuseScore 4.app/Contents/MacOS/mscore")
if not os.path.exists(MUSESCORE_PATH):
    MUSESCORE_PATH = 'musescore'
    
def convert_mscz_to_musicxml_file(mscz_path: str) -> tuple[str, bytes]:
    musicxml_path = str(Path(mscz_path).with_suffix(".musicxml"))
    
    subprocess.run([MUSESCORE_PATH, mscz_path, "-o", musicxml_path], check=True)

    if not os.path.exists(musicxml_path):
        raise FileNotFoundError("MuseScore finished without producing a MusicXML file.")

    musicxml_tab = get_musicxml_tab(musicxml_path)
    musicxml_tab.write(musicxml_path, encoding='UTF-8', xml_declaration=True)
    
    musicxml_tab.write('tree_output.musicxml', encoding='UTF-8', xml_declaration=True)

    with open(musicxml_path, "rb") as musicxml_file:
        return musicxml_path, musicxml_file.read()
    
def _read_existing_musicxml(musicxml_path: str) -> tuple[str, bytes]:
    musicxml_tab = get_musicxml_tab(musicxml_path)
    musicxml_tab.write(musicxml_path)
    
    musicxml_tab.write('tree_output.musicxml')
    
    # return musicxml files as-is without converting them.
    with open(musicxml_path, "rb") as musicxml_file:
        return musicxml_path, musicxml_file.read()
