from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models import ClassSession, EngagementEvent, SessionReport
from app.ai.analytics import calculate_active_learning_score
import json
import datetime

async def generate_session_report(session_id: int, db: AsyncSession):
    # Fetch all events for the session
    result = await db.execute(
        select(EngagementEvent).where(EngagementEvent.session_id == session_id)
    )
    events = result.scalars().all()
    
    # Calculate score
    total_score = calculate_active_learning_score(events)
    
    # Prepare summary data
    summary = {
        "generated_at": datetime.datetime.utcnow().isoformat(),
        "total_events": len(events),
        "score": total_score,
        "behavior_breakdown": {}
    }
    
    for event in events:
        summary["behavior_breakdown"][event.behavior_type] = summary["behavior_breakdown"].get(event.behavior_type, 0) + 1
        
    # Save report to database
    report = SessionReport(
        session_id=session_id,
        total_active_score=total_score,
        summary_data=json.dumps(summary)
    )
    db.add(report)
    await db.commit()
    
    return summary
