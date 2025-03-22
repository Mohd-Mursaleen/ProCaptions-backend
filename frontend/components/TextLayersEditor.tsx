"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import type { Position, TextLayer, TextLayerStyle } from "../types/api"
import { Plus, X, ArrowUp, ArrowDown, Move, Minus, Type, Settings, ChevronDown, Layers } from "lucide-react"
import { MdCenterFocusStrong } from "react-icons/md"
import { motion } from "framer-motion"
import { FiPlus, FiX, FiArrowUp, FiArrowDown, FiMove, FiEdit2, FiDroplet, FiZap, FiMinus, FiLayout, FiType, FiSettings } from 'react-icons/fi';

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
  
  // If it's an absolute URL (starts with http or https), return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // If it's a relative URL from our local storage, point directly to backend
  if (url.startsWith('/uploads/')) {
    // For development - point directly to the backend server
    const fullUrl = `http://localhost:8000${url}`;
    return fullUrl;
  }
  
  // If it's just a filename without path, assume it's in public directory
  if (!url.includes('/') && !url.startsWith('data:')) {
    // Point to backend public directory
    const fullUrl = `http://localhost:8000/uploads/public/${url}`;
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
  
  // Add state for active tab (improves UI organization)
  const [activeTab, setActiveTab] = useState<'layers' | 'style' | 'advanced'>('layers');
  
  // Add state for preview dimensions
  const [previewDimensions, setPreviewDimensions] = useState<{ width: number, height: number } | null>(null);
  
  // Add state for mobile drawer (for small screens)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
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
      
      // Force recalculation of preview dimensions and positions when window resizes
      if (imageRef.current && originalImageDimensions) {
        // Force a re-render to update text positions
        setLayers(prevLayers => [...prevLayers]);
      }
      
      // Close drawer on window resize (to avoid UI issues)
      if (isDrawerOpen && window.innerWidth > 768) {
        setIsDrawerOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [originalImageDimensions, isDrawerOpen]);
  
  // Load the background image to get its dimensions
  useEffect(() => {
    if (backgroundImage) {
      const fullImageUrl = getFullImageUrl(backgroundImage);
      
      const img = new Image();
      img.onload = () => {
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
  
  // Update preview dimensions when image loads or window resizes
  useEffect(() => {
    if (imageRef.current && originalImageDimensions) {
      const containerWidth = imageRef.current.parentElement?.clientWidth || 0;
      const aspectRatio = originalImageDimensions.width / originalImageDimensions.height;
      const previewHeight = containerWidth / aspectRatio;
      
      setPreviewDimensions({
        width: containerWidth,
        height: previewHeight
      });
    }
  }, [originalImageDimensions, windowSize]);
  
  // Improved: Convert preview coordinates to original image coordinates
  const previewToOriginalCoordinates = (previewX: number, previewY: number): Position => {
    if (!originalImageDimensions || !previewDimensions) {
      return { x: previewX, y: previewY };
    }
    
    // Convert preview coordinates to original coordinates using aspect ratio
    const scaleX = originalImageDimensions.width / previewDimensions.width;
    const scaleY = originalImageDimensions.height / previewDimensions.height;
    
    const origX = Math.round(previewX * scaleX);
    const origY = Math.round(previewY * scaleY);
    
    return {
      x: origX,
      y: origY
    };
  };
  
  // Improved: Convert original image coordinates to preview coordinates
  const originalToPreviewCoordinates = (originalX: number, originalY: number): Position => {
    if (!originalImageDimensions || !previewDimensions) {
      return { x: originalX, y: originalY };
    }
    
    // Convert original coordinates to preview coordinates using aspect ratio
    const scaleX = previewDimensions.width / originalImageDimensions.width;
    const scaleY = previewDimensions.height / originalImageDimensions.height;
    
    const previewX = Math.round(originalX * scaleX);
    const previewY = Math.round(originalY * scaleY);
    
    return {
      x: previewX,
      y: previewY
    };
  };
  
  // Add event listeners for drag operations
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.isDragging) return;
            
      // Calculate position relative to image container
      if (imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        
        // Get current position in preview coordinates relative to the image
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        
        // Convert cursor position to original coordinates
        const newOriginalPos = previewToOriginalCoordinates(cursorX, cursorY);
        
        // Update the layer position
        const newLayers = [...layers];
        newLayers[dragState.layerIndex].position = newOriginalPos;
        setLayers(newLayers);
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (dragState.isDragging) {
        setDragState(prev => ({ ...prev, isDragging: false }));
        document.body.classList.remove('cursor-grabbing');
      }
    };
    
    // Touch event handlers for mobile devices
    const handleTouchMove = (e: TouchEvent) => {
      if (!dragState.isDragging || e.touches.length === 0) return;
      
      // Prevent default to stop scrolling while dragging
      e.preventDefault();
      
      // Calculate position relative to image container
      if (imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        const touch = e.touches[0];
        
        // Get current position in preview coordinates relative to the image
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        
        // Convert touch position to original coordinates
        const newOriginalPos = previewToOriginalCoordinates(touchX, touchY);
        
        // Update the layer position
        const newLayers = [...layers];
        newLayers[dragState.layerIndex].position = newOriginalPos;
        setLayers(newLayers);
      }
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      if (dragState.isDragging) {
        setDragState(prev => ({ ...prev, isDragging: false }));
        document.body.classList.remove('cursor-grabbing');
      }
    };
    
    // Add global event listeners when dragging
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      document.addEventListener('touchcancel', handleTouchEnd);
    }
    
    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [dragState, layers]);
  
  // Add a new layer
  const handleAddLayer = () => {
    const newLayer: TextLayer = {
      text: 'New Text',
      position: originalImageDimensions ? 
        { x: Math.round(originalImageDimensions.width / 2), y: Math.round(originalImageDimensions.height / 2) } : 
        { x: 100, y: 100 },
      style: { ...DEFAULT_LAYER_STYLE }
    };
    
    const newLayers = [...layers, newLayer];
    setLayers(newLayers);
    setSelectedLayerIndex(newLayers.length - 1);
  };
  
  // Center the selected text in the image
  const handleCenterText = () => {
    if (!originalImageDimensions || selectedLayerIndex < 0) return;
    
    const newLayers = [...layers];
    newLayers[selectedLayerIndex].position = {
      x: Math.round(originalImageDimensions.width / 2),
      y: Math.round(originalImageDimensions.height / 2)
    };
    setLayers(newLayers);
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
      if (newLayers[index].style && 'effects' in newLayers[index].style) {
        const { effects, ...styleWithoutEffects } = newLayers[index].style as any;
        newLayers[index].style = styleWithoutEffects;
      }
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
  
  // Calculate font style for preview text display
  const getTextStyle = (layer: TextLayer, index: number): React.CSSProperties => {
    if (!previewDimensions || !originalImageDimensions) {
      return {
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
    
    // Calculate the preview font size based on aspect ratio
    const scaleY = previewDimensions.height / originalImageDimensions.height;
    const previewFontSize = Math.round((layer.style?.font_size || 120) * scaleY);
    
    const fontName = layer.style?.font_name || 'anton';
    
    return {
      fontFamily: fontName === 'anton' 
        ? "Anton, sans-serif" 
        : fontName === 'sixcaps' 
          ? "'Six Caps', sans-serif" 
          : fontName === 'impact' 
            ? "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif"
            : "sans-serif",
      fontSize: `${previewFontSize}px`,
      color: layer.style?.color || '#FFFFFF',
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
    
    // Apply grabbing cursor to the body during drag operations
    document.body.classList.add('cursor-grabbing');
  };
  
  // Handle touch start to initiate dragging on touch devices
  const handleTextLayerTouchStart = (index: number, e: React.TouchEvent) => {
    e.stopPropagation();
    
    if (disabled || e.touches.length === 0) return;
    
    // Set selected layer
    setSelectedLayerIndex(index);
    
    const touch = e.touches[0];
    
    // Start dragging with the current layer's position
    setDragState({
      isDragging: true,
      layerIndex: index,
      startX: touch.clientX,
      startY: touch.clientY,
      originalPosition: { ...layers[index].position }
    });
    
    // Apply grabbing cursor to the body during drag operations
    document.body.classList.add('cursor-grabbing');
  };

  // Add a position marker component for better visual feedback
  const PositionMarker = ({ position }: { position: Position }) => {
    const previewPos = originalToPreviewCoordinates(position.x, position.y);
    
    return (
      <div
        className="absolute w-4 h-4 pointer-events-none z-5"
        style={{
          top: `${previewPos.y}px`,
          left: `${previewPos.x}px`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <div className="absolute w-2 h-2 rounded-full bg-indigo-400 border border-indigo-600 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-glow"></div>
      </div>
    );
  };
  
  // Toggle mobile drawer
  const toggleDrawer = () => {
    setIsDrawerOpen(prev => !prev);
  };
  
  // Render different tab content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case "layers":
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-white/90">Text Layers</h3>
              <button
                type="button"
                onClick={handleAddLayer}
                disabled={disabled}
                className="p-3 bg-gradient-to-r from-indigo-500 to-rose-500 text-white rounded-full hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 touch-manipulation"
                title="Add new text layer"
                aria-label="Add new text layer"
              >
                <Plus size={20} />
              </button>
            </div>

            {layers.length === 0 ? (
              <div className="text-center py-8 text-white/50">
                <p>No text layers yet</p>
                <p className="text-sm mt-2">Click the + button to add your first text layer</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {layers.map((layer, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`flex items-center justify-between p-4 rounded-md cursor-pointer ${
                      selectedLayerIndex === index
                        ? "bg-indigo-500/20 border border-indigo-500/30"
                        : "bg-white/5 hover:bg-white/10 border border-white/10"
                    }`}
                    onClick={() => setSelectedLayerIndex(index)}
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <Move className="mr-2 text-indigo-400 flex-shrink-0" size={18} />
                      <div className="truncate text-white/90" style={{ maxWidth: "150px" }}>
                        {layer.text || "Empty text"}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoveUp(index)
                        }}
                        disabled={index === 0 || disabled}
                        className="p-2 text-white/60 hover:text-white disabled:opacity-30 rounded-md touch-manipulation"
                        title="Move up"
                        aria-label="Move layer up"
                      >
                        <ArrowUp size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoveDown(index)
                        }}
                        disabled={index === layers.length - 1 || disabled}
                        className="p-2 text-white/60 hover:text-white disabled:opacity-30 rounded-md touch-manipulation"
                        title="Move down"
                        aria-label="Move layer down"
                      >
                        <ArrowDown size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveLayer(index)
                        }}
                        disabled={disabled}
                        className="p-2 text-rose-400 hover:text-rose-300 disabled:opacity-30 rounded-md touch-manipulation"
                        title="Remove layer"
                        aria-label="Remove layer"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        )

      case "style":
        return selectedLayerIndex >= 0 && selectedLayerIndex < layers.length ? (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Text
              </label>
              <input
                type="text"
                value={layers[selectedLayerIndex].text}
                onChange={(e) => handleUpdateText(selectedLayerIndex, e.target.value)}
                className="w-full px-4 py-3 border bg-white/10 border-white/20 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-white appearance-none"
                placeholder="Enter text"
                disabled={disabled}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Font
              </label>
              <select
                value={layers[selectedLayerIndex].style?.font_name || 'anton'}
                onChange={(e) => handleUpdateFontName(selectedLayerIndex, e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-white appearance-none"
                disabled={disabled}
              >
                <option value="anton">Anton</option>
                <option value="sixcaps">Six Caps</option>
                <option value="impact">Impact</option>
                <option value="boldonse">Boldonse</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Font Size
              </label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => handleUpdateFontSize(selectedLayerIndex, Math.max(20, (layers[selectedLayerIndex].style?.font_size || 120) - 10))}
                  className="p-3 border border-white/20 rounded-l-md bg-white/5 hover:bg-white/10 text-white touch-manipulation"
                  disabled={disabled}
                  aria-label="Decrease font size"
                >
                  <FiMinus size={20} />
                </button>
                <input
                  type="number"
                  value={layers[selectedLayerIndex].style?.font_size || 120}
                  onChange={(e) => handleUpdateFontSize(selectedLayerIndex, parseInt(e.target.value) || 120)}
                  className="w-24 text-center border-y border-white/20 py-3 bg-white/10 text-white focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => handleUpdateFontSize(selectedLayerIndex, (layers[selectedLayerIndex].style?.font_size || 120) + 10)}
                  className="p-3 border border-white/20 rounded-r-md bg-white/5 hover:bg-white/10 text-white touch-manipulation"
                  disabled={disabled}
                  aria-label="Increase font size"
                >
                  <FiPlus size={20} />
                </button>
                <span className="ml-2 text-gray-500 text-sm">px</span>
              </div>
              
              {/* Font size presets */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[80, 100, 120, 150, 200, 300].map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => handleUpdateFontSize(selectedLayerIndex, size)}
                    className={`py-2 px-3 rounded-md text-sm ${
                      layers[selectedLayerIndex].style?.font_size === size ? "bg-indigo-500/30 text-white border border-indigo-500/50"
                        : "bg-white/5 text-white/70 hover:bg-white/10 border border-white/10"
                    } touch-manipulation`}
                    disabled={disabled}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Text Color
              </label>
              <div className="flex items-center">
                <div 
                  className="w-10 h-10 rounded border border-gray-300 mr-3"
                  style={{ backgroundColor: layers[selectedLayerIndex].style?.color || '#FFFFFF' }}
                ></div>
                <input
                  type="color"
                  value={layers[selectedLayerIndex].style?.color || '#FFFFFF'}
                  onChange={(e) => handleUpdateColor(selectedLayerIndex, e.target.value)}
                  className="h-10 w-10 rounded touch-manipulation"
                  disabled={disabled}
                />
              </div>
            </div>
            
            {/* Center text button for mobile */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleCenterText}
                disabled={disabled || selectedLayerIndex < 0}
                className="flex items-center justify-center w-full py-3 px-4 bg-indigo-500/20 hover:bg-indigo-500/30 text-white rounded-md border border-indigo-500/40 touch-manipulation"
                title="Center text in image"
              >
                <MdCenterFocusStrong size={20} className="mr-2" />
                Center in Image
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-white/50">
            <p>Select a layer first to edit its style</p>
          </div>
        );
      
       
      default:
        return null;
    }
  };
  
  return (
    <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 relative">
      {/* Left side - preview */}
      <div className="w-full md:w-3/5 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-[#050510] rounded-lg shadow-lg p-4 border border-white/10"
        >
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-medium text-white/90">Text Preview</h3>
            
            {/* Mobile-only toggle button for editor panel */}
            <button 
              className="md:hidden p-2 bg-indigo-500/20 border border-indigo-500/40 rounded-md text-white/90 touch-manipulation"
              onClick={toggleDrawer}
              aria-label="Toggle editor panel"
            >
              {isDrawerOpen ? <X size={20} /> : <Layers size={20} />}
            </button>
          </div>
          
          {/* Interactive preview area with fixed aspect ratio */}
          <div 
            className="relative bg-[#030303] rounded-lg overflow-hidden mb-4 border border-white/5"
            style={{
              width: '100%',
              paddingTop: originalImageDimensions ? 
                `${(originalImageDimensions.height / originalImageDimensions.width) * 100}%` : 
                '56.25%' // 16:9 default
            }}
          >
            {backgroundImage ? (
              <div 
                className="absolute inset-0" 
                ref={imageContainerRef}
              >
                <img 
                  src={getFullImageUrl(backgroundImage) || ''} 
                  alt="Background" 
                  className="w-full h-full object-contain"
                  ref={imageRef}
                  onLoad={() => {
                    if (imageRef.current) {
                      // Force a re-render to update text positions
                      setLayers(prevLayers => [...prevLayers]);
                    }
                  }}
                />
                
                {/* Position markers for selected layer */}
                {selectedLayerIndex >= 0 && layers[selectedLayerIndex] && !dragState.isDragging && (
                  <PositionMarker position={layers[selectedLayerIndex].position} />
                )}
                
                {/* Render all text layers - clickable to select and draggable */}
                {layers.map((layer, index) => (
                  <div 
                    key={index}
                    style={getTextStyle(layer, index)}
                    className={`preview-text-layer ${selectedLayerIndex === index ? 'ring-2 ring-indigo-400' : ''}`}
                    onClick={(e) => handleTextLayerClick(index, e)}
                    onMouseDown={(e) => handleTextLayerMouseDown(index, e)}
                    onTouchStart={(e) => handleTextLayerTouchStart(index, e)}
                  >
                    {layer.text}
                  </div>
                ))}
                
                {/* Mobile-only layer indicator */}
                {layers.length > 0 && windowSize.width < 768 && (
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs p-2 rounded-md backdrop-blur-sm border border-white/10">
                    Layer {selectedLayerIndex + 1} of {layers.length}
                  </div>
                )}
                
                {/* Debug info - only show on larger screens */}
                {originalImageDimensions && windowSize.width >= 768 && (
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs p-1 rounded-md backdrop-blur-sm border border-white/10">
                    Image: {originalImageDimensions.width}x{originalImageDimensions.height} | 
                    Preview: {previewDimensions?.width}x{previewDimensions?.height}
                  </div>
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/40 bg-gradient-to-br from-indigo-900/20 to-rose-900/20">
                Upload an image to preview text layers
              </div>
            )}
          </div>
          
          <div className="text-sm text-white/50 text-center">
            {layers.length ? 
              `${layers.length} text layer${layers.length > 1 ? 's' : ''} - Tap to select or drag to reposition` : 
              'No text layers added yet'}
          </div>
        </motion.div>
        
        {/* Mobile add layer button - fixed at bottom for easy access */}
        {windowSize.width < 768 && !isDrawerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-4 right-4 z-30"
          >
            <button
              type="button"
              onClick={handleAddLayer}
              disabled={disabled}
              className="p-4 bg-gradient-to-r from-indigo-500 to-rose-500 text-white rounded-full shadow-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 touch-manipulation"
              title="Add new text layer"
              aria-label="Add new text layer"
            >
              <Plus size={24} />
            </button>
          </motion.div>
        )}
      </div>
      
      {/* Right side - editor controls - responsive for mobile */}
      <div 
        className={`
          md:w-2/5 bg-[#050510]/90 rounded-lg shadow-lg backdrop-blur-sm border border-white/10
          ${windowSize.width < 768 ? 
            `fixed inset-0 z-30 ${isDrawerOpen ? 'translate-y-0' : 'translate-y-full'} transition-transform duration-300 ease-in-out overflow-auto` 
            : ''}
        `}
      >
        {/* Close button only for mobile drawer */}
        {windowSize.width < 768 && isDrawerOpen && (
          <div className="sticky top-0 bg-[#050510] border-b border-white/10 p-3 flex justify-between items-center">
            <h2 className="text-lg font-medium text-white/90">Text Editor</h2>
            <button 
              className="p-2 bg-white/10 rounded-md text-white/90"
              onClick={toggleDrawer}
              aria-label="Close panel"
            >
              <X size={20} />
            </button>
          </div>
        )}
        
        {/* Tab navigation - Sticky on mobile */}
        <div className={`flex border-b border-white/10 overflow-x-auto ${windowSize.width < 768 && isDrawerOpen ? 'sticky top-12 bg-[#050510] z-10' : ''}`}>
          <button
            onClick={() => setActiveTab('layers')}
            className={`flex items-center px-4 py-3 text-sm font-medium ${
              activeTab === 'layers' 
                ? 'text-indigo-400 border-b-2 border-indigo-500' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="mr-2" size={18} />
            Layers
          </button>
          <button
            onClick={() => setActiveTab('style')}
            className={`flex items-center px-4 py-3 text-sm font-medium ${
              activeTab === 'style' 
                ? 'text-indigo-400 border-b-2 border-indigo-500' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
            disabled={selectedLayerIndex < 0}
          >
            <FiType className="mr-2" size={18} />
            Style
          </button>
        </div>
        
        {/* Tab content */}
        <div className="p-4">
          {renderTabContent()}
        </div>
        
        {/* Quick actions - Add new layer button when no layers exist */}
        {layers.length === 0 && (
          <div className="p-4 border-t border-white/10">
            <button
              type="button"
              onClick={handleAddLayer}
              disabled={disabled}
              className="w-full px-4 py-3 bg-gradient-to-r from-indigo-500 to-rose-500 text-white rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 touch-manipulation"
            >
              <Plus className="inline mr-1" size={18} /> Add Text Layer
            </button>
          </div>
        )}
        
        {/* Mobile footer - done button at the bottom */}
        {windowSize.width < 768 && isDrawerOpen && (
          <div className="sticky bottom-0 bg-[#050510] border-t border-white/10 p-4">
            <button
              type="button"
              onClick={toggleDrawer}
              className="w-full px-4 py-3 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 touch-manipulation"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TextLayersEditor; 