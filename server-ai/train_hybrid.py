"""
HYBRID TRAINING PIPELINE
1. Extract: MongoDB (Atlas)
2. Transform: Pandas Cleaning & Normalization
3. Train: BAAI/bge-m3 (SOTA Model) via TSDAE
4. Output: Fine-tuned Model for ChromaDB
"""

# ==========================================
# FIX LỖI PYTHON 3.13 (inspect.formatargspec)
# ==========================================
import inspect
if not hasattr(inspect, 'formatargspec'):
    def formatargspec(args, varargs=None, varkwargs=None, defaults=None,
                      kwonlyargs=(), kwonlydefaults={}, annotations={},
                      formatvalue=lambda value: '=' + repr(value)):
        if args:
            specs = []
            for i, arg in enumerate(args):
                if defaults and i >= len(args) - len(defaults):
                    default = defaults[i - (len(args) - len(defaults))]
                    specs.append(arg + formatvalue(default))
                else:
                    specs.append(arg)
            if varargs:
                specs.append('*' + varargs)
            if kwonlyargs:
                specs.append('*')
                for arg in kwonlyargs:
                    if kwonlydefaults and arg in kwonlydefaults:
                        specs.append(arg + formatvalue(kwonlydefaults[arg]))
                    else:
                        specs.append(arg)
            if varkwargs:
                specs.append('**' + varkwargs)
            return '(' + ', '.join(specs) + ')'
        return '()'
    inspect.formatargspec = formatargspec
# ==========================================

import os
import pandas as pd
import numpy as np
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer, models, datasets, losses
from torch.utils.data import DataLoader
from loguru import logger
import torch
import re
import nltk # Thêm NLTK

# Cấu hình "Hàng Tuyển"
MODEL_NAME = "BAAI/bge-m3"  # Model xịn 2.3GB
OUTPUT_PATH = "./models/social-hybrid-model-v1"
# MongoDB Atlas Config
MONGO_URI = "mongodb+srv://xuanhodcbas:0984232310ho.@cluster0.f7sbfkn.mongodb.net/project-chat-social"
DB_NAME = "project-chat-social"

BATCH_SIZE = 4 
EPOCHS = 1 

def clean_text(text):
    """Chuẩn hóa dữ liệu text"""
    if not isinstance(text, str):
        return ""
    text = text.encode('utf-8', errors='ignore').decode('utf-8')
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def download_nltk_resources():
    """Tải resource NLTK nếu chưa có"""
    logger.info("📦 Checking NLTK resources...")
    try:
        nltk.data.find('tokenizers/punkt')
        nltk.data.find('tokenizers/punkt_tab')
    except LookupError:
        logger.info("⬇️ Downloading NLTK 'punkt' data for TSDAE...")
        nltk.download('punkt')
        nltk.download('punkt_tab')
        logger.info("✅ NLTK data downloaded!")

def run_pipeline():
    download_nltk_resources() # Gọi hàm check resource
    
    logger.info("🚀 KICKOFF PIPELINE - HYBRID TRAINING")
    
    # --- PHASE 1: EXTRACT ---
    logger.info("Step 1: Extracting data from MongoDB...")
    try:
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        cursor = db.posts.find(
            {"isDeleted": {"$ne": True}}, 
            {"_id": 1, "userId": 1, "groupId": 1, "content": 1}
        )
        raw_data = list(cursor)
        logger.info(f"   -> Raw count: {len(raw_data)}")
        
        if not raw_data:
            logger.error("❌ No data found!")
            return
            
    except Exception as e:
        logger.error(f"❌ DB Error: {e}")
        return

    # --- PHASE 2: TRANSFORM ---
    logger.info("Step 2: Cleaning & Normalizing Data...")
    
    df = pd.DataFrame(raw_data)
    
    df['_id'] = df['_id'].astype(str)
    # Xử lý an toàn cho trường userId
    df['userId'] = df['userId'].apply(lambda x: str(x) if x else "")
    
    # groupId có thể null
    if 'groupId' in df.columns:
        df['groupId'] = df['groupId'].apply(lambda x: str(x) if x else "")
    
    df['content'] = df['content'].fillna("")
    df['clean_content'] = df['content'].apply(clean_text)
    
    # Lọc bài quá ngắn
    mask = df['clean_content'].str.len() > 10
    df_clean = df.loc[mask].copy()
    
    logger.info(f"   -> Clean count: {len(df_clean)} (Removed {len(df) - len(df_clean)} junk rows)")
    
    # --- PHASE 3: TRAIN (HYBRID/DENSE) ---
    logger.info(f"Step 3: Training Model {MODEL_NAME}...")
    
    try:
        word_embedding_model = models.Transformer(MODEL_NAME)
        pooling_model = models.Pooling(word_embedding_model.get_word_embedding_dimension(), 'cls')
        model = SentenceTransformer(modules=[word_embedding_model, pooling_model])
        
        # Lấy list text đúng cách
        train_sentences = df_clean['clean_content'].tolist()
        
        if not train_sentences:
            logger.error("❌ No valid sentences to train!")
            return

        # TSDAE
        train_dataset = datasets.DenoisingAutoEncoderDataset(train_sentences)
        train_dataloader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
        
        train_loss = losses.DenoisingAutoEncoderLoss(model, decoder_name_or_path=MODEL_NAME, tie_encoder_decoder=True)
        
        logger.info("   -> Start Fitting (Đây là bước lâu nhất)...")
        model.fit(
            train_objectives=[(train_dataloader, train_loss)],
            epochs=EPOCHS,
            weight_decay=0,
            scheduler='constantlr',
            optimizer_params={'lr': 3e-5},
            show_progress_bar=True
        )
        
        # --- PHASE 4: OUTPUT ---
        logger.info("Step 4: Saving Fine-tuned Model...")
        os.makedirs(OUTPUT_PATH, exist_ok=True)
        model.save(OUTPUT_PATH)
        
        logger.info(f"✅ DONE! Hybrid Model saved at: {os.path.abspath(OUTPUT_PATH)}")
        logger.info("👉 Bạn có thể chạy server chính ngay bây giờ: python main.py")
        
    except Exception as e:
        logger.error(f"❌ Training Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_pipeline()
