import boto3
from botocore.exceptions import ClientError, NoCredentialsError, EndpointConnectionError
from pathlib import Path
from typing import Dict
import os
from dotenv import load_dotenv
from PIL import Image
import io
import uuid
import logging
import shutil

load_dotenv()

# Get logger
logger = logging.getLogger(__name__)

# Check if S3 credentials are properly configured
has_s3 = (
    os.getenv('S3_ACCESS_KEY_ID') is not None and
    os.getenv('S3_SECRET_ACCESS_KEY') is not None and
    os.getenv('S3_BUCKET') is not None
)

# S3 configuration
S3_BUCKET = os.getenv('S3_BUCKET', 'procaption-bucket')
S3_REGION = os.getenv('S3_REGION', 'ap-south-1')
S3_URL = os.getenv('S3_URL', 'https://sandbox-opener-bucket.s3.ap-south-1.amazonaws.com')

# Initialize the S3 client
s3_client = None
if has_s3:
    try:
        # Configure S3 client
        s3_client = boto3.client(
            's3',
            region_name=S3_REGION,
            aws_access_key_id=os.getenv('S3_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('S3_SECRET_ACCESS_KEY')
        )
        # Test connection by listing buckets
        s3_client.list_buckets()
        logger.info("AWS S3 client configured and connected successfully")
    except NoCredentialsError:
        logger.error("AWS credentials not found or invalid. Check your environment variables.")
        s3_client = None
    except EndpointConnectionError:
        logger.error(f"Cannot connect to S3 endpoint for region {S3_REGION}. Check network connectivity.")
        s3_client = None
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        error_message = e.response.get('Error', {}).get('Message', 'Unknown error')
        logger.error(f"AWS S3 client error: {error_code} - {error_message}")
        s3_client = None
    except Exception as e:
        logger.error(f"Unexpected error initializing S3 client: {str(e)}")
        s3_client = None
else:
    logger.warning("AWS S3 credentials not configured properly. Check your environment variables.")
    s3_client = None

class S3Service:
    @staticmethod
    async def upload_image(image_path: Path, folder: str = "processed") -> Dict:
        """
        Upload an image from a file path to S3
        
        Args:
            image_path: Path to the image file
            folder: Optional folder name within the bucket
            
        Returns:
            Dict containing the URL and key of the uploaded image
        """
        try:
            # First check if the file exists
            if not os.path.exists(image_path):
                raise FileNotFoundError(f"Image file not found: {image_path}")
                
            if not has_s3 or s3_client is None:
                # Fallback to local path if S3 is not configured
                return S3Service._handle_local_fallback(image_path, folder)
            
            # Generate a unique filename within the specified folder
            filename = Path(image_path).name
            base_name, ext = os.path.splitext(filename)
            # Replace spaces with underscores to avoid URL encoding issues
            safe_base_name = base_name.replace(" ", "_")
            unique_id = uuid.uuid4().hex[:8]
            s3_key = f"{folder}/{safe_base_name}_{unique_id}{ext}"
            
            try:
                # Upload the file to S3
                s3_client.upload_file(
                    str(image_path),
                    S3_BUCKET,
                    s3_key,
                    ExtraArgs={
                        'ContentType': f'image/{ext[1:]}' if ext.startswith('.') else f'image/{ext}'
                    }
                )
                
                # Generate the public URL
                url = f"{S3_URL}/{s3_key}"
                logger.info(f"Uploaded image to S3: {url}")
                
                return {
                    "url": url,
                    "public_id": s3_key
                }
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', 'Unknown')
                error_message = e.response.get('Error', {}).get('Message', 'Unknown error')
                logger.error(f"S3 upload error: {error_code} - {error_message}")
                
                # If it's an access issue, we'll try again without the content type to see if that helps
                if error_code == 'AccessDenied':
                    try:
                        logger.info("Attempting upload without ExtraArgs due to AccessDenied error")
                        s3_client.upload_file(
                            str(image_path),
                            S3_BUCKET,
                            s3_key
                        )
                        
                        # If successful, generate the URL
                        url = f"{S3_URL}/{s3_key}"
                        logger.info(f"Uploaded image to S3 without ExtraArgs: {url}")
                        
                        return {
                            "url": url,
                            "public_id": s3_key
                        }
                    except Exception as retry_error:
                        logger.error(f"Retry upload also failed: {str(retry_error)}")
                
                # Fallback to local path
                logger.warning(f"Falling back to local storage due to S3 error: {error_code}")
                return S3Service._handle_local_fallback(image_path, folder)
                
        except Exception as e:
            logger.error(f"Failed to upload image to S3: {str(e)}")
            # Fallback to local path for any errors
            return S3Service._handle_local_fallback(image_path, folder)

    @staticmethod
    async def upload_image_data(image: Image.Image, folder: str = "processed") -> Dict:
        """
        Upload a PIL Image object directly to S3
        
        Args:
            image: PIL Image to upload
            folder: Optional folder name within the bucket
            
        Returns:
            Dict containing the URL and key of the uploaded image
        """
        try:
            if not has_s3 or s3_client is None:
                # Fallback to local path if S3 is not configured
                return await S3Service._handle_image_data_local_fallback(image, folder)
            
            # Convert the PIL Image to bytes
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='PNG')
            img_byte_arr.seek(0)
            
            # Generate a unique filename
            unique_id = uuid.uuid4().hex[:8]
            s3_key = f"{folder}/image_{unique_id}.png"
            
            try:
                # Upload the image bytes to S3
                s3_client.upload_fileobj(
                    img_byte_arr,
                    S3_BUCKET,
                    s3_key,
                    ExtraArgs={
                        'ContentType': 'image/png'
                    }
                )
                
                # Generate the public URL
                url = f"{S3_URL}/{s3_key}"
                logger.info(f"Uploaded image data to S3: {url}")
                
                return {
                    "url": url,
                    "public_id": s3_key
                }
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', 'Unknown')
                error_message = e.response.get('Error', {}).get('Message', 'Unknown error')
                logger.error(f"S3 upload error for image data: {error_code} - {error_message}")
                
                # If it's an access issue, we'll try again without the content type
                if error_code == 'AccessDenied':
                    try:
                        logger.info("Attempting upload without ExtraArgs due to AccessDenied error")
                        img_byte_arr.seek(0)  # Reset position
                        s3_client.upload_fileobj(
                            img_byte_arr,
                            S3_BUCKET,
                            s3_key
                        )
                        
                        # If successful, generate the URL
                        url = f"{S3_URL}/{s3_key}"
                        logger.info(f"Uploaded image data to S3 without ExtraArgs: {url}")
                        
                        return {
                            "url": url,
                            "public_id": s3_key
                        }
                    except Exception as retry_error:
                        logger.error(f"Retry upload also failed: {str(retry_error)}")
                
                # Fallback to local path
                logger.warning(f"Falling back to local storage due to S3 error: {error_code}")
                return await S3Service._handle_image_data_local_fallback(image, folder)
                
        except Exception as e:
            logger.error(f"Failed to upload image data to S3: {str(e)}")
            # Fallback to local path for any errors
            return await S3Service._handle_image_data_local_fallback(image, folder)
            
    @staticmethod
    def _handle_local_fallback(image_path: Path, folder: str) -> Dict:
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
            
    @staticmethod
    async def _handle_image_data_local_fallback(image: Image.Image, folder: str) -> Dict:
        """Fallback to local storage when S3 upload fails for image data"""
        logger.info("Using local storage fallback for image data")
        try:
            # Create a public directory
            public_dir = Path("uploads/public")
            public_dir.mkdir(exist_ok=True, parents=True)
            
            # Generate a unique filename
            unique_id = uuid.uuid4().hex[:8]
            new_filename = f"image_{unique_id}.png"
            
            # Save the image to the public directory
            public_path = public_dir / new_filename
            image.save(public_path, format='PNG')
            
            # Generate a local URL
            local_url = f"/uploads/public/{new_filename}"
            logger.info(f"Local fallback for image data: Saved to {public_path}, URL: {local_url}")
            
            return {
                "url": local_url,
                "public_id": new_filename
            }
        except Exception as e:
            logger.error(f"Local fallback for image data also failed: {str(e)}")
            # Create a temporary file as a last resort
            temp_path = f"uploads/temp/error_fallback_{uuid.uuid4().hex[:8]}.png"
            try:
                os.makedirs(os.path.dirname(temp_path), exist_ok=True)
                image.save(temp_path, format='PNG')
                return {
                    "url": f"/{temp_path}",
                    "public_id": os.path.basename(temp_path)
                }
            except:
                # If all else fails, return a placeholder
                return {
                    "url": "/uploads/error_image.png",
                    "public_id": "error_image.png"
                } 