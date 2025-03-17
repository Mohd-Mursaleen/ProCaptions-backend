import React, { useState } from 'react';
import { NextPage } from 'next';
import { Position, SegmentationResponse, AddTextResponse, ComposeResponse, TextLayer } from '../types/api';
import { segmentImage, addDramaticText, composeFinalImage, addMultipleTextLayers } from '../api/procaptions';
import ImageUploader from '../components/ImageUploader';
import LiveTextEditor from '../components/LiveTextEditor';
import TextLayersEditor from '../components/TextLayersEditor';
import { FiArrowLeft, FiDownload, FiRefreshCw, FiLayers, FiType } from 'react-icons/fi';

const Home: NextPage = () => {
  // Image state
  const [segmentationData, setSegmentationData] = useState<SegmentationResponse | null>(null);
  const [textImage, setTextImage] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  
  // Text settings
  const [text, setText] = useState<string>('hero');
  const [position, setPosition] = useState<Position>({ x: 400, y: 300 });
  const [fontSize, setFontSize] = useState<number>(150);
  const [fontName, setFontName] = useState<string>('anton');
  const [withPeriod, setWithPeriod] = useState<boolean>(true);
  
  // Multi-layer text settings
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [useMultiLayer, setUseMultiLayer] = useState<boolean>(false);
  
  // UI state
  const [currentStep, setCurrentStep] = useState<'upload' | 'edit' | 'result'>('upload');
  
  // Loading states
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isProcessingText, setIsProcessingText] = useState<boolean>(false);
  const [isComposing, setIsComposing] = useState<boolean>(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Handle image upload and segmentation
  const handleUpload = async (file: File) => {
    try {
      setIsUploading(true);
      setError(null);
      
      // Reset previous results
      setSegmentationData(null);
      setTextImage(null);
      setFinalImage(null);
      
      // Upload and segment the image
      const result = await segmentImage(file);
      
      setSegmentationData(result);
      
      // Move to edit step
      setCurrentStep('edit');
      
    } catch (error) {
      console.error('Error uploading and segmenting image:', error);
      setError('Failed to process your image. Please try a different image or try again later.');
    } finally {
      setIsUploading(false);
    }
  };
  
  // Apply text to the background image and compose final image
  const handleComposeImage = async () => {
    if (!segmentationData) return;
    
    try {
      setIsProcessingText(true);
      setError(null);
      
      let textResult: AddTextResponse;
      
      if (useMultiLayer && textLayers.length > 0) {
        // Use multiple text layers
        console.log('Creating image with multiple text layers:', textLayers);
        
        textResult = await addMultipleTextLayers({
          background_path: segmentationData.background,
          text_layers: textLayers
        });
      } else {
        // Use single dramatic text layer
        console.log('Creating image with settings:', {
          text,
          position,
          fontSize,
          fontName,
          withPeriod
        });
        
        textResult = await addDramaticText({
          background_path: segmentationData.background,
          text,
          position,
          font_size: fontSize,
          font_name: fontName,
          with_period: withPeriod,
        });
      }
      
      setTextImage(textResult.image_with_text);
      
      // Step 2: Compose final image
      setIsComposing(true);
      const finalResult = await composeFinalImage({
        background_with_text_path: textResult.image_with_text,
        foreground_path: segmentationData.foreground,
      });
      
      setFinalImage(finalResult.final_image);
      
      // Move to result step
      setCurrentStep('result');
      
    } catch (error) {
      console.error('Error composing image:', error);
      setError('Error creating your image. Please try again or adjust your settings.');
    } finally {
      setIsProcessingText(false);
      setIsComposing(false);
    }
  };
  
  // Edit the current image (go back to edit step)
  const handleEditImage = () => {
    setCurrentStep('edit');
  };
  
  // Reset and start over
  const handleReset = () => {
    setCurrentStep('upload');
    setSegmentationData(null);
    setTextImage(null);
    setFinalImage(null);
    setText('hero');
    setPosition({ x: 400, y: 300 });
    setFontSize(150);
    setFontName('anton');
    setWithPeriod(true);
    setTextLayers([]);
    setError(null);
  };
  
  // Toggle between single and multi-layer text modes
  const toggleTextMode = () => {
    if (!useMultiLayer && textLayers.length === 0) {
      // Initialize with current text settings when switching to multi-layer mode
      setTextLayers([{
        text,
        position,
        style: {
          font_size: fontSize,
          font_name: fontName,
          color: '#FFFFFF'
        }
      }]);
    }
    setUseMultiLayer(!useMultiLayer);
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">ProCaptions</h1>
          <p className="text-gray-600">Create dramatic text overlays for your images</p>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Step indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-center">
              <div 
                className={`flex items-center ${currentStep === 'upload' ? 'text-blue-600' : 'text-gray-500'} cursor-pointer`}
                onClick={handleReset}
              >
                <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${currentStep === 'upload' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-200'}`}>
                  1
                </div>
                <div className="ml-2 text-sm font-medium">Upload</div>
              </div>
              
              <div className="w-12 h-0.5 mx-2 bg-gray-200"></div>
              
              <div 
                className={`flex items-center ${currentStep === 'edit' ? 'text-blue-600' : currentStep === 'result' ? 'text-gray-500 cursor-pointer' : 'text-gray-500'}`}
                onClick={currentStep === 'result' ? handleEditImage : undefined}
              >
                <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${currentStep === 'edit' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-200'}`}>
                  2
                </div>
                <div className="ml-2 text-sm font-medium">Edit</div>
              </div>
              
              <div className="w-12 h-0.5 mx-2 bg-gray-200"></div>
              
              <div className={`flex items-center ${currentStep === 'result' ? 'text-blue-600' : 'text-gray-500'}`}>
                <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${currentStep === 'result' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-200'}`}>
                  3
                </div>
                <div className="ml-2 text-sm font-medium">Result</div>
              </div>
            </div>
          </div>
          
          {/* Error message */}
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Upload step */}
          {currentStep === 'upload' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Upload Your Image</h2>
                <p className="text-gray-600 mb-6">
                  Upload an image to get started. We'll automatically separate the foreground and background.
                </p>
                <ImageUploader
                  onUploadComplete={handleUpload}
                  isLoading={isUploading}
                />
              </div>
            </div>
          )}
          
          {/* Edit step */}
          {currentStep === 'edit' && segmentationData && (
            <div className="space-y-6">
              <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-medium text-gray-900">Edit Your Text</h2>
                  
                  {/* Toggle between single and multi-layer text modes */}
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={toggleTextMode}
                      className={`px-3 py-2 rounded-md flex items-center ${!useMultiLayer ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}
                      disabled={isProcessingText}
                    >
                      <FiType className="mr-1" /> Single Text
                    </button>
                    <button
                      type="button"
                      onClick={toggleTextMode}
                      className={`px-3 py-2 rounded-md flex items-center ${useMultiLayer ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}
                      disabled={isProcessingText}
                    >
                      <FiLayers className="mr-1" /> Multiple Layers
                    </button>
                  </div>
                </div>
                
                <p className="text-gray-600 mb-6">
                  {useMultiLayer 
                    ? "Add multiple text layers with different styles and positions."
                    : "Customize your text, adjust its size, and position it on the image."}
                </p>
                
                {useMultiLayer ? (
                  <TextLayersEditor
                    backgroundImage={segmentationData.background}
                    onLayersChange={setTextLayers}
                    disabled={isProcessingText}
                  />
                ) : (
                  <LiveTextEditor
                    backgroundImage={segmentationData.background}
                    text={text}
                    onTextChange={setText}
                    fontSize={fontSize}
                    onFontSizeChange={setFontSize}
                    fontName={fontName}
                    onFontNameChange={setFontName}
                    withPeriod={withPeriod}
                    onWithPeriodChange={setWithPeriod}
                    position={position}
                    onPositionChange={setPosition}
                    disabled={isProcessingText}
                  />
                )}
                
                <div className="mt-6 flex justify-between">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center"
                    disabled={isProcessingText || isComposing}
                  >
                    <FiRefreshCw className="mr-2" /> Start Over
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleComposeImage}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled={isProcessingText || isComposing || (useMultiLayer && textLayers.length === 0)}
                  >
                    {isProcessingText || isComposing ? (
                      <>
                        <span className="inline-block animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                        Processing...
                      </>
                    ) : (
                      'Create Final Image'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Result step */}
          {currentStep === 'result' && finalImage && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Your Final Image</h2>
                <div className="flex justify-center mb-6">
                  <img 
                    src={finalImage} 
                    alt="Final result" 
                    className="max-w-full rounded shadow-lg"
                  />
                </div>
                
                {/* Image settings summary */}
                <div className="mb-6 bg-gray-50 rounded-md p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Image Settings</h3>
                  {useMultiLayer ? (
                    <div>
                      <p className="text-gray-700 mb-2">Multiple text layers: {textLayers.length}</p>
                      <ul className="text-sm divide-y">
                        {textLayers.map((layer, index) => (
                          <li key={index} className="py-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <span className="block text-gray-500">Text</span>
                                <span className="font-medium text-gray-900">{layer.text}</span>
                              </div>
                              <div>
                                <span className="block text-gray-500">Font</span>
                                <span className="font-medium text-gray-900">
                                  {AVAILABLE_FONTS.find(f => f.value === layer.style.font_name)?.label || layer.style.font_name}
                                </span>
                              </div>
                              <div>
                                <span className="block text-gray-500">Size</span>
                                <span className="font-medium text-gray-900">{layer.style.font_size}px</span>
                              </div>
                              <div>
                                <span className="block text-gray-500">Position</span>
                                <span className="font-medium text-gray-900">x: {layer.position.x}, y: {layer.position.y}</span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="block text-gray-500">Text</span>
                        <span className="font-medium text-gray-900">{text}{withPeriod ? '.' : ''}</span>
                      </div>
                      <div>
                        <span className="block text-gray-500">Font</span>
                        <span className="font-medium text-gray-900">{
                          AVAILABLE_FONTS.find(f => f.value === fontName)?.label || fontName
                        }</span>
                      </div>
                      <div>
                        <span className="block text-gray-500">Size</span>
                        <span className="font-medium text-gray-900">{fontSize}px</span>
                      </div>
                      <div>
                        <span className="block text-gray-500">Position</span>
                        <span className="font-medium text-gray-900">x: {position.x}, y: {position.y}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-center space-x-4">
                  <button
                    type="button"
                    onClick={handleEditImage}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center"
                  >
                    <FiArrowLeft className="mr-2" /> Edit This Image
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center"
                  >
                    <FiRefreshCw className="mr-2" /> Create New Image
                  </button>
                  
                  <a
                    href={finalImage}
                    download="procaptions-image.png"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center"
                  >
                    <FiDownload className="mr-2" /> Download Image
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500 text-sm">
            ProCaptions © {new Date().getFullYear()} | Create dramatic text overlays for your images
          </p>
        </div>
      </footer>
    </div>
  );
};

// Font definitions
const AVAILABLE_FONTS = [
  { value: 'anton', label: 'Anton' },
  { value: 'sixcaps', label: 'Six Caps' },
  { value: 'impact', label: 'Impact' },
  { value: 'arial_bold', label: 'Arial Bold' },
  { value: 'helvetica_bold', label: 'Helvetica Bold' },
];

export default Home; 