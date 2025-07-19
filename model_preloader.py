# Model preloader for faster startup
import asyncio
import logging
from rembg import new_session
from PIL import Image
import numpy as np
import io

logger = logging.getLogger(__name__)

class ModelPreloader:
    def __init__(self):
        self.session = None
        self.is_loaded = False
    
    async def preload_model(self):
        """Preload the rembg model during startup"""
        try:
            logger.info("Preloading rembg model...")
            
            # Initialize session
            self.session = new_session('u2netp')
            
            # Create a small dummy image to trigger model download
            dummy_image = Image.new('RGB', (100, 100), color='red')
            
            # Run a dummy segmentation to ensure model is loaded
            logger.info("Running dummy segmentation to warm up model...")
            from rembg import remove
            result = remove(dummy_image, session=self.session)
            
            self.is_loaded = True
            logger.info("Model preloaded successfully!")
            
        except Exception as e:
            logger.error(f"Failed to preload model: {str(e)}")
            self.is_loaded = False
    
    def get_session(self):
        """Get the preloaded session"""
        if not self.is_loaded:
            raise RuntimeError("Model not loaded. Call preload_model() first.")
        return self.session

# Global instance
model_preloader = ModelPreloader()