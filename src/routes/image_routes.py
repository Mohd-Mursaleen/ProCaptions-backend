from fastapi import APIRouter, UploadFile, HTTPException, Depends
from pathlib import Path
import shutil
from src.services.segmentation import SegmentationService
from src.services.composition import CompositionService, TextLayer
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import os
import logging
import glob
import uuid
from src.security import get_api_key
from src.utils.cleanup import cleanup_service

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
async def segment_image(file: UploadFile, api_key: str = Depends(get_api_key)) -> Dict[str, str]:
    import psutil
    import gc
    from src.services.s3_service import S3Service
    
    # Initialize S3 service
    s3_service = S3Service()
    
    try:
        # Check memory before processing
        memory = psutil.virtual_memory()
        if memory.percent > 85:
            logger.warning(f"High memory usage before processing: {memory.percent}%")
            gc.collect()
            memory = psutil.virtual_memory()
            if memory.percent > 90:
                raise HTTPException(
                    status_code=503, 
                    detail=f"Server overloaded (Memory: {memory.percent}%). Please try again in a few moments."
                )
        
        logger.info(f"Segmentation request received for file: {file.filename}")
        logger.info(f"Memory usage before processing: {memory.percent}%")
        
        # Validate file size (limit to 10MB for free tier)
        file_size = 0
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to beginning
        
        if file_size > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(
                status_code=413, 
                detail="File too large. Maximum size is 10MB for free tier."
            )
        
        # Save temporary file
        temp_dir = Path("uploads/temp")
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        temp_path = temp_dir / f"{uuid.uuid4()}_{file.filename}"
        
        # Save uploaded file using standard file operations
        with open(temp_path, 'wb') as out_file:
            shutil.copyfileobj(file.file, out_file)
            
        logger.info(f"Temporary file saved: {temp_path} ({file_size / 1024 / 1024:.1f}MB)")

        # Process with segmentation service
        fore_path, back_path, mask_path = await segmentation_service.segment_image(temp_path)
        logger.info(f"Segmentation successful: foreground={fore_path}, background={back_path}, mask={mask_path}")

        # Upload to S3
        foreground_cloud = await s3_service.upload_file(fore_path, "foreground")
        background_cloud = await s3_service.upload_file(back_path, "background")
        mask_cloud = await s3_service.upload_file(mask_path, "mask")
        
        logger.info(f"S3 upload successful: foreground={foreground_cloud['url']}, background={background_cloud['url']}, mask={mask_cloud['url']}")

        # Clean up temporary file
        if temp_path.exists():
            os.remove(temp_path)
            logger.info(f"Temporary file removed: {temp_path}")
        
        # Always clean up the processed files after uploading to S3
        for path in [fore_path, back_path, mask_path]:
            if os.path.exists(path):
                os.remove(path)
        logger.info("Processed files removed (using S3 storage)")

        # Final memory cleanup
        gc.collect()
        final_memory = psutil.virtual_memory()
        logger.info(f"Memory usage after processing: {final_memory.percent}%")

        return {
            "foreground": foreground_cloud["url"],
            "background": background_cloud["url"],
            "mask": mask_cloud["url"]
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Segmentation failed: {str(e)}")
        # Cleanup on error
        gc.collect()
        if 'temp_path' in locals() and temp_path.exists():
            try:
                os.remove(temp_path)
            except:
                pass
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/add-dramatic-text", response_model=TextResponse)
async def add_dramatic_text(request: DramaticTextRequest, api_key: str = Depends(get_api_key)) -> Dict[str, str]:
    """
    Add dramatic impact-style text to an image (the text that appears behind subjects)
    """
    from src.services.s3_service import S3Service
    
    # Initialize S3 service
    s3_service = S3Service()
    
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
            # Process the image and add text
            local_path, info = await composition_service.add_dramatic_text(
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
            
            # Upload the result to S3
            s3_result = await s3_service.upload_file(local_path, "text")
            
            # Clean up the local file
            if os.path.exists(local_path):
                os.remove(local_path)
                logger.info(f"Removed local file after S3 upload: {local_path}")
            
            return {"image_with_text": s3_result["url"]}
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
async def compose_final(request: ComposeRequest, api_key: str = Depends(get_api_key)) -> Dict[str, str]:
    from src.services.s3_service import S3Service
    
    # Initialize S3 service
    s3_service = S3Service()
    
    try:
        # Compose the image locally
        local_path = await composition_service.compose_final_image(
            request.background_with_text_path,
            request.foreground_path
        )
        
        # Upload the result to S3
        s3_result = await s3_service.upload_file(local_path, "composed")
        
        # Clean up the local file
        if os.path.exists(local_path):
            os.remove(local_path)
            logger.info(f"Removed local file after S3 upload: {local_path}")
        
        return {"final_image": s3_result["url"]}
    except Exception as e:
        logger.error(f"Error in compose_final: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error composing final image: {str(e)}")

@router.post("/add-multiple-text-layers")
async def add_multiple_text_layers(request: MultiLayerTextRequest, api_key: str = Depends(get_api_key)) -> Dict[str, str]:
    """Add multiple text layers to a background image"""
    from src.services.s3_service import S3Service
    
    # Initialize S3 service
    s3_service = S3Service()
    
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
            # Process the image locally
            local_path = await composition_service.add_multiple_text_layers(
                request.background_path,
                layers
            )
            
            # Log the local path for debugging
            logging.info(f"Local path before S3 upload: {local_path}, type: {type(local_path)}")
            
            # Convert Path to string if needed
            if isinstance(local_path, Path):
                local_path_str = str(local_path)
            else:
                local_path_str = local_path
                
            # Check if the file exists
            if not os.path.exists(local_path_str):
                logging.error(f"File does not exist: {local_path_str}")
                raise FileNotFoundError(f"Output file not found: {local_path_str}")
                
            # Upload the result to S3
            s3_result = await s3_service.upload_file(local_path_str, "multilayer")
            
            # Clean up the local file
            if os.path.exists(local_path_str):
                os.remove(local_path_str)
                logger.info(f"Removed local file after S3 upload: {local_path_str}")
            
            # Return the S3 URL
            return {"image_with_text": s3_result["url"]}
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