import asyncio
from app.database import AsyncSessionLocal
from app.models import ClassSession
from sqlalchemy import select

async def update():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(ClassSession))
        ss = res.scalars().all()
        for s in ss:
            if "SE005" not in s.name:
                s.name = f"SE005 - Linear Algebra ({s.name})"
        await db.commit()
        print("Updated all DB sessions to SE005 - Linear Algebra!")

if __name__ == "__main__":
    asyncio.run(update())
