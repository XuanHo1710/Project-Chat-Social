# Social Media AI Server v2.0

Local AI Server using **Ollama** + **ChromaDB Vector Database**

## 🌟 Key Features

| Feature | Description |
|---------|-------------|
| 🔍 **Semantic Search** | Find posts by meaning using vector embeddings |
| 🎯 **Personalized Recommendations** | Based on REAL user interaction history |
| #️⃣ **Hashtag Suggestions** | Only from REAL database hashtags |
| 📊 **Post Analysis** | Sentiment, topics using local LLM |

## ⚠️ Important: REAL DATA ONLY!

This server uses **REAL data from your MongoDB database**.
- No fake data
- No hardcoded values
- Hashtag suggestions come from existing hashtags in database
- Recommendations based on actual user interactions

## 🛠️ Tech Stack

- **Ollama** - Local LLM (llama3.2 + nomic-embed-text)
- **ChromaDB** - Vector database for embeddings
- **FastAPI** - Web framework
- **MongoDB** - Source of truth for all data

## 📦 Installation

### 1. Install Ollama

Download from: https://ollama.ai/

```bash
# After installing, pull required models:
ollama pull llama3.2
ollama pull nomic-embed-text
```

### 2. Setup Python Environment

```bash
cd server-ai

# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your MongoDB connection
```

### 4. Run the Server

```bash
python main.py
```

Server runs at: http://localhost:8000
API Docs: http://localhost:8000/docs

## 📡 API Endpoints

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/search` | Semantic search posts |
| GET | `/api/v1/search?q=query` | Search (GET version) |
| POST | `/api/v1/search/expanded` | Search with LLM query expansion |

### Recommendations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/recommendations` | Get personalized recommendations |
| GET | `/api/v1/recommendations/{user_id}` | Get user recommendations |
| GET | `/api/v1/similar/{post_id}` | Find similar posts |

### Hashtags

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/hashtags/suggest` | Suggest hashtags (from REAL DB) |
| GET | `/api/v1/hashtags/trending` | Get trending hashtags |
| GET | `/api/v1/hashtags/search?q=query` | Search hashtags |

### Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/analyze` | Analyze post with LLM |

### Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sync` | Sync MongoDB → Vector DB |
| GET | `/api/v1/sync/status` | Get sync status |

## 🔄 How It Works

### 1. Data Sync (MongoDB → Vector DB)

```
MongoDB Posts → Ollama Embeddings → ChromaDB
```

Call `POST /api/v1/sync` to index your posts into the vector database.

### 2. Semantic Search

```
User Query → Ollama Embedding → ChromaDB Search → Similar Posts
```

### 3. Recommendations

```
User History (Likes/Comments) → Interest Profile → Vector Search → Personalized Feed
```

### 4. Hashtag Suggestions

```
Post Content → Similar Hashtags Search → Return ONLY existing hashtags
```

## 💡 Usage Examples

### Search Posts

```bash
curl -X POST http://localhost:8000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{"query": "phim hay cuối tuần", "limit": 10}'
```

### Get Recommendations

```bash
curl http://localhost:8000/api/v1/recommendations/USER_ID_HERE?limit=20
```

### Suggest Hashtags

```bash
curl -X POST http://localhost:8000/api/v1/hashtags/suggest \
  -H "Content-Type: application/json" \
  -d '{"content": "Đi xem phim cuối tuần", "limit": 5}'
```

### Sync Database

```bash
curl -X POST http://localhost:8000/api/v1/sync
```

## 📁 Project Structure

```
server-ai/
├── main.py                      # FastAPI entry point
├── requirements.txt             # Python dependencies
├── .env.example                 # Environment template
├── chroma_db/                   # Vector database (auto-created)
├── logs/                        # Log files
└── app/
    ├── config.py                # Settings
    ├── models/
    │   └── schemas.py           # Pydantic models
    ├── services/
    │   ├── mongodb_service.py   # MongoDB operations
    │   ├── ollama_service.py    # Ollama LLM
    │   ├── vector_db.py         # ChromaDB operations
    │   └── search_service.py    # Search & recommendations
    └── routes/
        └── api.py               # API endpoints
```

## 🔧 Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017` |
| `MONGODB_DATABASE` | Database name | `social_media` |
| `OLLAMA_HOST` | Ollama API URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | LLM model | `llama3.2` |
| `OLLAMA_EMBEDDING_MODEL` | Embedding model | `nomic-embed-text` |
| `SEARCH_TOP_K` | Max search results | `20` |

## 🔒 Security Notes

- Ollama runs locally - no data sent to cloud
- All data stays in your MongoDB
- Configure CORS for production

## 📝 License

MIT
