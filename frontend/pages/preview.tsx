import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { SegmentationResponse, AddTextResponse, ComposeResponse } from '../types/api';
import { addDramaticText, composeFinalImage, addMultipleTextLayers } from '../api/procaptions';
import { FiDownload, FiArrowLeft } from 'react-icons/fi';
import { motion } from 'framer-motion';
import LoadingScreen from '../components/LoadingScreen';

const PreviewPage: NextPage = () => {
  const router = useRouter();
  
  // Image state
  const [segmentationData, setSegmentationData] = useState<SegmentationResponse | null>(null);
  const [textImage, setTextImage] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  
  // Text settings (will be pulled from localStorage)
  const [textSettings, setTextSettings] = useState<any>(null);
  
  // UI state
  const [isScrolled, setIsScrolled] = useState(false);
  const [isProcessingText, setIsProcessingText] = useState<boolean>(false);
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Handle scrolling for header effects
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Load segmentation data and text settings from localStorage
    const savedSegData = localStorage.getItem('segmentationData');
    const savedTextSettings = localStorage.getItem('textSettings');
    
    if (!savedSegData || !savedTextSettings) {
      router.push('/upload');
      return;
    }
    
    try {
      const parsedSegData = JSON.parse(savedSegData);
      const parsedTextSettings = JSON.parse(savedTextSettings);
      
      setSegmentationData(parsedSegData);
      setTextSettings(parsedTextSettings);
      
      // Start processing the image right away
      processImage(parsedSegData, parsedTextSettings);
    } catch (e) {
      console.error('Error parsing data:', e);
      setError('There was an error loading your data. Please try again.');
      setTimeout(() => router.push('/upload'), 2000);
    }
  }, [router]);
  
  // Process the image with text and compose the final result
  const processImage = async (segData: SegmentationResponse, txtSettings: any) => {
    if (!segData) return;
    
    try {
      setIsProcessingText(true);
      setError(null);
      
      let textResult: AddTextResponse;
      
      if (txtSettings.useMultiLayer && txtSettings.textLayers?.length > 0) {
        // Use multiple text layers
        console.log('Creating image with multiple text layers:', txtSettings.textLayers);
        
        textResult = await addMultipleTextLayers({
          background_path: segData.background,
          text_layers: txtSettings.textLayers
        });
      } else {
        // Use single dramatic text layer
        console.log('Creating image with settings:', {
          text: txtSettings.text,
          position: txtSettings.position,
          fontSize: txtSettings.fontSize,
          fontName: txtSettings.fontName,
          withPeriod: txtSettings.withPeriod,
          fontColor: txtSettings.fontColor
        });
        
        textResult = await addDramaticText({
          background_path: segData.background,
          text: txtSettings.text,
          position: txtSettings.position,
          font_size: txtSettings.fontSize,
          font_name: txtSettings.fontName,
          with_period: txtSettings.withPeriod,
          color: txtSettings.fontColor
        });
      }
      
      setTextImage(textResult.image_with_text);
      
      // Step 2: Compose final image
      setIsComposing(true);
      const finalResult = await composeFinalImage({
        background_with_text_path: textResult.image_with_text,
        foreground_path: segData.foreground,
      });
      
      setFinalImage(finalResult.final_image);
      
    } catch (error) {
      console.error('Error composing image:', error);
      setError('Error creating your image. Please try again or adjust your settings.');
    } finally {
      setIsProcessingText(false);
      setIsComposing(false);
    }
  };
  
  // Download the final image
  const handleDownload = () => {
    if (!finalImage) return;
    
    const link = document.createElement('a');
    link.href = finalImage;
    link.download = 'procaptions-image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Edit the current image
  const handleEdit = () => {
    router.push('/edit');
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <Head>
        <title>Preview | ProCaptions</title>
        <meta name="description" content="Preview and download your captioned image with ProCaptions" />
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
              Step 3 of 3
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
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/50 font-medium">
              1
            </div>
            <div className="ml-2 text-sm font-medium text-white/50">Upload</div>
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
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-rose-500 text-white font-medium">
              3
            </div>
            <div className="ml-2 text-sm font-medium text-white">Preview</div>
          </div>
        </motion.div>

        {/* Error message */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-900/30 border-l-4 border-red-500 p-4 mx-auto max-w-4xl"
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

        {/* Loading Screens */}
        {isProcessingText && (
          <LoadingScreen
            title="Creating Your Text"
            description="We're adding your text to the image with the perfect style and positioning."
            fullScreen
          />
        )}

        {isComposing && (
          <LoadingScreen
            title="Composing Final Image"
            description="We're combining all elements to create your final masterpiece."
            fullScreen
          />
        )}

        {/* Result section */}
        {finalImage && !isProcessingText && !isComposing && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6">
              <h2 className="text-xl font-medium text-white mb-4">Your ProCaption is Ready!</h2>
              
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="rounded-lg overflow-hidden border border-white/10 mb-6"
              >
                <img 
                  src={finalImage} 
                  alt="Final image with text"
                  className="w-full h-auto"
                />
              </motion.div>
              
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <Link href="/edit">
                  <motion.button 
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-center px-5 py-2 border border-white/20 rounded-md text-white hover:bg-white/10 transition-colors w-full sm:w-auto"
                  >
                    <FiArrowLeft className="mr-2" />
                    Edit Text
                  </motion.button>
                </Link>
                
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDownload}
                  className="flex items-center justify-center bg-gradient-to-r from-indigo-500 to-rose-500 hover:opacity-90 transition-opacity text-white px-5 py-2 rounded-md w-full sm:w-auto"
                >
                  <FiDownload className="mr-2" />
                  Download Image
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PreviewPage; 