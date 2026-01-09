# Tích hợp AI Recommendation

## Cấu trúc

```
server-ai/
├── train.py           # Script train model
├── main.py            # FastAPI server
└── app/
    ├── routes/api.py  # 3 API endpoints
    └── services/
        └── recommendation_service.py

backend/
└── src/recommendation/
    ├── recommendation.module.ts
    ├── recommendation.controller.ts
    ├── recommendation.service.ts
    └── types.ts

frontend/
└── src/app/(client)/search/page.tsx  # Trang tìm kiếm
```

## Cách chạy

### 1. Train AI Model
```bash
cd server-ai
python train.py
```

### 2. Chạy AI Server
```bash
python main.py
# Server: http://localhost:8000
```

### 3. Chạy Backend
```bash
cd backend
npm run start:dev
# Server: http://localhost:3001
```

### 4. Chạy Frontend
```bash
cd frontend
npm run dev
# Server: http://localhost:3000
```

## API Endpoints

### AI Server (port 8000)
- `GET /api/v1/search?q={query}` - Tìm kiếm
- `GET /api/v1/recommend/{userId}` - Gợi ý
- `GET /api/v1/similar/{postId}` - Tương tự

### Backend (port 3001)
- `GET /recommendation/search?q={query}` - Proxy search
- `GET /recommendation/recommend/{userId}` - Proxy recommend
- `GET /recommendation/similar/{postId}` - Proxy similar
- `GET /recommendation/status` - Check AI server

## Flow

```
Frontend → Backend → AI Server → ChromaDB → Response -> Custom Response on Backend -> Response to Frontend 
```

1. User nhập query ở Header
2. Redirect đến /search?q={query}
3. Frontend gọi Backend API
4. Backend proxy đến AI Server
5. AI Server query ChromaDB
6. Trả về posts sorted by score
