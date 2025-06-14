from fastapi import APIRouter, UploadFile, HTTPException
from pathlib import Path
import shutil
from src.services.segmentation import SegmentationService
from src.services.composition import CompositionService, TextLayer
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import aiofiles
import os
import logging
import glob
import uuid

router = APIRouter()
segmentation_service = SegmentationService()
composition_service = CompositionService()
logger = logging.getLogger(__name__)

class DramaticTextRequest(BaseModel):
    background_path: str
    text: str
    position: Dict[str, int]
    font_size: int = 150
    color: str = "#FFFFFF"
    font_name: str = "Impact"
    with_period: bool = True
    effects: Optional[Dict[str, Any]] = None
    
    class Config:
        # Allow extra fields to be flexible with client
        extra = "ignore"

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

        # Upload to S3
        foreground_cloud = _handle_local_fallback(fore_path)
        background_cloud = _handle_local_fallback(back_path)
        mask_cloud = _handle_local_fallback(mask_path)
        
        logger.info(f"Image URL details: foreground={foreground_cloud['url']}, background={background_cloud['url']}, mask={mask_cloud['url']}")

        # Clean up temporary file
        os.remove(temp_path)
        logger.info(f"Temporary file removed: {temp_path}")
        
        # Always clean up the processed files after uploading to S3
        os.remove(fore_path)
        os.remove(back_path)
        os.remove(mask_path)
        logger.info("Processed files removed (using S3 storage)")

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
        try:
            path, info = await composition_service.add_dramatic_text(
                background_path=request.background_path,
                text=request.text,
                position=position,
                font_size=font_size,
                color=color,
                font_name=font_name,
                with_period=with_period,
                to_uppercase=False,
                effects=request.effects
            )
            
            return {"image_with_text": path}
        except FileNotFoundError as e:
            logger.error(f"File not found error: {str(e)}")
            raise HTTPException(status_code=404, detail=f"Image file not found: {str(e)}")
        except ValueError as e:
            logger.error(f"Value error in add_dramatic_text: {str(e)}")
            raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in add_dramatic_text: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error adding text: {str(e)}")

@router.post("/compose")
async def compose_final(request: ComposeRequest) -> Dict[str, str]:
    try:
        try:
            result_path = await composition_service.compose_final_image(
                request.background_with_text_path,
                request.foreground_path
            )
            return {"final_image": result_path}
        except FileNotFoundError as e:
            logger.error(f"File not found error in compose_final: {str(e)}")
            raise HTTPException(status_code=404, detail=f"Image file not found: {str(e)}")
        except ValueError as e:
            logger.error(f"Value error in compose_final: {str(e)}")
            raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in compose_final: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error composing final image: {str(e)}")

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
        try:
            image_path = await composition_service.add_multiple_text_layers(
                request.background_path,
                layers
            )
            
            # Return the image path
            return {"image_with_text": image_path}
        except FileNotFoundError as e:
            logger.error(f"File not found error in add_multiple_text_layers: {str(e)}")
            raise HTTPException(status_code=404, detail=f"Image file not found: {str(e)}")
        except ValueError as e:
            logger.error(f"Value error in add_multiple_text_layers: {str(e)}")
            raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Failed to add multiple text layers: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add multiple text layers: {str(e)}")

@router.get("/list-uploads")
async def list_uploads() -> Dict[str, List[str]]:
    """List all files in the uploads directory for debugging purposes"""
    try:
        # Create base uploads directory if it doesn't exist
        base_dir = Path("uploads")
        base_dir.mkdir(exist_ok=True, parents=True)
        
        # Check public directory
        public_dir = base_dir / "public"
        public_dir.mkdir(exist_ok=True, parents=True)
        
        # Check processed directory
        processed_dir = base_dir / "processed"
        processed_dir.mkdir(exist_ok=True, parents=True)
        
        # Check temp directory
        temp_dir = base_dir / "temp"
        temp_dir.mkdir(exist_ok=True, parents=True)
        
        # Get files in each directory
        base_files = glob.glob(str(base_dir / "*.*"))
        public_files = glob.glob(str(public_dir / "*.*"))
        processed_files = glob.glob(str(processed_dir / "*.*")) 
        temp_files = glob.glob(str(temp_dir / "*.*"))
        
        # Get current working directory for reference
        cwd = os.getcwd()
        
        return {
            "cwd": cwd,
            "base_dir": str(base_dir.absolute()),
            "base_files": [os.path.basename(f) for f in base_files],
            "public_files": [os.path.basename(f) for f in public_files],
            "processed_files": [os.path.basename(f) for f in processed_files],
            "temp_files": [os.path.basename(f) for f in temp_files],
            "upload_dirs_exist": {
                "base": os.path.exists(str(base_dir)),
                "public": os.path.exists(str(public_dir)),
                "processed": os.path.exists(str(processed_dir)),
                "temp": os.path.exists(str(temp_dir))
            }
        }
    except Exception as e:
        logger.error(f"Error listing uploads: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error listing uploads: {str(e)}") 

def _handle_local_fallback(image_path: Path, folder: str = "processed") -> Dict:
    """Fallback to local storage when S3 upload fails"""
    logger.info(f"Using local storage fallback for {image_path}")
    try:
        # Create a public directory
        public_dir = Path("uploads/public")
        public_dir.mkdir(exist_ok=True, parents=True)
        
        # Generate a unique filename
        unique_id = uuid.uuid4().hex[:8]
        filename = Path(image_path).name
        base_name, ext = os.path.splitext(filename)
        # Replace spaces with underscores to avoid URL encoding issues
        safe_base_name = base_name.replace(" ", "_")
        new_filename = f"{safe_base_name}_{unique_id}{ext}"
        
        # Copy the file to the public directory
        public_path = public_dir / new_filename
        shutil.copy2(image_path, public_path)
        
        # Generate a local URL
        local_url = f"/uploads/public/{new_filename}"
        logger.info(f"Local fallback: Copied {image_path} to {public_path}, URL: {local_url}")
        
        return {
            "url": local_url,
            "public_id": new_filename
        }
    except Exception as e:
        logger.error(f"Local fallback also failed: {str(e)}")
        # Last resort - return the original path
        return {
            "url": f"/uploads/{os.path.basename(str(image_path))}",
            "public_id": os.path.basename(str(image_path))
        }