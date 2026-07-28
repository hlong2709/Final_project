from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import engine
from app.models import Base
from app.api.endpoints import video, dashboard
import os

app = FastAPI(
    title="Swinburne AI Active Learning Analytics",
    description="Backend for monitoring and evaluating active learning behaviors.",
    version="0.1.0"
)

# Enable CORS for local file access and cross-origin calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_header(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/ui"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Create database tables on startup
@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/")
async def root():
    return {"message": "Welcome to Swinburne AI Active Learning Analytics API. Go to /ui to view the dashboard."}

# Include routers
app.include_router(video.router, prefix="/api/v1/video", tags=["video"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])

# Mount Frontend UI static files
ui_path = "DU_AN_CUOI_KI_ADVANCED_COMPUTER_PROGRAMMING/Swinburne_Active_Learning_UI"
if os.path.exists(ui_path):
    app.mount("/ui", StaticFiles(directory=ui_path, html=True), name="ui")
else:
    print(f"Warning: Static UI directory not found at {ui_path}")

# Mount uploads folder to serve AI-annotated videos
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

