# 🚀 Hướng Dẫn Deploy Server AI

## 📋 Tổng Quan

Server AI sử dụng:
- **FastAPI** - Web framework
- **ChromaDB** - Vector database (local hoặc cloud)
- **Sentence Transformers** - Embedding model
- **MongoDB** - Database chính (kết nối từ xa)

## ⚠️ Lưu Ý Quan Trọng

> **Server AI yêu cầu GPU hoặc CPU mạnh** để chạy embedding model (~3-4GB RAM).
> Các nền tảng free tier thường **KHÔNG đủ** tài nguyên.

### Yêu Cầu Tối Thiểu:
- RAM: 4GB+
- Storage: 5GB+ (cho model và ChromaDB)
- CPU: 2 cores+

---

## 🆓 Các Nền Tảng Miễn Phí

### 1. **Render** (Khuyến nghị)

#### Ưu điểm:
- ✅ Free tier có 512MB RAM (có thể không đủ)
- ✅ Dễ setup, tự động deploy từ GitHub
- ✅ Hỗ trợ Docker

#### Cách Deploy:

**Bước 1: Tạo `Dockerfile`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download embedding model during build
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-mpnet-base-v2')"

# Copy app code
COPY . .

# Expose port
EXPOSE 8000

# Start server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Bước 2: Tạo `render.yaml`**

```yaml
services:
  - type: web
    name: server-ai
    env: docker
    plan: free # hoặc starter ($7/month) để có đủ RAM
    healthCheckPath: /health
    envVars:
      - key: HOST
        value: 0.0.0.0
      - key: PORT
        value: 8000
      - key: DEBUG
        value: false
      - key: MONGODB_URI
        sync: false # Set trong dashboard
      - key: MONGODB_DATABASE
        value: social_media
      - key: EMBEDDING_PROVIDER
        value: custom
```

**Bước 3: Deploy**
1. Push code lên GitHub
2. Vào [render.com](https://render.com) → New → Web Service
3. Connect GitHub repo
4. Chọn folder `server-ai`
5. Set environment variables trong dashboard
6. Deploy!

---

### 2. **Railway** (Khuyến nghị)

#### Ưu điểm:
- ✅ $5 free credit mỗi tháng
- ✅ Dễ setup, hỗ trợ Docker
- ✅ Tự động scale

#### Cách Deploy:

**Bước 1: Tạo `railway.json`**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 1,
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

**Bước 2: Deploy**
1. Vào [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Chọn repo và folder `server-ai`
4. Add Variables từ `.env.example`
5. Deploy!

---

### 3. **Fly.io**

#### Ưu điểm:
- ✅ Free tier với 3 shared VMs
- ✅ Hỗ trợ persistent storage
- ✅ Tốc độ nhanh

#### Cách Deploy:

**Bước 1: Cài Fly CLI**
```bash
# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

# macOS/Linux
curl -L https://fly.io/install.sh | sh
```

**Bước 2: Tạo `fly.toml`**

```toml
app = "server-ai-your-name"
primary_region = "sin" # Singapore

[build]
  dockerfile = "Dockerfile"

[env]
  HOST = "0.0.0.0"
  PORT = "8000"
  DEBUG = "false"
  EMBEDDING_PROVIDER = "custom"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 1024 # 1GB RAM
```

**Bước 3: Deploy**
```bash
cd server-ai

# Login
fly auth login

# Launch app
fly launch

# Set secrets
fly secrets set MONGODB_URI="mongodb+srv://..."
fly secrets set MONGODB_DATABASE="social_media"

# Deploy
fly deploy
```

---

### 4. **Google Cloud Run** (Free Tier)

#### Ưu điểm:
- ✅ 2 triệu requests miễn phí/tháng
- ✅ Auto-scaling
- ✅ Chỉ trả tiền khi có request

#### Cách Deploy:

**Bước 1: Cài Google Cloud CLI**
```bash
# Download từ: https://cloud.google.com/sdk/docs/install
```

**Bước 2: Build và Push Docker Image**
```bash
cd server-ai

# Login
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID

# Build image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/server-ai

# Deploy
gcloud run deploy server-ai \
  --image gcr.io/YOUR_PROJECT_ID/server-ai \
  --platform managed \
  --region asia-southeast1 \
  --memory 2Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "MONGODB_URI=mongodb+srv://...,MONGODB_DATABASE=social_media"
```

---

### 5. **Hugging Face Spaces** (Khuyến nghị cho AI)

#### Ưu điểm:
- ✅ **MIỄN PHÍ** với 2 vCPU, 16GB RAM!
- ✅ Tối ưu cho AI/ML workloads
- ✅ Hỗ trợ Docker

#### Cách Deploy:

**Bước 1: Tạo Space mới**
1. Vào [huggingface.co/spaces](https://huggingface.co/spaces)
2. Create new Space
3. Chọn **Docker** SDK

**Bước 2: Cập nhật Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download model
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-mpnet-base-v2')"

COPY . .

# HuggingFace Spaces uses port 7860
EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
```

**Bước 3: Tạo `README.md` cho Space**

```markdown
---
title: Server AI Recommendation
emoji: 🤖
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
---
```

**Bước 4: Set Secrets**
- Vào Settings → Repository secrets
- Thêm: `MONGODB_URI`, `MONGODB_DATABASE`

---

## 🔧 Cấu Hình ChromaDB Cloud (Optional)

Nếu muốn dùng ChromaDB cloud thay vì local:

### 1. **Chroma Cloud** (Official)

```env
CHROMA_HOST=api.trychroma.com
CHROMA_PORT=443
CHROMA_SSL=True
CHROMA_API_TOKEN=your_api_token
```

### 2. **Self-hosted ChromaDB**

Deploy ChromaDB riêng trên Railway/Render:

```yaml
# docker-compose.yml
services:
  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - chroma_data:/chroma/chroma
    environment:
      - CHROMA_SERVER_AUTH_CREDENTIALS=your_token
      - CHROMA_SERVER_AUTH_PROVIDER=chromadb.auth.token.TokenAuthServerProvider
```

---

## 📊 So Sánh Các Nền Tảng

| Nền tảng | RAM | Storage | Giá | Ghi chú |
|----------|-----|---------|-----|---------|
| **Render Free** | 512MB | 0.5GB | Free | ❌ Không đủ cho AI model |
| **Render Starter** | 2GB | 10GB | $7/mo | ✅ Đủ dùng |
| **Railway** | 8GB | 1GB | $5 free | ✅ Khuyến nghị |
| **Fly.io** | 1GB | 3GB | Free | ⚠️ Cần upgrade |
| **Cloud Run** | 2GB+ | - | Pay-per-use | ✅ Tốt cho traffic thấp |
| **HuggingFace** | 16GB | 50GB | **FREE** | ⭐ **BEST cho AI** |

---

## 🚀 Quick Deploy Commands

### Hugging Face (Khuyến nghị):
```bash
# Clone Space
git clone https://huggingface.co/spaces/YOUR_USERNAME/server-ai

# Copy files
cp -r server-ai/* ./

# Push
git add .
git commit -m "Deploy server-ai"
git push
```

### Railway:
```bash
# Install CLI
npm install -g @railway/cli

# Login & Deploy
railway login
cd server-ai
railway init
railway up
```

### Render:
```bash
# Just push to GitHub, Render will auto-deploy
git push origin main
```

---

## ⚙️ Environment Variables Cần Set

```env
# Required
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net
MONGODB_DATABASE=social_media

# Server
HOST=0.0.0.0
PORT=8000
DEBUG=false

# AI Model
EMBEDDING_PROVIDER=custom
CUSTOM_MODEL_PATH=./models/custom-social-embedding

# ChromaDB (nếu dùng cloud)
CHROMA_HOST=
CHROMA_PORT=8000
CHROMA_SSL=false
CHROMA_API_TOKEN=
```

---

## 🔄 Quy Trình Train & Deploy

### Bước 1: Train Model (Local)
```bash
cd server-ai
python train.py
```

### Bước 2: Upload Model (nếu dùng custom)
- Upload folder `models/` và `chroma_db/` lên cloud storage
- Hoặc include trong Docker image

### Bước 3: Deploy
- Push code lên GitHub
- Platform sẽ tự động build và deploy

---

## 🆘 Troubleshooting

### Lỗi Out of Memory:
- Upgrade plan để có thêm RAM
- Hoặc dùng smaller model: `all-MiniLM-L6-v2`

### Lỗi Connection MongoDB:
- Kiểm tra whitelist IP (0.0.0.0/0)
- Kiểm tra connection string

### Lỗi ChromaDB:
- Đảm bảo đã train trước khi deploy
- Hoặc dùng ChromaDB cloud

---

## 📞 Liên Hệ

Nếu gặp vấn đề, tạo issue trên GitHub repo.

**Happy Deploying! 🎉**
