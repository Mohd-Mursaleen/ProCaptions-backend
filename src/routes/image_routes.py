from fastapi import APIRouter, UploadFile, HTTPException
from pathlib import Path
import shutil
from src.services.segmentation import SegmentationService
from src.services.composition import CompositionService, TextLayer
from typing import Dict, Any, List
from pydantic import BaseModel, validator
from src.services.cloudinary_service import CloudinaryService
import aiofiles
import os
import numpy as np
from PIL import Image
import base64
import io
import logging

router = APIRouter()
segmentation_service = SegmentationService()
composition_service = CompositionService()
cloudinary_service = CloudinaryService()
logger = logging.getLogger(__name__)

class DramaticTextRequest(BaseModel):
    background_path: str
    text: str
    position: Dict[str, int]
    font_size: int = 150
    color: str = "#FFFFFF"
    font_name: str = "Impact"
    with_period: bool = True
    
    class Config:
        # Allow extra fields to be flexible with client
        extra = "ignore"
    
    @validator('position')
    def validate_position(cls, v):
        if not isinstance(v, dict):
            raise ValueError('position must be a dictionary')
        # Ensure both x and y are present and converted to integers
        x = int(v.get('x', 100))
        y = int(v.get('y', 100))
        return {'x': x, 'y': y}
    
    @validator('font_size')
    def validate_font_size(cls, v):
        if v is None:
            return 150
        try:
            return int(v)
        except (ValueError, TypeError):
            return 150
    
    @validator('color')
    def validate_color(cls, v):
        if not v:
            return "#FFFFFF"
        # Simple validation for hex color
        if not isinstance(v, str) or not (v.startswith('#') or v.startswith('rgb')):
            return "#FFFFFF"
        return v

class ComposeRequest(BaseModel):
    background_with_text_path: str
    foreground_path: str

class TextResponse(BaseModel):
    image_with_text: str

class MultiLayerTextRequest(BaseModel):
    background_path: str
    text_layers: List[Dict[str, Any]]

@router.post("/segment")
async def segment_image(file: UploadFile) -> Dict[str, str]:
    try:
        # Log request information
        logger.info(f"Segmentation request received for file: {file.filename}")
        
        # Save temporary file
        temp_path = Path("uploads/original") / file.filename
        async with aiofiles.open(temp_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
        
        logger.info(f"File saved to temporary path: {temp_path}")

        # Process with segmentation service
        fore_path, back_path, mask_path = await segmentation_service.segment_image(temp_path)
        logger.info(f"Segmentation successful: foreground={fore_path}, background={back_path}, mask={mask_path}")

        # Upload to Cloudinary
        foreground_cloud = await cloudinary_service.upload_image(fore_path)
        background_cloud = await cloudinary_service.upload_image(back_path)
        mask_cloud = await cloudinary_service.upload_image(mask_path)
        
        logger.info(f"Image URL details: foreground={foreground_cloud['url']}, background={background_cloud['url']}, mask={mask_cloud['url']}")

        # Clean up temporary file
        os.remove(temp_path)
        logger.info(f"Temporary file removed: {temp_path}")
        
        # Don't delete the processed files when using local storage
        if os.getenv('CLOUDINARY_CLOUD_NAME') != 'your_cloud_name':
            # Only clean up files if using real Cloudinary (not local storage)
            os.remove(fore_path)
            os.remove(back_path)
            os.remove(mask_path)
            logger.info("Processed files removed (using Cloudinary)")
        else:
            logger.info("Keeping processed files (using local storage)")

        return {
            "foreground": foreground_cloud["url"],
            "background": background_cloud["url"],
            "mask": mask_cloud["url"]
        }
        
    except Exception as e:
        logger.error(f"Segmentation failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/add-dramatic-text", response_model=TextResponse)
async def add_dramatic_text(request: DramaticTextRequest) -> Dict[str, str]:
    """
    Add dramatic impact-style text to an image (the text that appears behind subjects)
    """
    try:
        # Log the incoming request details
        logging.info(f"add_dramatic_text request received: {request.dict()}")
        logging.info(f"Background path: {request.background_path}")
        logging.info(f"Position: {request.position}")
        logging.info(f"Font: {request.font_name}, Size: {request.font_size}")
        
        # Ensure we have a valid position dictionary
        if not request.position or not isinstance(request.position, dict):
            logging.error(f"Invalid position format: {request.position}")
            raise HTTPException(status_code=400, detail="Position must be a dictionary with x and y coordinates")
        
        # Ensure position contains x and y keys
        try:
            position = {
                "x": int(request.position.get("x", 100)),
                "y": int(request.position.get("y", 100))
            }
        except (ValueError, TypeError) as e:
            logging.error(f"Invalid position values: {request.position}")
            raise HTTPException(status_code=400, detail=f"Invalid position values: {str(e)}")
        
        # Set defaults for optional parameters
        font_size = request.font_size or 150
        color = request.color or "#FFFFFF" 
        font_name = request.font_name or "anton"
        with_period = request.with_period if request.with_period is not None else True
        
        # Call the composition service with the parameters
        # Pass to_uppercase=False to prevent automatic capitalization
        path, info = await composition_service.add_dramatic_text(
            background_path=request.background_path,
            text=request.text,
            position=position,
            font_size=font_size,
            color=color,
            font_name=font_name,
            with_period=with_period,
            to_uppercase=False
        )
        
        return {"image_with_text": path}
    except Exception as e:
        logger.error(f"Error in add_dramatic_text: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error adding text: {str(e)}")

@router.post("/compose")
async def compose_final(request: ComposeRequest) -> Dict[str, str]:
    try:
        result_path = await composition_service.compose_final_image(
            request.background_with_text_path,
            request.foreground_path
        )
        return {"final_image": result_path}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/add-multiple-text-layers")
async def add_multiple_text_layers(request: MultiLayerTextRequest) -> Dict[str, str]:
    """Add multiple text layers to a background image"""
    try:
        # Log the incoming request
        logging.info(f"Adding multiple text layers to {request.background_path}")
        logging.info(f"Number of text layers: {len(request.text_layers)}")
        
        # Convert raw dictionaries to TextLayer objects
        layers = []
        for i, layer_data in enumerate(request.text_layers):
            text = layer_data.get("text", "")
            position = layer_data.get("position", {"x": 10, "y": 10})
            style = layer_data.get("style", {})
            
            # Ensure position contains x and y as integers
            safe_position = {
                "x": int(position.get("x", 10)),
                "y": int(position.get("y", 10))
            }
            
            # Log layer details for debugging
            logging.info(f"Layer {i+1}: text='{text}', position={safe_position}")
            
            # Create TextLayer object with validated data
            layers.append(TextLayer(text, safe_position, style))
        
        # Call composition service
        image_path = await composition_service.add_multiple_text_layers(
            request.background_path,
            layers
        )
        
        # Return the image path
        return {"image_with_text": image_path}
    except Exception as e:
        logging.error(f"Failed to add multiple text layers: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add multiple text layers: {str(e)}") 