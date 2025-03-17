import cloudinary
import cloudinary.uploader
from pathlib import Path
from typing import Dict
import os
from dotenv import load_dotenv
from PIL import Image
import io
import shutil
import uuid
import logging

load_dotenv()

# Get logger
logger = logging.getLogger(__name__)

# Check if Cloudinary credentials are properly configured
has_cloudinary = (
    os.getenv('CLOUDINARY_CLOUD_NAME') != 'your_cloud_name' and
    os.getenv('CLOUDINARY_API_KEY') != 'your_api_key' and
    os.getenv('CLOUDINARY_API_SECRET') != 'your_api_secret'
)

if has_cloudinary:
    # Configure Cloudinary
    cloudinary.config(
        cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
        api_key=os.getenv('CLOUDINARY_API_KEY'),
        api_secret=os.getenv('CLOUDINARY_API_SECRET')
    )
    logger.info("Cloudinary configured with provided credentials")
else:
    logger.warning("Cloudinary credentials not configured. Using local storage instead.")

class CloudinaryService:
    @staticmethod
    async def upload_image(image_path: Path, folder: str = "processed") -> Dict:
        try:
            if has_cloudinary:
                # Use actual Cloudinary service
                result = cloudinary.uploader.upload(
                    str(image_path),
                    folder=folder,
                    resource_type="image",
                    quality="auto:best",
                    fetch_format="auto"
                )
                return {
                    "url": result["secure_url"],
                    "public_id": result["public_id"]
                }
            else:
                # Create a mock implementation that works locally
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
                logger.info(f"Local storage: Copied {image_path} to {public_path}, URL: {local_url}")
                
                return {
                    "url": local_url,
                    "public_id": new_filename
                }
        except Exception as e:
            logger.error(f"Failed to handle image: {str(e)}")
            raise Exception(f"Failed to handle image: {str(e)}")

    @staticmethod
    async def upload_image_data(image: Image.Image, folder: str = "processed") -> Dict:
        try:
            if has_cloudinary:
                # Convert PIL Image to bytes and use actual Cloudinary
                img_byte_arr = io.BytesIO()
                image.save(img_byte_arr, format='PNG')
                img_byte_arr = img_byte_arr.getvalue()

                result = cloudinary.uploader.upload(
                    img_byte_arr,
                    folder=folder,
                    resource_type="image",
                    quality="auto:best",
                    fetch_format="auto"
                )
                return {
                    "url": result["secure_url"],
                    "public_id": result["public_id"]
                }
            else:
                # Create a mock implementation that works locally
                public_dir = Path("uploads/public")
                public_dir.mkdir(exist_ok=True, parents=True)
                
                # Generate a unique filename
                unique_id = uuid.uuid4().hex[:8]
                # Use a safe filename without spaces
                new_filename = f"image_{unique_id}.png"
                
                # Save the image to the public directory
                public_path = public_dir / new_filename
                image.save(public_path, format='PNG')
                
                # Generate a local URL
                local_url = f"/uploads/public/{new_filename}"
                
                return {
                    "url": local_url,
                    "public_id": new_filename
                }
        except Exception as e:
            raise Exception(f"Failed to handle image data: {str(e)}") 