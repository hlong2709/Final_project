import cv2
import numpy as np

width, height = 640, 480
fps = 30

codecs_to_test = ['avc1', 'H264', 'VP80', 'mp4v', 'XVID']

for c in codecs_to_test:
    try:
        out_path = f"uploads/test_{c}.mp4"
        fourcc = cv2.VideoWriter_fourcc(*c)
        out = cv2.VideoWriter(out_path, fourcc, fps, (width, height))
        if out.isOpened():
            print(f"Codec {c}: VideoWriter OPENED SUCCESSFULLY!")
            out.release()
        else:
            print(f"Codec {c}: VideoWriter FAILED to open.")
    except Exception as e:
        print(f"Codec {c}: Error {e}")
