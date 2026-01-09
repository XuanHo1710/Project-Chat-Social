"""
TRAIN HYBRID MODEL
==================
- Lấy 100 posts từ MongoDB
- Chuẩn hóa dữ liệu
- Train với BGE-M3 (model xịn nhất)
- Tính hybrid score = content + collaborative filtering
- Lưu ChromaDB
"""

import inspect
if not hasattr(inspect, 'formatargspec'):
    def formatargspec(args, varargs=None, varkwargs=None, defaults=None,
                      kwonlyargs=(), kwonlydefaults={}, annotations={},
                      formatvalue=lambda value: '=' + repr(value)):
        specs = []
        if args:
            for i, arg in enumerate(args):
                if defaults and i >= len(args) - len(defaults):
                    specs.append(arg + formatvalue(defaults[i - (len(args) - len(defaults))]))
                else:
                    specs.append(arg)
        if varargs: specs.append('*' + varargs)
        if varkwargs: specs.append('**' + varkwargs)
        return '(' + ', '.join(specs) + ')'
    inspect.formatargspec = formatargspec

import os
import re
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.preprocessing import LabelEncoder
from sklearn.decomposition import TruncatedSVD
from sklearn.metrics.pairwise import cosine_similarity
from scipy.sparse import csr_matrix
from sentence_transformers import SentenceTransformer
from pymongo import MongoClient
import chromadb
from chromadb.config import Settings as ChromaSettings
from loguru import logger
import warnings
warnings.filterwarnings('ignore')

# Config
MODEL_NAME = "BAAI/bge-m3"  # Model xịn nhất
MONGO_URI = "mongodb+srv://xuanhodcbas:0984232310ho.@cluster0.f7sbfkn.mongodb.net/project-chat-social"
DB_NAME = "project-chat-social"
CHROMA_PATH = "./chroma_db"
COLLECTION_NAME = "posts"
LIMIT = 100  # Giới hạn 100 posts để train nhanh

def clean_text(text):
    if not isinstance(text, str): return ""
    text = text.encode('utf-8', errors='ignore').decode('utf-8')
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def train():
    logger.info("=" * 50)
    logger.info("🔥 TRAIN HYBRID MODEL")
    logger.info("=" * 50)
    
    # 1. Lấy dữ liệu từ MongoDB
    logger.info(f"📥 Lấy {LIMIT} posts từ MongoDB...")
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    cursor = db.posts.find(
        {"isDeleted": {"$ne": True}},
        {"_id": 1, "userId": 1, "groupId": 1, "content": 1}
    ).limit(LIMIT)
    
    data = list(cursor)
    client.close()
    logger.info(f"   ✅ Đã lấy {len(data)} posts")
    
    if not data:
        logger.error("❌ Không có dữ liệu!")
        return
    
    # 2. Chuẩn hóa
    logger.info("🔧 Chuẩn hóa dữ liệu...")
    df = pd.DataFrame(data)
    df['_id'] = df['_id'].astype(str)
    df['userId'] = df['userId'].apply(lambda x: str(x) if pd.notna(x) and x else "unknown")
    df['groupId'] = df['groupId'].apply(lambda x: str(x) if pd.notna(x) and x else "no_group") if 'groupId' in df.columns else "no_group"
    df['content'] = df['content'].fillna("").apply(clean_text)
    
    # Lọc content quá ngắn
    df = df[df['content'].str.len() > 0].reset_index(drop=True)
    logger.info(f"   ✅ Còn {len(df)} posts sau khi lọc")
    
    # Label Encoding
    user_encoder = LabelEncoder()
    df['user_enc'] = user_encoder.fit_transform(df['userId'])
    n_users = len(user_encoder.classes_)
    n_posts = len(df)
    
    # 3. Load model và tạo embeddings
    logger.info(f"🧠 Loading model {MODEL_NAME}...")
    logger.info("   (Lần đầu sẽ tải ~2.3GB, chờ 5-10 phút)")
    model = SentenceTransformer(MODEL_NAME)
    logger.info("   ✅ Model loaded!")
    
    logger.info("📊 Generating embeddings...")
    embeddings = model.encode(df['content'].tolist(), show_progress_bar=True, batch_size=8)
    
    # 4. Tính Content Score
    logger.info("🔢 Tính Content Score...")
    mean_emb = embeddings.mean(axis=0)
    content_scores = cosine_similarity(embeddings, mean_emb.reshape(1, -1)).flatten()
    content_scores = (content_scores - content_scores.min()) / (content_scores.max() - content_scores.min() + 1e-8)
    
    # 5. Tính CF Score (Collaborative Filtering)
    logger.info("🤝 Tính CF Score...")
    interaction_matrix = csr_matrix(
        (np.ones(n_posts), (df['user_enc'].values, np.arange(n_posts))),
        shape=(n_users, n_posts)
    )
    
    n_factors = min(20, min(n_users, n_posts) - 1)
    svd = TruncatedSVD(n_components=n_factors, n_iter=10, random_state=42)
    user_factors = svd.fit_transform(interaction_matrix)
    item_factors = svd.components_.T
    
    cf_matrix = np.dot(user_factors, item_factors.T)
    cf_scores = cf_matrix.max(axis=0)
    cf_scores = (cf_scores - cf_scores.min()) / (cf_scores.max() - cf_scores.min() + 1e-8)
    
    # 6. Hybrid Score
    logger.info("🔀 Tính Hybrid Score...")
    hybrid_scores = 0.6 * content_scores + 0.4 * cf_scores
    
    # 7. Lưu ChromaDB
    logger.info("💾 Lưu vào ChromaDB...")
    os.makedirs(CHROMA_PATH, exist_ok=True)
    chroma = chromadb.PersistentClient(path=CHROMA_PATH, settings=ChromaSettings(anonymized_telemetry=False))
    
    try:
        chroma.delete_collection(COLLECTION_NAME)
    except:
        pass
    
    collection = chroma.create_collection(name=COLLECTION_NAME)
    
    ids = df['_id'].tolist()
    documents = df['content'].tolist()
    metadatas = [{
        "user_id": str(df.loc[i, 'userId']),
        "group_id": str(df.loc[i, 'groupId']),
        "score": float(hybrid_scores[i])
    } for i in range(len(df))]
    
    collection.add(
        ids=ids,
        embeddings=embeddings.tolist(),
        documents=documents,
        metadatas=metadatas
    )
    
    logger.info("=" * 50)
    logger.info("🎉 TRAINING HOÀN TẤT!")
    logger.info(f"   📊 Posts: {len(df)}")
    logger.info(f"   💾 ChromaDB: {CHROMA_PATH}/{COLLECTION_NAME}")
    logger.info("   👉 Chạy: python main.py")
    logger.info("=" * 50)

if __name__ == "__main__":
    train()
