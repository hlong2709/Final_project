import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import delete
from app.models import Student, EngagementEvent

DATABASE_URL = "sqlite+aiosqlite:///./adcp.db"
engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def update_students():
    async with AsyncSessionLocal() as db:
        # Delete existing students and events
        await db.execute(delete(EngagementEvent))
        await db.execute(delete(Student))
        await db.commit()

        team_students = [
            {"student_id": "SE1501", "name": "Diệp Tấn Phát", "email": "phat.diep@swinburne.edu.vn"},
            {"student_id": "SE1502", "name": "Lê Hoàng Thành Đạt", "email": "dat.le@swinburne.edu.vn"},
            {"student_id": "SE1503", "name": "Đặng Gia Minh", "email": "minh.dang@swinburne.edu.vn"},
            {"student_id": "SE1504", "name": "Heng Hưng Long", "email": "long.heng@swinburne.edu.vn"},
        ]

        for s_data in team_students:
            student = Student(**s_data)
            db.add(student)

        await db.commit()
        print("Successfully updated database with 4 team members: Diep Tan Phat, Le Hoang Thanh Dat, Dang Gia Minh, Heng Hung Long!")

if __name__ == "__main__":
    asyncio.run(update_students())
