"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import type { Position } from "../types/api"
import { Move, ZoomIn, Type, Info, Plus, Minus, Settings, Sliders, ChevronDown } from "lucide-react"
import { MdCenterFocusStrong } from "react-icons/md"
import { motion } from "framer-motion"

interface LiveTextEditorProps {
  backgroundImage: string | null
  text: string
  onTextChange: (text: string) => void
  fontSize: number
  onFontSizeChange: (size: number) => void
  fontName: string
  onFontNameChange: (font: string) => void
  withPeriod: boolean
  onWithPeriodChange: (withPeriod: boolean) => void
  position: Position
  onPositionChange: (position: Position) => void
  fontColor: string
  onFontColorChange: (color: string) => void
  disabled: boolean
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

  const previewRef = useRef<HTMLDivElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

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

  // Handle period toggle
  const handleWithPeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onWithPeriodChange(e.target.checked)
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
    const previewFontSize = fontSize / scale
    const previewPos = getPreviewPosition()

    // Get font-specific adjustments to improve preview accuracy
    const { widthFactor, heightFactor } = getFontMetrics(fontName)

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
      textShadow: "2px 2px 8px rgba(0, 0, 0, 0.5)",
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
      opacity: isDraggingText ? 0.8 : 1, // Add opacity during drag for visual feedback
      transition: "opacity 0.1s ease", // Smooth transition for opacity
    }
  }

  // Add position marker to help with alignment
  const PositionMarker = () => {
    const previewPos = getPreviewPosition()

    return (
      <div
        className="absolute w-16 h-16 pointer-events-none"
        style={{
          top: `${previewPos.y}px`,
          left: `${previewPos.x}px`,
          transform: "translate(-50%, -50%)",
          zIndex: 5,
        }}
      >
        {/* Subtle dot marker instead of cross */}
        <div className="absolute w-2 h-2 rounded-full bg-indigo-400 border border-indigo-600 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-glow"></div>
      </div>
    )
  }

  // Update the font color change handler to use the prop
  const handleFontColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFontColorChange(e.target.value)
  }

  // Tab navigation
  const renderTabContent = () => {
    switch (activeTab) {
      case "text":
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="text-input" className="block text-sm font-medium text-white/80 mb-1">
                Text Content
              </label>
              <input
                id="text-input"
                type="text"
                value={localText}
                onChange={handleTextChange}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-white placeholder-white/40"
                placeholder="Enter text (e.g., hero)"
                disabled={disabled}
              />
            </div>

            <div>
              <label htmlFor="font-select" className="block text-sm font-medium text-white/80 mb-1">
                Font Family
              </label>
              <div className="relative">
                <select
                  id="font-select"
                  value={fontName}
                  onChange={handleFontChange}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-white appearance-none"
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
                  size={16}
                />
              </div>
            </div>

            <div className="flex items-center">
              <div className="relative flex items-center">
                <input
                  id="with-period"
                  type="checkbox"
                  checked={withPeriod}
                  onChange={handleWithPeriodChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-white/20 rounded bg-white/10"
                  disabled={disabled}
                />
                <label htmlFor="with-period" className="ml-2 block text-sm text-white/80">
                  Add period at the end
                </label>
              </div>
              
            </div>

            <div>
              <label htmlFor="font-color" className="block text-sm font-medium text-white/80 mb-1">
                Font Color
              </label>
              <div className="flex items-center">
                <div
                  className="w-8 h-8 rounded border border-white/20 mr-2"
                  style={{ backgroundColor: fontColor }}
                ></div>
                <input
                  id="font-color"
                  type="color"
                  value={fontColor}
                  onChange={handleFontColorChange}
                  className="h-8 w-8 rounded bg-transparent"
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        )

      case "style":
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="font-size" className="block text-sm font-medium text-white/80 mb-1">
                Font Size
              </label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => adjustFontSize(-10)}
                  className="p-2 border border-white/20 rounded-l-md bg-white/5 hover:bg-white/10 text-white"
                  disabled={disabled}
                >
                  <Minus size={16} />
                </button>
                <input
                  id="font-size-input"
                  type="number"
                  value={fontSizeInput}
                  onChange={handleFontSizeInputChange}
                  onBlur={applyFontSize}
                  onKeyPress={handleFontSizeKeyPress}
                  className="w-20 text-center border-y border-white/20 py-2 bg-white/10 text-white focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Size"
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => adjustFontSize(10)}
                  className="p-2 border border-white/20 rounded-r-md bg-white/5 hover:bg-white/10 text-white"
                  disabled={disabled}
                >
                  <Plus size={16} />
                </button>
                <span className="ml-2 text-white/50 text-sm">px</span>
              </div>

              {/* Font size presets */}
              <div className="mt-2 flex flex-wrap gap-2">
                {[100, 150, 200, 250, 300, 350].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onFontSizeChange(size)}
                    className={`text-xs py-1 px-2 rounded ${
                      fontSize === size
                        ? "bg-indigo-500/30 text-white border border-indigo-500/50"
                        : "bg-white/5 text-white/70 hover:bg-white/10 border border-white/10"
                    }`}
                    disabled={disabled}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Text Position</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="position-x" className="text-xs text-white/50">
                    X Position
                  </label>
                  <input
                    id="position-x"
                    type="number"
                    value={position.x}
                    onChange={(e) => onPositionChange({ ...position, x: Number.parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-1 bg-white/10 border border-white/20 rounded-md text-sm text-white"
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
                    className="w-full px-3 py-1 bg-white/10 border border-white/20 rounded-md text-sm text-white"
                    disabled={disabled}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleCenterText}
                className="mt-2 flex items-center justify-center w-full py-1 rounded bg-white/5 text-white/80 hover:bg-white/10 text-sm border border-white/10"
                title="Center text in image"
                disabled={disabled}
              >
                <MdCenterFocusStrong size={16} className="mr-1" />
                Center Text
              </button>
            </div>
          </div>
        )

      case "advanced":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Preview Mode</label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setPreviewMode("position")}
                  className={`p-2 rounded flex items-center ${
                    previewMode === "position"
                      ? "bg-indigo-500/30 text-white border border-indigo-500/50"
                      : "bg-white/5 text-white/70 hover:bg-white/10 border border-white/10"
                  }`}
                  title="Position Mode: Click or drag to position text"
                  disabled={disabled}
                >
                  <Move size={16} className="mr-1" />
                  Position
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("size")}
                  className={`p-2 rounded flex items-center ${
                    previewMode === "size"
                      ? "bg-indigo-500/30 text-white border border-indigo-500/50"
                      : "bg-white/5 text-white/70 hover:bg-white/10 border border-white/10"
                  }`}
                  title="Size Mode: Adjust font size"
                  disabled={disabled}
                >
                  <ZoomIn size={16} className="mr-1" />
                  Size
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("text")}
                  className={`p-2 rounded flex items-center ${
                    previewMode === "text"
                      ? "bg-indigo-500/30 text-white border border-indigo-500/50"
                      : "bg-white/5 text-white/70 hover:bg-white/10 border border-white/10"
                  }`}
                  title="Text Mode: Edit text content"
                  disabled={disabled}
                >
                  <Type size={16} className="mr-1" />
                  Text
                </button>
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-md border border-white/10">
              <div className="flex items-center mb-2">
                <Info size={16} className="text-indigo-400 mr-2" />
                <span className="text-sm font-medium text-white/80">Help & Tips</span>
              </div>
              <ul className="text-xs text-white/60 space-y-1 list-disc pl-5">
                <li>Drag text directly in the preview to reposition</li>
                <li>Use preview modes to focus on different editing tasks</li>
                <li>For the most accurate preview, position text in the center</li>
                <li>Use X and Y inputs for precise positioning</li>
              </ul>
            </div>

            {originalImageDimensions && (
              <div className="text-xs text-white/50">
                <p>
                  Image Size: {originalImageDimensions.width} × {originalImageDimensions.height}px
                </p>
                <p>
                  Text Position: {position.x}, {position.y}
                </p>
                <p>Font Size: {fontSize}px</p>
                <p>Preview Scale: {getScalingFactor().toFixed(2)}×</p>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Preview Panel - More compact layout */}
      <div className="w-full lg:w-3/5 xl:w-7/12">
        <div className="sticky top-4">
          <div className="mb-2 flex justify-between items-center">
            <h3 className="text-md font-medium text-white/90">Text Preview</h3>
            <div className="text-sm text-white/60">{isDraggingText ? "Dragging text..." : "Drag to reposition"}</div>
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
            style={{ maxHeight: "calc(100vh - 220px)" }}
          >
            {backgroundImage ? (
              <>
                <img
                  ref={imageRef}
                  src={getFullImageUrl(backgroundImage) || ""}
                  alt="Background"
                  className="w-full h-auto"
                  onLoad={() => {
                    // Force recalculation of preview dimensions when image loads
                    if (imageRef.current) {
                      const scale = getScalingFactor()
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
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                    >
                      {localText + (withPeriod ? "." : "")}
                    </div>
                  </>
                )}

                {/* Display coordinates and dimensions information */}
                {originalImageDimensions && (
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs p-1 rounded-md backdrop-blur-sm border border-white/10">
                    Position: {position.x}, {position.y} | Size: {fontSize}px |
                    {((position.x / originalImageDimensions.width) * 100).toFixed(1)}%,
                    {((position.y / originalImageDimensions.height) * 100).toFixed(1)}%
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
      </div>

      {/* Controls Panel - More compact and adaptive */}
      <div
        className="w-full lg:w-2/5 xl:w-5/12 bg-[#050510]/90 rounded-lg border border-white/10 shadow-lg overflow-auto backdrop-blur-sm"
        style={{ maxHeight: "calc(100vh - 180px)" }}
      >
        {/* Tabs Navigation - Horizontal scrolling on small screens */}
        <div className="flex border-b border-white/10 overflow-x-auto">
          <button
            onClick={() => setActiveTab("text")}
            className={`flex items-center px-4 py-2 text-sm font-medium whitespace-nowrap ${
              activeTab === "text"
                ? "text-indigo-400 border-b-2 border-indigo-500"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Type className="mr-2" size={16} />
            Text
          </button>
          <button
            onClick={() => setActiveTab("style")}
            className={`flex items-center px-4 py-2 text-sm font-medium whitespace-nowrap ${
              activeTab === "style"
                ? "text-indigo-400 border-b-2 border-indigo-500"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Sliders className="mr-2" size={16} />
            Style
          </button>
          <button
            onClick={() => setActiveTab("advanced")}
            className={`flex items-center px-4 py-2 text-sm font-medium whitespace-nowrap ${
              activeTab === "advanced"
                ? "text-indigo-400 border-b-2 border-indigo-500"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Settings className="mr-2" size={16} />
            Advanced
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4">{renderTabContent()}</div>
      </div>
    </div>
  )
}

export default LiveTextEditor 