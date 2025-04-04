"use client"

import React, { useState, useRef, useEffect } from 'react';
import type { Position, TextLayer, TextLayerStyle, ShadowEffectSettings, EffectSettings, OutlineEffectSettings, GlowEffectSettings, ThreeDEffectSettings, EffectType } from "../types/api"
import { Plus, X, ArrowUp, ArrowDown, Move, Minus, Type, Settings, ChevronDown, Layers } from "lucide-react"
import { MdCenterFocusStrong } from "react-icons/md"
import { motion } from "framer-motion"
import { FiPlus, FiX, FiArrowUp, FiArrowDown, FiMove, FiEdit2, FiDroplet, FiZap, FiMinus, FiLayout, FiType, FiSettings } from 'react-icons/fi';

interface TextLayersEditorProps {
  backgroundImage: string | null;
  onLayersChange: (layers: TextLayer[]) => void;
  disabled: boolean;
  isMobileView?: boolean;
  onDrawerStateChange?: (isOpen: boolean) => void;
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

const EFFECT_TYPES: Array<{ value: EffectType; label: string }> = [
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
  disabled,
  isMobileView,
  onDrawerStateChange
}) => {
  // State for layers
  const [layers, setLayers] = useState<TextLayer[]>([]);
  
  // State for currently selected layer index
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number>(-1);
  
  // Enhanced mobile UI state
  const [isMobile, setIsMobile] = useState(false)
  
  // Edit step approach for better mobile UX
  const [editStep, setEditStep] = useState<'none' | 'layers' | 'style' | 'add'>('none')
  
  // Simplified drawer - just open/closed
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  
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
  
  // Keep this for desktop view
  const [activeTab, setActiveTab] = useState<'layers' | 'style' | 'advanced'>('layers');
  
  // Add state for preview dimensions
  const [previewDimensions, setPreviewDimensions] = useState<{ width: number, height: number } | null>(null);
  
  // Effect to notify parent of layer changes
  useEffect(() => {
    onLayersChange(layers);
  }, [layers, onLayersChange]);
  
  // Debug logging for image URLs
  useEffect(() => {
    console.log('TextLayersEditor - Background image URL:', backgroundImage);
    console.log('TextLayersEditor - Full background image URL:', getFullImageUrl(backgroundImage));
  }, [backgroundImage]);
  
  // Use effect to determine if we're on mobile
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setWindowSize({
        width,
        height,
      });
      
      // Use the prop value if provided, otherwise detect based on screen size
      if (isMobileView !== undefined) {
        setIsMobile(isMobileView);
      } else {
        // Detect mobile screens
        setIsMobile(width < 768);
      }
      
      // Close drawer on window resize to avoid UI issues
      if (isDrawerOpen && window.innerWidth > 768) {
        setIsDrawerOpen(false);
        setEditStep('none');
      }
      
      // Force recalculation of preview dimensions when window resizes
      if (imageRef.current && originalImageDimensions) {
        // Force a re-render to update text positions
        setLayers(prevLayers => [...prevLayers]);
      }
    };
    
    // Initial call on mount
    handleResize();

    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [originalImageDimensions, isDrawerOpen, isMobileView]);
  
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
  const handleUpdateEffectType = (index: number, effectType: EffectType) => {
    if (disabled) return;
    
    const updatedLayers = [...layers];
    if (!updatedLayers[index].style) {
      updatedLayers[index].style = { ...DEFAULT_LAYER_STYLE };
    }
    
    if (!updatedLayers[index].style.effects) {
      updatedLayers[index].style.effects = { type: 'none' };
    }
    
    // Simplified shadow effect - just toggle on/off with default settings
    if (effectType === 'none') {
      updatedLayers[index].style.effects = { type: 'none' };
    } else {
      updatedLayers[index].style.effects = { 
        type: effectType,
        // Apply default effect settings with correct property names from ShadowEffectSettings interface
        settings: {
            offset: [5, 5],
            color: '#000000',
            opacity: 0.5,
            blur: 3
        }
      };
    }
    
    setLayers(updatedLayers);
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
    
    // Get shadow effect settings
    const effects = layer.style?.effects;
    const shadowEffect = effects && effects.type === 'shadow' 
      ? effects.settings as ShadowEffectSettings 
      : null;
    
    // Create text shadow based on effect settings
    let textShadow = 'none';
    if (shadowEffect) {
      const { offset, color, opacity, blur } = shadowEffect;
      // Scale the offset and blur based on the preview scale
      const scaledOffsetX = offset[0] * scaleY;
      const scaledOffsetY = offset[1] * scaleY;
      const scaledBlur = blur * scaleY;
      
      // Convert hex color to rgba
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      
      textShadow = `${scaledOffsetX}px ${scaledOffsetY}px ${scaledBlur}px rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    
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
      textShadow,
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

  // Simplified toggle drawer
  const toggleDrawer = (open?: boolean) => {
    const newState = open !== undefined ? open : !isDrawerOpen;
    setIsDrawerOpen(newState);
    // Notify parent component about drawer state change
    if (onDrawerStateChange) {
      onDrawerStateChange(newState);
    }
  }
  
  // Toggle edit step
  const toggleEditStep = (step: 'none' | 'layers' | 'style' | 'add') => {
    if (editStep === step) {
      setEditStep('none')
      toggleDrawer(false)
    } else {
      setEditStep(step)
      toggleDrawer(true)
    }
  }
  
  // Add position marker component with enhanced mobile visibility
  const PositionMarker = ({ position }: { position: Position }) => {
    const previewPos = originalToPreviewCoordinates(position.x, position.y);
    
    return (
      <div
        className="absolute pointer-events-none z-5"
        style={{
          top: `${previewPos.y}px`,
          left: `${previewPos.x}px`,
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Enhanced marker with animation for better visibility */}
        <div className={`absolute rounded-full ${isMobile ? 'w-6 h-6' : 'w-4 h-4'} bg-indigo-500/20 border border-indigo-500/40 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse`}></div>
        <div className="absolute w-2 h-2 rounded-full bg-indigo-500 border border-indigo-700 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-glow"></div>
      </div>
    );
  };
  
  // Render step-based content for mobile
  const renderStepContent = () => {
    switch (editStep) {
      case 'layers':
        return (
          <div className="p-5">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-medium text-white">Text Layers</h3>
              <button 
                className="p-2 bg-white/10 rounded-full"
                onClick={() => toggleEditStep('none')}
              >
                <X size={24} />
              </button>
            </div>
            
            {layers.length === 0 ? (
              <div className="text-center py-6 text-white/50">
                <p>No text layers yet</p>
                <p className="text-sm mt-2">Tap the + button to add your first text layer</p>
                <button
                  onClick={handleAddLayer}
                  className="mt-4 px-5 py-3 bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
                >
                  <Plus size={20} className="inline-block mr-2" /> Add Text Layer
                </button>
              </div>
            ) : (
              <ul className="space-y-3 max-h-[60vh] overflow-y-auto pb-5">
                {layers.map((layer, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`flex items-center justify-between p-4 rounded-md ${
                      selectedLayerIndex === index
                        ? "bg-indigo-500/20 border border-indigo-500/30"
                        : "bg-white/5 hover:bg-white/10 border border-white/10"
                    }`}
                    onClick={() => setSelectedLayerIndex(index)}
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <Move className="mr-2 text-indigo-400 flex-shrink-0" size={22} />
                      <div className="truncate text-white/90" style={{ maxWidth: "200px" }}>
                        {layer.text || "Empty text"}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoveUp(index)
                        }}
                        disabled={index === 0 || disabled}
                        className="p-3 text-white/60 hover:text-white disabled:opacity-30 rounded-md touch-manipulation"
                        aria-label="Move layer up"
                      >
                        <ArrowUp size={22} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoveDown(index)
                        }}
                        disabled={index === layers.length - 1 || disabled}
                        className="p-3 text-white/60 hover:text-white disabled:opacity-30 rounded-md touch-manipulation"
                        aria-label="Move layer down"
                      >
                        <ArrowDown size={22} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveLayer(index)
                        }}
                        disabled={disabled}
                        className="p-3 text-rose-400 hover:text-rose-300 disabled:opacity-30 rounded-md touch-manipulation"
                        aria-label="Remove layer"
                      >
                        <X size={22} />
                      </button>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        );
        
      case 'style':
        return selectedLayerIndex >= 0 && selectedLayerIndex < layers.length ? (
          <div className="p-5">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-medium text-white">Edit Layer</h3>
              <button 
                className="p-2 bg-white/10 rounded-full"
                onClick={() => toggleEditStep('none')}
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-5 max-h-[60vh] overflow-y-auto pb-5">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Text
                </label>
                <input
                  type="text"
                  value={layers[selectedLayerIndex].text}
                  onChange={(e) => handleUpdateText(selectedLayerIndex, e.target.value)}
                  className="w-full px-4 py-4 text-lg border bg-white/10 border-white/20 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-white appearance-none"
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
                  className="w-full px-4 py-4 text-lg bg-white/10 border border-white/20 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-white appearance-none"
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
                    className="p-4 border border-white/20 rounded-l-md bg-white/5 hover:bg-white/10 text-white touch-manipulation"
                    disabled={disabled}
                    aria-label="Decrease font size"
                  >
                    <FiMinus size={24} />
                  </button>
                  <input
                    type="number"
                    value={layers[selectedLayerIndex].style?.font_size || 120}
                    onChange={(e) => handleUpdateFontSize(selectedLayerIndex, parseInt(e.target.value) || 120)}
                    className="w-24 text-center border-y border-white/20 py-4 text-lg bg-white/10 text-white focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={disabled}
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdateFontSize(selectedLayerIndex, (layers[selectedLayerIndex].style?.font_size || 120) + 10)}
                    className="p-4 border border-white/20 rounded-r-md bg-white/5 hover:bg-white/10 text-white touch-manipulation"
                    disabled={disabled}
                    aria-label="Increase font size"
                  >
                    <FiPlus size={24} />
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
                      className={`py-3 px-3 rounded-md text-sm ${
                        layers[selectedLayerIndex].style?.font_size === size ? "bg-indigo-500/30 text-white border border-indigo-500/50"
                          : "bg-white/5 text-white/70 hover:bg-white/10 border border-white/10"
                      }`}
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
                    className="w-12 h-12 rounded border border-gray-300 mr-3"
                    style={{ backgroundColor: layers[selectedLayerIndex].style?.color || '#FFFFFF' }}
                  ></div>
                  <input
                    type="color"
                    value={layers[selectedLayerIndex].style?.color || '#FFFFFF'}
                    onChange={(e) => handleUpdateColor(selectedLayerIndex, e.target.value)}
                    className="h-12 w-12 rounded touch-manipulation"
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* Effect type selector with simplified UI */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Effects
                </label>
                <div className="flex items-center">
                  <div className="relative flex items-center">
                    <input
                      id={`shadow-effect-${selectedLayerIndex}`}
                      type="checkbox"
                      checked={layers[selectedLayerIndex]?.style?.effects?.type === 'shadow'}
                      onChange={(e) => {
                        handleUpdateEffectType(
                          selectedLayerIndex, 
                          e.target.checked ? 'shadow' : 'none'
                        )
                      }}
                      className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-white/20 rounded bg-white/10"
                      disabled={disabled}
                    />
                    <label htmlFor={`shadow-effect-${selectedLayerIndex}`} className="ml-2 block text-sm text-white/80">
                      Add shadow effect
                    </label>
                  </div>
                </div>
              </div>
              
              {/* Center button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCenterText}
                  disabled={disabled || selectedLayerIndex < 0}
                  className="flex items-center justify-center w-full py-4 text-base px-4 bg-white/10 hover:bg-white/15 text-white rounded-md border border-white/20 touch-manipulation"
                  title="Center text in image"
                >
                  <MdCenterFocusStrong size={24} className="mr-2" />
                  Center in Image
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 text-center py-8 text-white/50">
            <p>Select a layer first to edit its style</p>
            <p className="text-sm mt-2">Tap on a layer from the layers panel</p>
          </div>
        );
      
      case 'add':
        return (
          <div className="p-5">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-medium text-white">Add New Text</h3>
              <button 
                className="p-2 bg-white/10 rounded-full"
                onClick={() => toggleEditStep('none')}
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-5">
              <p className="text-white/70">
                Add a new text layer to your image. You'll be able to customize its style after adding.
              </p>
              
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Text Content
                </label>
                <input
                  type="text"
                  id="new-text-content"
                  placeholder="Enter text here"
                  className="w-full px-4 py-4 text-lg border bg-white/10 border-white/20 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-white appearance-none"
                />
              </div>
              
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => {
                    const inputElement = document.getElementById('new-text-content') as HTMLInputElement;
                    const text = inputElement?.value || 'New Text';
                    
                    const newLayer: TextLayer = {
                      text: text,
                      position: originalImageDimensions ? 
                        { x: Math.round(originalImageDimensions.width / 2), y: Math.round(originalImageDimensions.height / 2) } : 
                        { x: 100, y: 100 },
                      style: { ...DEFAULT_LAYER_STYLE }
                    };
                    
                    const newLayers = [...layers, newLayer];
                    setLayers(newLayers);
                    setSelectedLayerIndex(newLayers.length - 1);
                    toggleEditStep('style');
                  }}
                  className="px-6 py-4 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 active:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Add Layer
                </button>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };
  
  // Use early returns to handle edge cases
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
                className={`${isMobile ? 'p-3.5' : 'p-3'} bg-gradient-to-r from-indigo-500 to-rose-500 text-white rounded-full hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 touch-manipulation`}
                title="Add new text layer"
                aria-label="Add new text layer"
              >
                <Plus size={isMobile ? 24 : 20} />
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
                    className={`flex items-center justify-between ${isMobile ? 'p-4' : 'p-3'} rounded-md cursor-pointer ${
                      selectedLayerIndex === index
                        ? "bg-indigo-500/20 border border-indigo-500/30"
                        : "bg-white/5 hover:bg-white/10 border border-white/10"
                    }`}
                    onClick={() => setSelectedLayerIndex(index)}
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <Move className="mr-2 text-indigo-400 flex-shrink-0" size={isMobile ? 22 : 18} />
                      <div className="truncate text-white/90" style={{ maxWidth: isMobile ? "200px" : "150px" }}>
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
                        className={`${isMobile ? 'p-3' : 'p-2'} text-white/60 hover:text-white disabled:opacity-30 rounded-md touch-manipulation`}
                        title="Move up"
                        aria-label="Move layer up"
                      >
                        <ArrowUp size={isMobile ? 22 : 18} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoveDown(index)
                        }}
                        disabled={index === layers.length - 1 || disabled}
                        className={`${isMobile ? 'p-3' : 'p-2'} text-white/60 hover:text-white disabled:opacity-30 rounded-md touch-manipulation`}
                        title="Move down"
                        aria-label="Move layer down"
                      >
                        <ArrowDown size={isMobile ? 22 : 18} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveLayer(index)
                        }}
                        disabled={disabled}
                        className={`${isMobile ? 'p-3' : 'p-2'} text-rose-400 hover:text-rose-300 disabled:opacity-30 rounded-md touch-manipulation`}
                        title="Remove layer"
                        aria-label="Remove layer"
                      >
                        <X size={isMobile ? 22 : 18} />
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
                className={`w-full ${isMobile ? 'px-4 py-4 text-lg' : 'px-4 py-3'} border bg-white/10 border-white/20 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-white appearance-none`}
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
                className={`w-full ${isMobile ? 'px-4 py-4 text-lg' : 'px-4 py-3'} bg-white/10 border border-white/20 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-white appearance-none`}
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
                  className={`${isMobile ? 'p-4' : 'p-3'} border border-white/20 rounded-l-md bg-white/5 hover:bg-white/10 text-white touch-manipulation`}
                  disabled={disabled}
                  aria-label="Decrease font size"
                >
                  <FiMinus size={isMobile ? 24 : 20} />
                </button>
                <input
                  type="number"
                  value={layers[selectedLayerIndex].style?.font_size || 120}
                  onChange={(e) => handleUpdateFontSize(selectedLayerIndex, parseInt(e.target.value) || 120)}
                  className={`w-24 text-center border-y border-white/20 ${isMobile ? 'py-4 text-lg' : 'py-3'} bg-white/10 text-white focus:ring-indigo-500 focus:border-indigo-500`}
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => handleUpdateFontSize(selectedLayerIndex, (layers[selectedLayerIndex].style?.font_size || 120) + 10)}
                  className={`${isMobile ? 'p-4' : 'p-3'} border border-white/20 rounded-r-md bg-white/5 hover:bg-white/10 text-white touch-manipulation`}
                  disabled={disabled}
                  aria-label="Increase font size"
                >
                  <FiPlus size={isMobile ? 24 : 20} />
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
                    className={`${isMobile ? 'py-3' : 'py-2'} px-3 rounded-md text-sm ${
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
                  className={`${isMobile ? 'w-12 h-12' : 'w-10 h-10'} rounded border border-gray-300 mr-3`}
                  style={{ backgroundColor: layers[selectedLayerIndex].style?.color || '#FFFFFF' }}
                ></div>
                <input
                  type="color"
                  value={layers[selectedLayerIndex].style?.color || '#FFFFFF'}
                  onChange={(e) => handleUpdateColor(selectedLayerIndex, e.target.value)}
                  className={`${isMobile ? 'h-12 w-12' : 'h-10 w-10'} rounded touch-manipulation`}
                  disabled={disabled}
                />
              </div>
            </div>

            {/* Add Effect Type Selector */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Text Effect
              </label>
              <select
                value={layers[selectedLayerIndex].style?.effects?.type || 'none'}
                onChange={(e) => handleUpdateEffectType(selectedLayerIndex, e.target.value as EffectType)}
                className={`w-full ${isMobile ? 'px-4 py-4 text-lg' : 'px-4 py-3'} bg-white/10 border border-white/20 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-white appearance-none`}
                disabled={disabled}
              >
                {EFFECT_TYPES.map(effect => (
                  <option key={effect.value} value={effect.value}>
                    {effect.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Replace Shadow Effect Controls with a simple checkbox */}
            <div className="flex items-center my-4">
              <input
                id="shadow-effect"
                type="checkbox"
                checked={layers[selectedLayerIndex].style?.effects?.type === 'shadow'}
                onChange={(e) => {
                  const newLayers = [...layers];
                  if (!newLayers[selectedLayerIndex].style) {
                    newLayers[selectedLayerIndex].style = {};
                  }
                  
                  if (e.target.checked) {
                    // Enable shadow with default settings
                    newLayers[selectedLayerIndex].style.effects = {
                      type: 'shadow',
                      settings: {
                        offset: [5, 5],
                        color: '#000000',
                        opacity: 0.5,
                        blur: 3
                      }
                    };
                  } else {
                    // Remove shadow effect
                    delete newLayers[selectedLayerIndex].style.effects;
                  }
                  
                  setLayers(newLayers);
                }}
                className={`${isMobile ? 'h-6 w-6' : 'h-5 w-5'} text-indigo-600 focus:ring-indigo-500 border-white/20 rounded bg-white/10`}
                disabled={disabled}
              />
              <label htmlFor="shadow-effect" className={`ml-2 block ${isMobile ? 'text-base' : 'text-sm'} text-white/80`}>
                Add shadow effect
              </label>
            </div>
            
            {/* Center text button for mobile */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleCenterText}
                disabled={disabled || selectedLayerIndex < 0}
                className={`flex items-center justify-center w-full ${isMobile ? 'py-4 text-base' : 'py-3 text-sm'} px-4 bg-indigo-500/20 hover:bg-indigo-500/30 text-white rounded-md border border-indigo-500/40 touch-manipulation`}
                title="Center text in image"
              >
                <MdCenterFocusStrong size={isMobile ? 24 : 20} className="mr-2" />
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
                    className={`preview-text-layer ${selectedLayerIndex === index ? 'ring-2 ring-indigo-400' : ''} ${isMobile ? 'active:scale-95' : ''} transition-transform`}
                    onClick={(e) => handleTextLayerClick(index, e)}
                    onMouseDown={(e) => handleTextLayerMouseDown(index, e)}
                    onTouchStart={(e) => handleTextLayerTouchStart(index, e)}
                  >
                    {layer.text}
                  </div>
                ))}
                
                {/* Mobile-only layer indicator */}
                {layers.length > 0 && isMobile && selectedLayerIndex >= 0 && (
                  <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs p-2 rounded-md backdrop-blur-sm border border-white/10 shadow-lg">
                    <div className="flex items-center">
                      <Layers size={12} className="mr-1.5" /> 
                    Layer {selectedLayerIndex + 1} of {layers.length}
                  </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/40 bg-gradient-to-br from-indigo-900/20 to-rose-900/20">
                Upload an image to preview text layers
              </div>
            )}
          </div>
          
          {/* Replace with simplified layer count indicator */}
          {layers.length > 0 && !isMobile && (
            <div className="flex justify-end">
              <div className="text-sm text-white/50 bg-black/30 px-3 py-1.5 rounded-full">
                {layers.length} layer{layers.length > 1 ? 's' : ''}
          </div>
            </div>
          )}
        </motion.div>
        
        {/* Canva-style mobile toolbar */}
        {isMobile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-xl shadow-lg py-3 px-2 z-20"
          >
            <div className="flex justify-around items-center">
            <button
                className={`flex flex-col items-center w-16 ${editStep === 'layers' ? 'text-indigo-600' : 'text-gray-800'}`}
                onClick={() => toggleEditStep('layers')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <span className="text-xs">Layers</span>
            </button>
              
              {selectedLayerIndex >= 0 && (
                <button 
                  className={`flex flex-col items-center w-16 ${editStep === 'style' ? 'text-indigo-600' : 'text-gray-800'}`}
                  onClick={() => toggleEditStep('style')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1">
                    <path d="M9 3h6v11h2v-4h2v4h1v3h-3v2h-8v-2H6v-3h1v-4h2v4h2V3zm5 0v8h-4V3h4z"/>
                  </svg>
                  <span className="text-xs">Edit</span>
                </button>
              )}
              
              <button 
                className={`flex flex-col items-center w-16 ${editStep === 'add' ? 'text-indigo-600' : 'text-gray-800'}`}
                onClick={() => toggleEditStep('add')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span className="text-xs">Add Text</span>
              </button>
              
              {selectedLayerIndex >= 0 && (
            <button 
                  className="flex flex-col items-center w-16 text-gray-800"
                  onClick={handleCenterText}
            >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1">
                    <path d="M12 2v20M2 12h20"/>
                  </svg>
                  <span className="text-xs">Center</span>
            </button>
              )}
              
              {selectedLayerIndex >= 0 && (
                <button 
                  className="flex flex-col items-center w-16 text-gray-800"
                  onClick={() => handleRemoveLayer(selectedLayerIndex)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  <span className="text-xs">Remove</span>
                </button>
              )}
          </div>
            
          </motion.div>
        )}
        
        {/* Canva-style editing panel for mobile */}
        {isMobile && isDrawerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 300 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 bg-black/40 z-30"
            onClick={() => toggleEditStep('none')}
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-[80px] left-0 right-0 bg-[#050510] rounded-t-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {renderStepContent()}
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Replace this section with more modern tab design at the top */}
      {!isMobile && (
        <div className="md:w-2/5 rounded-lg shadow-lg overflow-hidden">
          {/* Modern header with sleek tabs */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-3">
            <div className="flex bg-black/20 rounded-lg p-1.5">
          <button
            onClick={() => setActiveTab('layers')}
                className={`flex-1 py-2 px-4 rounded-md transition-all font-medium text-sm ${
              activeTab === 'layers' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <div className="flex justify-center items-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                  <span>Layers</span>
                </div>
          </button>
          <button
            onClick={() => setActiveTab('style')}
                className={`flex-1 py-2 px-4 rounded-md transition-all font-medium text-sm ${
              activeTab === 'style' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <div className="flex justify-center items-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                  <span>Edit Layers</span>
                </div>
          </button>
            </div>
        </div>
        
          {/* Keep the existing tab content */}
          <div className="bg-[#050510]/95 border border-white/10 min-h-[300px] p-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {renderTabContent()}
        </div>
        
          {/* Quick actions */}
        {layers.length === 0 && (
            <div className="p-4 border-t border-white/10 bg-[#050510]/95">
            <button
              type="button"
              onClick={handleAddLayer}
              disabled={disabled}
                className="w-full px-4 py-3 text-sm bg-gradient-to-r from-indigo-500 to-rose-500 text-white rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 touch-manipulation"
            >
              <Plus className="inline mr-1" size={18} /> Add Text Layer
            </button>
          </div>
        )}
          </div>
        )}
    </div>
  );
}

export default TextLayersEditor; 