import numpy as np
from PIL import Image
from pathlib import Path
import logging
from typing import Tuple
import os
import pillow_heif
from PIL import ImageFile
from rembg import remove, new_session

ImageFile.LOAD_TRUNCATED_IMAGES = True
pillow_heif.register_heif_opener()

class SegmentationService:
    def __init__(self):
        # Initialize a persistent rembg session with the lighter u2netp model
        self.session = new_session('u2netp')

    async def convert_to_png(self, image_path: Path) -> Path:
        """
        Convert any image format (including HEIC) to PNG format.
        Returns the path to the converted PNG file.
        """
        try:
            logging.info(f"Converting image format: {image_path}")
            
            temp_dir = Path("uploads/temp")
            temp_dir.mkdir(exist_ok=True)
            
            output_path = temp_dir / f"{image_path.stem}_converted.png"
            
            with Image.open(image_path) as img:
                if img.mode not in ('RGB', 'RGBA'):
                    img = img.convert('RGB')
                img.save(output_path, "PNG")
            
            logging.info(f"Image converted successfully to: {output_path}")
            return output_path
            
        except Exception as e:
            logging.error(f"Image conversion failed: {str(e)}")
            raise ValueError(f"Image conversion failed: {str(e)}")

    async def segment_image(self, image_path: Path) -> Tuple[Path, Path, Path]:
        try:
            logging.info(f"Starting segmentation for image: {image_path}")
            
            # Convert image to PNG format
            png_image_path = await self.convert_to_png(image_path)
            
            # Get original dimensions
            img = Image.open(png_image_path)
            original_width, original_height = img.size
            logging.info(f"Original image dimensions: {original_width}x{original_height}")
            
            # Resize large images for faster processing
            MAX_DIMENSION = 1024
            if max(original_width, original_height) > MAX_DIMENSION:
                if original_width > original_height:
                    new_width = MAX_DIMENSION
                    new_height = int(original_height * (MAX_DIMENSION / original_width))
                else:
                    new_height = MAX_DIMENSION
                    new_width = int(original_width * (MAX_DIMENSION / original_height))
                
                logging.info(f"Resizing image to {new_width}x{new_height}")
                # Use BILINEAR for faster resizing
                img = img.resize((new_width, new_height), Image.BILINEAR)
                
                temp_dir = Path("uploads/temp")
                temp_dir.mkdir(exist_ok=True)
                temp_path = temp_dir / f"resized_{image_path.name}"
                img.save(temp_path)
                processing_path = temp_path
                is_resized = True
            else:
                processing_path = png_image_path
                is_resized = False
            
            # Perform segmentation with the persistent session
            input_image = Image.open(processing_path).convert('RGBA')
            input_array = np.array(input_image)
            output = remove(input_image, session=self.session)
            output_array = np.array(output)
            refined_alpha = output_array[:, :, 3]
            
            # Resize mask back to original size if resized
            if is_resized:
                logging.info(f"Resizing mask to {original_width}x{original_height}")
                refined_alpha_pil = Image.fromarray(refined_alpha)
                # Use BILINEAR for mask resizing
                refined_alpha_pil = refined_alpha_pil.resize((original_width, original_height), Image.BILINEAR)
                refined_alpha = np.array(refined_alpha_pil)
                
                input_image = Image.open(image_path).convert('RGBA')
                input_array = np.array(input_image)
            
            # Create foreground
            foreground = np.zeros((input_array.shape[0], input_array.shape[1], 4), dtype=np.uint8)
            foreground[:, :, :3] = input_array[:, :, :3]
            foreground[:, :, 3] = refined_alpha
            foreground_img = Image.fromarray(foreground)
            
            # Create background
            background = input_image.copy()
            background.putalpha(255)
            alpha_bg = Image.fromarray(255 - refined_alpha)
            background.putalpha(alpha_bg)
            
            # Save results
            processed_dir = Path("uploads/processed")
            processed_dir.mkdir(exist_ok=True)
            base_name = image_path.stem
            
            mask_path = processed_dir / f"{base_name}_mask.png"
            fore_path = processed_dir / f"{base_name}_foreground.png"
            back_path = processed_dir / f"{base_name}_background.png"
            
            Image.fromarray(refined_alpha).save(mask_path)
            foreground_img.save(fore_path, "PNG")
            background.save(back_path, "PNG")
            
            # Clean up temporary file
            if is_resized and processing_path.exists():
                try:
                    processing_path.unlink()
                except Exception as e:
                    logging.warning(f"Failed to remove temporary file: {e}")
            
            return fore_path, back_path, mask_path
        
        except Exception as e:
            logging.error(f"Segmentation failed: {str(e)}")
            raise ValueError(f"Image segmentation failed: {str(e)}")