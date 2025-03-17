import os
import requests
import logging
from pathlib import Path
import sys
from tqdm import tqdm

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def download_file(url, output_path):
    """
    Download a file with progress bar
    """
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        block_size = 1024  # 1 KB
        
        with open(output_path, 'wb') as file, tqdm(
            desc=os.path.basename(output_path),
            total=total_size,
            unit='B',
            unit_scale=True,
            unit_divisor=1024,
        ) as bar:
            for data in response.iter_content(block_size):
                file.write(data)
                bar.update(len(data))
                
        logger.info(f"Downloaded {os.path.basename(output_path)} successfully")
        return True
    except Exception as e:
        logger.error(f"Download failed: {str(e)}")
        return False

def setup_sam_model():
    """
    Download SAM model checkpoint if needed
    """
    models_dir = Path("src/models")
    models_dir.mkdir(exist_ok=True, parents=True)
    
    # SAM checkpoint - use vit_b (smaller and faster) instead of vit_h
    sam_checkpoint = models_dir / "sam_vit_b_01ec64.pth"
    sam_url = "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth"
    
    if not sam_checkpoint.exists():
        logger.info("SAM model checkpoint not found, downloading vit_b model (smaller, faster)...")
        if download_file(sam_url, sam_checkpoint):
            logger.info("SAM model checkpoint downloaded successfully")
        else:
            logger.warning("Failed to download SAM model checkpoint")
    else:
        logger.info("SAM vit_b model checkpoint already exists")

def setup_yolo_model():
    """
    Download YOLOv8 model if needed (handled by ultralytics library)
    """
    try:
        from ultralytics import YOLO
        logger.info("Checking YOLOv8 model...")
        
        # Force download by loading the model
        # This will trigger the download if not present
        model = YOLO("yolov8n.pt")
        logger.info("YOLOv8 model ready")
    except Exception as e:
        logger.error(f"Error setting up YOLOv8 model: {str(e)}")

def download_fonts():
    """
    Download required fonts
    """
    fonts_dir = Path("assets/fonts")
    fonts_dir.mkdir(exist_ok=True, parents=True)
    
    # Define fonts to download
    fonts = {
        "Anton-Regular.ttf": "https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf",
        "SixCaps.ttf": "https://github.com/google/fonts/raw/main/ofl/sixcaps/SixCaps.ttf",
    }
    
    for font_name, font_url in fonts.items():
        font_path = fonts_dir / font_name
        if not font_path.exists():
            logger.info(f"Downloading font: {font_name}")
            if download_file(font_url, font_path):
                logger.info(f"Font {font_name} downloaded successfully")
            else:
                logger.warning(f"Failed to download font {font_name}")
        else:
            logger.info(f"Font {font_name} already exists")

def setup_models():
    """
    Main function to setup all required models
    """
    logger.info("Starting model setup")
    
    setup_sam_model()
    setup_yolo_model()
    download_fonts()
    
    logger.info("Model setup complete")

if __name__ == "__main__":
    setup_models() 