import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { Position, SegmentationResponse, TextLayer, ShadowEffectSettings } from '../types/api';
import LiveTextEditor from '../components/LiveTextEditor';
import TextLayersEditor from '../components/TextLayersEditor';
import { FiLayers, FiType } from 'react-icons/fi';
import { motion } from 'framer-motion';

const EditPage: NextPage = () => {
  const router = useRouter();
  
  // Image state
  const [segmentationData, setSegmentationData] = useState<SegmentationResponse | null>(null);
  
  // Text settings
  const [text, setText] = useState<string>('hero');
  const [position, setPosition] = useState<Position>({ x: 400, y: 300 });
  const [fontSize, setFontSize] = useState<number>(150);
  const [fontName, setFontName] = useState<string>('anton');
  const [withPeriod, setWithPeriod] = useState<boolean>(true);
  const [fontColor, setFontColor] = useState<string>('#FFFFFF');
  const [shadowEffect, setShadowEffect] = useState<ShadowEffectSettings | undefined>(undefined);
  
  // Multi-layer text settings
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [useMultiLayer, setUseMultiLayer] = useState<boolean>(false);
  
  // UI state
  const [isScrolled, setIsScrolled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  // Add state to track if any drawer is open in child components
  const [isAnyDrawerOpen, setIsAnyDrawerOpen] = useState(false);

  // Handle scrolling for header effects
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Check initially
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Check if we have segmentation data in localStorage
    const savedData = localStorage.getItem('segmentationData');
    console.log('Edit page loaded. Checking for segmentation data...');
    
    if (savedData) {
      try {
        console.log('Found segmentation data in localStorage');
        const parsedData = JSON.parse(savedData);
        setSegmentationData(parsedData);
        console.log('Segmentation data parsed successfully:', parsedData);
      } catch (e) {
        console.error('Error parsing segmentation data:', e);
        setError('There was an error loading your image data. Please try uploading again.');
        // Redirect back to upload if data is invalid
        setTimeout(() => router.push('/upload'), 2000);
      }
    } else {
      console.warn('No segmentation data found in localStorage, redirecting to upload page');
      // No data found, redirect to upload page
      router.push('/upload');
    }
  }, [router]);
  
  // Toggle between single and multi-layer text modes
  const toggleTextMode = () => {
    if (!useMultiLayer && textLayers.length === 0) {
      // Initialize with current text settings when switching to multi-layer mode
      const initialLayer = {
        text,
        position,
        style: {
          font_size: fontSize,
          font_name: fontName,
          color: '#FFFFFF'
        }
      };
      console.log('Initializing text layers with:', initialLayer);
      setTextLayers([initialLayer]);
    }
    setUseMultiLayer(!useMultiLayer);
  };
  
  // This effect ensures the textLayers are properly initialized from localStorage if available
  useEffect(() => {
    // If we have text settings in localStorage, try to load them
    const savedTextSettings = localStorage.getItem('textSettings');
    if (savedTextSettings) {
      try {
        const parsedSettings = JSON.parse(savedTextSettings);
        if (parsedSettings.useMultiLayer && parsedSettings.textLayers?.length > 0) {
          console.log('Loading saved text layers from localStorage:', parsedSettings.textLayers);
          setTextLayers(parsedSettings.textLayers);
          setUseMultiLayer(true);
        } else if (!parsedSettings.useMultiLayer) {
          // Load individual text settings
          if (parsedSettings.text) setText(parsedSettings.text);
          if (parsedSettings.position) setPosition(parsedSettings.position);
          if (parsedSettings.fontSize) setFontSize(parsedSettings.fontSize);
          if (parsedSettings.fontName) setFontName(parsedSettings.fontName);
          if (parsedSettings.withPeriod !== undefined) setWithPeriod(parsedSettings.withPeriod);
          if (parsedSettings.fontColor) setFontColor(parsedSettings.fontColor);
          if (parsedSettings.shadowEffect) setShadowEffect(parsedSettings.shadowEffect);
        }
      } catch (e) {
        console.error('Error parsing text settings:', e);
      }
    }
  }, []);
  
  const handleContinue = () => {
    // Store the text settings in localStorage
    const textSettings = useMultiLayer 
      ? { textLayers, useMultiLayer }
      : { text, position, fontSize, fontName, withPeriod, fontColor, shadowEffect, useMultiLayer };
    
    localStorage.setItem('textSettings', JSON.stringify(textSettings));
    
    // Navigate to preview page
    router.push('/preview');
  };

  // Add function to handle drawer state change from child components
  const handleDrawerStateChange = (isOpen: boolean) => {
    setIsAnyDrawerOpen(isOpen);
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <Head>
        <title>Edit Text | ProCaptions</title>
        <meta name="description" content="Edit text for your image with ProCaptions" />
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
              Step 2 of 3
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
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-rose-500 text-white font-medium">
              2
            </div>
            <div className="ml-2 text-sm font-medium text-white">Edit</div>
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

        {/* Edit section */}
        {segmentationData && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="max-w-6xl mx-auto"
          >
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6">
              {/* Mobile toggle for text modes - Fixed at top of screen for easy access */}
              {isMobile && (
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 mb-5 -mt-6 -mx-6 px-6 py-3 rounded-t-lg">
                  <div className="text-center">
                    <div className="inline-flex bg-black/20 p-1 rounded-lg">
                  <button
                        onClick={() => setUseMultiLayer(false)}
                        className={`flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium ${
                          !useMultiLayer 
                            ? 'bg-white text-gray-900 shadow-sm' 
                            : 'text-white/80 hover:bg-white/10'
                        }`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                          <path d="M4 9h16M4 15h16M8 4v16M16 4v16"/>
                        </svg>
                        <span>Single Text</span>
                  </button>
                  <button
                        onClick={() => setUseMultiLayer(true)}
                        className={`flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium ${
                          useMultiLayer 
                            ? 'bg-white text-gray-900 shadow-sm' 
                            : 'text-white/80 hover:bg-white/10'
                        }`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                        <span>Multiple Layers</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Desktop toggle for text modes */}
              {!isMobile && (
                <div className="flex justify-between items-center mb-6 p-2 bg-[#050510] rounded-md">
                  <div className="flex space-x-1">
                    <button
                      onClick={() => setUseMultiLayer(false)}
                      className={`flex items-center px-4 py-1.5 rounded-md transition-all ${
                        !useMultiLayer 
                          ? 'bg-[#1A1A2E] text-white' 
                          : 'text-white/60 hover:bg-[#1A1A2E]/40'
                      }`}
                    >
                      <span className="mr-2 text-sm font-medium">T</span>
                      <span className="text-sm">Single Text</span>
                    </button>
                    <button
                      onClick={() => setUseMultiLayer(true)}
                      className={`flex items-center px-4 py-1.5 rounded-md transition-all ${
                        useMultiLayer 
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white' 
                          : 'text-white/60 hover:bg-[#1A1A2E]/40'
                    }`}
                  >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                      </svg>
                      <span className="text-sm">Multiple Layers</span>
                  </button>
                </div>
              </div>
              )}
              
              {/* Text editor based on mode - Using mobile prop to control view */}
              <div className={`${!isMobile ? 'bg-[#050510] rounded-lg p-4' : ''}`}>
              {useMultiLayer ? (
                <TextLayersEditor
                  backgroundImage={segmentationData.background}
                  onLayersChange={setTextLayers}
                  disabled={false}
                  isMobileView={isMobile}
                  onDrawerStateChange={handleDrawerStateChange}
                />
              ) : (
                <LiveTextEditor
                  backgroundImage={segmentationData.background}
                  text={text}
                  onTextChange={setText}
                  position={position}
                  onPositionChange={setPosition}
                  fontSize={fontSize}
                  onFontSizeChange={setFontSize}
                  fontName={fontName}
                  onFontNameChange={setFontName}
                  withPeriod={withPeriod}
                  onWithPeriodChange={setWithPeriod}
                  fontColor={fontColor}
                  onFontColorChange={setFontColor}
                  disabled={false}
                  shadowEffect={shadowEffect}
                  onShadowEffectChange={setShadowEffect}
                  isMobileView={isMobile}
                  onDrawerStateChange={handleDrawerStateChange}
                />
              )}
              </div>
              
              {/* Navigation buttons */}
              <div className="mt-8 pt-6 border-t border-white/10 flex justify-between">
                <Link href="/upload">
                  <button className="text-white/60 hover:text-white flex items-center transition-colors">
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                    </svg>
                    Back to Upload
                  </button>
                </Link>
                
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleContinue}
                  className={`${isMobile ? 
                    `fixed bottom-[80px] right-4 shadow-lg ${isAnyDrawerOpen ? "z-10 opacity-0" : "z-50 opacity-100"}` : 
                    ""} bg-gradient-to-r from-indigo-500 to-rose-500 hover:opacity-90 transition-opacity text-white px-5 py-2 rounded-md flex items-center`}
                >
                  {isMobile ? "Create" : "Continue to Preview"}
                  <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                  </svg>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default EditPage; 