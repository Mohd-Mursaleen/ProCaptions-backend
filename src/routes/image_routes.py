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

class TextRequest(BaseModel):
    background_path: str
    text: str
    position: Dict[str, int]
    font_size: int = 48
    color: str = "#000000"
    font_name: str = "Arial"

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

class TextMetrics(BaseModel):
    position: Dict[str, int]
    text_size: Dict[str, int]
    image_size: Dict[str, int]

class TextResponse(BaseModel):
    image_with_text: str

class FontSizeRequest(BaseModel):
    background_path: str
    text: str
    position: Dict[str, int]
    font_name: str = "anton"
    
class FontSizeResponse(BaseModel):
    suggested_sizes: List[int]
    previews: Dict[str, str]

class RefineMaskRequest(BaseModel):
    mask_path: str
    edits: List[Dict[str, Any]]  # List of brush strokes with coordinates and type (add/remove)

class PositionSuggestionRequest(BaseModel):
    background_path: str
    text: str
    font_size: int = 120
    font_name: str = "anton"

class Text3DEffectRequest(BaseModel):
    background_path: str
    text: str
    position: Dict[str, int]
    font_size: int = 120
    color: str = "#FFFFFF"
    font_name: str = "anton"
    effect_type: str = "3d_depth"  # 3d_depth, shadow, glow, outline
    effect_settings: Dict[str, Any] = None

class BlendComposeRequest(BaseModel):
    background_with_text_path: str
    foreground_path: str
    blend_mode: str = "normal"  # normal, multiply, etc.
    blend_opacity: float = 1.0

class MultiLayerTextRequest(BaseModel):
    background_path: str
    text_layers: List[Dict[str, Any]]

class TemplateRequest(BaseModel):
    foreground_path: str
    background_color: str = "#000000"
    template_name: str = "instagram_post"
    padding_percent: int = 10

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

@router.post("/add-text", response_model=TextResponse)
async def add_text(request: TextRequest) -> Dict[str, str]:
    try:
        result_url, _ = await composition_service.add_text(
            request.background_path,
            request.text,
            request.position,
            request.font_size,
            request.color,
            request.font_name
        )
        return {"image_with_text": result_url}
    except Exception as e:
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

@router.post("/font-size-suggestions", response_model=FontSizeResponse)
async def get_font_size_suggestions(request: FontSizeRequest) -> Dict[str, Any]:
    """
    Get font size suggestions and preview images for different sizes.
    This helps users choose an appropriate font size for their text overlay.
    """
    try:
        # Generate a range of font sizes based on image dimensions
        suggested_sizes, previews = await composition_service.generate_font_size_previews(
            request.background_path,
            request.text,
            request.position,
            request.font_name
        )
        
        return {
            "suggested_sizes": suggested_sizes,
            "previews": previews
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/refine-mask")
async def refine_mask(request: RefineMaskRequest) -> Dict[str, str]:
    """
    Refine a mask with manual brush edits.
    
    edits format: [
        {
            "type": "add" or "remove",
            "points": [[x1, y1], [x2, y2], ...],
            "size": brush_size
        }
    ]
    """
    try:
        # Load the mask
        mask_path = Path(request.mask_path)
        if not mask_path.exists():
            raise HTTPException(status_code=404, detail="Mask not found")
        
        mask = np.array(Image.open(mask_path))
        
        # Apply each edit
        for edit in request.edits:
            edit_type = edit.get('type', 'add')
            points = edit.get('points', [])
            size = edit.get('size', 10)
            
            # Skip if no points
            if not points:
                continue
            
            # Determine value based on edit type (255 for add, 0 for remove)
            value = 255 if edit_type == 'add' else 0
            
            # Draw on the mask
            for i in range(len(points) - 1):
                pt1 = tuple(map(int, points[i]))
                pt2 = tuple(map(int, points[i + 1]))
                
                # Draw a line between consecutive points
                # OpenCV's line function needs exact coordinates
                import cv2
                cv2.line(mask, pt1, pt2, value, size)
        
        # Save the refined mask
        refined_mask_path = mask_path.with_name(f"{mask_path.stem}_refined.png")
        Image.fromarray(mask).save(refined_mask_path)
        
        # Return paths and cloud URLs
        cloud_url = await cloudinary_service.upload_image(str(refined_mask_path))
        
        return {
            "refined_mask_path": str(refined_mask_path),
            "refined_mask_url": cloud_url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mask refinement failed: {str(e)}")

# Add a base64 mask endpoint for the frontend to get masks without saving files
class Base64MaskRequest(BaseModel):
    image_data: str  # Base64 encoded image

@router.post("/segment-base64")
async def segment_base64_image(request: Base64MaskRequest) -> Dict[str, Any]:
    """Segment an image provided as base64 and return base64 results"""
    try:
        # Decode base64 image
        image_data = base64.b64decode(request.image_data.split(',')[1] if ',' in request.image_data else request.image_data)
        image = Image.open(io.BytesIO(image_data))
        
        # Save temporarily
        temp_dir = Path("uploads/temp")
        temp_dir.mkdir(exist_ok=True, parents=True)
        temp_path = temp_dir / "temp_image.png"
        image.save(temp_path)
        
        # Process with segmentation service
        fore_path, back_path, mask_path = await segmentation_service.segment_image(temp_path)
        
        # Convert results to base64
        def img_to_base64(img_path):
            with open(img_path, "rb") as img_file:
                return base64.b64encode(img_file.read()).decode('utf-8')
        
        # Return all images as base64
        return {
            "foreground": img_to_base64(fore_path),
            "background": img_to_base64(back_path),
            "mask": img_to_base64(mask_path),
            "original": img_to_base64(temp_path)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Base64 segmentation failed: {str(e)}")

# Add endpoint to get model status
@router.get("/model-status")
async def get_model_status() -> Dict[str, bool]:
    """Get status of available AI models"""
    return {
        "yolo_available": segmentation_service.yolo_model is not None,
        "sam_available": segmentation_service.sam_predictor is not None,
        "rembg_available": True  # This is a fallback so we can assume it's available
    }

@router.post("/suggest-text-positions")
async def suggest_text_positions(request: PositionSuggestionRequest) -> Dict[str, List[Dict[str, int]]]:
    """Suggest optimal positions for text based on the background content"""
    try:
        # Get position suggestions from composition service
        positions = await composition_service.suggest_text_positions(
            request.background_path,
            request.text,
            request.font_size,
            request.font_name
        )
        
        return {"suggested_positions": positions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to suggest positions: {str(e)}")

@router.post("/add-3d-text", response_model=TextResponse)
async def add_3d_text(request: Text3DEffectRequest) -> Dict[str, str]:
    """Add text with 3D effects to a background image"""
    try:
        # Build effects dictionary
        effects = {}
        if request.effect_type and request.effect_type in ["3d_depth", "shadow", "glow", "outline"]:
            effects[request.effect_type] = request.effect_settings or {}
        
        # Call composition service
        _, info = await composition_service.add_text(
            request.background_path,
            request.text,
            request.position,
            request.font_size,
            request.color,
            request.font_name,
            effects
        )
        
        return {"image_with_text": info["cloud_url"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add 3D text: {str(e)}")

@router.post("/compose-with-blend")
async def compose_with_blend(request: BlendComposeRequest) -> Dict[str, str]:
    """Compose final image with blend mode options"""
    try:
        # Validate blend mode
        valid_blend_modes = ["normal", "multiply", "screen", "overlay"]
        blend_mode = request.blend_mode if request.blend_mode in valid_blend_modes else "normal"
        
        # Validate opacity
        blend_opacity = max(0.0, min(1.0, request.blend_opacity))
        
        # Call composition service
        result_url = await composition_service.compose_final_image(
            request.background_with_text_path,
            request.foreground_path,
            blend_mode,
            blend_opacity
        )
        
        return {"composed_image_url": result_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compose with blend: {str(e)}")

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

@router.post("/create-template")
async def create_template(request: TemplateRequest) -> Dict[str, str]:
    """Create a social media template with the foreground subject"""
    try:
        # Validate template name
        valid_templates = [
            "instagram_post", "instagram_story", "facebook_post", 
            "twitter_post", "linkedin_post", "youtube_thumbnail", "tiktok_video"
        ]
        
        template_name = request.template_name if request.template_name in valid_templates else "instagram_post"
        
        # Validate padding percentage
        padding_percent = max(0, min(30, request.padding_percent))
        
        # Create template
        result_url = await composition_service.create_template(
            request.foreground_path,
            request.background_color,
            template_name,
            padding_percent
        )
        
        return {"template_url": result_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create template: {str(e)}")

# Endpoint to get available social media templates
@router.get("/templates")
async def get_templates() -> Dict[str, List[Dict[str, Any]]]:
    """Get list of available social media templates"""
    templates = [
        {
            "name": "instagram_post",
            "display_name": "Instagram Post",
            "dimensions": "1080x1080",
            "aspect_ratio": "1:1"
        },
        {
            "name": "instagram_story",
            "display_name": "Instagram Story",
            "dimensions": "1080x1920",
            "aspect_ratio": "9:16"
        },
        {
            "name": "facebook_post",
            "display_name": "Facebook Post",
            "dimensions": "1200x630",
            "aspect_ratio": "1.91:1"
        },
        {
            "name": "twitter_post",
            "display_name": "Twitter Post",
            "dimensions": "1600x900",
            "aspect_ratio": "16:9"
        },
        {
            "name": "linkedin_post",
            "display_name": "LinkedIn Post",
            "dimensions": "1200x627",
            "aspect_ratio": "1.91:1"
        },
        {
            "name": "youtube_thumbnail",
            "display_name": "YouTube Thumbnail",
            "dimensions": "1280x720",
            "aspect_ratio": "16:9"
        },
        {
            "name": "tiktok_video",
            "display_name": "TikTok Video",
            "dimensions": "1080x1920",
            "aspect_ratio": "9:16"
        }
    ]
    
    return {"templates": templates} 