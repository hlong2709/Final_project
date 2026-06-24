import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
import random
import datetime
from app.database import AsyncSessionLocal, engine
from app.models import Student, ClassSession, EngagementEvent, Base

async def generate_data():
    # Create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as db:
        # Create a session
        session = ClassSession(
            name=f"Active Learning Session {random.randint(100, 999)}",
            teacher_name="Dr. Nguyen",
            start_time=datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=1)
        )
        db.add(session)
        await db.flush()
        
        # Create students
        students = []
        names = ["An", "Binh", "Chi", "Dung", "Hoa", "Minh", "Nam", "Phuong", "Quynh", "Tu"]
        for name in names:
            student = Student(student_id=f"S{random.randint(1000, 9999)}", name=name, email=f"{name.lower()}@swinburne.edu.vn")
            db.add(student)
            students.append(student)
        await db.flush()
        
        # Create random events
        behaviors = ["hand_raising", "group_discussion", "focus", "distracted"]
        for _ in range(50):
            event = EngagementEvent(
                session_id=session.id,
                student_id=random.choice(students).id,
                behavior_type=random.choice(behaviors),
                confidence=random.uniform(0.7, 0.99),
                timestamp=datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=random.randint(0, 60))
            )
            db.add(event)
        
        await db.commit()
        print(f"Dummy data generated! Session ID: {session.id}")

if __name__ == "__main__":
    asyncio.run(generate_data())
