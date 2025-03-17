#!/usr/bin/env python3
"""
Script to add custom fonts to ProCaptions
"""

import argparse
import os
import sys
import shutil
import logging
from pathlib import Path
import requests

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def download_font(url, output_path):
    """Download a font from a URL"""
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        logger.info(f"Downloaded font to {output_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to download font: {str(e)}")
        return False

def add_font(font_path=None, font_url=None, font_name=None):
    """Add a font to the fonts directory"""
    fonts_dir = Path("assets/fonts")
    fonts_dir.mkdir(exist_ok=True, parents=True)
    
    if font_path:
        # Copy from local path
        src_path = Path(font_path)
        if not src_path.exists():
            logger.error(f"Font file not found: {font_path}")
            return False
        
        # Use original filename if font_name not provided
        if not font_name:
            font_name = src_path.name
        
        # Ensure extension is preserved
        if not font_name.lower().endswith(('.ttf', '.otf')):
            ext = src_path.suffix
            font_name += ext
        
        dest_path = fonts_dir / font_name
        shutil.copy2(src_path, dest_path)
        logger.info(f"Added font: {dest_path}")
        
    elif font_url:
        # Download from URL
        if not font_name:
            # Extract filename from URL
            font_name = os.path.basename(font_url)
        
        # Ensure extension is preserved
        if not font_name.lower().endswith(('.ttf', '.otf')):
            font_name += ".ttf"  # Assume TTF as default
        
        dest_path = fonts_dir / font_name
        if download_font(font_url, dest_path):
            logger.info(f"Added font: {dest_path}")
        else:
            return False
    else:
        logger.error("Must provide either a font path or URL")
        return False
    
    # Update the font mapping in composition.py (optional)
    try:
        update_font_mapping(font_name)
    except Exception as e:
        logger.warning(f"Could not update font mapping: {str(e)}")
    
    return True

def update_font_mapping(font_name):
    """Update the font mapping in composition.py (optional)"""
    # This is optional and may require more sophisticated code parsing
    # For now, we'll just remind the user to update manually
    logger.info(
        f"Font added successfully. To use it with a friendly name, "
        f"you may want to update the 'dramatic_fonts' dictionary in "
        f"src/services/composition.py with:\n"
        f"    \"your_font_name\": \"{font_name}\","
    )

def main():
    parser = argparse.ArgumentParser(description="Add custom fonts to ProCaptions")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--path", help="Local path to the font file")
    group.add_argument("--url", help="URL to download the font from")
    parser.add_argument("--name", help="Custom name for the font (optional)")
    
    args = parser.parse_args()
    
    success = add_font(font_path=args.path, font_url=args.url, font_name=args.name)
    
    if success:
        print("Font added successfully!")
    else:
        print("Failed to add font.")
        sys.exit(1)

if __name__ == "__main__":
    main() 