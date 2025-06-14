import numpy as np
from PIL import Image
from pathlib import Path
import logging
from typing import Tuple, Optional
import os
import time
import redis
import hashlib
import json

class SegmentationService:
    def __init__(self):
        # Initialize Redis client if available
        self.redis_client = None
        if os.getenv("USE_REDIS", "false").lower() == "true":
            try:
                self.redis_client = redis.Redis(
                    host=os.getenv("REDIS_HOST", "localhost"),
                    port=int(os.getenv("REDIS_PORT", 6379)),
                    password=os.getenv("REDIS_PASSWORD", ""),
                    db=0
                )
                # Test connection
                self.redis_client.ping()
                logging.info("Redis cache connected for segmentation")
            except Exception as e:
                logging.warning(f"Redis connection failed: {str(e)}")
                self.redis_client = None
    
    def _get_cache_key(self, image_path: Path) -> str:
        """Generate a cache key for an image based on its content hash"""
        try:
            with open(image_path, "rb") as f:
                file_hash = hashlib.md5(f.read()).hexdigest()
            return f"segmentation:{file_hash}"
        except Exception as e:
            logging.error(f"Error generating cache key: {str(e)}")
            # Fallback to using the filename
            return f"segmentation:{image_path.name}"
    
    def _cache_result(self, key: str, fore_path: Path, back_path: Path, mask_path: Path) -> bool:
        """Cache segmentation results in Redis"""
        if not self.redis_client:
            return False
        
        try:
            # Store paths in Redis (not the actual images to save memory)
            cache_data = {
                "fore_path": str(fore_path),
                "back_path": str(back_path),
                "mask_path": str(mask_path),
                "timestamp": time.time()
            }
            
            # Set with 1 hour expiration
            self.redis_client.setex(
                key,
                3600,  # 1 hour expiration
                json.dumps(cache_data)
            )
            
            logging.info(f"Cached segmentation results for {key}")
            return True
        except Exception as e:
            logging.error(f"Failed to cache results: {str(e)}")
            return False
    
    def _get_cached_result(self, key: str) -> Optional[Tuple[Path, Path, Path]]:
        """Retrieve cached segmentation results from Redis if available"""
        if not self.redis_client:
            return None
        
        try:
            cached = self.redis_client.get(key)
            if not cached:
                return None
            
            cache_data = json.loads(cached)
            
            # Check if cached files still exist
            fore_path = Path(cache_data["fore_path"])
            back_path = Path(cache_data["back_path"])
            mask_path = Path(cache_data["mask_path"])
            
            if fore_path.exists() and back_path.exists() and mask_path.exists():
                logging.info(f"Using cached segmentation for {key}")
                return fore_path, back_path, mask_path
            else:
                # Files don't exist anymore, invalidate cache
                self.redis_client.delete(key)
                return None
        except Exception as e:
            logging.error(f"Failed to retrieve from cache: {str(e)}")
            return None

    async def segment_image(self, image_path: Path) -> Tuple[Path, Path, Path]:
        try:
            start_time = time.time()
            logging.info(f"Starting segmentation for image: {image_path}")
            
            # Get image dimensions before processing
            img = Image.open(image_path)
            original_width, original_height = img.size
            logging.info(f"Original image dimensions: {original_width}x{original_height}")
            
            # Check if the image is very large and resize if needed to speed up processing
            MAX_DIMENSION = 1024  # Maximum dimension for processing
            if max(original_width, original_height) > MAX_DIMENSION:
                # Calculate new dimensions while maintaining aspect ratio
                if original_width > original_height:
                    new_width = MAX_DIMENSION
                    new_height = int(original_height * (MAX_DIMENSION / original_width))
                else:
                    new_height = MAX_DIMENSION
                    new_width = int(original_width * (MAX_DIMENSION / original_height))
                
                # Resize the image for processing
                logging.info(f"Resizing image to {new_width}x{new_height} for faster processing")
                img = img.resize((new_width, new_height), Image.LANCZOS)
                
                # Save resized image to a temporary file for processing
                temp_dir = Path("uploads/temp")
                temp_dir.mkdir(exist_ok=True)
                temp_path = temp_dir / f"resized_{image_path.name}"
                img.save(temp_path)
                processing_path = temp_path
                is_resized = True
            else:
                processing_path = image_path
                is_resized = False
            
            # Check cache first if Redis is available
            cache_key = self._get_cache_key(image_path)
            cached_result = self._get_cached_result(cache_key)
            if cached_result:
                logging.info(f"Cache hit: {cache_key}")
                return cached_result
            
            logging.info(f"Cache miss, processing image: {processing_path}")
            
            # Read image for processing
            input_image = Image.open(processing_path).convert('RGBA')
            input_array = np.array(input_image)
            
            # Use rembg to remove background
            from rembg import remove
            output = remove(input_image)
            output_array = np.array(output)
            refined_alpha = output_array[:, :, 3]
            
            # If image was resized, resize the mask back to original dimensions
            if is_resized:
                logging.info(f"Resizing mask back to original dimensions: {original_width}x{original_height}")
                refined_alpha_pil = Image.fromarray(refined_alpha)
                refined_alpha_pil = refined_alpha_pil.resize((original_width, original_height), Image.LANCZOS)
                refined_alpha = np.array(refined_alpha_pil)
                
                # Use the original image for creating foreground and background
                input_image = Image.open(image_path).convert('RGBA')
                input_array = np.array(input_image)
            
            # Create foreground with refined edges
            foreground = np.zeros((input_array.shape[0], input_array.shape[1], 4), dtype=np.uint8)
            foreground[:, :, :3] = input_array[:, :, :3]
            foreground[:, :, 3] = refined_alpha
            
            # Create foreground image with transparency
            foreground_img = Image.fromarray(foreground)
            
            # Create background (scene with transparent subject)
            background = input_image.copy()
            background.putalpha(255)  # Make fully opaque first
            alpha_bg = Image.fromarray(255 - refined_alpha)  # Invert refined mask for background
            background.putalpha(alpha_bg)
            
            # Save results
            processed_dir = Path("uploads/processed")
            processed_dir.mkdir(exist_ok=True)
            base_name = image_path.stem
            
            mask_path = processed_dir / f"{base_name}_mask.png"
            fore_path = processed_dir / f"{base_name}_foreground.png"
            back_path = processed_dir / f"{base_name}_background.png"
            
            # Save mask
            Image.fromarray(refined_alpha).save(mask_path)
            
            # Save foreground with transparency
            foreground_img.save(fore_path, "PNG")
            
            # Save background with transparency
            background.save(back_path, "PNG")
            
            # Clean up temporary file if created
            if is_resized and processing_path.exists():
                try:
                    processing_path.unlink()
                except Exception as e:
                    logging.warning(f"Failed to remove temporary file: {e}")
            
            # Cache the results if Redis is available
            self._cache_result(cache_key, fore_path, back_path, mask_path)
            
            end_time = time.time()
            logging.info(f"Segmentation completed in {end_time - start_time:.2f} seconds")
            
            return fore_path, back_path, mask_path
        
        except Exception as e:
            logging.error(f"Segmentation failed: {str(e)}")
            raise ValueError(f"Image segmentation failed: {str(e)}")