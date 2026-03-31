"""
TRAIN HYBRID MODEL → QDRANT CLOUD
===================================
- Lấy posts + reactions + shares + relationships + userinteractions từ MongoDB
- Chunk posts bằng sliding window (overlap) cho RAG chuyên nghiệp
- Embed bằng intfloat/multilingual-e5-base (768-dim, fast, high quality)
- Upload vectors lên Qdrant Cloud
- Tính user vectors và lưu vào MongoDB
- Tạo query_vectors collection cho RAG query embedding

Chạy: python train.py
"""

import os
import re
import uuid
import hashlib
import numpy as np
import pandas as pd
from datetime import datetime
from collections import defaultdict
from sklearn.preprocessing import LabelEncoder
from sklearn.decomposition import TruncatedSVD
from sklearn.metrics.pairwise import cosine_similarity
from scipy.sparse import csr_matrix
from sentence_transformers import SentenceTransformer
from pymongo import MongoClient
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, UpdateStatus
from loguru import logger
from dotenv import load_dotenv
import warnings
warnings.filterwarnings('ignore')

load_dotenv()

# Config from .env (centralized)
from app.config import get_settings
_settings = get_settings()

MODEL_NAME = _settings.embedding_model
MONGO_URI = _settings.mongodb_uri
DB_NAME = _settings.mongodb_database
QDRANT_URL = _settings.qdrant_url
QDRANT_API_KEY = _settings.qdrant_api_key
COLLECTION_NAME = _settings.qdrant_collection_posts
USER_COLLECTION = _settings.qdrant_collection_users
QUERY_COLLECTION = _settings.qdrant_collection_queries
CHUNK_MAX_SIZE = _settings.chunk_max_size
CHUNK_OVERLAP = _settings.chunk_overlap
LIMIT = 100000

# Weights
REACTION_WEIGHTS = {
    "LIKE": 1.0, "LOVE": 1.5, "HAHA": 0.8,
    "WOW": 0.7, "SAD": 0.3, "ANGRY": -0.5
}
SHARE_WEIGHT = 2.0
FRIEND_INTERACTION_BOOST = 1.3

# Kafka UserInteraction weights (from userinteractions collection)
UI_WEIGHTS = {
    "POST_VIEW": 0.3,
    "POST_LIKE": 1.0,
    "POST_UNLIKE": -0.5,
    "POST_COMMENT": 1.5,
    "POST_SHARE": 2.5,
    "POST_SAVE": 2.0,
    "POST_UNSAVE": -0.3,
    "POST_HIDE": -2.0,
    "REEL_VIEW": 0.3,
    "REEL_LIKE": 1.0,
}


def mongo_id_to_uuid(mongo_id: str) -> str:
    """Convert MongoDB ObjectID string to deterministic UUID for Qdrant."""
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, mongo_id))


def clean_text(text):
    if not isinstance(text, str): return ""
    text = text.encode('utf-8', errors='ignore').decode('utf-8')
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def normalize_privacy(privacy):
    if not privacy: return "PUBLIC"
    privacy = str(privacy).upper()
    return privacy if privacy in ["PUBLIC", "FRIEND", "PRIVATE", "GROUP"] else "PUBLIC"


def build_friend_graph(relationships_df):
    friend_graph = defaultdict(set)
    for _, rel in relationships_df.iterrows():
        user_id = str(rel['userId'])
        friend_id = str(rel['friendId'])
        friend_graph[user_id].add(friend_id)
        friend_graph[friend_id].add(user_id)
    return dict(friend_graph)


def build_user_vectors(reactions_df, shares_df, ui_df, post_embeddings_dict, post_owners_dict, friend_graph, embedding_dim):
    user_interactions = defaultdict(list)
    
    if not reactions_df.empty:
        for _, reaction in reactions_df.iterrows():
            user_id = str(reaction['userId'])
            post_id = str(reaction['factorId'])
            reaction_type = reaction.get('type', 'LIKE')
            if post_id in post_embeddings_dict:
                weight = REACTION_WEIGHTS.get(reaction_type, 0.5)
                post_owner = post_owners_dict.get(post_id)
                if post_owner and user_id in friend_graph and post_owner in friend_graph[user_id]:
                    weight *= FRIEND_INTERACTION_BOOST
                user_interactions[user_id].append((post_id, weight))
    
    if not shares_df.empty:
        for _, share in shares_df.iterrows():
            user_id = str(share['userId'])
            shared_post_id = str(share['sharedPostId'])
            if shared_post_id in post_embeddings_dict:
                weight = SHARE_WEIGHT
                post_owner = post_owners_dict.get(shared_post_id)
                if post_owner and user_id in friend_graph and post_owner in friend_graph[user_id]:
                    weight *= FRIEND_INTERACTION_BOOST
                user_interactions[user_id].append((shared_post_id, weight))
    
    # userinteractions from Kafka (POST_VIEW, POST_LIKE, POST_SAVE, POST_HIDE, etc.)
    if not ui_df.empty:
        post_interactions = ui_df[ui_df['targetType'].isin(['POST', 'REEL'])]
        for _, row in post_interactions.iterrows():
            user_id = str(row['userId'])
            target_id = str(row['targetId'])
            itype = row.get('interactionType', '')
            if target_id in post_embeddings_dict and itype in UI_WEIGHTS:
                weight = UI_WEIGHTS[itype]
                post_owner = post_owners_dict.get(target_id)
                if post_owner and user_id in friend_graph and post_owner in friend_graph[user_id]:
                    weight *= FRIEND_INTERACTION_BOOST
                user_interactions[user_id].append((target_id, weight))
    
    user_vectors = {}
    for user_id, interactions in user_interactions.items():
        if not interactions: continue
        weighted_embeddings = []
        total_weight = 0
        for post_id, weight in interactions:
            if post_id in post_embeddings_dict:
                weighted_embeddings.append(post_embeddings_dict[post_id] * weight)
                total_weight += abs(weight)
        if weighted_embeddings and total_weight > 0:
            user_vector = np.sum(weighted_embeddings, axis=0) / total_weight
            norm = np.linalg.norm(user_vector)
            if norm > 0: user_vector = user_vector / norm
            user_vectors[user_id] = user_vector
    
    return user_vectors


def train():
    logger.info("=" * 50)
    logger.info("🔥 TRAIN → QDRANT CLOUD (Lightweight Model)")
    logger.info(f"   Model: {MODEL_NAME}")
    logger.info(f"   Qdrant: {QDRANT_URL}")
    logger.info("=" * 50)
    
    # 1. Connect to Qdrant
    logger.info("🔌 Connecting to Qdrant Cloud...")
    qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=120)
    logger.info("   ✅ Connected!")
    
    # 2. Fetch data from MongoDB
    logger.info(f"📥 Lấy posts từ MongoDB...")
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    data = list(db.posts.find(
        {"isDeleted": {"$ne": True}},
        {"_id": 1, "userId": 1, "groupId": 1, "content": 1, "privacy": 1, "sharedPostId": 1, "createdAt": 1}
    ))
    logger.info(f"   ✅ {len(data)} posts")
    
    reactions_data = list(db.reactions.find(
        {"factorId": {"$in": [doc['_id'] for doc in data]}, "typeFactor": "POST"},
        {"_id": 1, "factorId": 1, "userId": 1, "type": 1}
    ))
    logger.info(f"   ✅ {len(reactions_data)} reactions")
    
    shares_data = list(db.posts.find(
        {"sharedPostId": {"$ne": None}, "isDeleted": {"$ne": True}},
        {"_id": 1, "userId": 1, "sharedPostId": 1}
    ))
    logger.info(f"   ✅ {len(shares_data)} shares")
    
    relationships_data = list(db.relationships.find(
        {"status": "ACCEPTED"}, {"_id": 1, "userId": 1, "friendId": 1}
    ))
    logger.info(f"   ✅ {len(relationships_data)} relationships")
    
    # UserInteractions from Kafka (POST_VIEW, POST_LIKE, POST_SAVE, etc.)
    ui_data = list(db.userinteractions.find(
        {"targetType": {"$in": ["POST", "REEL"]}},
        {"_id": 1, "userId": 1, "targetId": 1, "interactionType": 1, "targetType": 1}
    ))
    logger.info(f"   ✅ {len(ui_data)} userinteractions (Kafka)")
    
    all_accounts = list(db.accounts.find({}, {"_id": 1}))
    all_user_ids = [str(acc['_id']) for acc in all_accounts]
    logger.info(f"   ✅ {len(all_user_ids)} accounts")
    
    client.close()
    
    if not data:
        logger.error("❌ Không có dữ liệu!")
        return
    
    # 3. Chuẩn hóa
    logger.info("🔧 Chuẩn hóa dữ liệu...")
    df = pd.DataFrame(data)
    df['_id'] = df['_id'].astype(str)
    df['userId'] = df['userId'].apply(lambda x: str(x) if pd.notna(x) and x else "unknown")
    df['groupId'] = df['groupId'].apply(lambda x: str(x) if pd.notna(x) and x else "no_group") if 'groupId' in df.columns else "no_group"
    df['content'] = df['content'].fillna("").apply(clean_text)
    df['privacy'] = df['privacy'].apply(normalize_privacy) if 'privacy' in df.columns else "PUBLIC"
    df['createdAt'] = df['createdAt'].apply(lambda x: x.isoformat() if pd.notna(x) and hasattr(x, 'isoformat') else "") if 'createdAt' in df.columns else ""
    
    df = df[df['content'].str.len() > 0].reset_index(drop=True)
    logger.info(f"   ✅ {len(df)} posts sau khi lọc")
    
    # Process reactions, shares, relationships
    reactions_df = pd.DataFrame(reactions_data) if reactions_data else pd.DataFrame()
    if not reactions_df.empty:
        reactions_df['_id'] = reactions_df['_id'].astype(str)
        reactions_df['factorId'] = reactions_df['factorId'].astype(str)
        reactions_df['userId'] = reactions_df['userId'].astype(str)
        reactions_df['type'] = reactions_df['type'].fillna("LIKE")
    
    shares_df = pd.DataFrame(shares_data) if shares_data else pd.DataFrame()
    if not shares_df.empty:
        shares_df['_id'] = shares_df['_id'].astype(str)
        shares_df['userId'] = shares_df['userId'].astype(str)
        shares_df['sharedPostId'] = shares_df['sharedPostId'].astype(str)
    
    relationships_df = pd.DataFrame(relationships_data) if relationships_data else pd.DataFrame()
    friend_graph = {}
    if not relationships_df.empty:
        relationships_df['userId'] = relationships_df['userId'].astype(str)
        relationships_df['friendId'] = relationships_df['friendId'].astype(str)
        friend_graph = build_friend_graph(relationships_df)
        logger.info(f"   ✅ Friend graph: {len(friend_graph)} users")
    
    # Process userinteractions
    ui_df = pd.DataFrame(ui_data) if ui_data else pd.DataFrame()
    if not ui_df.empty:
        ui_df['_id'] = ui_df['_id'].astype(str)
        ui_df['userId'] = ui_df['userId'].astype(str)
        ui_df['targetId'] = ui_df['targetId'].astype(str)
        ui_df['interactionType'] = ui_df['interactionType'].fillna("")
        ui_df['targetType'] = ui_df['targetType'].fillna("")
    
    post_owners_dict = {df.loc[i, '_id']: df.loc[i, 'userId'] for i in range(len(df))}
    
    # 4. Load model & chunk posts & generate embeddings
    logger.info(f"🧠 Loading model {MODEL_NAME}...")
    model = SentenceTransformer(MODEL_NAME)
    embedding_dim = model.get_sentence_embedding_dimension()
    logger.info(f"   ✅ Model loaded! Dimension: {embedding_dim}")
    
    # Chunk posts using professional sliding window strategy
    from app.services.chunking_service import chunk_text
    logger.info(f"✂️ Chunking posts (max_size={CHUNK_MAX_SIZE}, overlap={CHUNK_OVERLAP})...")
    
    # Build chunk data: each chunk links to its parent post
    chunk_records = []  # (chunk_text, post_idx, chunk_idx, total_chunks)
    for i in range(len(df)):
        content = df.loc[i, 'content']
        chunks = chunk_text(content, max_chunk_size=CHUNK_MAX_SIZE, chunk_overlap=CHUNK_OVERLAP)
        for ci, ct in enumerate(chunks):
            chunk_records.append((ct, i, ci, len(chunks)))
    
    logger.info(f"   ✅ {len(chunk_records)} chunks from {len(df)} posts (avg {len(chunk_records)/len(df):.1f} chunks/post)")
    
    # E5 models require "passage: " prefix for documents
    is_e5_model = "e5" in MODEL_NAME.lower()
    chunk_texts = [f"passage: {cr[0]}" if is_e5_model else cr[0] for cr in chunk_records]
    
    logger.info("📊 Generating embeddings...")
    embeddings = model.encode(chunk_texts, show_progress_bar=True, batch_size=64, normalize_embeddings=True)
    
    # Build post-level embeddings by averaging chunk embeddings per post
    post_embeddings = {}
    for idx, (_, post_idx, _, _) in enumerate(chunk_records):
        post_id = df.loc[post_idx, '_id']
        if post_id not in post_embeddings:
            post_embeddings[post_id] = []
        post_embeddings[post_id].append(embeddings[idx])
    
    # Average chunk embeddings per post for user vector building
    post_embeddings_dict = {}
    for pid, embs in post_embeddings.items():
        avg_emb = np.mean(embs, axis=0)
        norm = np.linalg.norm(avg_emb)
        if norm > 0:
            avg_emb = avg_emb / norm
        post_embeddings_dict[pid] = avg_emb
    
    # 5. Hybrid scores (per post, using averaged post embeddings)
    logger.info("🔢 Tính scores...")
    post_emb_array = np.array([post_embeddings_dict[df.loc[i, '_id']] for i in range(len(df))])
    mean_emb = post_emb_array.mean(axis=0)
    content_scores = cosine_similarity(post_emb_array, mean_emb.reshape(1, -1)).flatten()
    content_scores = (content_scores - content_scores.min()) / (content_scores.max() - content_scores.min() + 1e-8)
    
    n_users = df['userId'].nunique()
    n_posts = len(df)
    user_encoder = LabelEncoder()
    df['user_enc'] = user_encoder.fit_transform(df['userId'])
    
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
    
    hybrid_scores = 0.6 * content_scores + 0.4 * cf_scores
    
    # 6. Build user vectors
    logger.info("👤 Building User Vectors...")
    user_vectors = build_user_vectors(
        reactions_df, shares_df, ui_df, post_embeddings_dict, 
        post_owners_dict, friend_graph, embedding_dim
    )
    logger.info(f"   ✅ {len(user_vectors)} user vectors from interactions")
    
    # Default vectors for users without interactions
    mean_embedding = embeddings.mean(axis=0)
    users_without = 0
    for user_id in all_user_ids:
        if user_id not in user_vectors:
            user_hash = int(hashlib.md5(user_id.encode()).hexdigest(), 16)
            np.random.seed(user_hash % (2**32))
            noise = np.random.uniform(-0.05, 0.05, embedding_dim)
            user_vector = mean_embedding + noise
            norm = np.linalg.norm(user_vector)
            if norm > 0: user_vector = user_vector / norm
            user_vectors[user_id] = user_vector
            users_without += 1
    np.random.seed(None)
    logger.info(f"   ✅ {users_without} default vectors created")
    
    # 7. Upload to Qdrant Cloud (chunk-level vectors for better RAG retrieval)
    logger.info("☁️ Uploading chunk vectors to Qdrant Cloud...")
    
    # Recreate collection
    try:
        qdrant.delete_collection(COLLECTION_NAME)
        logger.info(f"   🗑️ Old collection '{COLLECTION_NAME}' deleted")
    except: pass
    
    qdrant.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=embedding_dim, distance=Distance.COSINE)
    )
    logger.info(f"   ✅ Collection '{COLLECTION_NAME}' created (dim={embedding_dim})")
    
    # Upload chunks in batches
    BATCH_SIZE = 100
    total = len(chunk_records)
    for batch_start in range(0, total, BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, total)
        points = []
        for idx in range(batch_start, batch_end):
            chunk_text_raw, post_idx, chunk_idx, total_chunks = chunk_records[idx]
            post_id = df.loc[post_idx, '_id']
            # Unique ID: post_id + chunk_index
            chunk_id = f"{post_id}_chunk_{chunk_idx}"
            point_id = mongo_id_to_uuid(chunk_id)
            points.append(PointStruct(
                id=point_id,
                vector=embeddings[idx].tolist(),
                payload={
                    "post_id": post_id,
                    "chunk_index": chunk_idx,
                    "total_chunks": total_chunks,
                    "user_id": str(df.loc[post_idx, 'userId']),
                    "group_id": str(df.loc[post_idx, 'groupId']),
                    "privacy": str(df.loc[post_idx, 'privacy']),
                    "created_at": str(df.loc[post_idx, 'createdAt']) if 'createdAt' in df.columns else "",
                    "score": float(hybrid_scores[post_idx]),
                    "media_type": "TEXT",
                }
            ))
        
        qdrant.upsert(collection_name=COLLECTION_NAME, points=points)
        logger.info(f"   ✅ Uploaded {batch_end}/{total} chunks")
    
    # 8. Upload user vectors to Qdrant Cloud
    logger.info("☁️ Uploading user vectors to Qdrant Cloud...")
    
    # Recreate user_vectors collection
    try:
        qdrant.delete_collection(USER_COLLECTION)
        logger.info(f"   🗑️ Old '{USER_COLLECTION}' deleted")
    except: pass
    
    qdrant.create_collection(
        collection_name=USER_COLLECTION,
        vectors_config=VectorParams(size=embedding_dim, distance=Distance.COSINE)
    )
    logger.info(f"   ✅ Collection '{USER_COLLECTION}' created (dim={embedding_dim})")
    
    # Upload user vectors in batches
    # Pre-compute interaction counts per user
    user_interaction_counts = {}
    for uid in user_vectors.keys():
        count = 0
        if not reactions_df.empty and 'userId' in reactions_df.columns:
            count += len(reactions_df[reactions_df['userId'] == uid])
        if not shares_df.empty and 'userId' in shares_df.columns:
            count += len(shares_df[shares_df['userId'] == uid])
        if not ui_df.empty and 'userId' in ui_df.columns:
            count += len(ui_df[ui_df['userId'] == uid])
        user_interaction_counts[uid] = count
    
    user_list = list(user_vectors.items())
    BATCH_SIZE = 100
    for batch_start in range(0, len(user_list), BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, len(user_list))
        points = []
        for uid, vec in user_list[batch_start:batch_end]:
            point_id = mongo_id_to_uuid(uid)
            points.append(PointStruct(
                id=point_id,
                vector=vec.tolist(),
                payload={
                    "user_id": uid,
                    "interaction_count": user_interaction_counts.get(uid, 0),
                }
            ))
        qdrant.upsert(collection_name=USER_COLLECTION, points=points)
        logger.info(f"   ✅ Uploaded {batch_end}/{len(user_list)} user vectors")
    
    # 9. Also save to MongoDB (backup + fast access)
    logger.info("💾 Saving user vectors to MongoDB (backup)...")
    mongo_client = MongoClient(MONGO_URI)
    mongo_db = mongo_client[DB_NAME]
    
    bulk_ops = []
    from pymongo import UpdateOne
    for uid, vec in user_vectors.items():
        bulk_ops.append(UpdateOne(
            {"user_id": uid},
            {"$set": {
                "user_id": uid,
                "vector": vec.tolist(),
                "count": user_interaction_counts.get(uid, 0),
                "last_updated": datetime.now()
            }},
            upsert=True
        ))
        if len(bulk_ops) >= 500:
            mongo_db.ai_user_vectors.bulk_write(bulk_ops)
            bulk_ops = []
    
    if bulk_ops:
        mongo_db.ai_user_vectors.bulk_write(bulk_ops)
    
    mongo_client.close()
    logger.info(f"   ✅ {len(user_vectors)} user vectors saved to MongoDB")
    
    # 10. Create query_vectors collection for RAG query embedding
    logger.info("☁️ Creating query_vectors collection for RAG...")
    try:
        qdrant.delete_collection(QUERY_COLLECTION)
    except: pass
    
    qdrant.create_collection(
        collection_name=QUERY_COLLECTION,
        vectors_config=VectorParams(size=embedding_dim, distance=Distance.COSINE)
    )
    logger.info(f"   ✅ Collection '{QUERY_COLLECTION}' created (dim={embedding_dim})")
    
    # 11. Verify
    posts_info = qdrant.get_collection(COLLECTION_NAME)
    users_info = qdrant.get_collection(USER_COLLECTION)
    query_info = qdrant.get_collection(QUERY_COLLECTION)
    logger.info("=" * 50)
    logger.info("🎉 TRAINING HOÀN TẤT!")
    logger.info(f"   📊 Chunks: {posts_info.points_count} (Qdrant)")
    logger.info(f"   👤 User Vectors: {users_info.points_count} (Qdrant)")
    logger.info(f"   🔍 Query Vectors: {query_info.points_count} (Qdrant, ready for RAG)")
    logger.info(f"   🧠 Model: {MODEL_NAME}")
    logger.info(f"   ☁️ Qdrant: {QDRANT_URL}")
    logger.info("   👉 Chạy: python main.py")
    logger.info("=" * 50)


if __name__ == "__main__":
    train()
