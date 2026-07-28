import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import numpy as np

print("Initializing Pose Landmarker Task...")
try:
    base_options = python.BaseOptions(model_asset_path='pose_landmarker_full.task')
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        output_segmentation_masks=False
    )
    detector = vision.PoseLandmarker.create_from_options(options)
    print("Pose Landmarker initialized successfully!")
    
    # Create a dummy black image to test inference
    dummy_img = np.zeros((480, 640, 3), dtype=np.uint8)
    rgb_frame = cv2.cvtColor(dummy_img, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
    
    print("Running inference...")
    res = detector.detect(mp_image)
    print("Inference completed successfully! Results pose_landmarks:", res.pose_landmarks)
    
except Exception as e:
    import traceback
    traceback.print_exc()
