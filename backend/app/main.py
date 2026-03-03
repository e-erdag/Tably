from fastapi import FastAPI, UploadFile, HTTPException
from tempfile import TemporaryDirectory
import subprocess
from pathlib import Path
from music21 import converter
from itertools import islice

app = FastAPI()

ALLOWED_FILE_TYPES = (".mscz", ".musicxml", ".xml")

@app.post('/upload')
async def upload_musescore_file(file: UploadFile):
    if file.filename is None:
        raise HTTPException(400, 'File must have a filename')
    
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_FILE_TYPES:
        raise HTTPException(400, f'Invalid file type \'{ext[1:]}\'.')

    with TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        input_path = tmp_path / file.filename
        output_path = tmp_path / 'output.musicxml'
        
        input_path.write_bytes(await file.read())
                
        if ext != '.musicxml':
            res = subprocess.run(
                ['musescore', '-o', str(output_path), str(input_path)],
                capture_output=True
            )
            
            if res.returncode != 0:
                raise HTTPException(400, f'Invalid file')
        else:
            output_path = input_path
        
        score = converter.parse(output_path)
        # for note in score.flatten().notes:
        #     print(note.fullName)
        
        # print(score.beat)
        
        # chords = score.chordify()
        # for chord in islice(chords.flatten().notesAndRests, 10):
        #     print(chord.fullName)
        
        # key = score.analyze('key')
        # print(key)
        return {
            'song_title': score.metadata.title, 
            'composer': score.metadata.composer,
        }