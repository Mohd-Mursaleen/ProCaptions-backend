import os
import time
from pathlib import Path
import logging
import asyncio
import glob

logger = logging.getLogger(__name__)

class ImageCleanupService:
    def __init__(self, cleanup_delay: int = 600):  # 600 seconds = 10 minutes
        self.cleanup_delay = cleanup_delay
        self.files_to_cleanup = {}

    async def schedule_cleanup(self, file_path: str):
        """Schedule a file for cleanup after the delay"""
        self.files_to_cleanup[file_path] = time.time() + self.cleanup_delay
        logger.info(f"Scheduled cleanup for {file_path} in {self.cleanup_delay} seconds")

    async def cleanup_task(self):
        """Background task to clean up expired files"""
        while True:
            current_time = time.time()
            files_to_remove = []

            # Find files that need to be cleaned up
            for file_path, expiry_time in self.files_to_cleanup.items():
                if current_time >= expiry_time:
                    try:
                        if os.path.exists(file_path):
                            os.remove(file_path)
                            logger.info(f"Cleaned up file: {file_path}")
                        files_to_remove.append(file_path)
                    except Exception as e:
                        logger.error(f"Error cleaning up file {file_path}: {str(e)}")
                        files_to_remove.append(file_path)

            # Remove cleaned up files from tracking
            for file_path in files_to_remove:
                self.files_to_cleanup.pop(file_path, None)

            # Sleep for a bit before next check
            await asyncio.sleep(90)  # Check every 30 seconds

    async def cleanup_all_temp_files(self):
        """Clean up all files in temp and processed directories"""
        dirs_to_clean = [
            "uploads/temp",
            "uploads/processed",
            "uploads/public"
        ]

        for dir_path in dirs_to_clean:
            if os.path.exists(dir_path):
                files = glob.glob(os.path.join(dir_path, "*.*"))
                for file_path in files:
                    try:
                        os.remove(file_path)
                        logger.info(f"Cleaned up old file: {file_path}")
                    except Exception as e:
                        logger.error(f"Error cleaning up file {file_path}: {str(e)}")

# Create singleton instance
cleanup_service = ImageCleanupService()
