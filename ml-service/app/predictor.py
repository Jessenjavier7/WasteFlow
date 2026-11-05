
import json
import os

import numpy as np
import tensorflow as tf

from PIL import Image, ImageOps
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input


# =========================================================
# CONFIGURATION
# =========================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "models",
    "waste_classifier.keras",
)

CLASS_PATH = os.path.join(
    BASE_DIR,
    "models",
    "class_names.json",
)

IMAGE_SIZE = (224, 224)

EXPECTED_CLASSES = ["organic", "paper", "plastic"]


# =========================================================
# LOAD MODEL
# =========================================================

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(
        f"Model file not found: {MODEL_PATH}. "
        "Please train the model first."
    )

if not os.path.exists(CLASS_PATH):
    raise FileNotFoundError(
        f"Class names file not found: {CLASS_PATH}."
    )


print("Loading WasteFlow classification model...")

model = tf.keras.models.load_model(
    MODEL_PATH,
    compile=False,
)

with open(CLASS_PATH, "r", encoding="utf-8") as file:
    class_names = json.load(file)


# Validate class names.
if class_names != EXPECTED_CLASSES:
    raise ValueError(
        f"Unexpected classes: {class_names}. "
        f"Expected: {EXPECTED_CLASSES}."
    )


# Validate model output.
if model.output_shape[-1] != len(class_names):
    raise ValueError(
        "Model output count does not match class names."
    )


print("WasteFlow model loaded successfully.")
print("Available classes:", class_names)


# =========================================================
# IMAGE PREPROCESSING
# =========================================================

def preprocess_image(image: Image.Image) -> np.ndarray:
    """
    Preprocess an image using the MobileNetV2 pipeline.

    Steps:
        1. Correct EXIF orientation.
        2. Convert image to RGB.
        3. Convert PIL image to NumPy array.
        4. Resize to 224x224 while preserving aspect ratio.
        5. Add black padding.
        6. Apply MobileNetV2 preprocessing.
        7. Add batch dimension.

    Returns:
        np.ndarray: Preprocessed image with shape (1, 224, 224, 3).
    """

    if not isinstance(image, Image.Image):
        raise TypeError("Input must be a PIL Image.")

    # Correct image orientation using EXIF metadata.
    image = ImageOps.exif_transpose(image)

    # Convert to RGB.
    image = image.convert("RGB")

    # Convert PIL image to NumPy array.
    image_array = np.asarray(
        image,
        dtype=np.float32,
    )

    # Preserve aspect ratio and add black padding.
    image_array = tf.image.resize_with_pad(
        image_array,
        target_height=IMAGE_SIZE[0],
        target_width=IMAGE_SIZE[1],
        method="bilinear",
        antialias=True,
    )

    image_array = image_array.numpy()

    # MobileNetV2 preprocessing: [0, 255] -> [-1, 1].
    image_array = preprocess_input(image_array)

    # Add batch dimension.
    image_array = np.expand_dims(
        image_array,
        axis=0,
    )

    return image_array.astype(np.float32)


# =========================================================
# IMAGE PREDICTION
# =========================================================

def predict_image(
    image: Image.Image,
    top_k: int = 3,
) -> dict:
    """
    Predict waste category from an image.

    Returns:
        {
            "prediction": "plastic",
            "confidence": 0.9521,
            "top_predictions": [
                {
                    "class": "plastic",
                    "confidence": 0.9521
                }
            ]
        }
    """

    if not isinstance(image, Image.Image):
        raise TypeError(
            "Input must be a PIL Image."
        )

    if not isinstance(top_k, int) or isinstance(top_k, bool):
        raise TypeError(
            "top_k must be an integer."
        )

    if top_k < 1:
        raise ValueError(
            "top_k must be at least 1."
        )

    top_k = min(
        top_k,
        len(class_names),
    )

    # Preprocess image.
    image_array = preprocess_image(image)

    # Run model inference.
    # Direct model invocation avoids model.predict overhead.
    predictions = model(
        image_array,
        training=False,
    ).numpy()[0]

    # Validate prediction output.
    if not np.all(np.isfinite(predictions)):
        raise RuntimeError(
            "Model returned invalid prediction values."
        )

    # Get highest prediction scores.
    top_indices = np.argsort(
        predictions
    )[::-1][:top_k]

    top_predictions = []

    for index in top_indices:
        top_predictions.append({
            "class": class_names[int(index)],
            "confidence": round(
                float(predictions[index]),
                4,
            ),
        })

    best_prediction = top_predictions[0]

    return {
        "prediction": best_prediction["class"],
        "confidence": best_prediction["confidence"],
        "top_predictions": top_predictions,
    }
