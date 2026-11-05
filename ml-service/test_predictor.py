
from PIL import Image

from app.predictor import predict_image


IMAGE_PATH = "dataset/test_predict/tes1.jpg"


image = Image.open(IMAGE_PATH)

result = predict_image(
    image,
    top_k=3,
)

print("\nPrediction Result")
print("=================")

print("Prediction:", result["prediction"])
print("Confidence:", result["confidence"])

print("\nTop Predictions:")

for item in result["top_predictions"]:
    print(
        f'{item["class"]}: '
        f'{item["confidence"] * 100:.2f}%'
    )
