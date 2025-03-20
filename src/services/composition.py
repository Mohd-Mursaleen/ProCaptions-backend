from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import numpy as np
from typing import Dict, List, Tuple, Optional, Any, Union
import requests
from io import BytesIO
from src.services.cloudinary_service import CloudinaryService
import os
from pathlib import Path
import cv2
import logging
import math
import random
import time

class CompositionService:
    def __init__(self):
        self.cloudinary = CloudinaryService()
        self.fonts_dir = Path("assets/fonts")
        self.fonts_dir.mkdir(parents=True, exist_ok=True)
        
        # Map of stylistic font names to actual font files
        self.dramatic_fonts = {
            "anton": "Anton-Regular.ttf",
            "sixcaps": "SixCaps.ttf",
            "impact": "Impact",  # System font as fallback
            "arial_bold": "Arial Bold",  # System font as fallback
            "helvetica_bold": "Helvetica Bold",  # System font as fallback
            "boldonse": "Boldonse.ttf"  # Added Boldonse font
        }
        
        # 3D effect presets
        self.effect_presets = {
            "shadow": {
                "offset": (5, 5),
                "color": "#000000",
                "opacity": 0.5,
                "blur": 3
            },
            "outline": {
                "width": 2,
                "color": "#000000",
                "opacity": 1.0
            },
            "glow": {
                "color": "#FFFFFF",
                "radius": 10,
                "opacity": 0.7
            },
            "3d_depth": {
                "layers": 10,
                "angle": 45,  # degrees
                "distance": 2,
                "color_gradient": ["#333333", "#666666", "#999999"]
            },
            "text_gradient": {
                "colors": ["#FF0000", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#FF00FF"],
                "direction": "horizontal",  # horizontal, vertical, diagonal
                "use_mask": True  # Use text as mask for gradient
            },
            "background_gradient": {
                "colors": ["#FF000088", "#0000FF88"],  # With alpha channel for transparency
                "direction": "vertical",
                "padding": 10,  # Padding around text in pixels
                "radius": 0,  # Border radius for the background
                "opacity": 0.7  # Overall opacity of the background
            }
        }

    async def _get_image_from_url(self, url: str) -> Image.Image:
        """Fetches an image from a URL with improved error handling"""
        try:
            # Set a timeout for the request to prevent hanging
            response = requests.get(url, timeout=60)
            response.raise_for_status()  # Raise an exception for 4xx/5xx responses
            return Image.open(BytesIO(response.content)).convert('RGBA')
        except requests.exceptions.RequestException as e:
            logging.error(f"Error fetching image from URL {url}: {str(e)}")
            raise ValueError(f"Failed to fetch image from URL: {str(e)}")
        except Exception as e:
            logging.error(f"Error processing image from URL {url}: {str(e)}")
            raise ValueError(f"Failed to process image: {str(e)}")
        
    def _get_font(self, font_name: str, font_size: int) -> ImageFont.FreeTypeFont:
        """Try to load the specified font or fall back to a suitable alternative"""
        try:
            # Check if font is in our map of known fonts
            if font_name.lower() in self.dramatic_fonts:
                font_file = self.dramatic_fonts[font_name.lower()]
                
                # If it's a local file name, try to load it from our fonts directory
                if font_file.endswith('.ttf') or font_file.endswith('.otf'):
                    font_path = self.fonts_dir / font_file
                    if font_path.exists():
                        return ImageFont.truetype(str(font_path), font_size)
                
                # Otherwise assume it's a system font
                return ImageFont.truetype(font_file, font_size)
            
            # Direct font name as fallback
            return ImageFont.truetype(font_name, font_size)
        except Exception as e:
            logging.warning(f"Failed to load font {font_name}: {e}")
            # Fallback to default font
            try:
                return ImageFont.truetype("Arial", font_size)
            except:
                return ImageFont.load_default()

    def _apply_text_effects(
        self, 
        draw: ImageDraw.ImageDraw,
        text: str,
        position: Tuple[int, int],
        font: ImageFont.FreeTypeFont,
        color: str = "#FFFFFF",
        effects: Dict[str, Any] = None
    ) -> None:
        """Apply advanced text effects"""
        try:
            # Log the exact position where text will be drawn
            logging.info(f"Drawing text at exact position: {position}")
            
            # Ensure color is properly formatted
            if not color or not isinstance(color, str):
                color = "#FFFFFF"
            
            # If no effects, just draw normal text
            if not effects:
                draw.text(position, text, fill=color, font=font)
                return
            
            # Extract effect parameters
            shadow = effects.get('shadow', None)
            outline = effects.get('outline', None)
            glow = effects.get('glow', None)
            depth_3d = effects.get('3d_depth', None)
            text_gradient = effects.get('text_gradient', None)
            background_gradient = effects.get('background_gradient', None)
            
            # Apply 3D depth effect
            if depth_3d:
                preset = self.effect_presets['3d_depth']
                layers = depth_3d.get('layers', preset['layers'])
                angle = depth_3d.get('angle', preset['angle'])
                distance = depth_3d.get('distance', preset['distance'])
                colors = depth_3d.get('colors', preset['color_gradient'])
                
                # Convert angle to radians
                angle_rad = math.radians(angle)
                
                # Draw layers from back to front
                for i in range(layers, 0, -1):
                    offset_x = int(math.cos(angle_rad) * distance * i)
                    offset_y = int(math.sin(angle_rad) * distance * i)
                    
                    # Get color for this layer (gradient or fixed)
                    if isinstance(colors, list) and len(colors) > 0:
                        color_idx = min(int(i * len(colors) / layers), len(colors) - 1)
                        layer_color = colors[color_idx]
                    else:
                        layer_color = colors if isinstance(colors, str) else "#666666"
                    
                    # Draw the layer
                    draw.text(
                        (position[0] + offset_x, position[1] + offset_y),
                        text, 
                        fill=layer_color, 
                        font=font
                    )
            
            # Apply glow effect
            if glow:
                try:
                    preset = self.effect_presets['glow']
                    glow_color = glow.get('color', preset['color'])
                    glow_radius = glow.get('radius', preset['radius'])
                    glow_opacity = glow.get('opacity', preset['opacity'])
                    
                    # Create a separate image for the glow
                    glow_img = Image.new('RGBA', draw.im.size, (0, 0, 0, 0))
                    glow_draw = ImageDraw.Draw(glow_img)
                    
                    # Draw text on glow image
                    glow_draw.text(position, text, fill=glow_color, font=font)
                    
                    # Apply blur to create glow effect
                    glow_img = glow_img.filter(ImageFilter.GaussianBlur(glow_radius))
                    
                    # Adjust opacity
                    glow_np = np.array(glow_img)
                    glow_np[:, :, 3] = (glow_np[:, :, 3] * glow_opacity).astype(np.uint8)
                    
                    # Composite glow underneath main text
                    draw.im.paste(Image.fromarray(glow_np), (0, 0), Image.fromarray(glow_np))
                except Exception as e:
                    logging.error(f"Error applying glow effect: {str(e)}")
                    # Continue with other effects
            
            # Apply shadow effect
            if shadow:
                try:
                    preset = self.effect_presets['shadow']
                    # Fix: Ensure offset is tuple of integers
                    if isinstance(shadow.get('offset'), (list, tuple)):
                        offset_value = shadow.get('offset', preset['offset'])
                        # Ensure we have at least two elements for x,y
                        if len(offset_value) >= 2:
                            shadow_offset = (int(offset_value[0]), int(offset_value[1]))
                        else:
                            # Default if we don't have enough values
                            shadow_offset = preset['offset']
                    else:
                        # Use default if not a sequence
                        shadow_offset = preset['offset']
                    
                    shadow_color = shadow.get('color', preset['color'])
                    shadow_opacity = shadow.get('opacity', preset['opacity'])
                    shadow_blur = shadow.get('blur', preset['blur'])
                    
                    # Ensure shadow_color is valid
                    if not shadow_color or not isinstance(shadow_color, str):
                        shadow_color = preset['color']
                    
                    # Draw shadow
                    shadow_pos = (position[0] + shadow_offset[0], position[1] + shadow_offset[1])
                    
                    # Create separate image for shadow (easier to blur)
                    shadow_img = Image.new('RGBA', draw.im.size, (0, 0, 0, 0))
                    shadow_draw = ImageDraw.Draw(shadow_img)
                    
                    # Draw text in shadow color
                    shadow_draw.text(shadow_pos, text, fill=shadow_color, font=font)
                    
                    # Apply blur to shadow
                    if shadow_blur > 0:
                        shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(shadow_blur))
                    
                    # Adjust opacity
                    shadow_np = np.array(shadow_img)
                    shadow_np[:, :, 3] = (shadow_np[:, :, 3] * shadow_opacity).astype(np.uint8)
                    
                    # Composite shadow (underneath)
                    draw.im.paste(Image.fromarray(shadow_np), (0, 0), Image.fromarray(shadow_np))
                except Exception as e:
                    logging.error(f"Error applying shadow effect: {str(e)}")
                    # Continue with other effects
            
            # Draw outline effect
            if outline:
                try:
                    preset = self.effect_presets['outline']
                    outline_width = outline.get('width', preset['width'])
                    outline_color = outline.get('color', preset['color'])
                    
                    # Ensure outline_color is valid
                    if not outline_color or not isinstance(outline_color, str):
                        outline_color = preset['color']
                    
                    # Draw text outline by offsetting in all directions
                    for dx in range(-outline_width, outline_width+1):
                        for dy in range(-outline_width, outline_width+1):
                            if dx != 0 or dy != 0:  # Skip the center (actual text)
                                draw.text(
                                    (position[0] + dx, position[1] + dy),
                                    text, 
                                    fill=outline_color, 
                                    font=font
                                )
                except Exception as e:
                    logging.error(f"Error applying outline effect: {str(e)}")
                    # Continue with main text
            
            # Apply text gradient if specified
            if text_gradient:
                try:
                    preset = self.effect_presets['text_gradient']
                    gradient_colors = text_gradient.get('colors', preset['colors'])
                    gradient_direction = text_gradient.get('direction', preset['direction'])
                    use_mask = text_gradient.get('use_mask', preset['use_mask'])
                    
                    # Get text dimensions
                    text_bbox = draw.textbbox(position, text, font=font)
                    text_width = text_bbox[2] - text_bbox[0]
                    text_height = text_bbox[3] - text_bbox[1]
                    
                    # Create a mask image with the text
                    mask_img = Image.new('RGBA', draw.im.size, (0, 0, 0, 0))
                    mask_draw = ImageDraw.Draw(mask_img)
                    mask_draw.text(position, text, fill=(255, 255, 255, 255), font=font)
                    mask_array = np.array(mask_img)
                    
                    # Create a gradient image sized to the text
                    gradient_img = Image.new('RGBA', draw.im.size, (0, 0, 0, 0))
                    gradient_draw = ImageDraw.Draw(gradient_img)
                    
                    # Create gradient array
                    if gradient_direction == 'horizontal':
                        # Create horizontal gradient
                        for i in range(text_width):
                            # Calculate normalized position in gradient
                            pos = i / max(1, text_width - 1)
                            color_idx = pos * (len(gradient_colors) - 1)
                            
                            # Get interpolated color
                            idx_floor = int(color_idx)
                            idx_ceil = min(idx_floor + 1, len(gradient_colors) - 1)
                            
                            # Get the two colors to interpolate between
                            color1 = self._hex_to_rgba(gradient_colors[idx_floor])
                            color2 = self._hex_to_rgba(gradient_colors[idx_ceil])
                            
                            # Calculate blend factor
                            blend = color_idx - idx_floor
                            
                            # Interpolate colors
                            r = int(color1[0] * (1 - blend) + color2[0] * blend)
                            g = int(color1[1] * (1 - blend) + color2[1] * blend)
                            b = int(color1[2] * (1 - blend) + color2[2] * blend)
                            a = int(color1[3] * (1 - blend) + color2[3] * blend)
                            
                            # Draw a vertical line of this color
                            x_pos = position[0] + i
                            for j in range(text_height):
                                y_pos = position[1] + j
                                if 0 <= x_pos < draw.im.width and 0 <= y_pos < draw.im.height:
                                    gradient_img.putpixel((x_pos, y_pos), (r, g, b, a))
                                    
                    elif gradient_direction == 'vertical':
                        # Create vertical gradient
                        for j in range(text_height):
                            # Calculate normalized position in gradient
                            pos = j / max(1, text_height - 1)
                            color_idx = pos * (len(gradient_colors) - 1)
                            
                            # Get interpolated color
                            idx_floor = int(color_idx)
                            idx_ceil = min(idx_floor + 1, len(gradient_colors) - 1)
                            
                            # Get the two colors to interpolate between
                            color1 = self._hex_to_rgba(gradient_colors[idx_floor])
                            color2 = self._hex_to_rgba(gradient_colors[idx_ceil])
                            
                            # Calculate blend factor
                            blend = color_idx - idx_floor
                            
                            # Interpolate colors
                            r = int(color1[0] * (1 - blend) + color2[0] * blend)
                            g = int(color1[1] * (1 - blend) + color2[1] * blend)
                            b = int(color1[2] * (1 - blend) + color2[2] * blend)
                            a = int(color1[3] * (1 - blend) + color2[3] * blend)
                            
                            # Draw a horizontal line of this color
                            y_pos = position[1] + j
                            for i in range(text_width):
                                x_pos = position[0] + i
                                if 0 <= x_pos < draw.im.width and 0 <= y_pos < draw.im.height:
                                    gradient_img.putpixel((x_pos, y_pos), (r, g, b, a))
                    else:  # diagonal
                        # Create diagonal gradient
                        for i in range(text_width):
                            for j in range(text_height):
                                # Calculate normalized position in gradient (diagonal)
                                pos = (i / max(1, text_width - 1) + j / max(1, text_height - 1)) / 2
                                color_idx = pos * (len(gradient_colors) - 1)
                                
                                # Get interpolated color
                                idx_floor = int(color_idx)
                                idx_ceil = min(idx_floor + 1, len(gradient_colors) - 1)
                                
                                # Get the two colors to interpolate between
                                color1 = self._hex_to_rgba(gradient_colors[idx_floor])
                                color2 = self._hex_to_rgba(gradient_colors[idx_ceil])
                                
                                # Calculate blend factor
                                blend = color_idx - idx_floor
                                
                                # Interpolate colors
                                r = int(color1[0] * (1 - blend) + color2[0] * blend)
                                g = int(color1[1] * (1 - blend) + color2[1] * blend)
                                b = int(color1[2] * (1 - blend) + color2[2] * blend)
                                a = int(color1[3] * (1 - blend) + color2[3] * blend)
                                
                                # Set pixel color
                                x_pos = position[0] + i
                                y_pos = position[1] + j
                                if 0 <= x_pos < draw.im.width and 0 <= y_pos < draw.im.height:
                                    gradient_img.putpixel((x_pos, y_pos), (r, g, b, a))
                    
                    # Apply the gradient with the text mask
                    if use_mask:
                        # Use text as mask for the gradient
                        gradient_array = np.array(gradient_img)
                        # Only keep gradient where mask is non-zero
                        gradient_array[:, :, 3] = np.minimum(gradient_array[:, :, 3], mask_array[:, :, 3])
                        # Paste the masked gradient
                        draw.im.paste(Image.fromarray(gradient_array), (0, 0), Image.fromarray(mask_array))
                    else:
                        # Just draw the gradient directly (less precise)
                        draw.text(position, text, fill=None, font=font, embedded_color=True)
                except Exception as e:
                    logging.error(f"Error applying text gradient: {str(e)}")
                    # Fall back to regular text
                    draw.text(position, text, fill=color, font=font)
            # Apply background gradient if specified
            elif background_gradient:
                try:
                    preset = self.effect_presets['background_gradient']
                    bg_colors = background_gradient.get('colors', preset['colors'])
                    bg_direction = background_gradient.get('direction', preset['direction'])
                    padding = background_gradient.get('padding', preset['padding'])
                    radius = background_gradient.get('radius', preset['radius'])
                    opacity = background_gradient.get('opacity', preset['opacity'])
                    
                    # Get text dimensions
                    text_bbox = draw.textbbox(position, text, font=font)
                    
                    # Add padding
                    x1 = text_bbox[0] - padding
                    y1 = text_bbox[1] - padding
                    x2 = text_bbox[2] + padding
                    y2 = text_bbox[3] + padding
                    
                    # Ensure within image bounds
                    x1 = max(0, x1)
                    y1 = max(0, y1)
                    x2 = min(draw.im.width, x2)
                    y2 = min(draw.im.height, y2)
                    
                    bg_width = x2 - x1
                    bg_height = y2 - y1
                    
                    # Create background gradient image
                    bg_img = Image.new('RGBA', (bg_width, bg_height), (0, 0, 0, 0))
                    bg_draw = ImageDraw.Draw(bg_img)
                    
                    # Draw background with gradient
                    if bg_direction == 'horizontal':
                        for i in range(bg_width):
                            # Calculate color position
                            pos = i / max(1, bg_width - 1)
                            color_idx = pos * (len(bg_colors) - 1)
                            
                            # Interpolate colors
                            idx_floor = int(color_idx)
                            idx_ceil = min(idx_floor + 1, len(bg_colors) - 1)
                            
                            color1 = self._hex_to_rgba(bg_colors[idx_floor])
                            color2 = self._hex_to_rgba(bg_colors[idx_ceil])
                            
                            blend = color_idx - idx_floor
                            
                            r = int(color1[0] * (1 - blend) + color2[0] * blend)
                            g = int(color1[1] * (1 - blend) + color2[1] * blend)
                            b = int(color1[2] * (1 - blend) + color2[2] * blend)
                            a = int(color1[3] * (1 - blend) + color2[3] * blend)
                            
                            # Adjust for overall opacity
                            a = int(a * opacity)
                            
                            # Draw vertical line
                            bg_draw.line([(i, 0), (i, bg_height)], fill=(r, g, b, a))
                    elif bg_direction == 'vertical':
                        for j in range(bg_height):
                            # Calculate color position
                            pos = j / max(1, bg_height - 1)
                            color_idx = pos * (len(bg_colors) - 1)
                            
                            # Interpolate colors
                            idx_floor = int(color_idx)
                            idx_ceil = min(idx_floor + 1, len(bg_colors) - 1)
                            
                            color1 = self._hex_to_rgba(bg_colors[idx_floor])
                            color2 = self._hex_to_rgba(bg_colors[idx_ceil])
                            
                            blend = color_idx - idx_floor
                            
                            r = int(color1[0] * (1 - blend) + color2[0] * blend)
                            g = int(color1[1] * (1 - blend) + color2[1] * blend)
                            b = int(color1[2] * (1 - blend) + color2[2] * blend)
                            a = int(color1[3] * (1 - blend) + color2[3] * blend)
                            
                            # Adjust for overall opacity
                            a = int(a * opacity)
                            
                            # Draw horizontal line
                            bg_draw.line([(0, j), (bg_width, j)], fill=(r, g, b, a))
                    else:  # radial
                        # Center of the background box
                        center_x = bg_width // 2
                        center_y = bg_height // 2
                        max_dist = math.sqrt(center_x**2 + center_y**2)
                        
                        for i in range(bg_width):
                            for j in range(bg_height):
                                # Calculate distance from center (normalized)
                                dist = math.sqrt((i - center_x)**2 + (j - center_y)**2) / max_dist
                                color_idx = dist * (len(bg_colors) - 1)
                                
                                # Interpolate colors
                                idx_floor = int(color_idx)
                                idx_ceil = min(idx_floor + 1, len(bg_colors) - 1)
                                
                                color1 = self._hex_to_rgba(bg_colors[idx_floor])
                                color2 = self._hex_to_rgba(bg_colors[idx_ceil])
                                
                                blend = color_idx - idx_floor
                                
                                r = int(color1[0] * (1 - blend) + color2[0] * blend)
                                g = int(color1[1] * (1 - blend) + color2[1] * blend)
                                b = int(color1[2] * (1 - blend) + color2[2] * blend)
                                a = int(color1[3] * (1 - blend) + color2[3] * blend)
                                
                                # Adjust for overall opacity
                                a = int(a * opacity)
                                
                                # Set pixel
                                bg_img.putpixel((i, j), (r, g, b, a))
                    
                    # Apply rounded corners if specified
                    if radius > 0:
                        # Create a mask with rounded corners
                        mask = Image.new('L', (bg_width, bg_height), 0)
                        mask_draw = ImageDraw.Draw(mask)
                        mask_draw.rounded_rectangle([(0, 0), (bg_width-1, bg_height-1)], radius=radius, fill=255)
                        
                        # Apply mask to background
                        bg_array = np.array(bg_img)
                        mask_array = np.array(mask)
                        bg_array[:, :, 3] = bg_array[:, :, 3] * mask_array / 255
                        bg_img = Image.fromarray(bg_array)
                    
                    # Paste background onto main image
                    draw.im.paste(bg_img, (x1, y1), bg_img)
                    
                    # Draw the text
                    draw.text(position, text, fill=color, font=font)
                except Exception as e:
                    logging.error(f"Error applying background gradient: {str(e)}")
                    # Fall back to regular text
                    draw.text(position, text, fill=color, font=font)
            else:
                # Draw the main text on top (no special effects)
                draw.text(position, text, fill=color, font=font)
            
        except Exception as e:
            logging.error(f"Error in _apply_text_effects: {str(e)}")
            # Fallback to simple text rendering
            try:
                draw.text(position, text, fill="#FFFFFF", font=font)
            except:
                # Last resort fallback
                default_font = ImageFont.load_default()
                draw.text(position, text, fill="#FFFFFF", font=default_font)

    def _hex_to_rgba(self, hex_color: str) -> Tuple[int, int, int, int]:
        """Convert hex color to RGBA tuple"""
        # Handle colors with alpha in hex format (#RRGGBBAA)
        if hex_color.startswith('#'):
            hex_color = hex_color.lstrip('#')
            
            # Handle different hex formats
            if len(hex_color) == 8:  # #RRGGBBAA
                r = int(hex_color[0:2], 16)
                g = int(hex_color[2:4], 16)
                b = int(hex_color[4:6], 16)
                a = int(hex_color[6:8], 16)
            elif len(hex_color) == 6:  # #RRGGBB
                r = int(hex_color[0:2], 16)
                g = int(hex_color[2:4], 16)
                b = int(hex_color[4:6], 16)
                a = 255
            elif len(hex_color) == 4:  # #RGBA
                r = int(hex_color[0], 16) * 17
                g = int(hex_color[1], 16) * 17
                b = int(hex_color[2], 16) * 17
                a = int(hex_color[3], 16) * 17
            elif len(hex_color) == 3:  # #RGB
                r = int(hex_color[0], 16) * 17
                g = int(hex_color[1], 16) * 17
                b = int(hex_color[2], 16) * 17
                a = 255
            else:
                # Default to white fully opaque if invalid format
                r, g, b, a = 255, 255, 255, 255
        else:
            # Default to white fully opaque if not hex format
            r, g, b, a = 255, 255, 255, 255
            
        return (r, g, b, a)
    
    def _suggest_text_positions(
        self, 
        background: Image.Image, 
        text: str,
        font: ImageFont.FreeTypeFont,
        text_size: Tuple[int, int]
    ) -> List[Dict[str, int]]:
        """Suggest optimal text positions based on background content"""
        width, height = background.size
        
        # Convert to numpy array for analysis
        bg_array = np.array(background)
        
        # Check if alpha channel exists
        has_alpha = bg_array.shape[2] == 4
        
        # Create grid of potential positions
        grid_size = 3  # 3x3 grid
        positions = []
        
        for y_idx in range(grid_size):
            for x_idx in range(grid_size):
                # Calculate position in grid
                x_pos = int(width * (x_idx + 0.5) / grid_size - text_size[0] / 2)
                y_pos = int(height * (y_idx + 0.5) / grid_size - text_size[1] / 2)
                
                # Keep within bounds
                x_pos = max(10, min(width - text_size[0] - 10, x_pos))
                y_pos = max(10, min(height - text_size[1] - 10, y_pos))
                
                # Check if this position is good (transparent or empty area)
                region = bg_array[
                    y_pos:min(y_pos + text_size[1], height), 
                    x_pos:min(x_pos + text_size[0], width)
                ]
                
                if has_alpha:
                    # Calculate average alpha (transparency)
                    avg_alpha = np.mean(region[:, :, 3]) if region.size > 0 else 0
                    
                    # If area is transparent (low alpha), it's a good candidate
                    if avg_alpha < 128:  # Less than 50% opaque
                        positions.append({"x": x_pos, "y": y_pos, "score": 255 - avg_alpha})
                else:
                    # For images without alpha, check brightness (darker areas might be better for light text)
                    avg_brightness = np.mean(region) if region.size > 0 else 0
                    positions.append({"x": x_pos, "y": y_pos, "score": 255 - avg_brightness})
        
        # Sort by score (higher is better)
        positions.sort(key=lambda p: p["score"], reverse=True)
        
        # Return top 3 positions
        return positions[:3]

    async def add_text(
        self,
        background_path: str,
        text: str,
        position: Dict[str, int],
        font_size: int = 120,  # Increased default font size for dramatic effect
        color: str = "#FFFFFF",  # Changed default to white for better visibility
        font_name: str = "Impact",  # Changed default font for dramatic effect
        effects: Dict[str, Any] = None  # New parameter for text effects
    ) -> Tuple[str, dict]:
        """Add text to a background image with options for effects"""
        # Load the background image
        if background_path.startswith('http'):
            background = await self._get_image_from_url(background_path)
        else:
            background = Image.open(background_path).convert('RGBA')
            
        # Log image dimensions to help diagnose positioning issues
        logging.info(f"Original background dimensions: {background.size}")
            
        # Create a drawing canvas
        canvas = background.copy()
        draw = ImageDraw.Draw(canvas)
            
        # Get the font
        font = self._get_font(font_name, font_size)
            
        # Calculate text size
        text_bbox = draw.textbbox((0, 0), text, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
        
        # Extract position coordinates and ensure they're integers
        pos_x = int(position.get('x', 10))
        pos_y = int(position.get('y', 10))
        
        # Log the text position for debugging
        logging.info(f"Rendering text at position: x={pos_x}, y={pos_y}, font_size={font_size}")
        
        # IMPORTANT: Adjust the position to account for text rendering at baseline
        # This makes the text position more accurately match what the user expects
        # Text is rendered from its left baseline, not from top-left of its bounding box
        # The adjustment centers the text on the specified position
        adjusted_pos_x = pos_x - text_width // 2
        
        # VERTICAL POSITIONING FIX: Add a slight upward adjustment to match frontend preview
        # The vertical adjustment now includes a small factor to match how CSS positions text 
        vertical_adjustment_factor = 0.375  # 10% upward shift to match CSS centering (increased from 5%)
        vertical_adjustment = int(text_height * vertical_adjustment_factor)
        adjusted_pos_y = pos_y - text_height // 2 - vertical_adjustment
        
        logging.info(f"Text dimensions: width={text_width}, height={text_height}")
        logging.info(f"Adjusted position: x={adjusted_pos_x}, y={adjusted_pos_y} (with {vertical_adjustment}px vertical adjustment)")
        
        # Apply text with effects using the adjusted position
        self._apply_text_effects(
            draw, 
            text, 
            (adjusted_pos_x, adjusted_pos_y), 
            font, 
            color, 
            effects
        )
        
        # Save the result
        processed_dir = Path("uploads/processed")
        processed_dir.mkdir(exist_ok=True)
        
        # Generate a unique filename based on the original path
        base_name = os.path.basename(background_path)
        base_name_without_ext = os.path.splitext(base_name)[0]
        text_path = processed_dir / f"{base_name_without_ext}_text_{int(time.time())}.png"
        
        # Save locally
        canvas.save(text_path, "PNG")
        
        # Log the path of the saved image
        logging.info(f"Saved text image to: {text_path}")
        
        # Upload to cloud storage
        cloud_url = await self.cloudinary.upload_image(str(text_path))
        
        # Store the original (non-adjusted) position in the return info
        # This ensures the frontend gets back the same position it sent
        return str(text_path), {
            "path": str(text_path),
            "cloud_url": cloud_url,
            "text_size": {
                "width": text_width,
                "height": text_height
            },
            "position": {
                "x": pos_x,
                "y": pos_y
            },
            "image_size": {
                "width": background.width,
                "height": background.height
            }
        }

    async def add_dramatic_text(
        self,
        background_path: str,
        text: str,
        position: Dict[str, int],
        font_size: int = 150,
        color: str = "#FFFFFF",
        font_name: str = "anton",  # Default to Anton since we downloaded it
        with_period: bool = True,  # Option to add period like in examples
        to_uppercase: bool = False,  # Make uppercase conversion optional
        effects: Dict[str, Any] = None  # Added effects parameter
    ) -> Tuple[str, dict]:
        """Add dramatic, stylized text to the background with advanced effects"""
        try:
            # Validate input
            if not background_path:
                raise ValueError("Background path is required")
            
            # Ensure text is a string
            if not text:
                text = "SAMPLE TEXT"
            
            # Add a period if requested and not already present
            if with_period and not text.endswith('.'):
                text = text + '.'
            
            # Convert text to uppercase only if requested
            if to_uppercase:
                text = text.upper()
            
            # Ensure position is properly formatted
            if not position or not isinstance(position, dict):
                position = {"x": 100, "y": 100}
                logging.warning(f"Invalid position format: {position}, using default")
            
            # Ensure x and y are numbers
            try:
                x = int(position.get("x", 100))
                y = int(position.get("y", 100))
            except (ValueError, TypeError):
                x, y = 100, 100
                logging.warning(f"Invalid position values: {position}, using default coordinates")
            
            position = {"x": x, "y": y}
            
            # Only apply minimal effects if none are provided
            if effects is None:
                # No default effects - let the text render as is
                effects = {}
            else:
                # Ensure shadow offset is properly formatted if it exists
                if 'shadow' in effects and 'offset' in effects['shadow']:
                    offset = effects['shadow']['offset']
                    # Make sure it's a tuple of two integers
                    if isinstance(offset, (list, tuple)) and len(offset) >= 2:
                        effects['shadow']['offset'] = (int(offset[0]), int(offset[1]))
                    else:
                        # Default if format is wrong
                        effects['shadow']['offset'] = (6, 6)
            
            # Call the base add_text method with our modifications
            result, info = await self.add_text(
                background_path,
                text,
                position,
                font_size,
                color,
                font_name,
                effects
            )
            
            return result, info
        except Exception as e:
            logging.error(f"Error in add_dramatic_text: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to add dramatic text: {str(e)}")

    async def compose_final_image(
        self,
        background_with_text_path: str,
        foreground_path: str,
        blend_mode: str = 'normal',  # Added parameter for blend mode
        blend_opacity: float = 1.0  # Added parameter for opacity
    ) -> str:
        """Combine background with text and foreground subject"""
        try:
            logging.info(f"Composing final image: bg={background_with_text_path}, fg={foreground_path}")
            
            # Load the images
            if background_with_text_path.startswith('http'):
                background_with_text = await self._get_image_from_url(background_with_text_path)
            else:
                background_with_text = Image.open(background_with_text_path).convert('RGBA')
            
            if foreground_path.startswith('http'):
                foreground = await self._get_image_from_url(foreground_path)
            else:
                foreground = Image.open(foreground_path).convert('RGBA')
            
            logging.info(f"Background with text size: {background_with_text.size}, mode: {background_with_text.mode}")
            logging.info(f"Foreground size: {foreground.size}, mode: {foreground.mode}")
            
            # Ensure foreground is the same size as background
            if foreground.size != background_with_text.size:
                logging.info(f"Resizing foreground from {foreground.size} to {background_with_text.size}")
                foreground = foreground.resize(background_with_text.size, Image.LANCZOS)
            
            # Create the final composite - THIS IS THE KEY CHANGE:
            # Instead of manipulating numpy arrays, we'll use PIL's alpha_composite which 
            # properly handles transparency and preserves layers
            final_image = background_with_text.copy()
            
            # Now paste the foreground on top with its alpha mask
            # This ensures the foreground is placed ON TOP of the background+text
            final_image.paste(foreground, (0, 0), foreground)
            
            # Save the composed image
            processed_dir = Path("uploads/processed")
            processed_dir.mkdir(exist_ok=True)
            composed_path = processed_dir / f"composed_{int(time.time())}.png"
            final_image.save(composed_path, "PNG")
            
            # Upload to cloud storage
            cloud_url = await self.cloudinary.upload_image(str(composed_path))
            
            return str(composed_path)
        except Exception as e:
            logging.error(f"Error in compose_final_image: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to compose final image: {str(e)}")

    async def generate_font_size_previews(
        self,
        background_path: str,
        text: str,
        position: Dict[str, int],
        font_name: str = "anton"
    ) -> Tuple[List[int], Dict[str, str]]:
        """Generate previews of different font sizes for the user to choose from"""
        # Define range of font sizes to preview
        sizes = [80, 100, 120, 150, 180, 220]
        previews = {}
        
        # Generate preview for each size
        for size in sizes:
            # Add text with the specified size
            _, info = await self.add_text(
                background_path,
                text,
                position,
                font_size=size,
                font_name=font_name
            )
            
            # Store cloud URL
            previews[str(size)] = info['cloud_url']
        
        return sizes, previews

    async def suggest_text_positions(
        self,
        background_path: str,
        text: str,
        font_size: int = 120,
        font_name: str = "anton"
    ) -> List[Dict[str, int]]:
        """Suggest optimal text positions based on background content"""
        # Load the background image
        if background_path.startswith('http'):
            background = await self._get_image_from_url(background_path)
        else:
            background = Image.open(background_path).convert('RGBA')
        
        # Get the font and calculate text size
        font = self._get_font(font_name, font_size)
        
        # Create a temp drawing context to measure text
        temp_img = Image.new('RGBA', (1, 1))
        draw = ImageDraw.Draw(temp_img)
        text_bbox = draw.textbbox((0, 0), text, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
        
        # Get position suggestions
        return self._suggest_text_positions(
            background, 
            text, 
            font, 
            (text_width, text_height)
        )

    def _get_social_media_dimensions(self, template_name: str) -> Tuple[int, int]:
        """Get dimensions for a social media template"""
        templates = {
            "instagram_post": (1080, 1080),
            "instagram_story": (1080, 1920),
            "facebook_post": (1200, 630),
            "twitter_post": (1600, 900),
            "linkedin_post": (1200, 627),
            "youtube_thumbnail": (1280, 720),
            "tiktok_video": (1080, 1920)
        }
        
        return templates.get(template_name, (1080, 1080))  # Default to square

    async def create_template(
        self,
        foreground_path: str,
        background_color: str = "#000000",
        template_name: str = "instagram_post",
        padding_percent: int = 10
    ) -> str:
        """Create a social media template with the foreground subject"""
        # Load foreground image
        if foreground_path.startswith('http'):
            foreground = await self._get_image_from_url(foreground_path)
        else:
            foreground = Image.open(foreground_path).convert('RGBA')
        
        # Get template dimensions
        width, height = self._get_social_media_dimensions(template_name)
        
        # Create background with specified color
        background = Image.new('RGBA', (width, height), background_color)
        
        # Calculate scaling to fit foreground within template
        # while maintaining aspect ratio and adding padding
        fg_width, fg_height = foreground.size
        fg_aspect = fg_width / fg_height
        
        # Calculate available space after padding
        padding_px = min(width, height) * padding_percent // 100
        avail_width = width - (2 * padding_px)
        avail_height = height - (2 * padding_px)
        
        # Scale foreground to fit available space
        if avail_width / avail_height > fg_aspect:
            # Constrained by height
            new_height = avail_height
            new_width = int(new_height * fg_aspect)
        else:
            # Constrained by width
            new_width = avail_width
            new_height = int(new_width / fg_aspect)
        
        # Resize foreground
        foreground_resized = foreground.resize((new_width, new_height), Image.LANCZOS)
        
        # Calculate position to center in template
        pos_x = (width - new_width) // 2
        pos_y = (height - new_height) // 2
        
        # Paste foreground onto background
        background.paste(foreground_resized, (pos_x, pos_y), foreground_resized)
        
        # Save result
        processed_dir = Path("uploads/processed")
        template_path = processed_dir / f"template_{template_name}_{int(time.time())}.png"
        background.save(template_path, "PNG")
        
        # Upload to cloud storage
        cloud_url = await self.cloudinary.upload_image(str(template_path))
        
        return cloud_url

    async def add_multiple_text_layers(self, background_path: str, text_layers: List['TextLayer']) -> str:
        """Add multiple text layers to a background"""
        try:
            # Load the background image
            if background_path.startswith('http'):
                background = await self._get_image_from_url(background_path)
            else:
                background = Image.open(background_path).convert('RGBA')
            
            # Create a drawing canvas
            canvas = background.copy()
            draw = ImageDraw.Draw(canvas)
            
            # Log the number of text layers
            logging.info(f"Processing {len(text_layers)} text layers")
            
            # Add each text layer
            for i, layer in enumerate(text_layers):
                # Extract style information
                font_size = layer.style.get('font_size', 120)
                color = layer.style.get('color', '#FFFFFF')
                font_name = layer.style.get('font_name', 'impact')
                effects = layer.style.get('effects', None)
                
                # Log layer details
                logging.info(f"Layer {i+1}: text='{layer.text}', position={layer.position}, font={font_name}, size={font_size}")
                
                # Get font
                font = self._get_font(font_name, font_size)
                
                # Get text position
                pos_x = int(layer.position.get('x', 10))
                pos_y = int(layer.position.get('y', 10))
                
                # Calculate text size for centering
                text_bbox = draw.textbbox((0, 0), layer.text, font=font)
                text_width = text_bbox[2] - text_bbox[0]
                text_height = text_bbox[3] - text_bbox[1]
                
                # Center the text on the specified position
                adjusted_pos_x = pos_x - text_width // 2
                
                # VERTICAL POSITIONING FIX: Add a slight upward adjustment to match frontend preview
                # The vertical adjustment now includes a small factor to match how CSS positions text
                vertical_adjustment_factor = 0.10  # 10% upward shift to match CSS centering (increased from 5%)
                vertical_adjustment = int(text_height * vertical_adjustment_factor)
                adjusted_pos_y = pos_y - text_height // 2 - vertical_adjustment
                
                logging.info(f"Layer {i+1} adjusted position: x={adjusted_pos_x}, y={adjusted_pos_y}")
                
                # Apply text with effects
                self._apply_text_effects(
                    draw, 
                    layer.text, 
                    (adjusted_pos_x, adjusted_pos_y), 
                    font, 
                    color, 
                    effects
                )
            
            # Save the result
            processed_dir = Path("uploads/processed")
            processed_dir.mkdir(exist_ok=True)
            
            # Generate a unique filename
            text_path = processed_dir / f"multilayer_text_{int(time.time())}.png"
            
            # Save locally
            canvas.save(text_path, "PNG")
            logging.info(f"Saved multi-layer text image to: {text_path}")
            
            # Upload to cloud storage
            cloud_result = await self.cloudinary.upload_image(str(text_path))
            
            # Return the Cloudinary URL instead of the local path
            return cloud_result["url"]
            
        except Exception as e:
            logging.error(f"Error in add_multiple_text_layers: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to add multiple text layers: {str(e)}")

class TextLayer:
    def __init__(self, text: str, position: Dict[str, int], style: Dict):
        self.text = text
        self.position = position
        self.style = style

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "position": self.position,
            "style": self.style
        }