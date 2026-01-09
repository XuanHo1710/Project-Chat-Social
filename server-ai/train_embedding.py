"""
Script Trainer V2 (Standalone): Fine-tune Embedding Model XỊN (Unsupervised TSDAE)
Model: BAAI/bge-m3 (Cực mạnh đa ngôn ngữ, hỗ trợ tiếng Việt tốt)
Phương pháp: TSDAE (Transformer-based Denoising AutoEncoder)
"""

import os
import sys
from sentence_transformers import SentenceTransformer, models, datasets, losses
from torch.utils.data import DataLoader
from loguru import logger
from pymongo import MongoClient

# Cấu hình Model Xịn
BASE_MODEL_NAME = "BAAI/bge-m3" 
OUTPUT_PATH = "./models/custom-social-embedding-bge-m3"
BATCH_SIZE = 4
EPOCHS = 1 

# MongoDB Config (Hardcode cho chắc ăn khi chạy standalone)
MONGO_URI = "mongodb+srv://xuanhodcbas:0984232310ho.@cluster0.f7sbfkn.mongodb.net/project-chat-social"
DB_NAME = "project-chat-social"

def train_unsupervised():
    logger.info("🔌 Kết nối MongoDB...")
    try:
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        posts_collection = db["posts"]
        
        # Check connection
        client.admin.command('ping')
        logger.info("✅ MongoDB Connected!")
    except Exception as e:
        logger.error(f"❌ Lỗi kết nối MongoDB: {e}")
        return

    # Lấy dữ liệu
    logger.info("📥 Đang tải posts...")
    posts = list(posts_collection.find({"isDeleted": {"$ne": True}}).limit(10000))
    
    # Chỉ lấy content sạch
    train_sentences = []
    for p in posts:
        content = p.get("content", "").strip()
        if content and len(content) > 10: 
            train_sentences.append(content)
            
    logger.info(f"📚 Đã tải {len(train_sentences)} đoạn văn bản sạch để train")
    
    if len(train_sentences) < 10:
        logger.error("❌ Quá ít dữ liệu để train (cần > 10 bài)")
        return

    # 2. Định nghĩa Model
    logger.info(f"⬇️ Loading base model xịn: {BASE_MODEL_NAME} (có thể lâu nếu tải lần đầu)...")
    try:
        word_embedding_model = models.Transformer(BASE_MODEL_NAME)
        pooling_model = models.Pooling(word_embedding_model.get_word_embedding_dimension(), 'cls')
        model = SentenceTransformer(modules=[word_embedding_model, pooling_model])
    except Exception as e:
        logger.error(f"❌ Lỗi tải model: {e}")
        return

    # 3. Tạo Dataset TSDAE
    train_dataset = datasets.DenoisingAutoEncoderDataset(train_sentences)
    train_dataloader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    
    # 4. Loss
    train_loss = losses.DenoisingAutoEncoderLoss(model, decoder_name_or_path=BASE_MODEL_NAME, tie_encoder_decoder=True)

    # 5. Training
    logger.info(f"🚀 Bắt đầu Training Unsupervised với {len(train_sentences)} mẫu...")
    model.fit(
        train_objectives=[(train_dataloader, train_loss)],
        epochs=EPOCHS,
        weight_decay=0,
        scheduler='constantlr',
        optimizer_params={'lr': 3e-5},
        show_progress_bar=True
    )

    # 6. Save
    os.makedirs(OUTPUT_PATH, exist_ok=True)
    model.save(OUTPUT_PATH)
    logger.info(f"🎉 Training XỊN hoàn tất! Model lưu tại: {OUTPUT_PATH}")

if __name__ == "__main__":
    train_unsupervised()
