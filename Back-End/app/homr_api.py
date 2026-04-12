import asyncio
import logging
import os
from pathlib import Path

import onnxruntime as ort

from homr.main import (
    ProcessingConfig,
    XmlGeneratorArguments,
    download_weights,
    process_image,
)
from homr.title_detection import download_ocr_weights

from .xml_conversions import _read_existing_musicxml

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}

_models_ready = False
_models_lock = asyncio.Lock()


def is_supported_image_extension(extension: str) -> bool:
    # check whether the uploaded file should be handled by homr
    return extension.lower() in IMAGE_EXTENSIONS


def _should_use_gpu() -> bool:
    # use gpu inference when onnx runtime reports cuda support
    return "CUDAExecutionProvider" in ort.get_available_providers()


async def ensure_homr_models_ready() -> None:
    global _models_ready

    # skip setup if the models were already initialized earlier
    if _models_ready:
        return

    async with _models_lock:
        # check again inside the lock so setup only happens once
        if _models_ready:
            return

        use_gpu_inference = _should_use_gpu()
        logger.info("Initializing homr models. GPU inference enabled: %s", use_gpu_inference)
        await asyncio.to_thread(download_weights, use_gpu_inference)
        await asyncio.to_thread(download_ocr_weights)
        _models_ready = True
        logger.info("homr models are ready.")


def convert_image_to_musicxml(input_path: str) -> tuple[str, bytes]:
    # build the homr processing config for image based conversion
    use_gpu_inference = _should_use_gpu()
    config = ProcessingConfig(
        enable_debug=False,
        enable_cache=False,
        write_staff_positions=False,
        read_staff_positions=False,
        selected_staff=-1,
        use_gpu_inference=use_gpu_inference,
    )
    xml_args = XmlGeneratorArguments(False, None, None)

    # run homr on the saved image file.
    process_image(input_path, config, xml_args)

    # homr writes the output next to the input image as a musicxml file
    output_path = str(Path(input_path).with_suffix(".musicxml"))
    if not os.path.exists(output_path):
        raise FileNotFoundError("homr finished without producing a MusicXML file.")

    # Run the generated MusicXML through the existing tab converter
    # so image uploads return tablature like MSCZ uploads do
    return _read_existing_musicxml(output_path)
