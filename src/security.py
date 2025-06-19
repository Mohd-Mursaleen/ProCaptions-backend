from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

# Get API key from environment variable
API_KEY = os.getenv("API_KEY", "your-secret-api-key-change-this")  # Default value for development

# Create API key header scheme
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=True)

async def get_api_key(api_key_header: str = Security(api_key_header)) -> Optional[str]:
    """Validate API key"""
    if api_key_header == API_KEY:
        return api_key_header
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid API key"
    )
