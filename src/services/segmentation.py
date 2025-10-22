import numpy as np
from PIL import Image, ImageFilter, ExifTags
from pathlib import Path
import logging
from typing import Tuple
import os
import pillow_heif
from PIL import ImageFile
from rembg import remove, new_session
import gc
import psutil
import time

# Enable loading truncated images and HEIF format
ImageFile.LOAD_TRUNCATED_IMAGES = True
pillow_heif.register_heif_opener()

class SegmentationService:
    _instance = None
    _session = None
    
    def __new__(cls):
        # Singleton pattern to ensure only one instance
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        # Only initialize session once (lazy loading)
        if self._session is None:
            logging.info("Initializing AI model (one-time setup)...")
            # Use u2net_human_seg for better quality
            self._session = new_session('u2net_human_seg')
            logging.info("AI model loaded successfully!")
    
    def check_memory(self):
        """Check memory usage and cleanup if needed"""
        memory = psutil.virtual_memory()
        if memory.percent > 80:
            logging.warning(f"High memory usage: {memory.percent}%")
            gc.collect()  # Force garbage collection
            memory = psutil.virtual_memory()
            if memory.percent > 90:
                raise MemoryError(f"Insufficient memory: {memory.percent}% used")
        logging.info(f"Memory usage: {memory.percent}%")

    def fix_image_orientation(self, img: Image.Image) -> Image.Image:
        """
        Fix image orientation based on EXIF data.
        Some images (especially from smartphones) contain orientation metadata
        that needs to be applied to display the image correctly.
        """
        try:
            # Check if image has EXIF data
            if hasattr(img, '_getexif') and img._getexif():
                exif = dict(img._getexif().items())
                
                # Find the orientation tag
                orientation_key = None
                for key in ExifTags.TAGS.keys():
                    if ExifTags.TAGS[key] == 'Orientation':
                        orientation_key = key
                        break
                
                if orientation_key and orientation_key in exif:
                    orientation = exif[orientation_key]
                    logging.info(f"Found EXIF orientation: {orientation}")
                    
                    # Apply orientation
                    if orientation == 2:
                        # Horizontal flip
                        img = img.transpose(Image.FLIP_LEFT_RIGHT)
                    elif orientation == 3:
                        # 180 degree rotation
                        img = img.transpose(Image.ROTATE_180)
                    elif orientation == 4:
                        # Vertical flip
                        img = img.transpose(Image.FLIP_TOP_BOTTOM)
                    elif orientation == 5:
                        # Horizontal flip + 90 degree rotation
                        img = img.transpose(Image.FLIP_LEFT_RIGHT).transpose(Image.ROTATE_90)
                    elif orientation == 6:
                        # 90 degree rotation
                        img = img.transpose(Image.ROTATE_270)
                    elif orientation == 7:
                        # Horizontal flip + 270 degree rotation
                        img = img.transpose(Image.FLIP_LEFT_RIGHT).transpose(Image.ROTATE_270)
                    elif orientation == 8:
                        # 270 degree rotation
                        img = img.transpose(Image.ROTATE_90)
                    
                    logging.info("Applied EXIF orientation correction")
        except Exception as e:
            logging.warning(f"Error fixing image orientation: {str(e)}")
            # Continue with original image if orientation fix fails
            
        return img
    
    async def convert_image(self, image_path: Path) -> Tuple[Path, str]:
        """
        Convert any image format to an optimized format (JPEG or PNG).
        Returns the path to the converted file and the format used.
        """
        try:
            logging.info(f"Converting and optimizing image: {image_path}")
            
            temp_dir = Path("uploads/temp")
            temp_dir.mkdir(exist_ok=True)
            
            # Determine if the image has transparency
            has_transparency = False
            with Image.open(image_path) as img:
                # Fix orientation based on EXIF data
                img = self.fix_image_orientation(img)
                
                if img.mode == 'RGBA' or 'transparency' in img.info:
                    has_transparency = True
                
                # Choose format based on transparency
                if has_transparency:
                    output_format = "PNG"
                    output_path = temp_dir / f"{image_path.stem}_converted.png"
                else:
                    output_format = "JPEG"
                    output_path = temp_dir / f"{image_path.stem}_converted.jpg"
                
                # Convert color mode if needed
                if img.mode not in ('RGB', 'RGBA'):
                    img = img.convert('RGB' if output_format == "JPEG" else 'RGBA')
                
                # Save with appropriate optimization
                if output_format == "JPEG":
                    img.save(output_path, "JPEG", quality=90, optimize=True)
                else:
                    img.save(output_path, "PNG", optimize=True)
            
            logging.info(f"Image converted successfully to {output_format}: {output_path}")
            return output_path, output_format
            
        except Exception as e:
            logging.error(f"Image conversion failed: {str(e)}")
            raise ValueError(f"Image conversion failed: {str(e)}")

    def calculate_resize_dimensions(self, width: int, height: int) -> Tuple[int, int]:
        """
        Calculate dimensions for resizing while maintaining aspect ratio.
        Target resolution is 1080p (1920x1080) max.
        """
        # Target max dimensions (1080p)
        MAX_WIDTH = 1920
        MAX_HEIGHT = 1080
        
        # If image is already smaller than target, keep original size
        if width <= MAX_WIDTH and height <= MAX_HEIGHT:
            return width, height
            
        # Calculate aspect ratio
        aspect_ratio = width / height
        
        # Determine which dimension to constrain
        if aspect_ratio > MAX_WIDTH / MAX_HEIGHT:  # Width is the limiting factor
            new_width = MAX_WIDTH
            new_height = int(new_width / aspect_ratio)
        else:  # Height is the limiting factor
            new_height = MAX_HEIGHT
            new_width = int(new_height * aspect_ratio)
            
        return new_width, new_height

    def post_process_mask(self, mask: np.ndarray) -> np.ndarray:
        """
        Apply post-processing to improve mask quality.
        - Smooths edges
        - Removes noise
        - Enhances contrast
        """
        # Convert to PIL Image for filtering
        mask_img = Image.fromarray(mask)
        
        # Apply slight Gaussian blur to smooth edges
        mask_img = mask_img.filter(ImageFilter.GaussianBlur(radius=0.7))
        
        # Convert back to numpy array
        processed_mask = np.array(mask_img)
        
        # Enhance contrast (make edges more defined)
        # Values below 50 become 0, values above 200 become 255
        processed_mask = np.where(processed_mask < 50, 0, processed_mask)
        processed_mask = np.where(processed_mask > 200, 255, processed_mask)
        
        return processed_mask

    async def segment_image(self, image_path: Path) -> Tuple[Path, Path, Path]:
        """
        Segment an image to separate foreground and background.
        Optimized for balance between quality and performance.
        
        Args:
            image_path: Path to the input image
            
        Returns:
            Tuple of paths to foreground, background, and mask images
        """
        start_time = time.time()
        processing_path = None
        converted_path = None
        
        try:
            # Check memory before starting
            self.check_memory()
            logging.info(f"Starting segmentation for image: {image_path}")
            
            # Convert image to optimized format
            converted_path, format_used = await self.convert_image(image_path)
            
            # Get original dimensions
            with Image.open(converted_path) as img:
                original_width, original_height = img.size
                logging.info(f"Original image dimensions: {original_width}x{original_height}")
                
                # Calculate resize dimensions for processing (1080p max)
                new_width, new_height = self.calculate_resize_dimensions(original_width, original_height)
                
                # Only resize if dimensions changed
                if new_width != original_width or new_height != original_height:
                    logging.info(f"Resizing image to {new_width}x{new_height} for processing")
                    img = img.resize((new_width, new_height), Image.LANCZOS)
                    
                    temp_dir = Path("uploads/temp")
                    temp_dir.mkdir(exist_ok=True)
                    processing_path = temp_dir / f"resized_{image_path.name}"
                    img.save(processing_path, optimize=True)
                else:
                    processing_path = converted_path
                    logging.info("Image already at optimal size, no resizing needed")
            
            # Check memory before AI processing
            self.check_memory()
            
            # Perform segmentation with the singleton session
            logging.info("Running AI segmentation...")
            with Image.open(processing_path) as input_image:
                input_image = input_image.convert('RGBA')
                output = remove(input_image, session=self._session, alpha_matting=True)
                
                # Get the alpha channel (mask)
                output_array = np.array(output)
                alpha_channel = output_array[:, :, 3]
                
                # Apply post-processing to improve mask quality
                refined_alpha = self.post_process_mask(alpha_channel)
                
                # Create foreground with the refined alpha
                input_array = np.array(input_image)
                foreground = input_array.copy()
                foreground[:, :, 3] = refined_alpha
                
                # Create background (inverse of foreground alpha)
                background = input_array.copy()
                background[:, :, 3] = 255 - refined_alpha
                
                # Convert to PIL images
                foreground_img = Image.fromarray(foreground)
                background_img = Image.fromarray(background)
                mask_img = Image.fromarray(refined_alpha)
            
            # Save results
            processed_dir = Path("uploads/processed")
            processed_dir.mkdir(exist_ok=True)
            base_name = image_path.stem
            
            mask_path = processed_dir / f"{base_name}_mask.png"
            fore_path = processed_dir / f"{base_name}_foreground.png"
            back_path = processed_dir / f"{base_name}_background.png"
            
            # Save with appropriate quality settings
            mask_img.save(mask_path, "PNG", optimize=True)
            foreground_img.save(fore_path, "PNG", optimize=True)
            background_img.save(back_path, "PNG", optimize=True)
            
            # Clean up temporary files
            for path in [processing_path, converted_path]:
                if path and path != image_path and os.path.exists(path):
                    try:
                        os.remove(path)
                    except Exception as e:
                        logging.warning(f"Failed to remove temporary file {path}: {e}")
            
            # Force garbage collection
            gc.collect()
            
            elapsed_time = time.time() - start_time
            logging.info(f"Segmentation completed successfully in {elapsed_time:.2f} seconds")
            
            return fore_path, back_path, mask_path
        
        except Exception as e:
            # Clean up temporary files on error
            for path in [processing_path, converted_path]:
                if path and path != image_path and os.path.exists(path):
                    try:
                        os.remove(path)
                    except:
                        pass
            
            # Force garbage collection
            gc.collect()
            
            logging.error(f"Segmentation failed: {str(e)}")
            raise ValueError(f"Image segmentation failed: {str(e)}")