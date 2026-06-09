# Hướng dẫn Setup & Tích hợp AI Server

## 1. Cài đặt Môi trường (Local)

### Bước 1: Cấu hình Groq API
- Tạo hoặc cập nhật file `server-ai/.env`:
  ```env
  GROQ_API_KEY=your_groq_api_key
  GROQ_MODEL=llama-3.1-8b-instant
  LLM_BASE_URL=https://api.groq.com/openai
  LLM_MODEL=llama-3.1-8b-instant
  ```

### Bước 2: Chạy AI Server
```bash
cd server-ai

# Tạo môi trường ảo
python -m venv venv
.\venv\Scripts\activate

# Cài thư viện
pip install -r requirements.txt

# Copy file .env
copy .env.example .env

# Chạy Server
python main.py
```
Server sẽ chạy tại `http://localhost:8000`.

## 2. Sync Dữ liệu (Quan trọng!)

Để Search & Recommendation hoạt động, dữ liệu từ MongoDB cần được "index" sang Vector DB (ChromaDB).
- **Lần đầu**: Chạy lệnh Sync thủ công.
  ```bash
  curl -X POST http://localhost:8000/api/v1/sync
  ```
- **Tự động**: Server có thể cấu hình chạy nền, hoặc Backend gọi API này định kỳ.

## 3. Tích hợp vào Backend (NestJS)

Mô hình luồng dữ liệu:

### A. Khi tạo Post mới (Real-time Indexing)
Trong `PostService.createPost`:
```typescript
async createPost(createPostDto: CreatePostDto) {
  // 1. Lưu vào MongoDB
  const post = await this.postModel.create(createPostDto);
  
  // 2. Gọi AI Server để index (Fire & Forget hoặc Queue)
  axios.post('http://localhost:8000/api/v1/posts/analyze', {
    _id: post._id,
    content: post.content
    // ...
  }).catch(err => console.error("AI Index Error", err));

  return post;
}
```
*Lưu ý: Để tối ưu, nên dùng Message Queue (RabbitMQ/Kafka/Redis) để đẩy job sang AI Server xử lý async.*

### B. Chức năng Search
Trong `PostController.search`:
```typescript
@Get('search')
async search(@Query('q') query: string) {
  // Gọi AI Server Search
  const aiResults = await axios.post('http://localhost:8000/api/v1/search', {
     query: query,
     limit: 20
  });
  
  // Trả về kết quả (AI server đã trả về object post đầy đủ từ MongoDB)
  return aiResults.data;
}
```

### C. Chức năng Suggest Hashtag
Khi user đang gõ content:
```typescript
@Post('suggest-hashtags')
async suggestHashtags(@Body() body: { content: string }) {
  const result = await axios.post('http://localhost:8000/api/v1/hashtags/suggest', {
    content: body.content
  });
  return result.data;
}
```

## 4. ChromaDB

- Không cần cài đặt gì thêm.
- Dữ liệu vector được lưu tại thư mục `server-ai/chroma_db`.
- Nếu muốn reset dữ liệu vector: Xóa thư mục `chroma_db` và chạy lại API Sync.
