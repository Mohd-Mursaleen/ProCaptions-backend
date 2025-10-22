# Optimized Dockerfile for AWS Free Tier (t2.micro)
FROM python:3.10-slim

WORKDIR /app

# Install minimal system dependencies
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies with optimizations
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# PRE-DOWNLOAD AI MODEL (Critical for free tier!)
# This prevents the 2-5 minute delay on first request
RUN python -c "from rembg import new_session; session = new_session('u2net_human_seg'); print('✅ AI model pre-downloaded successfully')"

# Copy fonts first to ensure they're available
COPY assets/fonts /app/assets/fonts
RUN ls -la /app/assets/fonts

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p uploads/original uploads/processed uploads/temp uploads/public assets/fonts \
    && chmod -R 755 uploads \
    && chmod -R 755 assets

# Set environment variables for memory optimization
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONHASHSEED=random \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    MALLOC_TRIM_THRESHOLD_=100000

# Add health check
HEALTHCHECK --interval=60s --timeout=30s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# Optimized command for t2.micro (single worker, extended timeouts)
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1", \
     "--timeout-keep-alive", "300", \
     "--timeout-graceful-shutdown", "30", \
     "--access-log"]