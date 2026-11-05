
import os
import secrets

from io import BytesIO
from contextlib import asynccontextmanager

from dotenv import load_dotenv

from fastapi import (
    FastAPI,
    File,
    UploadFile,
    HTTPException,
    Header,
)

from PIL import (
    Image,
    ImageOps,
    UnidentifiedImageError,
)

from starlette.concurrency import run_in_threadpool

from app.predictor import predict_image


# =========================================================
# CONFIGURATION
# =========================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

load_dotenv(
    os.path.join(BASE_DIR, ".env")
)

ML_API_KEY = os.getenv("ML_API_KEY")

MAX_FILE_SIZE = 4 * 1024 * 1024

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

ALLOWED_IMAGE_FORMATS = {
    "JPEG",
    "PNG",
    "WEBP",
}

# Maximum image dimensions to reduce decompression-bomb risk.
MAX_IMAGE_PIXELS = 20_000_000


# =========================================================
# APPLICATION LIFESPAN
# =========================================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    if not ML_API_KEY or len(ML_API_KEY) < 32:
        raise RuntimeError(
            "ML_API_KEY is missing or too short."
        )

    print("WasteFlow ML Service started.")

    yield

    print("WasteFlow ML Service stopped.")


# =========================================================
# FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="WasteFlow ML API",
    description="Waste image classification service",
    version="1.0.0",
    lifespan=lifespan,
)


# =========================================================
# API KEY VALIDATION
# =========================================================

def verify_api_key(api_key: str | None):

    if (
        not api_key
        or not ML_API_KEY
        or not secrets.compare_digest(
            api_key,
            ML_API_KEY,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid API key.",
        )


# =========================================================
# IMAGE VALIDATION
# =========================================================

def validate_and_open_image(
    image_bytes: bytes,
    content_type: str,
) -> Image.Image:
    """
    Validate image content and return a normalized RGB image.

    Resizing is intentionally handled in predictor.py
    to keep preprocessing consistent with train.py.
    """

    try:
        # Open image from uploaded bytes.
        with Image.open(
            BytesIO(image_bytes)
        ) as original_image:

            # Validate actual image format.
            image_format = original_image.format

            if image_format not in ALLOWED_IMAGE_FORMATS:
                raise HTTPException(
                    status_code=400,
                    detail="Unsupported image format.",
                )

            # Check MIME type against actual image format.
            expected_content_type = {
                "JPEG": "image/jpeg",
                "PNG": "image/png",
                "WEBP": "image/webp",
            }

            if (
                expected_content_type.get(image_format)
                != content_type
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Image content does not match its MIME type.",
                )

            # Check image dimensions.
            width, height = original_image.size

            if width <= 0 or height <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid image dimensions.",
                )

            if width * height > MAX_IMAGE_PIXELS:
                raise HTTPException(
                    status_code=400,
                    detail="Image dimensions are too large.",
                )

            # Load image data before closing original file.
            original_image.load()

            # Correct image orientation based on EXIF metadata.
            image = ImageOps.exif_transpose(
                original_image
            )

            # Convert image to RGB.
            image = image.convert("RGB")

            return image

    except HTTPException:
        raise

    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid or corrupted image file.",
        )


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/health")
async def health_check():

    return {
        "success": True,
        "message": "WasteFlow ML API is running.",
    }


# =========================================================
# WASTE PREDICTION
# =========================================================

@app.post("/predict")
async def predict_waste(
    image: UploadFile = File(...),

    x_api_key: str | None = Header(
        default=None,
        alias="X-API-Key",
    ),
):
    # Validate API key.
    verify_api_key(x_api_key)

    # Validate declared MIME type.
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, and WebP are supported.",
        )

    try:
        # Read uploaded image with size limit.
        image_bytes = await image.read(
            MAX_FILE_SIZE + 1
        )

        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="Image file is empty.",
            )

        if len(image_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Image size exceeds 4 MB.",
            )

        # Validate image and normalize orientation/RGB.
        validated_image = validate_and_open_image(
            image_bytes,
            image.content_type,
        )

        # Run TensorFlow inference in a worker thread.
        result = await run_in_threadpool(
            predict_image,
            validated_image,
        )

        return {
            "success": True,
            "data": result,
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to process image.",
        )

    finally:
        await image.close()
