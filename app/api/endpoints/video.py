from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import ClassSession
from app.ai.detector import process_video
import shutil
import os
import datetime

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    course_name: str = Form("TEC004 - Advanced Computer Programming"),
    db: AsyncSession = Depends(get_db)
):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    clean_filename = file.filename.rsplit('.', 1)[0]
    session_name = f"{course_name} ({clean_filename})"
    session = ClassSession(
        name=session_name,
        teacher_name="Mr. Arthur Nguyen",
        start_time=datetime.datetime.now(datetime.UTC)
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    
    background_tasks.add_task(process_video, file_path, session.id)
    
    return {
        "message": "Video uploaded successfully and processing started",
        "session_id": session.id,
        "session_name": session.name,
        "filename": file.filename
    }
