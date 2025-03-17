import React, { useState, useEffect, useRef } from 'react';
import { Position, TextLayer, TextLayerStyle } from '../types/api';
import LiveTextEditor from './LiveTextEditor';
import { FiPlus, FiX, FiArrowUp, FiArrowDown, FiMove, FiEdit2, FiDroplet, FiZap, FiMinus } from 'react-icons/fi';

interface TextLayersEditorProps {
  backgroundImage: string | null;
  onLayersChange: (layers: TextLayer[]) => void;
  disabled: boolean;
}

// Define drag state interface
interface DragState {
  isDragging: boolean;
  layerIndex: number;
  startX: number;
  startY: number;
  originalPosition: Position;
}

const DEFAULT_LAYER_STYLE: TextLayerStyle = {
  font_size: 120,
  color: '#FFFFFF',
  font_name: 'anton',
  effects: {
    type: 'shadow',
    settings: {
      offset: [5, 5],
      color: '#000000',
      opacity: 0.5,
      blur: 3
    }
  }
};

const EFFECT_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'shadow', label: 'Shadow' },
  { value: 'outline', label: 'Outline' },
  { value: 'glow', label: 'Glow' },
  { value: '3d_depth', label: '3D Effect' }
];

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

const TextLayersEditor: React.FC<TextLayersEditorProps> = ({
  backgroundImage,
  onLayersChange,
  disabled
}) => {
  // State for layers
  const [layers, setLayers] = useState<TextLayer[]>([]);
  
  // State for currently selected layer index
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number>(-1);
  
  // Reference for the image container
  const imageContainerRef = useRef<HTMLDivElement>(null);
  // Add reference for the actual image element
  const imageRef = useRef<HTMLImageElement>(null);
  
  // State for tracking drag operations
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    layerIndex: -1,
    startX: 0,
    startY: 0,
    originalPosition: { x: 0, y: 0 }
  });
  
  // Add state for original image dimensions
  const [originalImageDimensions, setOriginalImageDimensions] = useState<{ width: number, height: number } | null>(null);
  
  // Add state for window resize updates
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });
  
  // Effect to notify parent of layer changes
  useEffect(() => {
    onLayersChange(layers);
  }, [layers, onLayersChange]);
  
  // Debug logging for image URLs
  useEffect(() => {
    console.log('TextLayersEditor - Background image URL:', backgroundImage);
    console.log('TextLayersEditor - Full background image URL:', getFullImageUrl(backgroundImage));
  }, [backgroundImage]);
  
  // Handle window resize to keep position calculations accurate
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      console.log('Window resized, updating calculations');
    };

    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Rerender components when window size changes
  useEffect(() => {
    if (windowSize.width > 0 && imageRef.current && originalImageDimensions) {
      console.log(`Window resized to ${windowSize.width}x${windowSize.height}`);
      console.log(`Preview image dimensions: ${imageRef.current.clientWidth}x${imageRef.current.clientHeight}`);
      // Force re-render by updating a state variable
      setLayers(prevLayers => [...prevLayers]);
    }
  }, [windowSize, originalImageDimensions]);
  
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
      };
      img.onerror = (e) => {
        console.error('Error loading background image:', fullImageUrl, e);
      };
      img.src = fullImageUrl || '';
    }
  }, [backgroundImage]);
  
  // Calculate the scaling factor between preview and original image
  const getScalingFactor = (): number => {
    if (!imageRef.current || !originalImageDimensions) {
      return 1; // Default to 1 if we don't have dimensions yet
    }
    
    const previewWidth = imageRef.current.clientWidth;
    const originalWidth = originalImageDimensions.width;
    
    const scale = originalWidth / previewWidth;
    console.log(`TextLayersEditor - Scale factor calculated: ${scale.toFixed(2)}`);
    return scale;
  };
  
  // Convert preview coordinates to original image coordinates
  const previewToOriginalCoordinates = (previewX: number, previewY: number): Position => {
    if (!originalImageDimensions || !imageRef.current) {
      return { x: previewX, y: previewY };
    }
    
    // Get current dimensions of the preview image
    const previewWidth = imageRef.current.clientWidth;
    const previewHeight = imageRef.current.clientHeight;
    
    // Convert to percentages (0-100) relative to the preview image dimensions
    const percentX = (previewX / previewWidth) * 100;
    const percentY = (previewY / previewHeight) * 100;
    
    // Convert percentages to pixels in the original image
    const origX = Math.round((percentX / 100) * originalImageDimensions.width);
    const origY = Math.round((percentY / 100) * originalImageDimensions.height);
    
    console.log(`Converting preview (${previewX}, ${previewY}) to original: (${origX}, ${origY}) [${percentX.toFixed(2)}%, ${percentY.toFixed(2)}%]`);
    
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
    
    // Get current dimensions of the preview image
    const previewWidth = imageRef.current.clientWidth;
    const previewHeight = imageRef.current.clientHeight;
    
    // Convert to percentages (0-100) relative to the original image dimensions
    const percentX = (originalX / originalImageDimensions.width) * 100;
    const percentY = (originalY / originalImageDimensions.height) * 100;
    
    // Convert percentages to pixels in the preview
    const previewX = Math.round((percentX / 100) * previewWidth);
    const previewY = Math.round((percentY / 100) * previewHeight);
    
    console.log(`Converting original (${originalX}, ${originalY}) to preview: (${previewX}, ${previewY}) [${percentX.toFixed(2)}%, ${percentY.toFixed(2)}%]`);
    
    return {
      x: previewX,
      y: previewY
    };
  };
  
  // Add event listeners for drag operations
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.isDragging) return;
      
      console.log('Mouse move during drag:', e.clientX, e.clientY);
            
      // Calculate position relative to image container
      if (imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        
        // Get current position in preview coordinates relative to the image
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        
        // Convert cursor position to original coordinates
        const newOriginalPos = previewToOriginalCoordinates(cursorX, cursorY);
        console.log('New absolute position:', newOriginalPos);
        
        // Update the layer position
        const newLayers = [...layers];
        newLayers[dragState.layerIndex].position = newOriginalPos;
        setLayers(newLayers);
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (dragState.isDragging) {
        console.log('Global mouse up - ending drag');
        setDragState(prev => ({ ...prev, isDragging: false }));
        document.body.classList.remove('cursor-grabbing');
        console.log('Drag state reset');
      }
    };
    
    // Add global event listeners when dragging
    if (dragState.isDragging) {
      console.log('Adding global mouse event listeners for drag');
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, layers, originalToPreviewCoordinates, previewToOriginalCoordinates]);
  
  // Add a new layer
  const handleAddLayer = () => {
    const newLayer: TextLayer = {
      text: 'New Text',
      position: { x: 100, y: 100 },
      style: { ...DEFAULT_LAYER_STYLE }
    };
    
    const newLayers = [...layers, newLayer];
    setLayers(newLayers);
    setSelectedLayerIndex(newLayers.length - 1);
  };
  
  // Remove a layer
  const handleRemoveLayer = (index: number) => {
    const newLayers = layers.filter((_, i) => i !== index);
    setLayers(newLayers);
    
    // Update selected index
    if (selectedLayerIndex === index) {
      setSelectedLayerIndex(Math.min(index, newLayers.length - 1));
    } else if (selectedLayerIndex > index) {
      setSelectedLayerIndex(selectedLayerIndex - 1);
    }
  };
  
  // Move layer up in stack
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    
    const newLayers = [...layers];
    const temp = newLayers[index];
    newLayers[index] = newLayers[index - 1];
    newLayers[index - 1] = temp;
    
    setLayers(newLayers);
    setSelectedLayerIndex(index - 1);
  };
  
  // Move layer down in stack
  const handleMoveDown = (index: number) => {
    if (index >= layers.length - 1) return;
    
    const newLayers = [...layers];
    const temp = newLayers[index];
    newLayers[index] = newLayers[index + 1];
    newLayers[index + 1] = temp;
    
    setLayers(newLayers);
    setSelectedLayerIndex(index + 1);
  };
  
  // Update a layer's text
  const handleUpdateText = (index: number, text: string) => {
    const newLayers = [...layers];
    newLayers[index] = {
      ...newLayers[index],
      text
    };
    setLayers(newLayers);
  };
  
  // Update a layer's position
  const handleUpdatePosition = (index: number, position: Position) => {
    const newLayers = [...layers];
    newLayers[index] = {
      ...newLayers[index],
      position
    };
    setLayers(newLayers);
  };
  
  // Update a layer's font size
  const handleUpdateFontSize = (index: number, fontSize: number) => {
    const newLayers = [...layers];
    newLayers[index] = {
      ...newLayers[index],
      style: {
        ...newLayers[index].style,
        font_size: fontSize
      }
    };
    setLayers(newLayers);
  };
  
  // Update a layer's font name
  const handleUpdateFontName = (index: number, fontName: string) => {
    const newLayers = [...layers];
    newLayers[index] = {
      ...newLayers[index],
      style: {
        ...newLayers[index].style,
        font_name: fontName
      }
    };
    setLayers(newLayers);
  };
  
  // Update a layer's color
  const handleUpdateColor = (index: number, color: string) => {
    const newLayers = [...layers];
    newLayers[index] = {
      ...newLayers[index],
      style: {
        ...newLayers[index].style,
        color
      }
    };
    setLayers(newLayers);
  };
  
  // Update a layer's effect type
  const handleUpdateEffectType = (index: number, effectType: string) => {
    const newLayers = [...layers];
    
    // If 'none', remove the effects property
    if (effectType === 'none') {
      const { effects, ...styleWithoutEffects } = newLayers[index].style;
      newLayers[index].style = styleWithoutEffects;
    } else {
      // Otherwise, set the new effect type with default settings
      let settings = {};
      
      // Set default settings based on effect type
      switch (effectType) {
        case 'shadow':
          settings = {
            offset: [5, 5],
            color: '#000000',
            opacity: 0.5,
            blur: 3
          };
          break;
        case 'outline':
          settings = {
            width: 2,
            color: '#000000',
            opacity: 1.0
          };
          break;
        case 'glow':
          settings = {
            color: '#FFFFFF',
            radius: 10,
            opacity: 0.7
          };
          break;
        case '3d_depth':
          settings = {
            layers: 10,
            angle: 45,
            distance: 2,
            color_gradient: ['#333333', '#666666', '#999999']
          };
          break;
      }
      
      newLayers[index].style = {
        ...newLayers[index].style,
        effects: {
          type: effectType,
          settings
        }
      };
    }
    
    setLayers(newLayers);
  };
  
  // Get the current effect type for a layer
  const getCurrentEffectType = (layer: TextLayer): string => {
    if (!layer.style.effects) return 'none';
    return layer.style.effects.type || 'none';
  };

  // Calculate font style for preview text display
  const getTextStyle = (layer: TextLayer, index: number): React.CSSProperties => {
    if (!imageRef.current || !originalImageDimensions) {
      return {
        // Default style when dimensions aren't available yet
        fontFamily: "Anton, sans-serif",
        fontSize: "120px",
        position: "absolute",
        transform: "translate(-50%, -50%)",
        cursor: "grab",
        visibility: "hidden"
      };
    }
    
    // Convert original position to preview position
    const previewPos = originalToPreviewCoordinates(layer.position.x, layer.position.y);
    
    // Calculate the preview font size 
    // Get percentage of original image height that the font size represents
    const fontSizePercent = ((layer.style.font_size || 120) / originalImageDimensions.height) * 100;
    
    // Apply that percentage to the current preview height
    const previewFontSize = Math.round((fontSizePercent / 100) * imageRef.current.clientHeight);
    
    // Get position percentages for debugging display
    const percentX = (layer.position.x / originalImageDimensions.width) * 100;
    const percentY = (layer.position.y / originalImageDimensions.height) * 100;
    
    return {
      fontFamily: layer.style.font_name === 'anton' 
        ? "Anton, sans-serif" 
        : layer.style.font_name === 'sixcaps' 
          ? "'Six Caps', sans-serif" 
          : layer.style.font_name === 'impact' 
            ? "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif"
            : "sans-serif",
      fontSize: `${previewFontSize}px`,
      color: layer.style.color || '#FFFFFF',
      position: 'absolute',
      top: `${previewPos.y}px`,
      left: `${previewPos.x}px`,
      transform: 'translate(-50%, -50%)',
      textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
      cursor: dragState.isDragging && dragState.layerIndex === index ? 'grabbing' : 'grab',
      userSelect: 'none',
      zIndex: index + 10,
      whiteSpace: 'nowrap',
      opacity: dragState.isDragging && dragState.layerIndex === index ? 0.8 : 1,
      transition: dragState.isDragging && dragState.layerIndex === index ? 'none' : 'opacity 0.2s ease',
    };
  };

  // Handle clicking on a text layer in the preview
  const handleTextLayerClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    // Only handle click if not dragging
    if (!dragState.isDragging) {
      setSelectedLayerIndex(index);
    }
  };
  
  // Handle mouse down to initiate dragging
  const handleTextLayerMouseDown = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent text selection
    
    if (disabled) return;
    
    console.log('Text layer mouse down at index:', index);
    
    // Set selected layer
    setSelectedLayerIndex(index);
    
    // Start dragging with the current layer's position
    setDragState({
      isDragging: true,
      layerIndex: index,
      startX: e.clientX,
      startY: e.clientY,
      originalPosition: { ...layers[index].position }
    });
    
    // Get percentage position for logging
    if (originalImageDimensions) {
      const percentX = (layers[index].position.x / originalImageDimensions.width) * 100;
      const percentY = (layers[index].position.y / originalImageDimensions.height) * 100;
      console.log(`Starting drag at position: ${layers[index].position.x}, ${layers[index].position.y} px (${percentX.toFixed(2)}%, ${percentY.toFixed(2)}%)`);
    }
    
    // Apply grabbing cursor to the body during drag operations
    document.body.classList.add('cursor-grabbing');
  };
  
  return (
    <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
      {/* Left sidebar - layer controls */}
      <div className="md:w-1/4 bg-white p-4 rounded-md shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Text Layers</h3>
          <button
            type="button"
            onClick={handleAddLayer}
            disabled={disabled}
            className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            title="Add new text layer"
          >
            <FiPlus />
          </button>
        </div>
        
        {layers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No text layers yet</p>
            <p className="text-sm mt-2">Click the + button to add your first text layer</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {layers.map((layer, index) => (
              <li
                key={index}
                className={`flex items-center justify-between p-3 rounded-md cursor-pointer ${
                  selectedLayerIndex === index ? 'bg-blue-100 border border-blue-300' : 'bg-gray-50 hover:bg-gray-100'
                }`}
                onClick={() => setSelectedLayerIndex(index)}
              >
                <div className="flex items-center">
                  <FiMove className="mr-2 text-gray-400" />
                  <div className="truncate" style={{ maxWidth: '150px' }}>
                    {layer.text || 'Empty text'}
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveUp(index);
                    }}
                    disabled={index === 0 || disabled}
                    className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                    title="Move up"
                  >
                    <FiArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveDown(index);
                    }}
                    disabled={index === layers.length - 1 || disabled}
                    className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                    title="Move down"
                  >
                    <FiArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveLayer(index);
                    }}
                    disabled={disabled}
                    className="p-1 text-red-500 hover:text-red-700 disabled:opacity-30"
                    title="Remove layer"
                  >
                    <FiX size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* Right side - combined preview and editor */}
      <div className="md:w-3/4">
        <div className="bg-white rounded-md shadow p-4">
          <h3 className="text-lg font-medium mb-4">Interactive Text Layers</h3>
          
          {/* Interactive preview area */}
          <div 
            className="relative bg-gray-800 rounded-lg overflow-hidden mb-4"
          >
            {backgroundImage ? (
              <div 
                className="relative" 
                ref={imageContainerRef}
              >
                <img 
                  src={getFullImageUrl(backgroundImage) || ''} 
                  alt="Background" 
                  className="w-full h-auto"
                  ref={imageRef}
                  onLoad={() => {
                    if (imageRef.current) {
                      console.log('Image loaded, dimensions:', 
                        imageRef.current.clientWidth, 
                        'x', 
                        imageRef.current.clientHeight
                      );
                      
                      // Force a re-render to update text positions
                      setLayers(prevLayers => [...prevLayers]);
                    }
                  }}
                />
                
                {/* Debug info */}
                {originalImageDimensions && (
                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs p-1 rounded">
                    Image: {originalImageDimensions.width}x{originalImageDimensions.height} | 
                    Scale: {(imageRef.current?.clientWidth ? originalImageDimensions.width / imageRef.current.clientWidth : 0).toFixed(2)}x
                  </div>
                )}
                
                {/* Render all text layers - clickable to select and draggable */}
                {layers.map((layer, index) => (
                  <div 
                    key={index}
                    style={getTextStyle(layer, index)}
                    className={`preview-text-layer ${selectedLayerIndex === index ? 'ring-2 ring-blue-400' : ''}`}
                    onClick={(e) => handleTextLayerClick(index, e)}
                    onMouseDown={(e) => handleTextLayerMouseDown(index, e)}
                  >
                    {layer.text}
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full h-64 flex items-center justify-center text-gray-400">
                Upload an image to preview text layers
              </div>
            )}
          </div>
          
          <div className="text-sm text-gray-500 text-center mb-4">
            {layers.length ? 
              `${layers.length} text layer${layers.length > 1 ? 's' : ''} - Click to select or drag to reposition` : 
              'No text layers added yet'}
          </div>

          {/* Selected layer position information */}
          {selectedLayerIndex >= 0 && selectedLayerIndex < layers.length && originalImageDimensions && (
            <div className="text-xs text-gray-500 text-center mb-4 p-2 bg-gray-100 rounded">
              Position: {layers[selectedLayerIndex].position.x}, {layers[selectedLayerIndex].position.y} px
              ({((layers[selectedLayerIndex].position.x / originalImageDimensions.width) * 100).toFixed(2)}%, 
              {((layers[selectedLayerIndex].position.y / originalImageDimensions.height) * 100).toFixed(2)}%)
              | Size: {layers[selectedLayerIndex].style.font_size}px 
              ({((layers[selectedLayerIndex].style.font_size || 120) / originalImageDimensions.height * 100).toFixed(2)}% of height)
            </div>
          )}

          {/* Edit controls for selected layer */}
          {selectedLayerIndex >= 0 && selectedLayerIndex < layers.length ? (
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium mb-4 flex items-center">
                <FiEdit2 className="mr-2" />
                Edit Layer: {layers[selectedLayerIndex].text}
              </h3>
              
              {/* Text style controls */}
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Text
                  </label>
                  <input
                    type="text"
                    value={layers[selectedLayerIndex].text}
                    onChange={(e) => handleUpdateText(selectedLayerIndex, e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter text"
                    disabled={disabled}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Font
                  </label>
                  <select
                    value={layers[selectedLayerIndex].style.font_name || 'anton'}
                    onChange={(e) => handleUpdateFontName(selectedLayerIndex, e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    disabled={disabled}
                  >
                    <option value="anton">Anton</option>
                    <option value="sixcaps">Six Caps</option>
                    <option value="impact">Impact</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Font Size
                  </label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => handleUpdateFontSize(selectedLayerIndex, Math.max(20, (layers[selectedLayerIndex].style.font_size || 120) - 10))}
                      className="p-2 border border-gray-300 rounded-l-md bg-gray-50 hover:bg-gray-100"
                      disabled={disabled}
                    >
                      <FiMinus size={16} />
                    </button>
                    <input
                      type="number"
                      value={layers[selectedLayerIndex].style.font_size || 120}
                      onChange={(e) => handleUpdateFontSize(selectedLayerIndex, parseInt(e.target.value) || 120)}
                      className="w-20 text-center border-y border-gray-300 py-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={disabled}
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateFontSize(selectedLayerIndex, (layers[selectedLayerIndex].style.font_size || 120) + 10)}
                      className="p-2 border border-gray-300 rounded-r-md bg-gray-50 hover:bg-gray-100"
                      disabled={disabled}
                    >
                      <FiPlus size={16} />
                    </button>
                    <span className="ml-2 text-gray-500 text-sm">px</span>
                  </div>
                  
                  {/* Font size presets */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[80, 100, 120, 150, 200].map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => handleUpdateFontSize(selectedLayerIndex, size)}
                        className={`text-xs py-1 px-2 rounded ${
                          layers[selectedLayerIndex].style.font_size === size ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                    Text Color
                  </label>
                  <div className="flex items-center">
                    <div 
                      className="w-8 h-8 rounded border border-gray-300 mr-2"
                      style={{ backgroundColor: layers[selectedLayerIndex].style.color || '#FFFFFF' }}
                    ></div>
                    <input
                      type="color"
                      value={layers[selectedLayerIndex].style.color || '#FFFFFF'}
                      onChange={(e) => handleUpdateColor(selectedLayerIndex, e.target.value)}
                      className="h-8 w-8 rounded"
                      disabled={disabled}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Text Effect
                  </label>
                  <select
                    value={getCurrentEffectType(layers[selectedLayerIndex])}
                    onChange={(e) => handleUpdateEffectType(selectedLayerIndex, e.target.value)}
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                    disabled={disabled}
                  >
                    {EFFECT_TYPES.map((effect) => (
                      <option key={effect.value} value={effect.value}>
                        {effect.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <p className="mb-2">Select a text layer to edit or create a new one</p>
              <button
                type="button"
                onClick={handleAddLayer}
                disabled={disabled}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                <FiPlus className="inline mr-1" /> Add New Text Layer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TextLayersEditor; 