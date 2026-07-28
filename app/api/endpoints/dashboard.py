from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from app.database import get_db
from app.models import ClassSession, EngagementEvent, Student
from app.ai.analytics import calculate_active_learning_score
import json
import datetime
import os

router = APIRouter()

@router.get("/sessions")
async def get_sessions(course_code: str = None, db: AsyncSession = Depends(get_db)):
    query = select(ClassSession).order_by(ClassSession.start_time.desc())
    if course_code:
        query = query.where(ClassSession.name.ilike(f"%{course_code}%"))
    result = await db.execute(query)
    return result.scalars().all()

@router.delete("/session/{session_id}")
async def delete_session(session_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ClassSession).where(ClassSession.id == session_id))
    session = result.scalar()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    await db.execute(delete(EngagementEvent).where(EngagementEvent.session_id == session_id))
    await db.delete(session)
    await db.commit()
    
    annotated_file = f"uploads/annotated_session_{session_id}.mp4"
    if os.path.exists(annotated_file):
        try:
            os.remove(annotated_file)
        except Exception:
            pass
            
    return {"message": f"Session ID {session_id} and associated video deleted successfully"}

@router.get("/session/{session_id}/stats")
async def get_session_stats(session_id: int, db: AsyncSession = Depends(get_db)):
    # Get total count of events in session
    total_result = await db.execute(
        select(func.count(EngagementEvent.id))
        .where(EngagementEvent.session_id == session_id)
    )
    total_events = total_result.scalar() or 0
    
    # Get engagement events distribution
    result = await db.execute(
        select(EngagementEvent.behavior_type, func.count(EngagementEvent.id))
        .where(EngagementEvent.session_id == session_id)
        .group_by(EngagementEvent.behavior_type)
    )
    stats = {row[0]: row[1] for row in result.all()}
    
    focus_count = stats.get("focus", 0)
    hand_raising_count = stats.get("hand_raising", 0)
    group_discussion_count = stats.get("group_discussion", 0)
    distracted_count = stats.get("distracted", 0)
    
    # Calculate percentages
    focus_pct = int((focus_count / total_events) * 100) if total_events > 0 else 0
    distracted_pct = int((distracted_count / total_events) * 100) if total_events > 0 else 0
    
    # Group discussion state
    discussion_state = "Yếu"
    if group_discussion_count > 15:
        discussion_state = "Tốt"
    elif group_discussion_count > 5:
        discussion_state = "Khá"
        
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
    
    import os
    annotated_url = f"/uploads/annotated_session_{session_id}.mp4"
    if not os.path.exists(f"uploads/annotated_session_{session_id}.mp4"):
        annotated_url = None

    original_video_url = None
    if os.path.exists("uploads"):
        for f in os.listdir("uploads"):
            if f.endswith((".mp4", ".mov", ".avi", ".webm")) and not f.startswith("annotated_") and not f.startswith("test_"):
                original_video_url = f"/uploads/{f}"
                break

    return {
        "session_id": session_id,
        "total_events": total_events,
        "focus_percentage": focus_pct,
        "hand_raises_count": hand_raising_count,
        "discussion_state": discussion_state,
        "distracted_percentage": distracted_pct,
        "behavior_distribution": stats,
        "top_active_students": top_students,
        "annotated_url": annotated_url,
        "original_video_url": original_video_url
    }

@router.get("/session/{session_id}/students")
async def get_session_students(session_id: int, db: AsyncSession = Depends(get_db)):
    # Fetch all students and their events in this session
    result = await db.execute(select(Student))
    students = result.scalars().all()
    
    student_list = []
    for student in students:
        # Get events for this student in this session
        events_result = await db.execute(
            select(EngagementEvent)
            .where(EngagementEvent.session_id == session_id)
            .where(EngagementEvent.student_id == student.id)
        )
        events = events_result.scalars().all()
        
        if not events:
            continue
            
        score = calculate_active_learning_score(events)
        
        # Count behaviors
        behavior_counts = {"focus": 0, "hand_raising": 0, "group_discussion": 0, "distracted": 0}
        for event in events:
            if event.behavior_type in behavior_counts:
                behavior_counts[event.behavior_type] += 1
                
        # Determine status (most recent behavior)
        sorted_events = sorted(events, key=lambda e: e.timestamp, reverse=True)
        latest_event = sorted_events[0] if sorted_events else None
        
        status_map = {
            "focus": "Tập trung",
            "hand_raising": "Giơ tay",
            "group_discussion": "Thảo luận",
            "distracted": "Mất tập trung"
        }
        status = status_map.get(latest_event.behavior_type, "Tập trung") if latest_event else "Tập trung"
        
        student_list.append({
            "id": student.student_id,
            "student_id": student.student_id,
            "db_id": student.id,
            "name": student.name,
            "score": round(score),
            "active_learning_score": round(score),
            "status": status,
            "avatar": student.name[0] if student.name else "S",
            "warning": score < 60 or behavior_counts["distracted"] > behavior_counts["focus"],
            "behavior_counts": behavior_counts,
            "hand_raises": behavior_counts["hand_raising"],
            "discussions": behavior_counts["group_discussion"],
            "distractions": behavior_counts["distracted"],
            "focus_count": behavior_counts["focus"]
        })
        
    return student_list

@router.get("/session/{session_id}/timeline")
async def get_session_timeline(session_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EngagementEvent)
        .where(EngagementEvent.session_id == session_id)
        .order_by(EngagementEvent.timestamp)
    )
    events = result.scalars().all()
    
    # Use fallback if no events yet
    if not events:
        return {"labels": ["08:00", "08:15", "08:30", "08:45", "09:00", "09:15", "09:30"], "data": [0, 0, 0, 0, 0, 0, 0]}
        
    # Get session start time
    session_res = await db.execute(select(ClassSession).where(ClassSession.id == session_id))
    session = session_res.scalar_one_or_none()
    start_time = session.start_time if session else datetime.datetime.now()
    
    # Divide events into 7 chronological chunks
    chunk_size = max(1, len(events) // 7)
    chunks = [events[i:i + chunk_size] for i in range(0, len(events), chunk_size)]
    
    labels = []
    data = []
    
    for idx, chunk in enumerate(chunks[:7]):
        # Calculate active engagement percentage
        active_count = sum(1 for e in chunk if e.behavior_type in ["focus", "hand_raising", "group_discussion"])
        engagement_pct = int((active_count / len(chunk)) * 100) if chunk else 0
        
        time_label = None
        if chunk and chunk[0].metadata_json:
            try:
                meta = json.loads(chunk[0].metadata_json)
                time_label = meta.get("video_time")
            except Exception:
                pass
                
        if not time_label:
            time_offset = start_time + datetime.timedelta(minutes=idx * 15)
            time_label = time_offset.strftime("%H:%M")
            
        labels.append(time_label)
        data.append(engagement_pct)
        
    while len(data) < 7:
        labels.append((start_time + datetime.timedelta(minutes=len(data) * 15)).strftime("%H:%M"))
        data.append(50)
        
    return {"labels": labels, "data": data}

@router.get("/session/{session_id}/logs")
async def get_session_logs(session_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EngagementEvent, Student)
        .join(Student, EngagementEvent.student_id == Student.id, isouter=True)
        .where(EngagementEvent.session_id == session_id)
        .order_by(EngagementEvent.timestamp.desc())
        .limit(20)
    )
    rows = result.all()
    
    behavior_map = {
        "focus": "đang tập trung nghe giảng",
        "hand_raising": "đã giơ tay phát biểu",
        "group_discussion": "đang thảo luận nhóm sôi nổi",
        "distracted": "đang mất tập trung"
    }
    
    logs = []
    for event, student in rows:
        student_name = student.name if student else "Học sinh ẩn danh"
        behavior_desc = behavior_map.get(event.behavior_type, "đang tương tác")
        
        # Extract exact video timestamp (MM:SS) and bbox from metadata_json if available
        video_time_str = None
        bbox = None
        if event.metadata_json:
            try:
                meta = json.loads(event.metadata_json)
                video_time_str = meta.get("video_time")
                bbox = meta.get("bbox")
            except Exception:
                pass
                
        if not video_time_str:
            video_time_str = event.timestamp.strftime("%H:%M:%S")
        
        score_change = "+1"
        if event.behavior_type == "hand_raising":
            score_change = "+10"
        elif event.behavior_type == "group_discussion":
            score_change = "+5"
        elif event.behavior_type == "distracted":
            score_change = "-2"
            
        logs.append({
            "id": event.id,
            "time": video_time_str,
            "name": student_name,
            "behavior": behavior_desc,
            "score": score_change,
            "type": event.behavior_type,
            "bbox": bbox
        })
        
    return logs

@router.get("/session/{session_id}/bboxes")
async def get_session_bboxes(session_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EngagementEvent, Student)
        .join(Student, EngagementEvent.student_id == Student.id, isouter=True)
        .where(EngagementEvent.session_id == session_id)
        .order_by(EngagementEvent.timestamp.desc())
        .limit(100)
    )
    rows = result.all()
    
    student_bboxes = {}
    for event, student in rows:
        student_name = student.name if student else "Học sinh"
        if student_name not in student_bboxes and event.metadata_json:
            try:
                meta = json.loads(event.metadata_json)
                bbox = meta.get("bbox")
                video_time = meta.get("video_time")
                if bbox and isinstance(bbox, list) and len(bbox) == 4:
                    student_bboxes[student_name] = {
                        "name": student_name,
                        "type": event.behavior_type,
                        "bbox": bbox,
                        "time": video_time
                    }
            except Exception:
                pass
                
    return list(student_bboxes.values())

@router.get("/student/{student_id}/progress")
async def get_student_progress(student_id: int, db: AsyncSession = Depends(get_db)):
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
