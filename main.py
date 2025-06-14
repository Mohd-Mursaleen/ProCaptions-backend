from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging
import os
from dotenv import load_dotenv
import asyncio
import time
from uvicorn.config import Config

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize the FastAPI app
app = FastAPI(
    title="ProCaptions: AI-Powered Image Text Editor",
    description="API for adding text behind image subjects using advanced AI segmentation"
)

# Configure server timeout settings - INCREASED TIMEOUTS
Config.TIMEOUT_KEEP_ALIVE = 300  # 5 minutes in seconds (increased from 120)
Config.HTTP_TIMEOUT = 300        # 5 minutes in seconds (increased from 120)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


# Health check endpoint


# Record app start time for uptime tracking
@app.on_event("startup")
async def record_start_time():
    app.state.start_time = time.time() 