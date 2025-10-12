# ProCaptions: AI-Powered Image Text Editor

ProCaptions is a web application that uses advanced AI to automatically isolate the main subject in images, add customizable text behind it, and create professional-looking poster-style designs.

## Demo  
[Watch the demo on YouTube](https://www.youtube.com/watch?v=6iUkTiAAxG8)
[Live](https://procaptions.vercel.app/preview)

## Key Features

### 1. Advanced Image Segmentation
- **AI-powered Subject Isolation**: Using SAM (Segment Anything Model) and YOLOv8 for accurate subject detection and segmentation
- **Manual Mask Refinement**: Fine-tune segmentation with brush/eraser tools
- **Edge Smoothing**: Clean, professional-looking edges with OpenCV post-processing

### 2. Text Customization & Placement
- **Dynamic Text Positioning**: Smart suggestions for optimal text placement
- **Rich Text Styling**: Fonts, sizes, colors, outlines, and shadows
- **3D Text Effects**: Add depth and dimension to your text
- **Multiple Text Layers**: Add multiple text elements with different styles

### 3. Social Media Templates
- Ready-to-use templates for Instagram, Facebook, Twitter, LinkedIn, YouTube, and TikTok
- Proper aspect ratios and dimensions for each platform

### 4. Real-time Preview & Export
- Interactive canvas for real-time editing
- High-resolution export with transparency support

## Technologies Used

### Backend
- **Framework**: FastAPI (Python)
- **AI Models**:
  - SAM (Segment Anything Model) for precise image segmentation
  - YOLOv8 for object detection
- **Image Processing**: OpenCV, Pillow
- **Caching**: Redis (optional)
- **Storage**: Cloudinary

### Frontend
- **Framework**: React with TypeScript
- **UI Components**: TailwindCSS
- **Canvas Manipulation**: Canvas API for interactive editing

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 14+
- pip
- npm or yarn
- Docker & Docker Compose (optional)

### Backend Setup

#### Option 1: Local Development

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/procaptions.git
   cd procaptions/backend
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   ```
   cp .env.example .env
   # Edit the .env file with your Cloudinary credentials
   ```

5. Download the required models and fonts:
   ```
   python -m src.setup.download_models
   ```

6. Start the backend server:
   ```
   uvicorn main:app --reload
   ```

#### Option 2: Docker Deployment

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/procaptions.git
   cd procaptions/backend
   ```

2. Configure environment variables:
   ```
   cp .env.example .env
   # Edit the .env file with your Cloudinary credentials
   ```

3. Build and start the Docker containers:
   ```
   docker-compose up -d
   ```

   This will start both the backend API and Redis cache.

4. Access the API at http://localhost:8000

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd ../frontend
   ```

2. Install dependencies:
   ```
   npm install
   # or
   yarn install
   ```

3. Start the development server:
   ```
   npm run dev
   # or
   yarn dev
   ```

## API Documentation

Once the backend is running, visit `http://localhost:8000/docs` for interactive API documentation.

### Key Endpoints

- `POST /api/v1/segment`: Segment an image to isolate the subject
- `POST /api/v1/refine-mask`: Manually refine the segmentation mask
- `POST /api/v1/add-text`: Add text to the background
- `POST /api/v1/add-3d-text`: Add text with 3D effects
- `POST /api/v1/compose-with-blend`: Combine layers with blend modes
- `POST /api/v1/create-template`: Create social media templates
- `GET /api/v1/templates`: Get available social media templates

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- SAM (Segment Anything Model) by Meta AI
- YOLOv8 by Ultralytics
- All the incredible open source contributors that made this project possible

## Performance Considerations

### Redis Caching
Redis caching is used to improve performance by storing segmentation results. This can significantly speed up repeated operations on the same images.

To enable Redis caching:
1. Set `USE_REDIS=true` in your `.env` file
2. Ensure Redis is running (included in Docker setup)

### Model Selection
- SAM (Segment Anything Model) provides the highest quality segmentation but requires more computational resources
- YOLOv8 provides fast object detection to guide SAM for better results
- Rembg is used as a fallback when SAM or YOLOv8 are not available

### GPU Acceleration
If you have a CUDA-compatible GPU:
1. Install the CUDA version of PyTorch before installing other requirements
2. The application will automatically detect and use the GPU if available 
