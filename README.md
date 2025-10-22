# ProCaptions: AI-Powered Image Text Editor

ProCaptions is a web application that uses AI to automatically isolate the main subject in images and add customizable text behind it to create poster-style designs.

[Live here](https://procaptions.vercel.app/preview)
## Demo  
[Watch the demo on YouTube](https://www.youtube.com/watch?v=6iUkTiAAxG8)

## Key Features

### 1. AI Image Segmentation
- **Automatic Subject Isolation**: Uses rembg with u2net_human_seg model for background removal
- **Edge Smoothing**: Gaussian blur and contrast enhancement for clean edges
- **Memory Optimized**: Automatic image resizing to 1080p max resolution
- **Format Support**: JPEG, PNG, HEIF with EXIF orientation correction

### 2. Text Customization & Effects
- **Custom Fonts**: Anton, SixCaps, Boldonse fonts included
- **Text Effects**: Shadow, outline, glow, and 3D depth effects
- **Multiple Text Layers**: Add multiple text elements with individual styling
- **Smart Positioning**: Precise text placement with coordinate-based positioning

### 3. Image Composition
- **Alpha Compositing**: Seamless blending of foreground and background
- **Cloud Storage**: AWS S3 integration for processed images
- **Automatic Cleanup**: Background cleanup of temporary files

## Technologies Used

### Backend
- **Framework**: FastAPI (Python) with async support
- **AI Model**: rembg library with u2net_human_seg model for segmentation
- **Image Processing**: PIL (Pillow), NumPy for image manipulation
- **Storage**: AWS S3 for cloud storage with local fallback
- **Memory Management**: psutil monitoring with garbage collection

## Getting Started

### Prerequisites
- Python 3.10+
- pip
- Docker & Docker Compose (optional)

### Backend Setup

#### Option 1: Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/procaptions.git
   cd procaptions
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   ```bash
   # Create .env file with your AWS S3 credentials
   API_KEY=your-api-key
   S3_ACCESS_KEY_ID=your-s3-access-key
   S3_SECRET_ACCESS_KEY=your-s3-secret-key
   S3_REGION=your-s3-region
   S3_BUCKET=your-s3-bucket
   ```

5. Download fonts (optional):
   ```bash
   python src/setup/download_fonts.py
   ```

6. Start the backend server:
   ```bash
   uvicorn main:app --reload
   ```

#### Option 2: Docker Deployment

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/procaptions.git
   cd procaptions
   ```

2. Configure environment variables in `.env` file

3. Build and start the Docker container:
   ```bash
   docker-compose up -d
   ```

4. Access the API at http://localhost:8000

## API Documentation

Once the backend is running, visit `http://localhost:8000/docs` for interactive API documentation.

### Key Endpoints

- `POST /api/v1/segment`: AI-powered image segmentation (returns foreground, background, mask)
- `POST /api/v1/add-dramatic-text`: Add styled text with effects to images
- `POST /api/v1/add-multiple-text-layers`: Add multiple text layers to a single image
- `POST /api/v1/compose`: Compose final image by combining background+text with foreground
- `GET /api/v1/download-image`: Download processed images from S3
- `GET /api/v1/list-uploads`: Debug endpoint to list uploaded files

## API Usage Examples

### 1. Segment an Image
```bash
curl -X POST "http://localhost:8000/api/v1/segment" \
  -H "X-API-Key: your-api-key" \
  -F "file=@your-image.jpg"
```

### 2. Add Text with Effects
```bash
curl -X POST "http://localhost:8000/api/v1/add-dramatic-text" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "background_path": "s3-url-from-segment",
    "text": "YOUR TEXT",
    "position": {"x": 500, "y": 300},
    "font_size": 150,
    "color": "#FFFFFF",
    "font_name": "anton",
    "effects": {
      "type": "shadow",
      "settings": {
        "offset": [5, 5],
        "color": "#000000",
        "opacity": 0.5
      }
    }
  }'
```

### 3. Compose Final Image
```bash
curl -X POST "http://localhost:8000/api/v1/compose" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "background_with_text_path": "s3-url-with-text",
    "foreground_path": "s3-url-foreground"
  }'
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- rembg library for AI-powered background removal
- u2net_human_seg model for image segmentation
- FastAPI for the robust API framework
- PIL/Pillow for image processing capabilities

## Performance Considerations

### Memory Management
- Automatic memory monitoring with psutil
- Garbage collection after processing
- 10MB file size limit for free tier deployment
- Image resizing to 1080p max resolution

### Storage Optimization
- AWS S3 for cloud storage with automatic cleanup
- Local fallback when S3 is unavailable
- Temporary file management with background cleanup
- Optimized image formats (JPEG/PNG) based on transparency

### AI Model Optimization
- Singleton pattern for model loading (loads once, reuses)
- u2net_human_seg model pre-downloaded in Docker for faster startup
- Alpha matting enabled for better edge quality
- Post-processing with Gaussian blur and contrast enhancement 
