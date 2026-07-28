import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from ultralytics import YOLO

model = YOLO('yolov8n.pt')

base_options = python.BaseOptions(model_asset_path='pose_landmarker_full.task')
options = vision.PoseLandmarkerOptions(
    base_options=base_options,
    output_segmentation_masks=False
)
pose_detector = vision.PoseLandmarker.create_from_options(options)

video_path = "test prj.mp4"
cap = cv2.VideoCapture(video_path)

fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
duration = total_frames / fps

print(f"Video: {video_path} | FPS: {fps} | Total Frames: {total_frames} | Duration: {duration:.2f}s")

frame_idx = 0
hand_raise_clusters = []
current_cluster = []

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
    
    sec = frame_idx / fps
    sec_str = f"{int(sec)//60:02d}:{int(sec)%60:02d}"

    if frame_idx % 3 == 0:
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        res = pose_detector.detect(mp_image)
        
        raised_in_frame = False
        if res.pose_landmarks:
            for p_idx, lms in enumerate(res.pose_landmarks):
                nose = lms[0]
                left_ear = lms[7]
                right_ear = lms[8]
                left_shoulder = lms[11]
                right_shoulder = lms[12]
                left_elbow = lms[13]
                right_elbow = lms[14]
                left_wrist = lms[15]
                right_wrist = lms[16]
                
                avg_shoulder_y = (left_shoulder.y + right_shoulder.y) / 2.0
                
                # Check all hand raise gesture indicators
                is_left_up = (left_wrist.y < avg_shoulder_y) or (left_elbow.y < left_shoulder.y)
                is_right_up = (right_wrist.y < avg_shoulder_y) or (right_elbow.y < right_shoulder.y)

                if is_left_up or is_right_up:
                    raised_in_frame = True
                    print(f"Frame {frame_idx} ({sec_str}s) - Pose #{p_idx}: HAND RAISED! (LWristY: {left_wrist.y:.3f}, RWristY: {right_wrist.y:.3f}, ShoulderY: {avg_shoulder_y:.3f})")

        if raised_in_frame:
            if not current_cluster:
                current_cluster = [sec_str]
        else:
            if current_cluster:
                hand_raise_clusters.append((current_cluster[0], sec_str))
                current_cluster = []

    frame_idx += 1

if current_cluster:
    hand_raise_clusters.append((current_cluster[0], sec_str))

cap.release()
print(f"\nTotal distinct Hand Raise Clusters detected: {len(hand_raise_clusters)}")
for idx, (start_t, end_t) in enumerate(hand_raise_clusters):
    print(f"Hand Raise #{idx + 1}: from {start_t} to {end_t}")
