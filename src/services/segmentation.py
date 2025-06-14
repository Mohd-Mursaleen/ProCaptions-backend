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
from src.services.s3_service import S3Service

class SegmentationService:
    def __init__(self):
        self.s3_service = S3Service()

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
            
            end_time = time.time()
            logging.info(f"Segmentation completed in {end_time - start_time:.2f} seconds")
            
            return fore_path, back_path, mask_path
        
        except Exception as e:
            logging.error(f"Segmentation failed: {str(e)}")
            raise ValueError(f"Image segmentation failed: {str(e)}")