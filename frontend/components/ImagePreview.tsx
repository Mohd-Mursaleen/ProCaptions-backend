import React, { useEffect } from 'react';
import { Position } from '../types/api';

interface ImagePreviewProps {
  backgroundImage: string | null;
  overlayImage: string | null;
  finalImage: string | null;
  isLoading: boolean;
  onClick?: (position: Position) => void;
}

// Helper function to ensure image URLs are properly formatted
const getFullImageUrl = (url: string | null): string | null => {
  if (!url) return null;
  
  console.log('Original URL in getFullImageUrl:', url);
  
  // If it's an absolute URL (starts with http or https), return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // If it's a relative URL from our local storage, point directly to backend
  if (url.startsWith('/uploads/')) {
    // For development - point directly to the backend server
    const fullUrl = `http://localhost:8000${url}`;
    console.log('Converted to backend URL:', fullUrl);
    return fullUrl;
  }
  
  // If it's just a filename without path, assume it's in public directory
  if (!url.includes('/') && !url.startsWith('data:')) {
    // Point to backend public directory
    const fullUrl = `http://localhost:8000/uploads/public/${url}`;
    console.log('Assumed backend public URL:', fullUrl);
    return fullUrl;
  }
  
  // In other cases, return as is
  return url;
};

const ImagePreview: React.FC<ImagePreviewProps> = ({
  backgroundImage,
  overlayImage,
  finalImage,
  isLoading,
  onClick,
}) => {
  // Debug logging
  useEffect(() => {
    const displayImage = finalImage || overlayImage || backgroundImage;
    console.log('ImagePreview - Raw URL:', displayImage);
    console.log('ImagePreview - Formatted URL:', getFullImageUrl(displayImage));
  }, [backgroundImage, overlayImage, finalImage]);

  // Calculate image dimensions for click coordinates
  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!onClick) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    
    onClick({ x, y });
  };
  
  if (isLoading) {
    return (
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="inline-block animate-spin h-8 w-8 border-3 border-blue-500 border-t-transparent rounded-full"></div>
          <p className="mt-4 text-gray-600">Processing your image...</p>
        </div>
      </div>
    );
  }
  
  if (!backgroundImage && !overlayImage && !finalImage) {
    return (
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">No image to preview</p>
          <p className="text-sm mt-2">Upload an image to get started</p>
        </div>
      </div>
    );
  }
  
  // Show the most processed version of the image that's available
  const displayImage = finalImage || overlayImage || backgroundImage;
  
  return (
    <div className="w-full bg-gray-100 rounded-lg flex justify-center overflow-hidden">
      {displayImage && (
        <img
          src={getFullImageUrl(displayImage) || ''}
          alt="Preview"
          className="max-w-full object-contain"
          onClick={handleImageClick}
          style={{ cursor: onClick ? 'crosshair' : 'default' }}
          onError={(e) => {
            console.error('Error loading image:', (e.target as HTMLImageElement).src);
          }}
        />
      )}
    </div>
  );
};

export default ImagePreview; 