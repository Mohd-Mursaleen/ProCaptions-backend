"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import type { Position } from "../types/api"
import { Move, ZoomIn, Type, Info, Plus, Minus, Settings, Sliders, ChevronDown, X, ArrowUp, ArrowDown } from "lucide-react"
import { MdCenterFocusStrong } from "react-icons/md"
import { motion } from "framer-motion"

// Add types for shadow effect
interface ShadowEffectSettings {
  offset: number[];
  color: string;
  opacity: number;
  blur: number;
}

export interface LiveTextEditorProps {
  backgroundImage: string | null
  text: string
  onTextChange: (text: string) => void
  fontSize: number
  onFontSizeChange: (size: number) => void
  fontName: string
  onWithPeriodChange: (withPeriod: boolean) => void
  position: Position
  onPositionChange: (position: Position) => void
  fontColor: string
  onFontColorChange: (color: string) => void
  disabled: boolean
  shadowEffect?: ShadowEffectSettings
  onShadowEffectChange?: (settings: ShadowEffectSettings | undefined) => void
  isMobileView?: boolean
  onDrawerStateChange?: (isOpen: boolean) => void
}

// Tab type for editor settings
type TabType = "text" | "style" | "advanced"

const AVAILABLE_FONTS = [
  { value: "anton", label: "Anton" },
  { value: "sixcaps", label: "Six Caps" },
  { value: "impact", label: "Impact" },
  { value: "boldonse", label: "Boldonse" },
]

// Custom font loading for preview accuracy
const loadCustomFonts = () => {
  // Add a style element to load fonts if needed
  if (!document.getElementById("custom-font-styles")) {
    const style = document.createElement("style")
    style.id = "custom-font-styles"
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Six+Caps&display=swap');
    `
    document.head.appendChild(style)
  }
}

// For accurate preview, estimate font metrics based on the font family
const getFontMetrics = (fontName: string) => {
  // These values help adjust the preview to match the backend's text rendering
  switch (fontName) {
    case "anton":
      return { widthFactor: 0.9, heightFactor: 0.9 }
    case "sixcaps":
      return { widthFactor: 0.9, heightFactor: 0.85 }
    case "impact":
      return { widthFactor: 0.95, heightFactor: 0.9 }
    default:
      return { widthFactor: 0.9, heightFactor: 0.85 }
  }
}

// Add this helper function at the top of the file after the imports
// This will ensure image URLs are properly formatted for both local and remote sources
const getFullImageUrl = (url: string | null): string | null => {
  if (!url) return null

  // If it's an absolute URL (starts with http or https), return as is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url
  }

  // If it's a relative URL from our local storage, point directly to backend
  if (url.startsWith("/uploads/")) {
    // For development - point directly to the backend server
    const fullUrl = `http://localhost:8000${url}`
    return fullUrl
  }

  // If it's just a filename without path, assume it's in public directory
  if (!url.includes("/") && !url.startsWith("data:")) {
    // Point to backend public directory
    const fullUrl = `http://localhost:8000/uploads/public/${url}`
    return fullUrl
  }

  // In other cases, return as is
  return url
}

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
  fontColor,
  onFontColorChange,
  disabled,
  shadowEffect,
  onShadowEffectChange,
  isMobileView,
  onDrawerStateChange,
}) => {
  const [localText, setLocalText] = useState(text)
  const [isDraggingText, setIsDraggingText] = useState(false)
  const [startDragPos, setStartDragPos] = useState({ x: 0, y: 0 })
  const [previewMode, setPreviewMode] = useState<"position" | "text" | "size">("position")
  // Font size input value for direct editing
  const [fontSizeInput, setFontSizeInput] = useState<string>(fontSize.toString())

  // Original image dimensions (we'll need to fetch these)
  const [originalImageDimensions, setOriginalImageDimensions] = useState<{ width: number; height: number } | null>(null)
  // Reference to track the rendered text dimensions for feedback
  const [textDimensions, setTextDimensions] = useState<{ width: number; height: number } | null>(null)
  // Show help info
  const [showHelp, setShowHelp] = useState(false)

  // Active tab for settings panels
  const [activeTab, setActiveTab] = useState<TabType>("text")
  
  // Enhanced mobile UI state
  const [isMobile, setIsMobile] = useState(false)
  
  // Edit step approach for better mobile UX
  const [editStep, setEditStep] = useState<'none' | 'text' | 'style' | 'shadow' | 'position'>('none')
  
  // Simplified drawer - just open/closed
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  
  // Reference for the editor container
  const editorRef = useRef<HTMLDivElement>(null)
  
  // Use effect to determine if we're on mobile
  useEffect(() => {
    const handleResize = () => {
      // Use the prop value if provided, otherwise detect based on screen size
      if (isMobileView !== undefined) {
        setIsMobile(isMobileView)
      } else {
        setIsMobile(window.innerWidth < 768)
      }
      
      // Close drawer on window resize (to avoid UI issues)
      if (isDrawerOpen && window.innerWidth > 768) {
        setIsDrawerOpen(false)
        setEditStep('none')
      }
    }
    
    // Initial check
    handleResize()
    
    // Add event listener
    window.addEventListener('resize', handleResize)
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [isMobileView, isDrawerOpen])

  const previewRef = useRef<HTMLDivElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

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
  const toggleEditStep = (step: 'none' | 'text' | 'style' | 'shadow' | 'position') => {
    if (editStep === step) {
      setEditStep('none')
      toggleDrawer(false)
    } else {
      setEditStep(step)
      toggleDrawer(true)
    }
  }

  // Load custom fonts when component mounts
  useEffect(() => {
    loadCustomFonts()
  }, [])

  // Update local text when prop changes
  useEffect(() => {
    setLocalText(text)
  }, [text])

  // Update font size input when fontSize prop changes
  useEffect(() => {
    setFontSizeInput(fontSize.toString())
  }, [fontSize])
  
  // Load the background image to get its dimensions
  useEffect(() => {
    if (backgroundImage) {
      const fullImageUrl = getFullImageUrl(backgroundImage)

      const img = new Image()
      img.onload = () => {
        setOriginalImageDimensions({
          width: img.width,
          height: img.height,
        })

        // If this is the first load, center the text on the image
        if (!position.x || !position.y || (position.x === 400 && position.y === 300)) {
          onPositionChange({
            x: Math.round(img.width / 2),
            y: Math.round(img.height / 2),
          })
        }
      }
      img.onerror = (e) => {
        console.error("Error loading background image:", fullImageUrl, e)
        // Try again with a different approach if the URL might be malformed
        if (fullImageUrl && fullImageUrl.startsWith("/uploads/")) {
          const retryUrl = `${window.location.protocol}//${window.location.host}${fullImageUrl}`
          const retryImg = new Image()
          retryImg.onload = () => {
            setOriginalImageDimensions({
              width: retryImg.width,
              height: retryImg.height,
            })
          }
          retryImg.onerror = () => {
            console.error("Retry also failed for URL:", retryUrl)
          }
          retryImg.src = retryUrl
        }
      }
      img.src = fullImageUrl || ""
    }
  }, [backgroundImage])

  // Measure text dimensions after render for accurate preview
  useEffect(() => {
    if (textLayerRef.current) {
      setTextDimensions({
        width: textLayerRef.current.offsetWidth,
        height: textLayerRef.current.offsetHeight,
      })
    }
  }, [localText, fontSize, fontName, withPeriod])

  // Add window resize listener to handle responsive positioning
  useEffect(() => {
    const handleResize = () => {
      // Force recalculation of preview dimensions and positions when window resizes
      if (imageRef.current && originalImageDimensions) {
        // Trigger a rerender to update preview position
        setTextDimensions({
          width: textLayerRef.current?.offsetWidth || 0,
          height: textLayerRef.current?.offsetHeight || 0,
        })
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [originalImageDimensions])

  // Handle text change
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value
    setLocalText(newText)
    onTextChange(newText)
  }

  // Handle font change
  const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFont = e.target.value
    onFontNameChange(newFont)
  }


  // Handle font size change via direct input
  const handleFontSizeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFontSizeInput(e.target.value)
  }

  // Apply the font size when input field is blurred or Enter is pressed
  const applyFontSize = () => {
    const size = Number.parseInt(fontSizeInput, 10)
    if (!isNaN(size) && size > 0) {
      onFontSizeChange(size)
    } else {
      // Reset to current font size if invalid
      setFontSizeInput(fontSize.toString())
    }
  }

  // Handle key press in font size input
  const handleFontSizeKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      applyFontSize()
    }
  }

  // Quick font size adjustments
  const adjustFontSize = (amount: number) => {
    const newSize = fontSize + amount
    if (newSize > 0) {
      onFontSizeChange(newSize)
    }
  }

  // Center text in image
  const handleCenterText = () => {
    if (originalImageDimensions) {
      onPositionChange({
        x: Math.round(originalImageDimensions.width / 2),
        y: Math.round(originalImageDimensions.height / 2),
      })
    }
  }

  // Improved: Calculate the scaling factor between preview and original image
  const getScalingFactor = (): number => {
    if (!previewRef.current || !originalImageDimensions || !imageRef.current) {
      return 1 // Default to 1 if we don't have dimensions yet
    }

    const previewWidth = imageRef.current.clientWidth
    const originalWidth = originalImageDimensions.width

    return originalWidth / previewWidth
  }

  // Improved: Convert preview coordinates to original image coordinates using percentages
  const previewToOriginalCoordinates = (previewX: number, previewY: number): Position => {
    if (!originalImageDimensions || !imageRef.current) {
      return { x: previewX, y: previewY }
    }

    // Get current dimensions of the preview image
    const previewWidth = imageRef.current.clientWidth
    const previewHeight = imageRef.current.clientHeight

    // Convert to percentages (0-100) relative to the preview dimensions
    const percentX = (previewX / previewWidth) * 100
    const percentY = (previewY / previewHeight) * 100

    // Convert percentages to pixels in the original image
    const origX = Math.round((percentX / 100) * originalImageDimensions.width)
    const origY = Math.round((percentY / 100) * originalImageDimensions.height)

    return {
      x: origX,
      y: origY,
    }
  }

  // Improved: Convert original image coordinates to preview coordinates using percentages
  const originalToPreviewCoordinates = (originalX: number, originalY: number): Position => {
    if (!originalImageDimensions || !imageRef.current) {
      return { x: originalX, y: originalY }
    }

    // Get current dimensions of the preview image
    const previewWidth = imageRef.current.clientWidth
    const previewHeight = imageRef.current.clientHeight

    // Convert to percentages (0-100) relative to the original dimensions
    const percentX = (originalX / originalImageDimensions.width) * 100
    const percentY = (originalY / originalImageDimensions.height) * 100

    // Convert percentages to pixels in the preview
    const previewX = Math.round((percentX / 100) * previewWidth)
    const previewY = Math.round((percentY / 100) * previewHeight)

    return {
      x: previewX,
      y: previewY,
    }
  }

  // Get the preview position (scaled from the original)
  const getPreviewPosition = (): Position => {
    return originalToPreviewCoordinates(position.x, position.y)
  }

  // Handle text position with mouse
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return

    setIsDraggingText(true)
    setStartDragPos({
      x: e.clientX,
      y: e.clientY,
    })

    // Prevent text selection during drag
    e.preventDefault()

    // Apply grabbing cursor to the body during drag operations
    document.body.classList.add("cursor-grabbing")
  }
  
  // Handle text position with touch (for mobile devices)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || e.touches.length === 0) return
    
    const touch = e.touches[0]
    
    setIsDraggingText(true)
    setStartDragPos({
      x: touch.clientX,
      y: touch.clientY,
    })
    
    // Apply grabbing cursor to the body during drag operations
    document.body.classList.add("cursor-grabbing")
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingText || !previewRef.current) return

    // Calculate new position
    const deltaX = e.clientX - startDragPos.x
    const deltaY = e.clientY - startDragPos.y

    // Set start position for next move
    setStartDragPos({
      x: e.clientX,
      y: e.clientY,
    })

    // Calculate preview position
    const previewPos = getPreviewPosition()
    const newPreviewPos = {
      x: previewPos.x + deltaX,
      y: previewPos.y + deltaY,
    }

    // Convert to original coordinates and update position
    const newOriginalPos = previewToOriginalCoordinates(newPreviewPos.x, newPreviewPos.y)
    onPositionChange(newOriginalPos)
  }
  
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingText || !previewRef.current || e.touches.length === 0) return
    
    // Prevent default to stop scrolling while dragging
    e.preventDefault()
    
    const touch = e.touches[0]
    
    // Calculate new position
    const deltaX = touch.clientX - startDragPos.x
    const deltaY = touch.clientY - startDragPos.y
    
    // Set start position for next move
    setStartDragPos({
      x: touch.clientX,
      y: touch.clientY,
    })
    
    // Calculate preview position
    const previewPos = getPreviewPosition()
    const newPreviewPos = {
      x: previewPos.x + deltaX,
      y: previewPos.y + deltaY,
    }
    
    // Convert to original coordinates and update position
    const newOriginalPos = previewToOriginalCoordinates(newPreviewPos.x, newPreviewPos.y)
    onPositionChange(newOriginalPos)
  }

  // Add global mouse event listeners for dragging
  useEffect(() => {
    // Global mouse handlers for when dragging extends outside the component
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingText || !previewRef.current) return

      // Calculate new position
      const deltaX = e.clientX - startDragPos.x
      const deltaY = e.clientY - startDragPos.y

      // Set start position for next move
      setStartDragPos({
        x: e.clientX,
        y: e.clientY,
      })

      // Calculate preview position
      const previewPos = getPreviewPosition()
      const newPreviewPos = {
        x: previewPos.x + deltaX,
        y: previewPos.y + deltaY,
      }

      // Convert to original coordinates and update position
      const newOriginalPos = previewToOriginalCoordinates(newPreviewPos.x, newPreviewPos.y)
      onPositionChange(newOriginalPos)
    }

    const handleGlobalMouseUp = () => {
      setIsDraggingText(false)
      document.body.classList.remove("cursor-grabbing")
    }
    
    // Global touch handlers for when dragging extends outside the component
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (!isDraggingText || !previewRef.current || e.touches.length === 0) return
      
      // Prevent default to stop scrolling while dragging
      e.preventDefault()
      
      const touch = e.touches[0]
      
      // Calculate new position
      const deltaX = touch.clientX - startDragPos.x
      const deltaY = touch.clientY - startDragPos.y
      
      // Set start position for next move
      setStartDragPos({
        x: touch.clientX,
        y: touch.clientY,
      })
      
      // Calculate preview position
      const previewPos = getPreviewPosition()
      const newPreviewPos = {
        x: previewPos.x + deltaX,
        y: previewPos.y + deltaY,
      }
      
      // Convert to original coordinates and update position
      const newOriginalPos = previewToOriginalCoordinates(newPreviewPos.x, newPreviewPos.y)
      onPositionChange(newOriginalPos)
    }
    
    const handleGlobalTouchEnd = () => {
      setIsDraggingText(false)
      document.body.classList.remove("cursor-grabbing")
    }

    // Add global event listeners when dragging
    if (isDraggingText) {
      document.addEventListener("mousemove", handleGlobalMouseMove)
      document.addEventListener("mouseup", handleGlobalMouseUp)
      document.addEventListener("touchmove", handleGlobalTouchMove, { passive: false })
      document.addEventListener("touchend", handleGlobalTouchEnd)
      document.addEventListener("touchcancel", handleGlobalTouchEnd)
    }

    // Cleanup
    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove)
      document.removeEventListener("mouseup", handleGlobalMouseUp)
      document.removeEventListener("touchmove", handleGlobalTouchMove)
      document.removeEventListener("touchend", handleGlobalTouchEnd)
      document.removeEventListener("touchcancel", handleGlobalTouchEnd)
    }
  }, [isDraggingText, startDragPos, previewRef])

  // Handle canvas click to position text
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle if we're not already dragging
    if (isDraggingText || disabled) return

    // If in position mode, select the text element but don't move it
    if (previewMode === "position") {
      // Instead of repositioning, just select the text element if clicked outside of it
      const textElem = textLayerRef.current
      if (textElem) {
        const textRect = textElem.getBoundingClientRect()
        const clickX = e.clientX
        const clickY = e.clientY

        // If click is outside the text element, just select it without repositioning
        const isOutsideText =
          clickX < textRect.left || clickX > textRect.right || clickY < textRect.top || clickY > textRect.bottom

        if (isOutsideText) {
          // Just focus/select the element
          textElem.focus()
        }
      }
    }
  }

  // Add a mouseup handler directly on the component
  const handlePreviewMouseUp = () => {
    if (isDraggingText) {
      setIsDraggingText(false)
      document.body.classList.remove("cursor-grabbing")
    }
  }
  
  // Add a touchend handler directly on the component
  const handlePreviewTouchEnd = () => {
    if (isDraggingText) {
      setIsDraggingText(false)
      document.body.classList.remove("cursor-grabbing")
    }
  }

  // Calculate text display size based on the container size and true font size
  const getTextStyle = () => {
    // Calculate the preview font size (scaled down from the original)
    const scale = getScalingFactor()
    const previewFontSize = Math.round(fontSize / scale)
    const previewPos = getPreviewPosition()

    // Get font-specific adjustments to improve preview accuracy
    const { widthFactor, heightFactor } = getFontMetrics(fontName)

    // Calculate text shadow if shadow effect is enabled
    let textShadow = 'none';
    if (shadowEffect) {
      const { offset, color, opacity, blur } = shadowEffect;
      
      // Match the scaling approach from TextLayersEditor
      // We use the inverse scale (1/scale) to properly scale down the shadow values
      const inverseScale = 1/scale;
      const scaledOffsetX = Math.round(offset[0] * inverseScale);
      const scaledOffsetY = Math.round(offset[1] * inverseScale);
      const scaledBlur = Math.round(blur * inverseScale);
      
      // Convert hex color to rgba
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      
      // Ensure opacity is between 0 and 1
      const safeOpacity = Math.max(0, Math.min(1, opacity));
      
      textShadow = `${scaledOffsetX}px ${scaledOffsetY}px ${scaledBlur}px rgba(${r}, ${g}, ${b}, ${safeOpacity})`;
    }

    return {
      fontFamily:
        fontName === "anton"
          ? "Anton, sans-serif"
          : fontName === "sixcaps"
            ? "'Six Caps', sans-serif"
            : fontName === "impact"
              ? "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif"
              : "'Helvetica Neue', Helvetica, Arial, sans-serif",
      fontSize: `${previewFontSize}px`,
      lineHeight: "1",
      fontWeight: fontName === "arial_bold" || fontName === "helvetica_bold" ? "bold" : "normal",
      color: fontColor,
      textShadow,
      cursor: isDraggingText ? "grabbing" : "grab",
      position: "absolute" as const,
      top: `${previewPos.y}px`,
      left: `${previewPos.x}px`,
      transform: "translate(-50%, -50%)",
      userSelect: "none" as const,
      whiteSpace: "nowrap" as const,
      display: "inline-block",
      padding: "0",
      margin: "0",
      letterSpacing: fontName === "anton" ? "0.01em" : "normal",
      opacity: isDraggingText ? 0.8 : 1,
      transition: "opacity 0.1s ease",
    }
  }

  // Modify the PositionMarker component for better visibility on mobile
  const PositionMarker = () => {
    const previewPos = getPreviewPosition()
    const isMobileView = window.innerWidth < 768

    return (
      <div
        className="absolute pointer-events-none"
        style={{
          top: `${previewPos.y}px`,
          left: `${previewPos.x}px`,
          transform: "translate(-50%, -50%)",
          zIndex: 5,
          width: isMobileView ? '44px' : '16px',
          height: isMobileView ? '44px' : '16px',
        }}
      >
        {/* Enhanced marker with outer ring for better visibility */}
        <div className={`absolute rounded-full ${isMobileView ? 'w-6 h-6' : 'w-4 h-4'} bg-indigo-500/20 border border-indigo-500/40 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse`}></div>
        <div className="absolute w-2 h-2 rounded-full bg-indigo-500 border border-indigo-700 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-glow"></div>
      </div>
    )
  }

  // Update the font color change handler to use the prop
  const handleFontColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFontColorChange(e.target.value)
  }

  // Replace complex tab-based content with step-based content
  const renderStepContent = () => {
    switch (editStep) {
      case 'text':
        return (
          <div className="p-5">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-medium text-white">Edit Text</h3>
              <button 
                className="p-2 bg-white/10 rounded-full"
                onClick={() => toggleEditStep('none')}
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label htmlFor="text-input" className="block text-sm font-medium text-white/80 mb-2">
                  Text Content
                </label>
                <input
                  id="text-input"
                  type="text"
                  value={localText}
                  onChange={handleTextChange}
                  className="w-full px-4 py-4 text-lg bg-white/10 border border-white/20 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-white placeholder-white/40"
                  placeholder="Enter text (e.g., hero)"
                  disabled={disabled}
                />
              </div>

              <div>
                <label htmlFor="font-select" className="block text-sm font-medium text-white/80 mb-2">
                  Font Family
                </label>
                <div className="relative">
                  <select
                    id="font-select"
                    value={fontName}
                    onChange={handleFontChange}
                    className="w-full px-4 py-4 text-lg bg-white/10 border border-white/20 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-white appearance-none"
                    disabled={disabled}
                  >
                    {AVAILABLE_FONTS.map((font) => (
                      <option key={font.value} value={font.value} className="bg-gray-800 text-white">
                        {font.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 pointer-events-none"
                    size={24}
                  />
                </div>
              </div>

              <div className="flex items-center">
                
              </div>
            </div>
          </div>
        );
        
      case 'style':
        return (
          <div className="p-5">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-medium text-white">Style</h3>
              <button 
                className="p-2 bg-white/10 rounded-full"
                onClick={() => toggleEditStep('none')}
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label htmlFor="font-size" className="block text-sm font-medium text-white/80 mb-2">
                  Font Size
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => adjustFontSize(-10)}
                    className="p-4 border border-white/20 rounded-l-md bg-white/5 hover:bg-white/10 text-white touch-manipulation"
                    disabled={disabled}
                    aria-label="Decrease font size"
                  >
                    <Minus size={24} />
                  </button>
                  <input
                    id="font-size-input"
                    type="number"
                    value={fontSizeInput}
                    onChange={handleFontSizeInputChange}
                    onBlur={applyFontSize}
                    onKeyPress={handleFontSizeKeyPress}
                    className="w-24 text-center border-y border-white/20 py-4 text-lg bg-white/10 text-white focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Size"
                    disabled={disabled}
                  />
                  <button
                    type="button"
                    onClick={() => adjustFontSize(10)}
                    className="p-4 border border-white/20 rounded-r-md bg-white/5 hover:bg-white/10 text-white touch-manipulation"
                    disabled={disabled}
                    aria-label="Increase font size"
                  >
                    <Plus size={24} />
                  </button>
                  <span className="ml-2 text-white/50 text-sm">px</span>
                </div>

                {/* Font size presets */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[100, 150, 200, 250, 300, 350].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => onFontSizeChange(size)}
                      className={`py-3 px-3 rounded-md text-sm ${
                        fontSize === size
                          ? "bg-indigo-500/30 text-white border border-indigo-500/50"
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
                <label htmlFor="font-color" className="block text-sm font-medium text-white/80 mb-2">
                  Font Color
                </label>
                <div className="flex items-center">
                  <div
                    className="w-12 h-12 rounded border border-white/20 mr-3"
                    style={{ backgroundColor: fontColor }}
                  ></div>
                  <input
                    id="font-color"
                    type="color"
                    value={fontColor}
                    onChange={handleFontColorChange}
                    className="h-12 w-12 rounded bg-transparent touch-manipulation"
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>
          </div>
        );
        
      case 'shadow':
        return (
          <div className="p-5">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-medium text-white">Effects</h3>
              <button 
                className="p-2 bg-white/10 rounded-full"
                onClick={() => toggleEditStep('none')}
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-5">
              <div className="flex items-center mb-4">
                <div className="relative flex items-center">
                  <input
                    id="add-shadow"
                    type="checkbox"
                    checked={!!shadowEffect}
                    onChange={(e) => {
                      if (e.target.checked) {
                        // Add default shadow effect
                        onShadowEffectChange?.({
                          offset: [5, 5],
                          color: '#000000',
                          opacity: 0.5,
                          blur: 3
                        });
                      } else {
                        // Remove shadow effect
                        onShadowEffectChange?.(undefined as any);
                      }
                    }}
                    className="h-6 w-6 text-indigo-600 focus:ring-indigo-500 border-white/20 rounded bg-white/10"
                    disabled={disabled}
                  />
                  <label htmlFor="add-shadow" className="ml-2 block text-base text-white/80">
                    Add shadow effect
                  </label>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 'position':
        return (
          <div className="p-5">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-medium text-white">Position</h3>
              <button 
                className="p-2 bg-white/10 rounded-full"
                onClick={() => toggleEditStep('none')}
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="position-x" className="text-xs text-white/50">
                    X Position
                  </label>
                  <input
                    id="position-x"
                    type="number"
                    value={position.x}
                    onChange={(e) => onPositionChange({ ...position, x: Number.parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-3 text-base bg-white/10 border border-white/20 rounded-md text-white"
                    disabled={disabled}
                  />
                </div>
                <div>
                  <label htmlFor="position-y" className="text-xs text-white/50">
                    Y Position
                  </label>
                  <input
                    id="position-y"
                    type="number"
                    value={position.y}
                    onChange={(e) => onPositionChange({ ...position, y: Number.parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-3 text-base bg-white/10 border border-white/20 rounded-md text-white"
                    disabled={disabled}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleCenterText}
                className="flex items-center justify-center w-full py-4 text-base rounded-md bg-white/10 text-white hover:bg-white/15 border border-white/10 touch-manipulation"
                title="Center text in image"
                disabled={disabled}
              >
                <MdCenterFocusStrong size={24} className="mr-2" />
                Center Text
              </button>
              <p className="text-xs text-white/50 text-center mt-3">
                Tip: You can also drag the text directly on the image to reposition it.
              </p>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  // Add the renderTabContent function for desktop view
  const renderTabContent = () => {
    switch (activeTab) {
      case 'text':
        return (
          <div className="space-y-6">
            <div>
              <label htmlFor="text-input" className="block text-sm font-medium text-white/80 mb-2">
                Text Content
              </label>
              <input
                id="text-input"
                type="text"
                value={localText}
                onChange={handleTextChange}
                className="w-full px-4 py-3 text-lg bg-white/10 border border-white/20 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-white placeholder-white/40"
                placeholder="Enter text (e.g., hero)"
                disabled={disabled}
              />
            </div>

            <div>
              <label htmlFor="font-select" className="block text-sm font-medium text-white/80 mb-2">
                Font Family
              </label>
              <div className="relative">
                <select
                  id="font-select"
                  value={fontName}
                  onChange={handleFontChange}
                  className="w-full px-4 py-3 text-lg bg-white/10 border border-white/20 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-white appearance-none"
                  disabled={disabled}
                >
                  {AVAILABLE_FONTS.map((font) => (
                    <option key={font.value} value={font.value} className="bg-gray-800 text-white">
                      {font.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 pointer-events-none"
                  size={24}
                />
              </div>
            </div>

            <div className="flex items-center">
              
            </div>
          </div>
        );
        
      case 'style':
        return (
          <div className="space-y-6">
            <div>
              <label htmlFor="font-size" className="block text-sm font-medium text-white/80 mb-2">
                Font Size
              </label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => adjustFontSize(-10)}
                  className="p-3 border border-white/20 rounded-l-md bg-white/5 hover:bg-white/10 text-white"
                  disabled={disabled}
                  aria-label="Decrease font size"
                >
                  <Minus size={18} />
                </button>
                <input
                  id="font-size-input"
                  type="number"
                  value={fontSizeInput}
                  onChange={handleFontSizeInputChange}
                  onBlur={applyFontSize}
                  onKeyPress={handleFontSizeKeyPress}
                  className="w-20 text-center border-y border-white/20 py-3 text-base bg-white/10 text-white focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Size"
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => adjustFontSize(10)}
                  className="p-3 border border-white/20 rounded-r-md bg-white/5 hover:bg-white/10 text-white"
                  disabled={disabled}
                  aria-label="Increase font size"
                >
                  <Plus size={18} />
                </button>
                <span className="ml-2 text-white/50 text-sm">px</span>
              </div>

              {/* Font size presets */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[100, 150, 200, 250, 300, 350].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onFontSizeChange(size)}
                    className={`py-2 px-2 rounded-md text-sm ${
                      fontSize === size
                        ? "bg-indigo-500/30 text-white border border-indigo-500/50"
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
              <label htmlFor="font-color" className="block text-sm font-medium text-white/80 mb-2">
                Font Color
              </label>
              <div className="flex items-center">
                <div
                  className="w-10 h-10 rounded border border-white/20 mr-3"
                  style={{ backgroundColor: fontColor }}
                ></div>
                <input
                  id="font-color"
                  type="color"
                  value={fontColor}
                  onChange={handleFontColorChange}
                  className="h-10 w-10 rounded bg-transparent"
                  disabled={disabled}
                />
              </div>
            </div>
            
            <div className="flex items-center mb-4">
              <div className="relative flex items-center">
                <input
                  id="add-shadow"
                  type="checkbox"
                  checked={!!shadowEffect}
                  onChange={(e) => {
                    if (e.target.checked) {
                      // Add default shadow effect
                      onShadowEffectChange?.({
                        offset: [5, 5],
                        color: '#000000',
                        opacity: 0.5,
                        blur: 3
                      });
                    } else {
                      // Remove shadow effect
                      onShadowEffectChange?.(undefined as any);
                    }
                  }}
                  className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-white/20 rounded bg-white/10"
                  disabled={disabled}
                />
                <label htmlFor="add-shadow" className="ml-2 block text-sm text-white/80">
                  Add shadow effect
                </label>
              </div>
            </div>
            
            <div className="pt-2">
              <label className="block text-sm font-medium text-white/80 mb-2">
                Text Position
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="position-x" className="text-xs text-white/50">
                    X Position
                  </label>
                  <input
                    id="position-x"
                    type="number"
                    value={position.x}
                    onChange={(e) => onPositionChange({ ...position, x: Number.parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white"
                    disabled={disabled}
                  />
                </div>
                <div>
                  <label htmlFor="position-y" className="text-xs text-white/50">
                    Y Position
                  </label>
                  <input
                    id="position-y"
                    type="number"
                    value={position.y}
                    onChange={(e) => onPositionChange({ ...position, y: Number.parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white"
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>
            
            <button
              type="button"
              onClick={handleCenterText}
              className="flex items-center justify-center w-full py-3 text-base rounded-md bg-white/10 text-white hover:bg-white/15 border border-white/10"
              title="Center text in image"
              disabled={disabled}
            >
              <MdCenterFocusStrong size={20} className="mr-2" />
              Center Text
            </button>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 relative">
      {/* Preview Panel */}
      <div className="w-full lg:w-3/5 xl:w-7/12">
        <div className={`${isMobile ? '' : 'sticky top-4'}`}>
          <div className="mb-2 flex justify-between items-center">
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            ref={previewRef}
            className="relative w-full bg-[#050510] rounded-lg overflow-hidden shadow-lg border border-white/10"
            onClick={handleCanvasClick}
            onMouseUp={handlePreviewMouseUp}
            onTouchEnd={handlePreviewTouchEnd}
            style={{ maxHeight: isMobile ? "calc(100vh - 200px)" : "calc(100vh - 220px)" }}
          >
            {backgroundImage ? (
              <>
                <img
                  ref={imageRef}
                  src={getFullImageUrl(backgroundImage) || ""}
                  alt="Background"
                  className="w-full h-auto"
                  onLoad={() => {
                    if (imageRef.current) {
                      const scale = getScalingFactor()
                    }
                  }}
                />
                {originalImageDimensions && (
                  <>
                    {!isDraggingText && <PositionMarker />}

                    <div
                      ref={textLayerRef}
                      style={getTextStyle()}
                      className={`preview-text ${isMobile ? 'active:scale-95' : ''} transition-transform`}
                      onMouseDown={handleMouseDown}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                    >
                      {localText + (withPeriod ? "." : "")}
                    </div>
                  </>
                )}

                {/* Position info - minimal version for mobile */}
                {originalImageDimensions && isMobile && (
                  <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs p-2 rounded-md backdrop-blur-sm border border-white/10 shadow-lg">
                    <div className="flex items-center">
                      <Move size={12} className="mr-1" /> {position.x}, {position.y}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-60 flex items-center justify-center text-white/40 bg-gradient-to-br from-indigo-900/20 to-rose-900/20">
                Upload an image to preview text
              </div>
            )}
          </motion.div>
        </div>
        
        {/* Canva-style mobile toolbar - only show when not in drawer mode */}
        {isMobile && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-0 left-0 right-0  bg-white rounded-xl shadow-lg py-3 px-2 z-20"
          >
            <div className="flex justify-around items-center">
              <button 
                className={`flex flex-col items-center w-16 ${editStep === 'text' ? 'text-indigo-600' : 'text-gray-800'}`}
                onClick={() => toggleEditStep('text')}
              >
                <Type size={20} className="mb-1" />
                <span className="text-xs">Text</span>
              </button>
              
              <button 
                className={`flex flex-col items-center w-16 ${editStep === 'style' ? 'text-indigo-600' : 'text-gray-800'}`}
                onClick={() => toggleEditStep('style')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                  className="mb-1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 9h16M4 15h16M8 4v16M16 4v16"/>
                </svg>
                <span className="text-xs">Style</span>
              </button>
              
              <button 
                className={`flex flex-col items-center w-16 ${editStep === 'shadow' ? 'text-indigo-600' : 'text-gray-800'}`}
                onClick={() => toggleEditStep('shadow')}
              >
                <svg className="mb-1" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-xs">Effects</span>
              </button>
              
              <button 
                className={`flex flex-col items-center w-16 ${editStep === 'position' ? 'text-indigo-600' : 'text-gray-800'}`}
                onClick={() => toggleEditStep('position')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="16"/>
                  <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
                <span className="text-xs">Position</span>
              </button>
              
              <button 
                className="flex flex-col items-center w-16 text-gray-800"
                onClick={handleCenterText}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1">
                  <path d="M12 2v20M2 12h20"/>
                </svg>
                <span className="text-xs">Center</span>
              </button>
            </div>
            
            
          </motion.div>
        )}
      </div>

      {/* Canva-style editing panel - overlay instead of drawer */}
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

      {/* Desktop Controls Panel - Keep the existing panel for desktop */}
      {!isMobile && (
        <div className="lg:w-2/5 xl:w-5/12 bg-[#111122] rounded-lg shadow-lg border border-white/5 overflow-hidden">
          <div className="border-b border-white/10">
            <div className="flex bg-[#070716]">
              {/* Text tab */}
              <button
                onClick={() => setActiveTab('text')}
                className={`px-8 py-4 text-base ${
                  activeTab === 'text' 
                    ? 'text-indigo-400 border-b-2 border-indigo-400' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <div className="flex items-center">
                  <svg width="22" height="22" className="mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 10H3M21 6H3M21 14H3M17 18H3"/>
                  </svg>
                  Text
                </div>
              </button>

              {/* Style tab */}
              <button
                onClick={() => setActiveTab('style')}
                className={`px-8 py-4 text-base ${
                  activeTab === 'style' 
                    ? 'text-indigo-400 border-b-2 border-indigo-400' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <div className="flex items-center">
                  <svg width="22" height="22" className="mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 9h16M4 15h16M8 4v16M16 4v16"/>
                  </svg>
                  Style
                </div>
              </button>
            </div>
          </div>

          {/* Tab content with ample padding */}
          <div className="p-8">
            {renderTabContent()}
          </div>
        </div>
      )}
    </div>
  )
}

export default LiveTextEditor 