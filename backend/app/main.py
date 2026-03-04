from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.responses import Response
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
        
        ### TODO: Translate to guitar tab
        
        # Store file in memory so FastAPI can send it in the Response
        content = output_path.read_bytes() 
        
        score = converter.parse(output_path)
        
        # I used this before with FileResponse, since that can set the filename of the file response.
        # However, I wanted to use Response instead, because using FileResponse means that the file 
        #   has to persist in disk so FastAPI can send it at the end of this endpoint (i.e. We can't
        #   use a TemporaryDirectory, because it cleans any files that are made in the temp dir
        #   before FastAPI can send it's response).
        # So, I used Response instead, since you can just store the xml data in memory and just send
        #   the raw bytes as xml. 
        #
        # if score.metadata.title not in ['', None]:
        #     filename = score.metadata.title + '.musicxml'  
        # else:
        #     filename = (Path(file.filename).stem or 'output') + '.musicxml'
        
        return Response(
            content=content,
            status_code=200, 
            media_type="application/xml",
        )