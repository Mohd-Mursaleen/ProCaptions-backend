import React, { useState, useEffect } from 'react';
import { Position, FontSizeResponse } from '../types/api';
import { getFontSizeSuggestions } from '../api/procaptions';

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

interface DramaticTextEditorProps {
  backgroundImage: string;
  onTextChange: (text: string) => void;
  onPositionChange: (position: Position) => void;
  onFontSizeChange: (fontSize: number) => void;
  onFontNameChange: (fontName: string) => void;
  onWithPeriodChange: (withPeriod: boolean) => void;
  disabled: boolean;
}

const AVAILABLE_FONTS = [
  { value: 'anton', label: 'Anton' },
  { value: 'sixcaps', label: 'Six Caps' },
  { value: 'impact', label: 'Impact' },
];

const DramaticTextEditor: React.FC<DramaticTextEditorProps> = ({
  backgroundImage,
  onTextChange,
  onPositionChange,
  onFontSizeChange,
  onFontNameChange,
  onWithPeriodChange,
  disabled,
}) => {
  const [text, setText] = useState<string>('hero');
  const [position, setPosition] = useState<Position>({ x: 400, y: 300 });
  const [fontName, setFontName] = useState<string>('anton');
  const [withPeriod, setWithPeriod] = useState<boolean>(true);
  
  // For font size suggestions and previews
  const [fontSizeData, setFontSizeData] = useState<FontSizeResponse | null>(null);
  const [selectedFontSize, setSelectedFontSize] = useState<number>(150);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Fetch font size suggestions when background image or text changes
  useEffect(() => {
    if (backgroundImage && text) {
      fetchFontSizeSuggestions();
    }
  }, [backgroundImage, text, fontName]);
  
  const fetchFontSizeSuggestions = async () => {
    try {
      setLoading(true);
      const suggestionsData = await getFontSizeSuggestions({
        background_path: backgroundImage,
        text,
        position,
        font_name: fontName,
      });
      
      setFontSizeData(suggestionsData);
      
      // Select the middle size option as default
      if (suggestionsData.suggested_sizes.length > 0) {
        const middleIndex = Math.floor(suggestionsData.suggested_sizes.length / 2);
        const defaultSize = suggestionsData.suggested_sizes[middleIndex];
        setSelectedFontSize(defaultSize);
        onFontSizeChange(defaultSize);
      }
      
    } catch (error) {
      console.error('Error fetching font size suggestions:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setText(newText);
    onTextChange(newText);
  };
  
  const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFont = e.target.value;
    setFontName(newFont);
    onFontNameChange(newFont);
  };
  
  const handleWithPeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newWithPeriod = e.target.checked;
    setWithPeriod(newWithPeriod);
    onWithPeriodChange(newWithPeriod);
  };
  
  const handleFontSizeSelect = (size: number) => {
    setSelectedFontSize(size);
    onFontSizeChange(size);
  };
  
  return (
    <div className="w-full space-y-6">
      <div className="space-y-4">
        <div>
          <label htmlFor="text-input" className="block text-sm font-medium text-gray-700 mb-1">
            Text
          </label>
          <input
            id="text-input"
            type="text"
            value={text}
            onChange={handleTextChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your text (e.g., hero)"
            disabled={disabled}
          />
        </div>
        
        <div>
          <label htmlFor="font-select" className="block text-sm font-medium text-gray-700 mb-1">
            Font
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
            Add period at the end (like "hero.")
          </label>
        </div>
      </div>
      
      {/* Font size preview section */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700">Font Size Preview</h3>
        
        {loading ? (
          <div className="text-center py-4">
            <div className="inline-block animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></div>
            <span className="text-gray-600 text-sm">Loading previews...</span>
          </div>
        ) : fontSizeData ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {fontSizeData.suggested_sizes.map((size) => (
                <div 
                  key={size}
                  className={`cursor-pointer border-2 rounded overflow-hidden hover:opacity-90 transition-all
                    ${selectedFontSize === size ? 'border-blue-500 shadow-md' : 'border-gray-200'}`}
                  onClick={() => handleFontSizeSelect(size)}
                >
                  <div className="relative">
                    <img 
                      src={getFullImageUrl(fontSizeData.previews[size.toString()]) || ''} 
                      alt={`Font size ${size}`} 
                      className="w-full h-auto"
                      onError={(e) => {
                        console.error('Error loading font preview:', (e.target as HTMLImageElement).src);
                      }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs py-1 text-center">
                      {size}px
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Current selected size */}
            <div className="text-center text-sm text-gray-600">
              Selected size: <span className="font-medium">{selectedFontSize}px</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 text-sm">
            {backgroundImage ? 'Enter text to see size previews' : 'Upload an image to enable size previews'}
          </div>
        )}
      </div>
    </div>
  );
};

export default DramaticTextEditor; 