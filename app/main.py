from fastapi import FastAPI
from app.database import engine
from app.models import Base
from app.api.endpoints import video, dashboard

app = FastAPI(
    title="Swinburne AI Active Learning Analytics",
    description="Backend for monitoring and evaluating active learning behaviors.",
    version="0.1.0"
)

# Create database tables on startup
@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/")
async def root():
    return {"message": "Welcome to Swinburne AI Active Learning Analytics API"}

# Include routers
app.include_router(video.router, prefix="/api/v1/video", tags=["video"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
