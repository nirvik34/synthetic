FROM python:3.12-slim

LABEL maintainer="nirvik34"
LABEL project="Deepdox"

# Architecture compatibility Fix (Illegal instruction)
ENV OPENBLAS_CORETYPE=GENERIC
ENV TOKENIZERS_PARALLELISM=false

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Install system dependencies for PyMuPDF and other libraries
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pre-install dependencies to utilize Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download models during build phase for faster startup
COPY scripts/pre_download_models.py ./scripts/
RUN python scripts/pre_download_models.py

# Copy application source
COPY . .

# Ensure standard docs directory exists
RUN mkdir -p docs

EXPOSE 8000

# Start with production-optimized settings
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]