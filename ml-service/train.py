
import json
import os

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input


# =========================================================
# CONFIGURATION
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

TRAIN_DIR = os.path.join(BASE_DIR, "dataset", "train")
VALIDATION_DIR = os.path.join(BASE_DIR, "dataset", "val")
TEST_DIR = os.path.join(BASE_DIR, "dataset", "test")

MODEL_DIR = os.path.join(BASE_DIR, "models")

MODEL_PATH = os.path.join(
    MODEL_DIR, "waste_classifier.keras"
)

CLASS_PATH = os.path.join(
    MODEL_DIR, "class_names.json"
)

IMAGE_SIZE = (224, 224)
BATCH_SIZE = 32

INITIAL_EPOCHS = 15
FINE_TUNE_EPOCHS = 10

SEED = 42

EXPECTED_CLASSES = ["organic", "paper", "plastic"]

AUTOTUNE = tf.data.AUTOTUNE


# =========================================================
# CREATE MODEL DIRECTORY
# =========================================================

os.makedirs(MODEL_DIR, exist_ok=True)

keras.utils.set_random_seed(SEED)


# =========================================================
# VALIDATE DATASET DIRECTORIES
# =========================================================

for directory in [TRAIN_DIR, VALIDATION_DIR, TEST_DIR]:
    if not os.path.isdir(directory):
        raise FileNotFoundError(
            f"Dataset directory not found: {directory}"
        )


# =========================================================
# LOAD DATASET
# =========================================================

def load_dataset(directory, shuffle):

    return keras.utils.image_dataset_from_directory(
        directory,
        image_size=IMAGE_SIZE,
        batch_size=BATCH_SIZE,
        label_mode="int",
        shuffle=shuffle,
        seed=SEED if shuffle else None,
        interpolation="bilinear",

        # Preserve aspect ratio and add padding.
        pad_to_aspect_ratio=True,
    )


print("\nLoading datasets...")

train_ds = load_dataset(
    TRAIN_DIR,
    shuffle=True,
)

validation_ds = load_dataset(
    VALIDATION_DIR,
    shuffle=False,
)

test_ds = load_dataset(
    TEST_DIR,
    shuffle=False,
)


# =========================================================
# VALIDATE CLASSES
# =========================================================

class_names = train_ds.class_names

if class_names != validation_ds.class_names:
    raise ValueError(
        "Training and validation classes do not match."
    )

if class_names != test_ds.class_names:
    raise ValueError(
        "Training and test classes do not match."
    )

if class_names != EXPECTED_CLASSES:
    raise ValueError(
        f"Expected classes {EXPECTED_CLASSES}, "
        f"but found {class_names}."
    )

num_classes = len(class_names)

print("\nDetected classes:", class_names)

print("\nDataset loaded successfully.")


# =========================================================
# SAVE CLASS NAMES
# =========================================================

with open(CLASS_PATH, "w", encoding="utf-8") as file:
    json.dump(class_names, file, indent=4)


# =========================================================
# DATA AUGMENTATION
# =========================================================

data_augmentation = keras.Sequential(
    [
        layers.RandomFlip("horizontal"),
        layers.RandomRotation(0.10),
        layers.RandomZoom(0.10),
        layers.RandomContrast(0.10),
    ],
    name="data_augmentation",
)


# =========================================================
# IMAGE PREPROCESSING
# =========================================================

def preprocess_dataset(images, labels, training=False):

    # Images are already resized to 224x224 with
    # aspect ratio preserved using padding.

    # Apply augmentation only to training data.
    # At this point pixel values are still in [0, 255].
    if training:
        images = data_augmentation(
            images,
            training=True,
        )

    # MobileNetV2 preprocessing: [0, 255] -> [-1, 1].
    images = preprocess_input(images)

    return images, labels


print("\nApplying image preprocessing...")

train_ds = (
    train_ds
    .map(
        lambda images, labels: preprocess_dataset(
            images,
            labels,
            training=True,
        ),
        num_parallel_calls=AUTOTUNE,
    )
    .prefetch(AUTOTUNE)
)

validation_ds = (
    validation_ds
    .map(
        lambda images, labels: preprocess_dataset(
            images,
            labels,
            training=False,
        ),
        num_parallel_calls=AUTOTUNE,
    )
    .prefetch(AUTOTUNE)
)

test_ds = (
    test_ds
    .map(
        lambda images, labels: preprocess_dataset(
            images,
            labels,
            training=False,
        ),
        num_parallel_calls=AUTOTUNE,
    )
    .prefetch(AUTOTUNE)
)


# =========================================================
# LOAD MOBILENETV2
# =========================================================

print("\nLoading MobileNetV2...")

base_model = MobileNetV2(
    input_shape=(224, 224, 3),
    include_top=False,
    weights="imagenet",
)

# Freeze pretrained layers initially.
base_model.trainable = False


# =========================================================
# BUILD CLASSIFICATION MODEL
# =========================================================

inputs = keras.Input(
    shape=(224, 224, 3),
)

x = base_model(
    inputs,
    training=False,
)

x = layers.GlobalAveragePooling2D()(x)

x = layers.Dropout(0.30)(x)

outputs = layers.Dense(
    num_classes,
    activation="softmax",
    name="predictions",
)(x)

model = keras.Model(
    inputs=inputs,
    outputs=outputs,
)


# =========================================================
# CALLBACKS
# =========================================================

callbacks = [
    keras.callbacks.EarlyStopping(
        monitor="val_loss",
        patience=5,
        restore_best_weights=True,
        verbose=1,
    ),

    keras.callbacks.ModelCheckpoint(
        MODEL_PATH,
        monitor="val_loss",
        save_best_only=True,
        verbose=1,
    ),
]


# =========================================================
# INITIAL TRAINING
# =========================================================

model.compile(
    optimizer=keras.optimizers.Adam(
        learning_rate=0.001,
    ),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)

print("\n====================================")
print("STARTING INITIAL TRAINING")
print("====================================")

initial_history = model.fit(
    train_ds,
    validation_data=validation_ds,
    epochs=INITIAL_EPOCHS,
    callbacks=callbacks,
)


# =========================================================
# FINE-TUNING
# =========================================================

print("\n====================================")
print("STARTING FINE-TUNING")
print("====================================")

base_model.trainable = True

# Unfreeze only the last 30 layers.
for layer in base_model.layers[:-30]:
    layer.trainable = False

# Keep BatchNormalization layers frozen.
for layer in base_model.layers:
    if isinstance(layer, layers.BatchNormalization):
        layer.trainable = False


model.compile(
    optimizer=keras.optimizers.Adam(
        learning_rate=0.00001,
    ),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)

fine_tune_history = model.fit(
    train_ds,
    validation_data=validation_ds,
    epochs=FINE_TUNE_EPOCHS,
    callbacks=callbacks,
)


# =========================================================
# FINAL TEST EVALUATION
# =========================================================

print("\n====================================")
print("FINAL TEST EVALUATION")
print("====================================")

# Load the best model saved by ModelCheckpoint.
best_model = keras.models.load_model(MODEL_PATH)

test_loss, test_accuracy = best_model.evaluate(
    test_ds,
    verbose=1,
)

print(f"\nTest Loss: {test_loss:.4f}")
print(f"Test Accuracy: {test_accuracy * 100:.2f}%")


# =========================================================
# CLASSIFICATION REPORT
# =========================================================

print("\n====================================")
print("CLASSIFICATION REPORT")
print("====================================")

y_true = np.concatenate([
    labels.numpy()
    for _, labels in test_ds
])

y_prob = best_model.predict(
    test_ds,
    verbose=1,
)

y_pred = np.argmax(y_prob, axis=1)

confusion_matrix = tf.math.confusion_matrix(
    y_true,
    y_pred,
    num_classes=num_classes,
).numpy()

print("\nConfusion Matrix:")
print(confusion_matrix)

print("\nPer-class Metrics:")

for index, class_name in enumerate(class_names):

    true_positive = confusion_matrix[index, index]

    false_positive = (
        confusion_matrix[:, index].sum() - true_positive
    )

    false_negative = (
        confusion_matrix[index, :].sum() - true_positive
    )

    precision = (
        true_positive / (true_positive + false_positive)
        if (true_positive + false_positive) > 0
        else 0.0
    )

    recall = (
        true_positive / (true_positive + false_negative)
        if (true_positive + false_negative) > 0
        else 0.0
    )

    f1_score = (
        2 * precision * recall / (precision + recall)
        if (precision + recall) > 0
        else 0.0
    )

    print(f"\n{class_name.upper()}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall:    {recall:.4f}")
    print(f"F1-Score:  {f1_score:.4f}")


# =========================================================
# SAVE FINAL MODEL
# =========================================================

best_model.save(MODEL_PATH)

print("\n====================================")
print("TRAINING COMPLETED")
print("====================================")

print("Model:", MODEL_PATH)
print("Classes:", class_names)
print(f"Test Accuracy: {test_accuracy * 100:.2f}%")
