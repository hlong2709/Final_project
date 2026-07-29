# ADCP — Swinburne AI Active Learning Analytics

An AI-powered system for analyzing student engagement ("active learning") in classroom videos. The backend uses **FastAPI**, processing lecture videos with **YOLOv8** (person detection) and **MediaPipe Pose Landmarker** (posture/gesture recognition) to automatically log behaviors: focused (`focus`), hand raising (`hand_raising`), group discussion (`group_discussion`), and distracted (`distracted`). Results are stored in SQLite and displayed on a web dashboard (HTML/CSS/JS + Chart.js).

> This is a project for the **Advanced Computer Programming (TEC004)** course — the frontend directory is `DU_AN_CUOI_KI_ADVANCED_COMPUTER_PROGRAMMING/`.

---

## Table of Contents

- [1. Project Architecture](#1-project-architecture)
- [2. System Requirements](#2-system-requirements)
- [3. Installation](#3-installation)
- [4. Dependencies](#4-dependencies)
- [5. Running the Application](#5-running-the-application)
- [6. Sample Usage](#6-sample-usage)
- [7. Utility Scripts](#7-utility-scripts)
- [8. Directory Structure](#8-directory-structure)

---

## 1. Project Architecture

```
Lecture video (.mp4)
        │  upload
        ▼
  FastAPI (/api/v1/video/upload)
        │  background task
        ▼
  app/ai/detector.py
   ├─ YOLOv8 (yolov8n.pt)          → detects people in each frame
   ├─ MediaPipe Pose Landmarker    → analyzes body joints (arms, shoulders, head)
   └─ Face matching via color histogram (app/ai/faces/*.jpg)
        │  writes EngagementEvent
        ▼
   SQLite (adcp.db) via SQLAlchemy (async) + aiosqlite
        │
        ▼
  Statistics API (/api/v1/dashboard/...)
        │
        ▼
  Web dashboard (Swinburne_Active_Learning_UI) — Chart.js, displays scores,
  the annotated video, and a real-time behavior log
```

**Main components:**

| Component | File | Role |
|---|---|---|
| Application entry point | `app/main.py` | Initializes FastAPI, CORS, mounts the static UI, creates DB tables on startup |
| Database connection | `app/database.py` | Async SQLAlchemy engine, reads `DATABASE_URL` from `.env` |
| DB schema | `app/models.py` | `Student`, `ClassSession`, `EngagementEvent`, `SessionReport` |
| Video upload API | `app/api/endpoints/video.py` | Receives the video file, creates a `ClassSession`, runs AI processing as a background task |
| Dashboard API | `app/api/endpoints/dashboard.py` | Session list, statistics, timeline, behavior logs, bounding boxes, student progress |
| AI core | `app/ai/detector.py` | Video processing loop: YOLO + Pose + event logging + exporting the annotated video |
| Scoring | `app/ai/analytics.py` | Active Learning Score calculation formula |
| Reporting | `app/services/reporting.py` | Generates a summary report per session |
| Frontend | `DU_AN_CUOI_KI_ADVANCED_COMPUTER_PROGRAMMING/Swinburne_Active_Learning_UI/` | Static dashboard (HTML/CSS/JS), calls the API via the relative path `/api/v1` |

---

## 2. System Requirements

- **Operating System:** Windows, macOS, or Linux (tested with the headless OpenCV build — no GUI required).
- **Python:** **Python 3.10 – 3.12** is recommended.
  > ⚠️ The bundled bytecode cache (`__pycache__`) was compiled with **Python 3.14**, but `mediapipe` does not yet fully support the newest Python releases on every platform. If you run into installation errors for `mediapipe`/`ultralytics`, use Python 3.10–3.12 to ensure compatibility.
- **RAM:** at least 8GB (16GB recommended) — running YOLO and MediaPipe together on video is fairly demanding.
- **Disk space:** at least 2GB free (the YOLO model is ~6.3MB, the Pose Landmarker model is ~9.4MB, plus space for uploaded/annotated videos).
- **GPU:** not required (the code runs CPU-only via `ultralytics`/`mediapipe`); a CUDA GPU can speed up video processing if you install GPU-enabled `torch`/`onnxruntime` builds (not included in the default `requirements.txt`).
- **Web browser:** a recent version of Chrome/Edge/Firefox to view the dashboard.
- **Internet connection:** required for the initial install (downloading Python packages, plus the frontend's CDN-hosted assets: Google Fonts, FontAwesome, Chart.js).

---

## 3. Installation

### Step 1 — Extract / clone the source code

```bash
unzip ADCP.zip
cd ADCP
```

### Step 2 — Create a Python virtual environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3 — Install dependencies

```bash
pip install -r requirements.txt
```

### Step 4 — Verify the AI model files are present

The project already ships with the two required models in the project root:

- `yolov8n.pt` — the YOLOv8 nano model used for person detection.
- `pose_landmarker_full.task` — the MediaPipe Pose Landmarker model.

If either is missing (e.g., when cloning from Git without large binary files), re-download `pose_landmarker_full.task` using the provided script:

```bash
python scripts/download_model.py
```

`yolov8n.pt` will be automatically downloaded by `ultralytics` on first run if it isn't found in the project root.

### Step 5 (optional) — Configure environment variables

By default the system uses SQLite at `./adcp.db`. You can override this with a `.env` file in the project root:

```env
DATABASE_URL=sqlite+aiosqlite:///./adcp.db
```

### Step 6 — Seed sample student data (recommended)

```bash
python seed_team.py
```

This clears any existing student/event data and recreates 4 sample students used for face-matching (`app/ai/faces/`).

---

## 4. Dependencies

The full list from `requirements.txt`:

| Library | Role |
|---|---|
| `fastapi` | Backend REST API framework |
| `uvicorn` | ASGI server used to run FastAPI |
| `sqlalchemy` | ORM, database operations (async mode) |
| `pydantic-settings` | Configuration/settings management |
| `python-multipart` | Handles form-data / file uploads |
| `opencv-python-headless` | Reads/writes video, draws bounding boxes (no GUI required) |
| `ultralytics` | YOLOv8 — person detection in each frame |
| `mediapipe` | Pose Landmarker — posture/joint analysis |
| `pandas` | Tabular data processing (used by analysis/reporting scripts) |
| `numpy` | Numerical/array computation |
| `jinja2` | Template engine (used internally by FastAPI/Starlette when rendering HTML) |
| `python-dotenv` | Reads the `.env` file |
| `aiosqlite` | Async SQLite driver for SQLAlchemy |

**Frontend** requires no additional installation — the JS libraries (Chart.js, FontAwesome) are loaded directly via CDN in `index.html`, and the entire UI is mounted by FastAPI as static files (no Node.js/npm/build step needed).

---

## 5. Running the Application

### 5.1. Start the backend server (required)

From the project root `ADCP/` (with the virtual environment activated):

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- `--reload`: automatically reloads on code changes (development use only).
- On startup, the app automatically creates the tables in `adcp.db` if they don't already exist (`Base.metadata.create_all`).

### 5.2. Access the application

| URL | Content |
|---|---|
| `http://localhost:8000/` | API welcome message |
| `http://localhost:8000/ui` | **Main dashboard** (web UI) |
| `http://localhost:8000/docs` | Swagger UI — interactive API documentation (auto-generated by FastAPI) |
| `http://localhost:8000/uploads/<filename>` | Original video / AI-annotated video |

### 5.3. Video processing workflow

1. Open `http://localhost:8000/ui` and go to the **Video Analysis** section.
2. Upload a lecture video (`.mp4`).
3. The backend saves the file to the `uploads/` folder, creates a new `ClassSession` record, and runs `process_video()` (`app/ai/detector.py`) as a **background task**:
   - Reads the video frame by frame with OpenCV.
   - Processes every 3rd frame (~10 FPS sampling) with YOLOv8 for person detection and MediaPipe Pose for posture analysis.
   - Matches each detected person to a student in the database (via reference face images in `app/ai/faces/`, or a left/right position fallback rule).
   - Logs behaviors (`focus` / `hand_raising` / `distracted`) into the `engagement_events` table.
   - Draws bounding boxes and behavior labels on each frame, exporting the annotated video to `uploads/annotated_session_<id>.mp4`.
4. The dashboard updates automatically: Active Learning score, timeline chart, real-time behavior log, and the annotated video is available for playback.

> ⏱️ Video processing runs in the background, so the upload request returns immediately; processing time depends on video length and machine specs (noticeably slower without a GPU).

---

## 6. Sample Usage

### 6.1. Via the web interface (recommended)

```bash
# 1) Start the server
uvicorn app.main:app --reload

# 2) Open your browser
http://localhost:8000/ui

# 3) On the Dashboard: select a course -> Video Analysis -> Upload video -> choose course/lecturer -> Confirm
```

Once processing is complete, return to the **Dashboard** and select the new session to view:
- % of time spent focused, number of hand raises, group discussion status.
- Top Active Students leaderboard.
- The AI-annotated video with per-student bounding boxes and behavior labels.

### 6.2. Via the API directly (curl)

**Upload a video and start analysis:**

```bash
curl -X POST "http://localhost:8000/api/v1/video/upload" \
  -F "file=@test prj.mp4" \
  -F "course_name=TEC004 - Advanced Computer Programming"
```

Sample response:

```json
{
  "message": "Video uploaded successfully and processing started",
  "session_id": 1,
  "session_name": "TEC004 - Advanced Computer Programming (test prj)",
  "filename": "test prj.mp4"
}
```

**Get the list of sessions:**

```bash
curl "http://localhost:8000/api/v1/dashboard/sessions"
```

**Get overall statistics for a session:**

```bash
curl "http://localhost:8000/api/v1/dashboard/session/1/stats"
```

**Get per-student scores/status for a session:**

```bash
curl "http://localhost:8000/api/v1/dashboard/session/1/students"
```

**Get the most recent behavior log entries (latest 20):**

```bash
curl "http://localhost:8000/api/v1/dashboard/session/1/logs"
```

**Delete a session (and its associated annotated video):**

```bash
curl -X DELETE "http://localhost:8000/api/v1/dashboard/session/1"
```

All endpoints can be tried directly, with full schemas, via Swagger UI at `http://localhost:8000/docs`.

### 6.3. Generate dummy data to test the dashboard (without processing a real video)

```bash
python scripts/generate_dummy_data.py
```

This script creates 1 session, 10 students, and 50 random events — useful for testing the dashboard UI without waiting for actual AI video processing.

---

## 7. Utility Scripts

Standalone scripts in the project root and in `scripts/` — run with `python <filename>.py` from the project root `ADCP/` (with the venv activated):

| Script | Function |
|---|---|
| `seed_team.py` | Clears and recreates the 4 sample team members (used for face matching) |
| `clear_old_sessions.py` | Deletes all existing sessions and events from the DB (cleans up test data) |
| `update_sessions.py` | Bulk-renames existing sessions, prefixing them with a course code |
| `inspect_video.py` | Debug tool: runs the Pose Landmarker on `test prj.mp4` and logs the detected hand-raise clusters |
| `scripts/download_model.py` | Re-downloads the `pose_landmarker_full.task` model from MediaPipe |
| `scripts/generate_dummy_data.py` | Generates fake data (sessions/students/events) to test the dashboard |
| `scripts/test_codecs.py` | Checks which video codecs (`avc1`, `H264`, `VP80`, `mp4v`, `XVID`) are available via OpenCV on the current machine |
| `scripts/test_tasks_api.py` | Verifies that the MediaPipe Pose Landmarker initializes and runs inference successfully |
| `scripts/test_writer.py` | Verifies that `cv2.VideoWriter` can write a sample video with a bounding box/label |

> Note: `app/main.py` mounts the `uploads/` folder as a static route, so test video files created by these scripts in `uploads/` are also accessible via `http://localhost:8000/uploads/<filename>`.

---

## 8. Directory Structure

```
ADCP/
├── app/
│   ├── main.py                  # FastAPI app, CORS, mounts UI & uploads
│   ├── database.py               # Async SQLAlchemy connection + SQLite
│   ├── models.py                  # Student, ClassSession, EngagementEvent, SessionReport
│   ├── ai/
│   │   ├── detector.py            # Core video processing: YOLO + MediaPipe Pose
│   │   ├── analytics.py           # Active Learning Score calculation
│   │   └── faces/                 # Reference face images used for student matching
│   ├── api/endpoints/
│   │   ├── video.py                # POST /api/v1/video/upload
│   │   └── dashboard.py            # GET/DELETE /api/v1/dashboard/...
│   └── services/
│       └── reporting.py            # Generates session summary reports
├── DU_AN_CUOI_KI_ADVANCED_COMPUTER_PROGRAMMING/
│   └── Swinburne_Active_Learning_UI/   # Frontend dashboard (HTML/CSS/JS)
├── scripts/                        # Utility / test scripts (see section 7)
├── uploads/                         # Original videos + AI-annotated videos (runtime)
├── adcp.db                          # SQLite database file (auto-created on first run)
├── yolov8n.pt                       # YOLOv8 nano model (person detection)
├── pose_landmarker_full.task        # MediaPipe Pose Landmarker model
├── requirements.txt
├── seed_team.py / clear_old_sessions.py / update_sessions.py / inspect_video.py
└── README.md
```

---

