import numpy as np
from PIL import Image, ImageFilter
from pathlib import Path
import logging
from typing import Tuple, Optional, List, Dict, Any
import cv2
import torch
import os
import json
import hashlib
import base64
import pickle
from ultralytics import YOLO
import time
import redis

# SAM imports
from segment_anything import sam_model_registry, SamPredictor

class SegmentationService:
    def __init__(self):
        # Initialize models directory
        self.models_dir = Path("src/models")
        self.models_dir.mkdir(exist_ok=True)
        
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
        
        # Load YOLOv8 model
        try:
            self.yolo_model = YOLO("yolov8n.pt")  # Using the nano model for faster inference
            logging.info("YOLOv8 model loaded successfully")
        except Exception as e:
            logging.error(f"Failed to load YOLOv8 model: {str(e)}")
            self.yolo_model = None
        
        # Load SAM model
        try:
            # Check if SAM checkpoint exists, otherwise download
            model_type = "vit_b"  # Use the smallest and fastest model (vit_b)
            sam_checkpoint = self.models_dir / "sam_vit_b_01ec64.pth"
            
            if not sam_checkpoint.exists():
                logging.info(f"SAM model not found, please download from https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth")
                # Attempt to auto-download the model
                try:
                    from src.setup.download_sam import download_sam_model
                    logging.info("Attempting to auto-download the SAM model...")
                    success = download_sam_model(model_type)
                    if not success:
                        logging.warning("Failed to auto-download SAM model")
                except Exception as e:
                    logging.error(f"Auto-download failed: {str(e)}")
            
            if sam_checkpoint.exists():
                # Load SAM if checkpoint exists
                device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
                logging.info(f"Loading SAM model on {device} (this may take a moment)...")
                sam = sam_model_registry[model_type](checkpoint=str(sam_checkpoint))
                sam.to(device)
                self.sam_predictor = SamPredictor(sam)
                logging.info(f"SAM model (vit_b) loaded successfully on {device}")
            else:
                self.sam_predictor = None
                logging.warning("SAM model not loaded - proceeding with fallback segmentation")
        except Exception as e:
            logging.error(f"Failed to load SAM model: {str(e)}")
            self.sam_predictor = None
    
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

    def _detect_objects(self, image_path: Path) -> List[Dict[str, Any]]:
        """Detect objects in the image using YOLOv8"""
        if self.yolo_model is None:
            logging.warning("YOLOv8 model not loaded - skipping object detection")
            return []
        
        try:
            # Run YOLOv8 inference
            results = self.yolo_model(str(image_path), verbose=False)
            
            # Process results
            detections = []
            for result in results:
                for i, (box, conf, cls) in enumerate(zip(result.boxes.xyxy.cpu().numpy(), 
                                                         result.boxes.conf.cpu().numpy(),
                                                         result.boxes.cls.cpu().numpy())):
                    # Filter out low confidence detections
                    if conf >= 0.5:  # Confidence threshold
                        detections.append({
                            'box': box.tolist(),  # [x1, y1, x2, y2]
                            'confidence': float(conf),
                            'class': int(cls),
                            'class_name': result.names[int(cls)]
                        })
            
            # Sort by size (area of bounding box) to prioritize main subjects
            detections.sort(key=lambda d: (d['box'][2] - d['box'][0]) * (d['box'][3] - d['box'][1]), reverse=True)
            
            return detections
        except Exception as e:
            logging.error(f"Object detection failed: {str(e)}")
            return []

    def _generate_sam_mask(self, image: np.ndarray, box: List[float]) -> np.ndarray:
        """Generate a mask for the given image and bounding box using SAM"""
        if self.sam_predictor is None:
            logging.warning("SAM model not loaded - skipping SAM segmentation")
            return None
        
        try:
            # Set the image for the SAM predictor
            self.sam_predictor.set_image(image)
            
            # Convert box to the format expected by SAM
            input_box = np.array(box)
            
            # Generate masks
            masks, scores, _ = self.sam_predictor.predict(
                box=input_box,
                multimask_output=True
            )
            
            # Return the highest scoring mask
            best_mask_idx = np.argmax(scores)
            return masks[best_mask_idx].astype(np.uint8) * 255
        except Exception as e:
            logging.error(f"SAM mask generation failed: {str(e)}")
            return None

    def _postprocess_mask(self, mask: np.ndarray, smooth_iterations: int = 2) -> np.ndarray:
        """Apply post-processing to the mask for cleaner edges"""
        if mask is None:
            return None
        
        try:
            # Convert to PIL for filtering
            mask_pil = Image.fromarray(mask)
            
            # Apply multiple smoothing passes
            for _ in range(smooth_iterations):
                mask_pil = mask_pil.filter(ImageFilter.GaussianBlur(1.5))
            
            # Apply threshold to re-binarize
            mask_np = np.array(mask_pil)
            _, mask_binary = cv2.threshold(mask_np, 127, 255, cv2.THRESH_BINARY)
            
            # Optional: Apply morphological operations for cleaner edges
            kernel = np.ones((3, 3), np.uint8)
            mask_binary = cv2.morphologyEx(mask_binary, cv2.MORPH_CLOSE, kernel)
            
            return mask_binary
        except Exception as e:
            logging.error(f"Mask post-processing failed: {str(e)}")
            return mask  # Return original mask if processing fails

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
                temp_path = Path("uploads/temp") / f"resized_{image_path.name}"
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
            
            # Read image
            input_image = Image.open(processing_path).convert('RGBA')
            input_array = np.array(input_image)
            
            # OpenCV expects BGR format for processing
            cv_image = cv2.cvtColor(input_array, cv2.COLOR_RGBA2BGR)
            
            # Time checkpoint for object detection
            det_start = time.time()
            
            # Detect objects using YOLOv8
            detections = self._detect_objects(processing_path)
            logging.info(f"Object detection completed in {time.time() - det_start:.2f} seconds, found {len(detections)} objects")
            
            # If we have detections and SAM is available, use them for segmentation
            if detections and self.sam_predictor is not None:
                # Use the largest detection (likely the main subject)
                main_subject = detections[0]
                box = main_subject['box']
                
                # Time checkpoint for SAM
                sam_start = time.time()
                
                # Generate mask using SAM
                logging.info(f"Generating mask using SAM for main subject: {main_subject['class_name']}")
                mask = self._generate_sam_mask(cv_image[:, :, :3], box)  # Remove alpha channel for SAM
                logging.info(f"SAM mask generation completed in {time.time() - sam_start:.2f} seconds")
                
                # Post-process the mask for cleaner edges
                if mask is not None:
                    post_start = time.time()
                    refined_alpha = self._postprocess_mask(mask)
                    logging.info(f"Mask post-processing completed in {time.time() - post_start:.2f} seconds")
                else:
                    # Fallback to a simple thresholded mask based on the bounding box
                    logging.warning("SAM mask generation failed, falling back to bounding box mask")
                    x1, y1, x2, y2 = [int(coord) for coord in box]
                    refined_alpha = np.zeros(cv_image.shape[:2], dtype=np.uint8)
                    refined_alpha[y1:y2, x1:x2] = 255
            else:
                fallback_start = time.time()
                logging.info("No objects detected or SAM not available, falling back to rembg")
                # Fallback to rembg if SAM or YOLOv8 failed
                try:
                    from rembg import remove
                    output = remove(input_image)
                    output_array = np.array(output)
                    refined_alpha = output_array[:, :, 3]
                    logging.info(f"rembg fallback completed in {time.time() - fallback_start:.2f} seconds")
                except ImportError:
                    logging.error("rembg not available for fallback")
                    # Create a simple mask
                    refined_alpha = np.ones(input_array.shape[:2], dtype=np.uint8) * 255
            
            # If image was resized, upscale the mask back to original dimensions
            if is_resized:
                logging.info(f"Resizing mask back to original dimensions: {original_width}x{original_height}")
                refined_alpha_pil = Image.fromarray(refined_alpha)
                refined_alpha_pil = refined_alpha_pil.resize((original_width, original_height), Image.LANCZOS)
                refined_alpha = np.array(refined_alpha_pil)
                
                # Also resize input_array back to original
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