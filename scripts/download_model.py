import urllib.request
import os

model_url = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
dest_path = "pose_landmarker_full.task"

print(f"Downloading MediaPipe model from {model_url}...")
try:
    urllib.request.urlretrieve(model_url, dest_path)
    print(f"Downloaded successfully! Saved to {dest_path}")
    print("File size:", os.path.getsize(dest_path), "bytes")
except Exception as e:
    print("Error downloading model:", e)
