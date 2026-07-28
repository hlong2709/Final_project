import cv2
import numpy as np

# Create a sample video with bounding box and text
width, height = 640, 480
fps = 30
out_path = "uploads/test_annotated.mp4"

fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(out_path, fourcc, fps, (width, height))

for i in range(90): # 3 seconds
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    
    # Draw bounding box
    cv2.rectangle(frame, (100, 100), (300, 400), (0, 255, 0), 2)
    
    # Draw label background
    cv2.rectangle(frame, (100, 70), (300, 100), (0, 255, 0), -1)
    
    # Draw label text
    cv2.putText(frame, f"An | HAND RAISING", (105, 92), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
    
    out.write(frame)

out.release()
print("Test video created at:", out_path)
