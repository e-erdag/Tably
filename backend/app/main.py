# music21 docs recommend to import this for security reasons. It must
#   be imported *before* music21
import defusedxml 
defusedxml.defuse_stdlib() # type: ignore

from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.responses import Response
from tempfile import TemporaryDirectory
import subprocess
from pathlib import Path
from music21 import converter, stream
import math

from .conversions import add_tab

app = FastAPI()

ALLOWED_FILE_TYPES = (".mscz", ".musicxml", ".xml")

@app.post('/upload')
async def upload_musescore_file(file: UploadFile):
    if file.filename is None:
        raise HTTPException(400, 'File must have a filename')
    
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_FILE_TYPES:
        raise HTTPException(400, f'Invalid file type \'{ext[1:]}\'.')

    # Use temp dir for easy cleanup. Don't need  to store musicxml files for now
    with TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        input_path = tmp_path / file.filename
        output_path = tmp_path / 'output.musicxml'
        
        # Write given input file to disk so musescore can read it, if needed
        input_path.write_bytes(await file.read())

        if ext == '.mscz':
            res = subprocess.run(
                ['musescore', '-o', str(output_path), str(input_path)],
                capture_output=True
            )
            
            # I'm just assuming that if this process fails, it's somehow an invalid file
            if res.returncode != 0:
                raise HTTPException(400, f'Invalid file')
        else:
            output_path = input_path
        
        score = converter.parse(output_path)   
        if(isinstance(score, stream.Score)):  
            ### TODO: Make this trash ass function a little better
            score = add_tab(score)
        
        title = score.metadata.title if score.metadata.title is not None else Path(file.filename).stem
        
        altered_path = tmp_path / f'{title}.musicxml'
        
        # Just for testing to inspect the file in vs code/musescore
        score.write('musicxml', altered_path)
        
        score.write('musicxml', f'{title}.musicxml')
        
        content = altered_path.read_bytes()
                
        return Response(
            content,
            status_code=200,
            media_type='application/xml'
        )