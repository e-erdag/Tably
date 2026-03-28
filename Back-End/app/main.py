import asyncio
import importlib.util
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from .convert_mscz_to_XML import convert_mscz_to_musicxml_file

from music21 import converter, stream

ROOT_DIR = Path(__file__).resolve().parent.parent
import homr

from .homr_api import (
    ensure_homr_models_ready,
    IMAGE_EXTENSIONS,
    convert_image_to_musicxml,
    is_supported_image_extension,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

XML_EXTENSIONS = {".musicxml", ".xml"}
MSCZ_EXTENSIONS = {".mscz"}
ALLOWED_EXTENSIONS = IMAGE_EXTENSIONS | XML_EXTENSIONS | MSCZ_EXTENSIONS

app = FastAPI(
    title="Tably Conversion API",
    description="Accepts sheet music uploads and returns MusicXML.",
)

## TODO
# Update later to allow origin from whatever domain we register
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    status: str


def _validate_upload(file: UploadFile) -> str:
    # make sure the uploaded file has a supported extension.
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file must have a filename.")

    extension = Path(file.filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type {extension}. Please upload one of: "
                ", ".join(ALLOWED_EXTENSIONS)
            ),
        )

    return extension


def _read_existing_musicxml(input_path: str) -> tuple[str, bytes]:
    # return musicxml files as-is without converting them.
    with open(input_path, "rb") as musicxml_file:
        return input_path, musicxml_file.read()


async def _prepare_for_conversion(extension: str) -> None:
    # only image uploads need the homr models to be ready first.
    if is_supported_image_extension(extension):
        await ensure_homr_models_ready()


def _convert_upload_to_musicxml(input_path: str, extension: str) -> tuple[str, bytes]:
    # choose the correct conversion path based on the uploaded file type.
    if is_supported_image_extension(extension):
        return convert_image_to_musicxml(input_path)
    if extension in XML_EXTENSIONS:
        return _read_existing_musicxml(input_path)
    if extension in MSCZ_EXTENSIONS:
        return convert_mscz_to_musicxml_file(input_path)
    raise ValueError(f"Unsupported extension: {extension}")


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    # provide a simple endpoint to confirm the api is running.
    return HealthResponse(status="ok")


@app.post("/convert")
async def convert_file(file: UploadFile = File(...)) -> Response:
    # inspect the extension first so we know how to handle the upload.
    extension = _validate_upload(file)
    await _prepare_for_conversion(extension)

    with tempfile.TemporaryDirectory() as temp_dir:
        # store the incoming upload in a temporary folder for processing.
        input_path = os.path.join(temp_dir, f"upload{extension}")

        try:
            # write the uploaded file to disk so the converter can read it.
            with open(input_path, "wb") as destination:
                shutil.copyfileobj(file.file, destination)

            # run the conversion in a background thread to avoid blocking the api.
            output_path, musicxml_content = await asyncio.to_thread(
                _convert_upload_to_musicxml, input_path, extension
            )
        except subprocess.CalledProcessError as exc:
            logger.exception("Conversion command failed")
            raise HTTPException(status_code=500, detail=f"Conversion failed: {exc}") from exc
        except Exception as exc:
            logger.exception("MusicXML conversion failed")
            raise HTTPException(status_code=500, detail=f"MusicXML conversion failed: {exc}") from exc
        finally:
            # close the uploaded file handle no matter what happens.
            await file.close()

        # send the result back as a downloadable musicxml file.
        output_name = Path(file.filename).stem + ".musicxml"
        headers = {"Content-Disposition": f'attachment; filename="{output_name}"'}

        logger.info("Converted %s to %s", file.filename, output_path)
        return Response(
            content=musicxml_content,
            media_type="application/vnd.recordare.musicxml+xml",
            headers=headers,
        )
