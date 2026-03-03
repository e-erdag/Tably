from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import os
import logging

MUSESCORE_PATH = "/Applications/MuseScore 4.app/Contents/MacOS/mscore"
#MUSESCORE_PATH = os.getenv("MUSESCORE_PATH", "mscore") TODO: make it work for deployment
app = FastAPI()

if not os.path.exists(MUSESCORE_PATH):
    raise RuntimeError("MuseScore CLI not found at specified path.")

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Allow requests from the frontend's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],

)

@app.post("/convert")
async def convert_mscz_to_musicxml(file: UploadFile):
    logging.info(f"Received file: {file.filename}")

    # ensure the uploaded file is an MSCZ file
    if not file.filename.endswith(".mscz"):
        logging.error("Invalid file type uploaded.")
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an MSCZ file.")

    # save the uploaded file temporarily
    temp_file_path = f"/tmp/{file.filename}"
    with open(temp_file_path, "wb") as temp_file:
        temp_file.write(await file.read())

    # define the output MusicXML file path
    output_file_path = temp_file_path.replace(".mscz", ".musicxml")

    # use MuseScore CLI to convert the file
    try:
        subprocess.run(
            [MUSESCORE_PATH, temp_file_path, "-o", output_file_path],
            check=True
        )       
        logging.info("Conversion successful.")
    except subprocess.CalledProcessError as e:
        logging.error(f"Conversion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")
    finally:
        # clean up the temporary input file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

    # check if the output file was created
    if not os.path.exists(output_file_path):
        logging.error("Output file not created.")
        raise HTTPException(status_code=500, detail="Conversion failed. Output file not created.")

    # read the output file and return its content
    with open(output_file_path, "rb") as output_file:
        content = output_file.read()

    # clean up the output file
    os.remove(output_file_path)

    logging.info("Returning converted file.")
    return {
        "filename": os.path.basename(output_file_path),
        "content": content.decode("latin1")  # Ensure binary data is safely encoded
    }