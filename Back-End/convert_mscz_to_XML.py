import os
import subprocess
from pathlib import Path

MUSESCORE_PATH = os.getenv("MUSESCORE_PATH", "/Applications/MuseScore 4.app/Contents/MacOS/mscore")


def convert_mscz_to_musicxml_file(input_path: str) -> tuple[str, bytes]:
    if not os.path.exists(MUSESCORE_PATH):
        raise FileNotFoundError(f"MuseScore CLI not found at {MUSESCORE_PATH}")

    output_path = str(Path(input_path).with_suffix(".musicxml"))
    subprocess.run([MUSESCORE_PATH, input_path, "-o", output_path], check=True)

    if not os.path.exists(output_path):
        raise FileNotFoundError("MuseScore finished without producing a MusicXML file.")

    with open(output_path, "rb") as output_file:
        return output_path, output_file.read()
