from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging
import os
from dotenv import load_dotenv
import asyncio
import time
from contextlib import asynccontextmanager
from uvicorn.config import Config
from src.utils.cleanup import cleanup_service
import datetime

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Get frontend URL from environment
FRONTEND_URL = os.getenv("PUBLIC_FRONTEND_URL", "http://localhost:3000")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize services and cleanup tasks
    logger.info("Starting up application...")
    app.state.start_time = time.time()
    
    # Start the cleanup task
    cleanup_task = asyncio.create_task(cleanup_service.cleanup_task())
    
    # Clean up any old files from previous runs
    await cleanup_service.cleanup_all_temp_files()
    
    yield
    
    # Shutdown: Cancel cleanup task
    logger.info("Shutting down application...")
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    logger.info("Cleanup task cancelled")

# Initialize the FastAPI app
app = FastAPI(
    title="ProCaptions: AI-Powered Image Text Editor",
    description="API for adding text behind image subjects using advanced AI segmentation",
    lifespan=lifespan
)

@app.get("/health", tags=["Health"])
async def health_check():
    return JSONResponse(
        content={
            "status": "Service is running",
            "uptime": str(datetime.timedelta(seconds=int(time.time() - app.state.start_time))),
        },
        status_code=200
    )

# Configure server timeout settings - INCREASED TIMEOUTS
Config.TIMEOUT_KEEP_ALIVE = 300  # 5 minutes in seconds
Config.HTTP_TIMEOUT = 300        # 5 minutes in seconds

# Configure CORS with environment-based origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        FRONTEND_URL,  # Production frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create upload directories
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / "original").mkdir(exist_ok=True)
(UPLOAD_DIR / "processed").mkdir(exist_ok=True)
(UPLOAD_DIR / "temp").mkdir(exist_ok=True)
(UPLOAD_DIR / "public").mkdir(exist_ok=True)

# Mount static files directory for serving uploaded images
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/uploads/public", StaticFiles(directory="uploads/public"), name="public_uploads")

# Import routers
from src.routes import image_routes

# Include routers
app.include_router(image_routes.router, prefix="/api/v1")