#!/usr/bin/env python3
"""
Script to download SAM (Segment Anything Model) checkpoint
"""

import os
import sys
import requests
import logging
from pathlib import Path
from tqdm import tqdm

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

SAM_CHECKPOINTS = {
    "vit_b": {
        "url": "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth",
        "size": 375034592,  # ~358 MB
        "description": "ViT-B SAM model (fastest, used in this project)"
    }
}

def download_file(url, output_path, expected_size=None):
    """
    Download a file with progress bar
    """
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # Get file size for progress bar
        total_size = int(response.headers.get('content-length', 0))
        if expected_size and total_size > 0 and total_size != expected_size:
            logger.warning(f"Expected file size ({expected_size}) doesn't match reported size ({total_size})")
        
        block_size = 1024 * 1024  # 1 MB chunks
        
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

def download_sam_model(model_type="vit_b"):
    """
    Download SAM model checkpoint
    """
    if model_type not in SAM_CHECKPOINTS:
        logger.error(f"Unknown model type: {model_type}")
        logger.info(f"Available models: {', '.join(SAM_CHECKPOINTS.keys())}")
        return False
    
    model_info = SAM_CHECKPOINTS[model_type]
    models_dir = Path("src/models")
    models_dir.mkdir(exist_ok=True, parents=True)
    
    # Get the filename from the URL
    filename = os.path.basename(model_info["url"])
    output_path = models_dir / filename
    
    # Check if file already exists
    if output_path.exists() and output_path.stat().st_size == model_info["size"]:
        logger.info(f"Model already exists at {output_path}")
        return True
    
    # Download the model
    logger.info(f"Downloading {model_type} model ({model_info['description']})")
    logger.info(f"File size: {model_info['size'] / (1024*1024):.1f} MB")
    
    return download_file(model_info["url"], output_path, model_info["size"])

def main():
    # Simple CLI
    import argparse
    parser = argparse.ArgumentParser(description="Download SAM model checkpoints")
    parser.add_argument(
        "--model", 
        choices=list(SAM_CHECKPOINTS.keys()), 
        default="vit_b",
        help="Model type to download"
    )
    
    args = parser.parse_args()
    
    print("Segment Anything Model (SAM) Downloader")
    print("----------------------------------------")
    print(f"Model: {args.model} ({SAM_CHECKPOINTS[args.model]['description']})")
    print(f"Size: {SAM_CHECKPOINTS[args.model]['size'] / (1024*1024):.1f} MB")
    print()
    
    success = download_sam_model(args.model)
    
    if success:
        print("\nDownload completed successfully!")
    else:
        print("\nDownload failed.")
        sys.exit(1)

if __name__ == "__main__":
    main() 