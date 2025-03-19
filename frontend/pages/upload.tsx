import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { SegmentationResponse } from '../types/api';
import { segmentImage } from '../api/procaptions';
import ImageUploader from '../components/ImageUploader';
import { FiArrowRight } from 'react-icons/fi';
import { motion } from 'framer-motion';

const UploadPage: NextPage = () => {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Handle image upload and segmentation
  const handleUpload = async (file: File) => {
    try {
      setIsUploading(true);
      setError(null);
      
      // Upload and segment the image
      const result = await segmentImage(file);
      
      // Ensure result is valid before proceeding
      if (!result || !result.foreground || !result.background) {
        throw new Error('Incomplete segmentation result received');
      }
      
      console.log('Segmentation successful:', result);
      
      // Store segmentation data in localStorage to be accessed by edit page
      localStorage.setItem('segmentationData', JSON.stringify(result));
      
      // Add a small delay before navigation to ensure localStorage is updated
      setTimeout(() => {
        // Navigate to edit page with explicit window location change as a fallback
        router.push('/edit').catch((navigationError) => {
          console.error('Router navigation failed:', navigationError);
          window.location.href = '/edit';
        });
      }, 100);
      
    } catch (error) {
      console.error('Error uploading and segmenting image:', error);
      setError('Failed to process your image. Please try a different image or try again later.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <Head>
        <title>Upload Image | ProCaptions</title>
        <meta name="description" content="Upload an image to create dramatic text overlays with ProCaptions" />
      </Head>

      {/* Navigation */}
      <motion.nav 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`bg-[#030303]/80 backdrop-blur-lg border-b border-white/10 py-4 px-4 md:px-6 ${
          isScrolled ? 'shadow-md' : ''
        }`}
      >
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/" className="text-white font-bold text-xl">
            ProCaptions
          </Link>
          
          <div className="flex items-center space-x-2">
            <div className="text-sm text-white/60">
              Step 1 of 3
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Progress Steps */}
      <div className="container mx-auto px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex items-center justify-center mb-8"
        >
          <div className="flex items-center">
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-rose-500 text-white font-medium">
              1
            </div>
            <div className="ml-2 text-sm font-medium text-white">Upload</div>
          </div>
          
          <div className="w-12 h-0.5 mx-2 bg-white/20"></div>
          
          <div className="flex items-center">
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/50 font-medium">
              2
            </div>
            <div className="ml-2 text-sm font-medium text-white/50">Edit</div>
          </div>
          
          <div className="w-12 h-0.5 mx-2 bg-white/20"></div>
          
          <div className="flex items-center">
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/50 font-medium">
              3
            </div>
            <div className="ml-2 text-sm font-medium text-white/50">Preview</div>
          </div>
        </motion.div>

        {/* Error message */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-900/30 border-l-4 border-red-500 p-4 mx-auto max-w-2xl"
          >
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Upload section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="max-w-2xl mx-auto"
        >
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-8">
            <h2 className="text-xl font-medium text-white mb-4">Upload Your Image</h2>
            <p className="text-white/60 mb-6">
              Upload an image to get started. We'll automatically separate the foreground and background.
            </p>
            <ImageUploader
              onUploadComplete={handleUpload}
              isLoading={isUploading}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default UploadPage; 