// API Request/Response Types

// Image Segmentation
export interface SegmentationResponse {
  foreground: string;
  background: string;
  mask: string;
}

// Text Position
export interface Position {
  x: number;
  y: number;
}

// Text Size
export interface TextSize {
  width: number;
  height: number;
}

// Image Size
export interface ImageSize {
  width: number;
  height: number;
}

// Add Text Request
export interface AddTextRequest {
  background_path: string;
  text: string;
  position: Position;
  font_size?: number;
  color?: string;
  font_name?: string;
}

// Add Dramatic Text Request
export interface AddDramaticTextRequest {
  background_path: string;
  text: string;
  position: Position;
  font_size?: number;
  color?: string;
  font_name?: string;
  with_period?: boolean;
  effects?: {
    type: EffectType;
    settings?: EffectSettings;
  };
}

// Add Text Response
export interface AddTextResponse {
  image_with_text: string;
}

// Font Size Request
export interface FontSizeRequest {
  background_path: string;
  text: string;
  position: Position;
  font_name?: string;
}

// Font Size Response
export interface FontSizeResponse {
  suggested_sizes: number[];
  previews: Record<string, string>;
}

// Compose Request
export interface ComposeRequest {
  background_with_text_path: string;
  foreground_path: string;
}

// Compose Response
export interface ComposeResponse {
  composed_image: string;
  final_image: string;
}

// Text Metrics
export interface TextMetrics {
  position: Position;
  text_size: TextSize;
  image_size: ImageSize;
}

// Effect Settings Types
export interface ShadowEffectSettings {
  offset: number[];
  color: string;
  opacity: number;
  blur: number;
}

export interface OutlineEffectSettings {
  width: number;
  color: string;
  opacity: number;
}

export interface GlowEffectSettings {
  color: string;
  radius: number;
  opacity: number;
}

export interface ThreeDEffectSettings {
  layers: number;
  angle: number;
  distance: number;
  color_gradient: string[];
}

// Union type for all effect settings
export type EffectSettings = ShadowEffectSettings | OutlineEffectSettings | GlowEffectSettings | ThreeDEffectSettings;

// Effect type
export type EffectType = 'shadow' | 'outline' | 'glow' | '3d_depth' | 'none';

// TextLayer Style
export interface TextLayerStyle {
  font_size?: number;
  color?: string;
  font_name?: string;
  effects?: {
    type: EffectType;
    settings?: EffectSettings;
  };
}

// TextLayer
export interface TextLayer {
  text: string;
  position: Position;
  font_size?: number;
  color?: string;
  font_name?: string;
  style?: TextLayerStyle;
}

// Multiple Text Layers Request
export interface MultiLayerTextRequest {
  background_path: string;
  text_layers: TextLayer[];
} 