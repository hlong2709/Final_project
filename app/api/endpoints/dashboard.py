from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models import ClassSession, EngagementEvent, Student, SessionReport
import json

router = APIRouter()

@router.get("/sessions")
async def get_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ClassSession))
    return result.scalars().all()

@router.get("/session/{session_id}/stats")
async def get_session_stats(session_id: int, db: AsyncSession = Depends(get_db)):
    # Get engagement events distribution
    result = await db.execute(
        select(EngagementEvent.behavior_type, func.count(EngagementEvent.id))
        .where(EngagementEvent.session_id == session_id)
        .group_by(EngagementEvent.behavior_type)
    )
    stats = {row[0]: row[1] for row in result.all()}
    
    # Get top active students
    student_stats = await db.execute(
        select(Student.name, func.count(EngagementEvent.id))
        .join(EngagementEvent)
        .where(EngagementEvent.session_id == session_id)
        .group_by(Student.name)
        .order_by(func.count(EngagementEvent.id).desc())
        .limit(5)
    )
    top_students = [{"name": row[0], "event_count": row[1]} for row in student_stats.all()]
    
    return {
        "session_id": session_id,
        "behavior_distribution": stats,
        "top_active_students": top_students
    }

@router.get("/student/{student_id}/progress")
async def get_student_progress(student_id: int, db: AsyncSession = Depends(get_db)):
    # Track student engagement over time (across sessions)
    result = await db.execute(
        select(ClassSession.name, func.count(EngagementEvent.id))
        .join(EngagementEvent)
        .where(EngagementEvent.student_id == student_id)
        .group_by(ClassSession.name)
    )
    progress = [{"session": row[0], "engagement_events": row[1]} for row in result.all()]
    
    return {
        "student_id": student_id,
        "progress": progress
    }
