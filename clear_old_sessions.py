import asyncio
from app.database import AsyncSessionLocal
from app.models import ClassSession, EngagementEvent
from sqlalchemy import delete

async def clear():
    async with AsyncSessionLocal() as db:
        await db.execute(delete(EngagementEvent))
        await db.execute(delete(ClassSession))
        await db.commit()
        print("Successfully cleared all old conflicting test sessions!")

if __name__ == "__main__":
    asyncio.run(clear())
