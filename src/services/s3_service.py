import boto3
import os
import logging
from pathlib import Path
from botocore.exceptions import ClientError
from dotenv import load_dotenv
import uuid

logger = logging.getLogger(__name__)

class S3Service:
    def __init__(self):
        # Load environment variables
        load_dotenv()
        
        # Get S3 configuration from environment
        self.access_key = os.getenv("S3_ACCESS_KEY_ID")
        self.secret_key = os.getenv("S3_SECRET_ACCESS_KEY")
        self.region = os.getenv("S3_REGION", "ap-south-1")
        self.bucket = os.getenv("S3_BUCKET", "procaption-bucket")
        self.endpoint = os.getenv("S3_ENDPOINT")
        self.s3_url = os.getenv("S3_URL")
        
        # Initialize S3 client
        self.s3 = boto3.client(
            's3',
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name=self.region,
            endpoint_url=self.endpoint
        )
        
        logger.info(f"S3Service initialized with bucket: {self.bucket}")
    
    async def upload_file(self, file_path, folder: str = "processed") -> dict:
        """
        Upload a file to S3 and return the URL
        
        Args:
            file_path: Path to the file to upload (can be string or Path object)
            folder: Folder in S3 bucket to upload to
            
        Returns:
            Dictionary with URL and public ID
        """
        try:
            # Convert to string if it's a Path object
            if isinstance(file_path, Path):
                file_path_str = str(file_path)
            else:
                file_path_str = file_path
                
            # Check if file exists
            if not os.path.exists(file_path_str):
                logger.error(f"File not found: {file_path_str}")
                raise FileNotFoundError(f"File not found: {file_path_str}")
                
            # Generate a unique key for the file
            file_name = os.path.basename(file_path_str)
            base_name, ext = os.path.splitext(file_name)
            unique_id = uuid.uuid4().hex[:8]
            safe_base_name = base_name.replace(" ", "_")
            s3_key = f"{folder}/{safe_base_name}_{unique_id}{ext}"
            
            logger.info(f"Uploading {file_path_str} to S3 bucket {self.bucket} with key {s3_key}")
            
            # Upload the file
            with open(file_path_str, 'rb') as file_data:
                self.s3.upload_fileobj(
                    file_data,
                    self.bucket,
                    s3_key,
                    # ExtraArgs={'ACL': 'public-read', 'ContentType': 'image/png'}
                )
            
            # Generate the URL
            if self.s3_url:
                url = f"{self.s3_url}/{s3_key}"
            else:
                url = f"https://{self.bucket}.s3.{self.region}.amazonaws.com/{s3_key}"
                
            logger.info(f"File uploaded successfully. URL: {url}")
            
            return {
                "url": url,
                "public_id": s3_key
            }
            
        except ClientError as e:
            logger.error(f"S3 upload error: {str(e)}")
            raise ValueError(f"Failed to upload to S3: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error during S3 upload: {str(e)}")
            raise ValueError(f"Failed to upload to S3: {str(e)}")
    
    async def download_file(self, s3_key: str, local_path: Path) -> Path:
        """
        Download a file from S3
        
        Args:
            s3_key: S3 key of the file to download
            local_path: Path where to save the downloaded file
            
        Returns:
            Path to the downloaded file
        """
        try:
            logger.info(f"Downloading {s3_key} from S3 bucket {self.bucket} to {local_path}")
            
            # Ensure the directory exists
            local_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Download the file
            self.s3.download_file(self.bucket, s3_key, str(local_path))
            
            logger.info(f"File downloaded successfully to {local_path}")
            return local_path
            
        except ClientError as e:
            logger.error(f"S3 download error: {str(e)}")
            raise ValueError(f"Failed to download from S3: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error during S3 download: {str(e)}")
            raise ValueError(f"Failed to download from S3: {str(e)}")
    
    async def delete_file(self, s3_key: str) -> bool:
        """
        Delete a file from S3
        
        Args:
            s3_key: S3 key of the file to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f"Deleting {s3_key} from S3 bucket {self.bucket}")
            
            # Delete the file
            self.s3.delete_object(Bucket=self.bucket, Key=s3_key)
            
            logger.info(f"File deleted successfully")
            return True
            
        except ClientError as e:
            logger.error(f"S3 delete error: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Unexpected eacrror during S3 delete: {str(e)}")
            return False