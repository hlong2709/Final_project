import cv2
from ultralytics import YOLO
import mediapipe as mp
mp_pose = None
try:
    if hasattr(mp, 'solutions'):
        mp_pose = mp.solutions.pose
    else:
        import mediapipe.python.solutions.pose as tmp_pose
        mp_pose = tmp_pose
except Exception:
    mp_pose = None

from sqlalchemy.ext.asyncio import AsyncSession
from app.models import EngagementEvent
import json
import asyncio
import random

# Load models
model = YOLO('yolov8n.pt')

# Fallback Pose class if MediaPipe fails
class MockPose:
    def process(self, image):
        class MockResults:
            pose_landmarks = None
        return MockResults()

if mp_pose:
    pose = mp_pose.Pose(static_image_mode=False, min_detection_confidence=0.5)
else:
    print("Warning: MediaPipe solutions not found. Hand raising detection will be disabled.")
    pose = MockPose()

async def detect_hand_raising(frame):
    """
    Heuristic: Nếu cổ tay (Wrist) nằm cao hơn mũi (Nose),
    chúng ta coi đó là hành vi giơ tay.
    """
    if not mp_pose:
        return False
        
    results = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    if results.pose_landmarks:
        landmarks = results.pose_landmarks.landmark
        
        # Lấy tọa độ Y (0 là đỉnh trên cùng, 1 là đáy)
        nose_y = landmarks[mp_pose.PoseLandmark.NOSE].y
        left_wrist_y = landmarks[mp_pose.PoseLandmark.LEFT_WRIST].y
        right_wrist_y = landmarks[mp_pose.PoseLandmark.RIGHT_WRIST].y
        
        # Nếu cổ tay cao hơn mũi (Y của cổ tay nhỏ hơn Y của mũi)
        if left_wrist_y < nose_y or right_wrist_y < nose_y:
            return True
    return False

async def process_video(file_path: str, db: AsyncSession):
    cap = cv2.VideoCapture(file_path)
    
    frame_count = 0
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break
        
        # Only process every 30th frame (approx 1 per second) to save resources
        if frame_count % 30 == 0:
            # 1. Nhận diện người bằng YOLO
            results = model(frame)
            
            # 2. Áp dụng Heuristics bằng MediaPipe
            is_hand_raised = await detect_hand_raising(frame)
            
            for r in results:
                for box in r.boxes:
                    cls = int(box.cls[0])
                    conf = float(box.conf[0])
                    
                    if cls == 0: # person
                        event_type = "focus"
                        if is_hand_raised:
                            event_type = "hand_raising"
                        
                        # Lưu vào database
                        event = EngagementEvent(
                            session_id=1, # Giả lập Session ID 1 cho buổi thuyết trình
                            behavior_type=event_type,
                            confidence=conf,
                            metadata_json=json.dumps({"bbox": box.xyxy[0].tolist()})
                        )
                        db.add(event)
            
            # Lưu tất cả sự kiện của khung hình này vào database
            await db.commit()
            print(f"Saved events to database for frame {frame_count}")
            
            # Small sleep to simulate async processing if needed, 
            # though YOLO is synchronous here
            await asyncio.sleep(0.01)
            
        frame_count += 1
    
    cap.release()
    print(f"Finished processing {file_path}")
