import React, { useState, useEffect, useRef } from 'react';
import { Position } from '../types/api';
import { FiMove, FiZoomIn, FiType, FiInfo, FiPlus, FiMinus, FiSettings, FiLayout, FiSliders, FiX } from 'react-icons/fi';
import { MdCenterFocusStrong } from 'react-icons/md';

interface LiveTextEditorProps {
  backgroundImage: string | null;
  text: string;
  onTextChange: (text: string) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  fontName: string;
  onFontNameChange: (font: string) => void;
  withPeriod: boolean;
  onWithPeriodChange: (withPeriod: boolean) => void;
  position: Position;
  onPositionChange: (position: Position) => void;
  disabled: boolean;
}

// Tab type for editor settings
type TabType = 'text' | 'style' | 'advanced';

const AVAILABLE_FONTS = [
  { value: 'anton', label: 'Anton' },
  { value: 'sixcaps', label: 'Six Caps' },
  { value: 'impact', label: 'Impact' },
];

// Custom font loading for preview accuracy
const loadCustomFonts = () => {
  // Add a style element to load fonts if needed
  if (!document.getElementById('custom-font-styles')) {
    const style = document.createElement('style');
    style.id = 'custom-font-styles';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Six+Caps&display=swap');
    `;
    document.head.appendChild(style);
  }
};

// For accurate preview, estimate font metrics based on the font family
const getFontMetrics = (fontName: string) => {
  // These values help adjust the preview to match the backend's text rendering
  switch(fontName) {
    case 'anton':
      return { widthFactor: 0.9, heightFactor: 0.9 };
    case 'sixcaps':
      return { widthFactor: 0.9, heightFactor: 0.85 };
    case 'impact':
      return { widthFactor: 0.95, heightFactor: 0.9 };
    default:
      return { widthFactor: 0.9, heightFactor: 0.85 };
  }
};

// Add this helper function at the top of the file after the imports
// This will ensure image URLs are properly formatted for both local and remote sources
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

const LiveTextEditor: React.FC<LiveTextEditorProps> = ({
  backgroundImage,
  text,
  onTextChange,
  fontSize,
  onFontSizeChange,
  fontName,
  onFontNameChange,
  withPeriod,
  onWithPeriodChange,
  position,
  onPositionChange,
  disabled,
}) => {
  const [localText, setLocalText] = useState(text);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [startDragPos, setStartDragPos] = useState({ x: 0, y: 0 });
  const [previewMode, setPreviewMode] = useState<'position' | 'text' | 'size'>('position');
  // Font size input value for direct editing
  const [fontSizeInput, setFontSizeInput] = useState<string>(fontSize.toString());
  
  // Original image dimensions (we'll need to fetch these)
  const [originalImageDimensions, setOriginalImageDimensions] = useState<{ width: number, height: number } | null>(null);
  // Reference to track the rendered text dimensions for feedback
  const [textDimensions, setTextDimensions] = useState<{ width: number, height: number } | null>(null);
  // Show help info
  const [showHelp, setShowHelp] = useState(false);
  
  // Active tab for settings panels
  const [activeTab, setActiveTab] = useState<TabType>('text');
  
  const previewRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Load custom fonts when component mounts
  useEffect(() => {
    loadCustomFonts();
  }, []);
  
  // Update local text when prop changes
  useEffect(() => {
    setLocalText(text);
  }, [text]);
  
  // Update font size input when fontSize prop changes
  useEffect(() => {
    setFontSizeInput(fontSize.toString());
  }, [fontSize]);
  
  // Load the background image to get its dimensions
  useEffect(() => {
    if (backgroundImage) {
      const fullImageUrl = getFullImageUrl(backgroundImage);
      console.log('Loading background image:', fullImageUrl);
      
      const img = new Image();
      img.onload = () => {
        console.log('Image loaded successfully with dimensions:', img.width, 'x', img.height);
        setOriginalImageDimensions({
          width: img.width,
          height: img.height
        });
        
        // If this is the first load, center the text on the image
        if (!position.x || !position.y || position.x === 400 && position.y === 300) {
          onPositionChange({
            x: Math.round(img.width / 2),
            y: Math.round(img.height / 2)
          });
        }
      };
      img.onerror = (e) => {
        console.error('Error loading background image:', fullImageUrl, e);
        // Try again with a different approach if the URL might be malformed
        if (fullImageUrl && fullImageUrl.startsWith('/uploads/')) {
          console.log('Retrying with absolute URL');
          const retryUrl = `${window.location.protocol}//${window.location.host}${fullImageUrl}`;
          const retryImg = new Image();
          retryImg.onload = () => {
            console.log('Retry image loaded successfully');
            setOriginalImageDimensions({
              width: retryImg.width,
              height: retryImg.height
            });
          };
          retryImg.onerror = () => {
            console.error('Retry also failed for URL:', retryUrl);
          };
          retryImg.src = retryUrl;
        }
      };
      img.src = fullImageUrl || '';
    }
  }, [backgroundImage]);
  
  // Measure text dimensions after render for accurate preview
  useEffect(() => {
    if (textLayerRef.current) {
      setTextDimensions({
        width: textLayerRef.current.offsetWidth,
        height: textLayerRef.current.offsetHeight
      });
    }
  }, [localText, fontSize, fontName, withPeriod]);
  
  // Handle text change
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setLocalText(newText);
    onTextChange(newText);
  };
  
  // Handle font change
  const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFont = e.target.value;
    onFontNameChange(newFont);
  };
  
  // Handle period toggle
  const handleWithPeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onWithPeriodChange(e.target.checked);
  };
  
  // Handle font size change via direct input
  const handleFontSizeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFontSizeInput(e.target.value);
  };
  
  // Apply the font size when input field is blurred or Enter is pressed
  const applyFontSize = () => {
    const size = parseInt(fontSizeInput, 10);
    if (!isNaN(size) && size > 0) {
      onFontSizeChange(size);
    } else {
      // Reset to current font size if invalid
      setFontSizeInput(fontSize.toString());
    }
  };
  
  // Handle key press in font size input
  const handleFontSizeKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      applyFontSize();
    }
  };
  
  // Quick font size adjustments
  const adjustFontSize = (amount: number) => {
    const newSize = fontSize + amount;
    if (newSize > 0) {
      onFontSizeChange(newSize);
    }
  };
  
  // Center text in image
  const handleCenterText = () => {
    if (originalImageDimensions) {
      onPositionChange({
        x: Math.round(originalImageDimensions.width / 2),
        y: Math.round(originalImageDimensions.height / 2)
      });
    }
  };
  
  // Calculate the scaling factor between preview and original image
  const getScalingFactor = (): number => {
    if (!previewRef.current || !originalImageDimensions || !imageRef.current) {
      return 1; // Default to 1 if we don't have dimensions yet
    }
    
    const previewWidth = imageRef.current.clientWidth;
    const originalWidth = originalImageDimensions.width;
    
    return originalWidth / previewWidth;
  };
  
  // Convert preview coordinates to original image coordinates
  const previewToOriginalCoordinates = (previewX: number, previewY: number): Position => {
    if (!originalImageDimensions || !imageRef.current) {
      return { x: previewX, y: previewY };
    }
    
    const scale = getScalingFactor();
    const origX = Math.round(previewX * scale);
    const origY = Math.round(previewY * scale);
    
    console.log(`Converting preview (${previewX}, ${previewY}) to original: (${origX}, ${origY}) with scale: ${scale.toFixed(2)}`);
    
    return {
      x: origX,
      y: origY
    };
  };
  
  // Convert original image coordinates to preview coordinates
  const originalToPreviewCoordinates = (originalX: number, originalY: number): Position => {
    if (!originalImageDimensions || !imageRef.current) {
      return { x: originalX, y: originalY };
    }
    
    const scale = getScalingFactor();
    const previewX = Math.round(originalX / scale);
    const previewY = Math.round(originalY / scale);
    
    console.log(`Converting original (${originalX}, ${originalY}) to preview: (${previewX}, ${previewY}) with scale: ${scale.toFixed(2)}`);
    
    return {
      x: previewX,
      y: previewY
    };
  };
  
  // Get the preview position (scaled from the original)
  const getPreviewPosition = (): Position => {
    return originalToPreviewCoordinates(position.x, position.y);
  };
  
  // Handle text position with mouse
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    setIsDraggingText(true);
    setStartDragPos({
      x: e.clientX,
      y: e.clientY
    });
    
    // Prevent text selection during drag
    e.preventDefault();
    
    // Apply grabbing cursor to the body during drag operations
    document.body.classList.add('cursor-grabbing');
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingText || !previewRef.current) return;
    
    // Calculate new position
    const deltaX = e.clientX - startDragPos.x;
    const deltaY = e.clientY - startDragPos.y;
    
    // Set start position for next move
    setStartDragPos({
      x: e.clientX,
      y: e.clientY
    });
    
    // Calculate preview position
    const previewPos = getPreviewPosition();
    const newPreviewPos = {
      x: previewPos.x + deltaX,
      y: previewPos.y + deltaY
    };
    
    // Convert to original coordinates and update position
    const newOriginalPos = previewToOriginalCoordinates(newPreviewPos.x, newPreviewPos.y);
    onPositionChange(newOriginalPos);
  };
  
  // Add global mouse event listeners for dragging
  useEffect(() => {
    // Global mouse handlers for when dragging extends outside the component
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingText || !previewRef.current) return;
      
      // Calculate new position
      const deltaX = e.clientX - startDragPos.x;
      const deltaY = e.clientY - startDragPos.y;
      
      // Set start position for next move
      setStartDragPos({
        x: e.clientX,
        y: e.clientY
      });
      
      // Calculate preview position
      const previewPos = getPreviewPosition();
      const newPreviewPos = {
        x: previewPos.x + deltaX,
        y: previewPos.y + deltaY
      };
      
      // Convert to original coordinates and update position
      const newOriginalPos = previewToOriginalCoordinates(newPreviewPos.x, newPreviewPos.y);
      onPositionChange(newOriginalPos);
    };
    
    const handleGlobalMouseUp = () => {
      setIsDraggingText(false);
      document.body.classList.remove('cursor-grabbing');
    };
    
    // Add global event listeners when dragging
    if (isDraggingText) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }
    
    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDraggingText, startDragPos, previewRef]);
  
  // Handle canvas click to position text
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle if we're not already dragging
    if (isDraggingText || disabled) return;
    
    // If in position mode, select the text element but don't move it
    if (previewMode === 'position') {
      // Instead of repositioning, just select the text element if clicked outside of it
      const textElem = textLayerRef.current;
      if (textElem) {
        const textRect = textElem.getBoundingClientRect();
        const clickX = e.clientX;
        const clickY = e.clientY;
        
        // If click is outside the text element, just select it without repositioning
        const isOutsideText = 
          clickX < textRect.left || 
          clickX > textRect.right || 
          clickY < textRect.top || 
          clickY > textRect.bottom;
          
        if (isOutsideText) {
          // Just focus/select the element
          textElem.focus();
        }
      }
    }
  };
  
  // Add a mouseup handler directly on the component
  const handlePreviewMouseUp = () => {
    if (isDraggingText) {
      setIsDraggingText(false);
      document.body.classList.remove('cursor-grabbing');
    }
  };
  
  // Calculate text display size based on the container size and true font size
  const getTextStyle = () => {
    // Calculate the preview font size (scaled down from the original)
    const scale = getScalingFactor();
    const previewFontSize = fontSize / scale;
    const previewPos = getPreviewPosition();
    
    // Get font-specific adjustments to improve preview accuracy
    const { widthFactor, heightFactor } = getFontMetrics(fontName);
    
    return {
      fontFamily: fontName === 'anton' 
        ? "Anton, sans-serif" 
        : fontName === 'sixcaps' 
          ? "'Six Caps', sans-serif" 
          : fontName === 'impact' 
            ? "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif"
            : "'Helvetica Neue', Helvetica, Arial, sans-serif",
      fontSize: `${previewFontSize}px`,
      lineHeight: '1',
      fontWeight: fontName === 'arial_bold' || fontName === 'helvetica_bold' ? 'bold' : 'normal',
      color: '#FFFFFF',
      textShadow: '2px 2px 8px rgba(0, 0, 0, 0.5)',
      cursor: isDraggingText ? 'grabbing' : 'grab',
      position: 'absolute' as const,
      top: `${previewPos.y}px`,
      left: `${previewPos.x}px`,
      transform: 'translate(-50%, -50%)',
      userSelect: 'none' as const,
      whiteSpace: 'nowrap' as const,
      display: 'inline-block',
      padding: '0',
      margin: '0',
      letterSpacing: fontName === 'anton' ? '0.01em' : 'normal',
      opacity: isDraggingText ? 0.8 : 1, // Add opacity during drag for visual feedback
      transition: 'opacity 0.1s ease', // Smooth transition for opacity
    };
  };

  // Add position marker to help with alignment
  const PositionMarker = () => {
    const previewPos = getPreviewPosition();
    
    return (
      <div 
        className="absolute w-16 h-16 pointer-events-none"
        style={{
          top: `${previewPos.y}px`,
          left: `${previewPos.x}px`,
          transform: 'translate(-50%, -50%)',
          zIndex: 5,
        }}
      >
        {/* Subtle dot marker instead of cross */}
        <div className="absolute w-2 h-2 rounded-full bg-white border border-gray-400 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"></div>
      </div>
    );
  };

  // Tab navigation
  const renderTabContent = () => {
    switch (activeTab) {
      case 'text':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="text-input" className="block text-sm font-medium text-gray-700 mb-1">
                Text Content
              </label>
              <input
                id="text-input"
                type="text"
                value={localText}
                onChange={handleTextChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter text (e.g., hero)"
                disabled={disabled}
              />
            </div>
            
            <div>
              <label htmlFor="font-select" className="block text-sm font-medium text-gray-700 mb-1">
                Font Family
              </label>
              <select
                id="font-select"
                value={fontName}
                onChange={handleFontChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={disabled}
              >
                {AVAILABLE_FONTS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center">
              <input
                id="with-period"
                type="checkbox"
                checked={withPeriod}
                onChange={handleWithPeriodChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={disabled}
              />
              <label htmlFor="with-period" className="ml-2 block text-sm text-gray-700">
                Add period at the end
              </label>
            </div>
          </div>
        );
        
      case 'style':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="font-size" className="block text-sm font-medium text-gray-700 mb-1">
                Font Size
              </label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => adjustFontSize(-10)}
                  className="p-2 border border-gray-300 rounded-l-md bg-gray-50 hover:bg-gray-100"
                  disabled={disabled}
                >
                  <FiMinus size={16} />
                </button>
                <input
                  id="font-size-input"
                  type="number"
                  value={fontSizeInput}
                  onChange={handleFontSizeInputChange}
                  onBlur={applyFontSize}
                  onKeyPress={handleFontSizeKeyPress}
                  className="w-20 text-center border-y border-gray-300 py-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Size"
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => adjustFontSize(10)}
                  className="p-2 border border-gray-300 rounded-r-md bg-gray-50 hover:bg-gray-100"
                  disabled={disabled}
                >
                  <FiPlus size={16} />
                </button>
                <span className="ml-2 text-gray-500 text-sm">px</span>
              </div>
              
              {/* Font size presets */}
              <div className="mt-2 flex flex-wrap gap-2">
                {[100, 150, 200, 250, 300].map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onFontSizeChange(size)}
                    className={`text-xs py-1 px-2 rounded ${
                      fontSize === size ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    disabled={disabled}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Text Position
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="position-x" className="text-xs text-gray-500">X Position</label>
                  <input
                    id="position-x"
                    type="number"
                    value={position.x}
                    onChange={(e) => onPositionChange({ ...position, x: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-1 border border-gray-300 rounded-md shadow-sm text-sm"
                    disabled={disabled}
                  />
                </div>
                <div>
                  <label htmlFor="position-y" className="text-xs text-gray-500">Y Position</label>
                  <input
                    id="position-y"
                    type="number"
                    value={position.y}
                    onChange={(e) => onPositionChange({ ...position, y: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-1 border border-gray-300 rounded-md shadow-sm text-sm"
                    disabled={disabled}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleCenterText}
                className="mt-2 flex items-center justify-center w-full py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm"
                title="Center text in image"
                disabled={disabled}
              >
                <MdCenterFocusStrong size={16} className="mr-1" />
                Center Text
              </button>
            </div>
          </div>
        );
        
      case 'advanced':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preview Mode
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setPreviewMode('position')}
                  className={`p-2 rounded flex items-center ${previewMode === 'position' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  title="Position Mode: Click or drag to position text"
                  disabled={disabled}
                >
                  <FiMove size={16} className="mr-1" />
                  Position
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('size')}
                  className={`p-2 rounded flex items-center ${previewMode === 'size' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  title="Size Mode: Adjust font size"
                  disabled={disabled}
                >
                  <FiZoomIn size={16} className="mr-1" />
                  Size
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('text')}
                  className={`p-2 rounded flex items-center ${previewMode === 'text' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  title="Text Mode: Edit text content"
                  disabled={disabled}
                >
                  <FiType size={16} className="mr-1" />
                  Text
                </button>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-md">
              <div className="flex items-center mb-2">
                <FiInfo size={16} className="text-blue-500 mr-2" />
                <span className="text-sm font-medium text-gray-700">Help & Tips</span>
              </div>
              <ul className="text-xs text-gray-600 space-y-1 list-disc pl-5">
                <li>Drag text directly in the preview to reposition</li>
                <li>Use preview modes to focus on different editing tasks</li>
                <li>For the most accurate preview, position text in the center</li>
                <li>Use X and Y inputs for precise positioning</li>
              </ul>
            </div>
            
            {originalImageDimensions && (
              <div className="text-xs text-gray-500">
                <p>Image Size: {originalImageDimensions.width} × {originalImageDimensions.height}px</p>
                <p>Text Position: {position.x}, {position.y}</p>
                <p>Font Size: {fontSize}px</p>
                <p>Preview Scale: {getScalingFactor().toFixed(2)}×</p>
              </div>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Preview Panel - Left Side */}
      <div className="w-full lg:w-7/12">
        <div className="sticky top-4">
          <div className="mb-2 flex justify-between items-center">
            <h3 className="text-md font-medium text-gray-700">Text Preview</h3>
            <div className="text-sm text-gray-500">
              {isDraggingText ? 'Dragging text...' : 'Drag to reposition'}
            </div>
          </div>
          
          <div 
            ref={previewRef} 
            className="relative w-full bg-gray-800 rounded-lg overflow-hidden shadow-md"
            onClick={handleCanvasClick}
            onMouseUp={handlePreviewMouseUp}
          >
            {backgroundImage ? (
              <>
                <img 
                  ref={imageRef}
                  src={getFullImageUrl(backgroundImage) || ''} 
                  alt="Background" 
                  className="w-full h-auto"
                  onLoad={() => {
                    // Force recalculation of preview dimensions when image loads
                    if (imageRef.current) {
                      const scale = getScalingFactor();
                      console.log(`Preview scale factor: ${scale.toFixed(2)}`);
                    }
                  }}
                />
                {originalImageDimensions && (
                  <>
                    {/* Position marker */}
                    {!isDraggingText && <PositionMarker />}
                    
                    <div 
                      ref={textLayerRef}
                      style={getTextStyle()}
                      className="preview-text"
                      onMouseDown={handleMouseDown}
                    >
                      {localText + (withPeriod ? '.' : '')}
                    </div>
                  </>
                )}
                
                {/* Display coordinates and dimensions information */}
                {originalImageDimensions && (
                  <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs p-1 rounded">
                    Position: {position.x}, {position.y} | 
                    Size: {fontSize}px
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-64 flex items-center justify-center text-gray-400">
                Upload an image to preview text
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Controls Panel - Right Side */}
      <div className="w-full lg:w-5/12 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {/* Tabs Navigation */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('text')}
            className={`flex items-center px-4 py-3 text-sm font-medium ${
              activeTab === 'text' 
                ? 'text-blue-600 border-b-2 border-blue-500' 
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <FiType className="mr-2" size={16} />
            Text
          </button>
          <button
            onClick={() => setActiveTab('style')}
            className={`flex items-center px-4 py-3 text-sm font-medium ${
              activeTab === 'style' 
                ? 'text-blue-600 border-b-2 border-blue-500' 
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <FiSliders className="mr-2" size={16} />
            Style
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`flex items-center px-4 py-3 text-sm font-medium ${
              activeTab === 'advanced' 
                ? 'text-blue-600 border-b-2 border-blue-500' 
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <FiSettings className="mr-2" size={16} />
            Advanced
          </button>
        </div>
        
        {/* Tab Content */}
        <div className="p-4">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default LiveTextEditor; 