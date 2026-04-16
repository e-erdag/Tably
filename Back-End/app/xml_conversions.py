import os
import subprocess
from pathlib import Path
from .tab_convert import get_musicxml_tab
import xml.etree.ElementTree as ET
from .config import settings
    
def convert_mscz_to_musicxml_file(mscz_path: str) -> tuple[str, bytes]:
    musicxml_path = str(Path(mscz_path).with_suffix(".musicxml")) 
    
    cmd = []
    if settings.musescore_wrapper:
        cmd.extend(settings.musescore_wrapper.split())
    cmd.extend([settings.musescore_path, mscz_path, "-o", musicxml_path])
    
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"Exit {result.returncode}\n"
            f"STDOUT: {result.stdout}\n"
            f"STDERR: {result.stderr}"
        )

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
