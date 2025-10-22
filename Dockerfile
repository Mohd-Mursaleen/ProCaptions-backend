# Multi-stage Dockerfile with Nginx for AWS EC2
FROM python:3.10-slim as backend

WORKDIR /app

# Install minimal system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
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

# Final stage with Nginx
FROM nginx:alpine

# Install Python and supervisor
RUN apk add --no-cache python3 py3-pip supervisor curl

# Copy Python app from backend stage
COPY --from=backend /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY --from=backend /usr/local/bin/uvicorn /usr/local/bin/uvicorn
COPY --from=backend /app /app

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy supervisor configuration
COPY supervisord.conf /etc/supervisord.conf

# Create necessary directories
RUN mkdir -p /var/log/supervisor /app/uploads

# Expose ports
EXPOSE 80

# Health check
HEALTHCHECK --interval=60s --timeout=30s --start-period=120s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start supervisor (manages both Nginx and Uvicorn)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]