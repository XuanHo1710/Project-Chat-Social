FROM python:3.11-slim-bookworm

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .

# Install torch CPU-only (~250MB vs ~915MB GPU wheel)
RUN pip install --no-cache-dir --timeout=120 \
    torch --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
RUN pip install --no-cache-dir --timeout=120 -r requirements.txt

# Pre-download embedding model (~470MB, cached in image layer)
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"

# Copy app code
COPY . .

RUN mkdir -p logs

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
