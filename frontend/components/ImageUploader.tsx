import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUpload } from 'react-icons/fi';

interface ImageUploaderProps {
  onUploadComplete: (file: File) => void;
  isLoading: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onUploadComplete, isLoading }) => {
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        
        // Create a preview URL
        const previewUrl = URL.createObjectURL(file);
        setPreview(previewUrl);
        
        // Call the callback with the file
        onUploadComplete(file);
      }
    },
    [onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif']
    },
    maxFiles: 1,
    disabled: isLoading
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        
        {preview ? (
          <div className="flex flex-col items-center">
            <img 
              src={preview} 
              alt="Preview" 
              className="max-h-64 max-w-full mb-4 rounded shadow-sm"
            />
            <p className="text-sm text-gray-500">
              Drag & drop a different image, or click to select
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6">
            <FiUpload className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium mb-1">Drag & drop your image here</p>
            <p className="text-sm text-gray-500">or click to select an image</p>
            <p className="text-xs text-gray-400 mt-2">
              Supports: JPG, PNG, GIF
            </p>
          </div>
        )}
      </div>
      
      {isLoading && (
        <div className="mt-4 text-center">
          <div className="inline-block animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></div>
          <span className="text-gray-600">Processing your image...</span>
        </div>
      )}
    </div>
  );
};

export default ImageUploader; 