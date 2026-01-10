"""
TRAIN HYBRID MODEL
==================
- Lấy posts từ MongoDB
- Lấy reactions, shares, relationships để tính user vectors
- Chuẩn hóa dữ liệu (bao gồm privacy)
- Train với BGE-M3 (model xịn nhất)
- Tính hybrid score = content + collaborative filtering + user preference
- Lưu ChromaDB (posts + user vectors + friend relationships)
- Đánh giá model với metrics
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
import json
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
USER_VECTORS_COLLECTION = "user_vectors"
FRIEND_GRAPH_COLLECTION = "friend_graph"
LIMIT = 200  # Giới hạn posts để train

# Weights cho các interaction types
REACTION_WEIGHTS = {
    "LIKE": 1.0,
    "LOVE": 1.5,
    "HAHA": 0.8,
    "WOW": 0.7,
    "SAD": 0.3,
    "ANGRY": -0.5
}

SHARE_WEIGHT = 2.0  # Share có weight cao vì user thực sự quan tâm
FRIEND_INTERACTION_BOOST = 1.3  # Boost cho posts từ bạn bè

def clean_text(text):
    if not isinstance(text, str): return ""
    text = text.encode('utf-8', errors='ignore').decode('utf-8')
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def normalize_privacy(privacy):
    """Chuẩn hóa giá trị privacy"""
    if not privacy:
        return "PUBLIC"
    privacy = str(privacy).upper()
    if privacy in ["PUBLIC", "FRIEND", "PRIVATE", "GROUP"]:
        return privacy
    return "PUBLIC"

def build_friend_graph(relationships_df):
    """
    Xây dựng đồ thị bạn bè từ relationships.
    Trả về dict: user_id -> set of friend_ids
    """
    friend_graph = defaultdict(set)
    
    for _, rel in relationships_df.iterrows():
        user_id = str(rel['userId'])
        friend_id = str(rel['friendId'])
        # Quan hệ 2 chiều
        friend_graph[user_id].add(friend_id)
        friend_graph[friend_id].add(user_id)
    
    return dict(friend_graph)

def build_user_vectors(reactions_df, shares_df, post_embeddings_dict, post_owners_dict, friend_graph, embedding_dim):
    """
    Xây dựng user vectors dựa trên:
    1. Reactions của user
    2. Shares của user
    3. Friend relationships (boost cho posts từ bạn bè)
    
    User vector = weighted average của các post embeddings
    """
    user_interactions = defaultdict(list)  # user_id -> [(post_id, weight)]
    
    # 1. Thêm reactions
    if not reactions_df.empty:
        for _, reaction in reactions_df.iterrows():
            user_id = str(reaction['userId'])
            post_id = str(reaction['factorId'])
            reaction_type = reaction.get('type', 'LIKE')
            
            if post_id in post_embeddings_dict:
                weight = REACTION_WEIGHTS.get(reaction_type, 0.5)
                
                # Boost nếu post từ bạn bè
                post_owner = post_owners_dict.get(post_id)
                if post_owner and user_id in friend_graph:
                    if post_owner in friend_graph[user_id]:
                        weight *= FRIEND_INTERACTION_BOOST
                
                user_interactions[user_id].append((post_id, weight))
    
    # 2. Thêm shares (weight cao hơn)
    if not shares_df.empty:
        for _, share in shares_df.iterrows():
            user_id = str(share['userId'])
            shared_post_id = str(share['sharedPostId'])
            
            if shared_post_id in post_embeddings_dict:
                weight = SHARE_WEIGHT
                
                # Boost nếu share post từ bạn bè
                post_owner = post_owners_dict.get(shared_post_id)
                if post_owner and user_id in friend_graph:
                    if post_owner in friend_graph[user_id]:
                        weight *= FRIEND_INTERACTION_BOOST
                
                user_interactions[user_id].append((shared_post_id, weight))
    
    # 3. Tính user vectors
    user_vectors = {}
    for user_id, interactions in user_interactions.items():
        if not interactions:
            continue
        
        weighted_embeddings = []
        total_weight = 0
        
        for post_id, weight in interactions:
            if post_id in post_embeddings_dict:
                weighted_embeddings.append(post_embeddings_dict[post_id] * weight)
                total_weight += abs(weight)
        
        if weighted_embeddings and total_weight > 0:
            user_vector = np.sum(weighted_embeddings, axis=0) / total_weight
            # Normalize vector
            norm = np.linalg.norm(user_vector)
            if norm > 0:
                user_vector = user_vector / norm
            user_vectors[user_id] = user_vector
    
    return user_vectors

def evaluate_model(embeddings, df, user_vectors, friend_graph):
    """
    Đánh giá chất lượng model (với sampling để tránh OOM):
    1. Coverage: % users có vector
    2. Embedding Quality: average cosine similarity (sampled)
    3. Friend Correlation: posts từ bạn bè có similarity cao hơn không
    """
    metrics = {}
    
    # 1. Coverage
    unique_users = df['userId'].unique()
    users_with_vectors = len([u for u in unique_users if u in user_vectors])
    metrics['user_coverage'] = users_with_vectors / len(unique_users) if len(unique_users) > 0 else 0
    
    # 2. Embedding Quality - Sample để tránh OOM
    # Với 100k posts, full matrix = 100k x 100k = 40GB RAM
    # Sample 1000 posts thì chỉ cần 1k x 1k = 4MB
    SAMPLE_SIZE = min(1000, len(embeddings))
    
    if len(embeddings) > 1:
        # Random sample indices
        np.random.seed(42)
        sample_indices = np.random.choice(len(embeddings), size=SAMPLE_SIZE, replace=False)
        sample_embeddings = embeddings[sample_indices]
        
        sim_matrix = cosine_similarity(sample_embeddings)
        np.fill_diagonal(sim_matrix, 0)
        metrics['avg_similarity'] = float(sim_matrix.mean())
        metrics['max_similarity'] = float(sim_matrix.max())
        metrics['min_similarity'] = float(sim_matrix[sim_matrix > 0].min()) if (sim_matrix > 0).any() else 0.0
        metrics['sample_size'] = SAMPLE_SIZE
    
    # 3. Friend Correlation - Sample để tránh OOM
    # Chỉ lấy 500 users có friend graph để tính
    friend_sims = []
    non_friend_sims = []
    
    users_with_friends = [u for u in df['userId'].unique() if u in friend_graph]
    sample_users = users_with_friends[:min(100, len(users_with_friends))]
    
    if sample_users:
        sample_df = df[df['userId'].isin(sample_users)].head(500).reset_index(drop=True)
        sample_emb_indices = sample_df.index.tolist()
        
        for idx, (i, row) in enumerate(sample_df.iterrows()):
            user_id = row['userId']
            if user_id not in friend_graph:
                continue
            
            friends = friend_graph[user_id]
            
            # Chỉ so sánh với 50 posts khác để tiết kiệm thời gian
            other_samples = sample_df.sample(min(50, len(sample_df))).iterrows()
            for j, other_row in other_samples:
                if i == j:
                    continue
                
                other_user = other_row['userId']
                # Chỉ tính similarity cho cặp này
                sim = float(np.dot(embeddings[i], embeddings[j]) / 
                           (np.linalg.norm(embeddings[i]) * np.linalg.norm(embeddings[j]) + 1e-8))
                
                if other_user in friends:
                    friend_sims.append(sim)
                else:
                    non_friend_sims.append(sim)
    
    if friend_sims:
        metrics['friend_avg_similarity'] = float(np.mean(friend_sims))
    if non_friend_sims:
        metrics['non_friend_avg_similarity'] = float(np.mean(non_friend_sims[:1000]))  # Limit
    
    return metrics

def train():
    logger.info("=" * 50)
    logger.info("🔥 TRAIN HYBRID MODEL WITH USER VECTORS")
    logger.info("=" * 50)
    
    # 1. Lấy dữ liệu từ MongoDB
    logger.info(f"📥 Lấy {LIMIT} posts từ MongoDB...")
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    # Lấy posts với thêm trường privacy
    cursor = db.posts.find(
        {"isDeleted": {"$ne": True}},
        {"_id": 1, "userId": 1, "groupId": 1, "content": 1, "privacy": 1, "sharedPostId": 1}
    ).limit(LIMIT)
    
    data = list(cursor)
    logger.info(f"   ✅ Đã lấy {len(data)} posts")
    
    # 2. Lấy reactions (chỉ reactions cho POST)
    logger.info("📥 Lấy reactions từ MongoDB...")
    post_ids = [doc['_id'] for doc in data]
    reactions_cursor = db.reactions.find(
        {
            "factorId": {"$in": post_ids},
            "typeFactor": "POST"
        },
        {"_id": 1, "factorId": 1, "typeFactor": 1, "userId": 1, "type": 1}
    )
    reactions_data = list(reactions_cursor)
    logger.info(f"   ✅ Đã lấy {len(reactions_data)} reactions")
    
    # 3. Lấy shares (posts có sharedPostId)
    logger.info("📥 Lấy shares từ MongoDB...")
    shares_cursor = db.posts.find(
        {
            "sharedPostId": {"$ne": None},
            "isDeleted": {"$ne": True}
        },
        {"_id": 1, "userId": 1, "sharedPostId": 1}
    )
    shares_data = list(shares_cursor)
    logger.info(f"   ✅ Đã lấy {len(shares_data)} shares")
    
    # 4. Lấy relationships (chỉ ACCEPTED)
    logger.info("📥 Lấy relationships từ MongoDB...")
    relationships_cursor = db.relationships.find(
        {"status": "ACCEPTED"},
        {"_id": 1, "userId": 1, "friendId": 1}
    )
    relationships_data = list(relationships_cursor)
    logger.info(f"   ✅ Đã lấy {len(relationships_data)} friend relationships")
    
    # 5. Lấy TẤT CẢ accounts từ MongoDB
    logger.info("📥 Lấy tất cả accounts từ MongoDB...")
    accounts_cursor = db.accounts.find(
        {},
        {"_id": 1}
    )
    all_accounts = list(accounts_cursor)
    all_user_ids = [str(acc['_id']) for acc in all_accounts]
    logger.info(f"   ✅ Đã lấy {len(all_user_ids)} accounts")
    
    client.close()
    
    if not data:
        logger.error("❌ Không có dữ liệu!")
        return
    
    # 5. Chuẩn hóa posts
    logger.info("🔧 Chuẩn hóa dữ liệu posts...")
    df = pd.DataFrame(data)
    df['_id'] = df['_id'].astype(str)
    df['userId'] = df['userId'].apply(lambda x: str(x) if pd.notna(x) and x else "unknown")
    df['groupId'] = df['groupId'].apply(lambda x: str(x) if pd.notna(x) and x else "no_group") if 'groupId' in df.columns else "no_group"
    df['content'] = df['content'].fillna("").apply(clean_text)
    df['privacy'] = df['privacy'].apply(normalize_privacy) if 'privacy' in df.columns else "PUBLIC"
    
    # Lọc content quá ngắn
    df = df[df['content'].str.len() > 0].reset_index(drop=True)
    logger.info(f"   ✅ Còn {len(df)} posts sau khi lọc")
    
    # 6. Chuẩn hóa reactions
    logger.info("🔧 Chuẩn hóa dữ liệu reactions...")
    reactions_df = pd.DataFrame(reactions_data) if reactions_data else pd.DataFrame()
    if not reactions_df.empty:
        reactions_df['_id'] = reactions_df['_id'].astype(str)
        reactions_df['factorId'] = reactions_df['factorId'].astype(str)
        reactions_df['userId'] = reactions_df['userId'].astype(str)
        reactions_df['type'] = reactions_df['type'].fillna("LIKE")
        logger.info(f"   ✅ Đã chuẩn hóa {len(reactions_df)} reactions")
    
    # 7. Chuẩn hóa shares
    logger.info("🔧 Chuẩn hóa dữ liệu shares...")
    shares_df = pd.DataFrame(shares_data) if shares_data else pd.DataFrame()
    if not shares_df.empty:
        shares_df['_id'] = shares_df['_id'].astype(str)
        shares_df['userId'] = shares_df['userId'].astype(str)
        shares_df['sharedPostId'] = shares_df['sharedPostId'].astype(str)
        logger.info(f"   ✅ Đã chuẩn hóa {len(shares_df)} shares")
    
    # 8. Build friend graph
    logger.info("🔧 Building friend graph...")
    relationships_df = pd.DataFrame(relationships_data) if relationships_data else pd.DataFrame()
    friend_graph = {}
    if not relationships_df.empty:
        relationships_df['userId'] = relationships_df['userId'].astype(str)
        relationships_df['friendId'] = relationships_df['friendId'].astype(str)
        friend_graph = build_friend_graph(relationships_df)
        logger.info(f"   ✅ Friend graph với {len(friend_graph)} users")
    
    # Label Encoding
    user_encoder = LabelEncoder()
    df['user_enc'] = user_encoder.fit_transform(df['userId'])
    n_users = len(user_encoder.classes_)
    n_posts = len(df)
    
    # Tạo dict post_id -> user_id (owner)
    post_owners_dict = {df.loc[i, '_id']: df.loc[i, 'userId'] for i in range(len(df))}
    
    # 9. Load model và tạo embeddings
    logger.info(f"🧠 Loading model {MODEL_NAME}...")
    logger.info("   (Lần đầu sẽ tải ~2.3GB, chờ 5-10 phút)")
    model = SentenceTransformer(MODEL_NAME)
    logger.info("   ✅ Model loaded!")
    
    logger.info("📊 Generating embeddings...")
    embeddings = model.encode(df['content'].tolist(), show_progress_bar=True, batch_size=8)
    embedding_dim = embeddings.shape[1]
    
    # Tạo dict post_id -> embedding để build user vectors
    post_embeddings_dict = {df.loc[i, '_id']: embeddings[i] for i in range(len(df))}
    
    # 10. Tính Content Score
    logger.info("🔢 Tính Content Score...")
    mean_emb = embeddings.mean(axis=0)
    content_scores = cosine_similarity(embeddings, mean_emb.reshape(1, -1)).flatten()
    content_scores = (content_scores - content_scores.min()) / (content_scores.max() - content_scores.min() + 1e-8)
    
    # 11. Tính CF Score (Collaborative Filtering)
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
    
    # 12. Build User Vectors từ reactions + shares + friend relationships
    logger.info("👤 Building User Vectors từ reactions, shares, relationships...")
    user_vectors = build_user_vectors(
        reactions_df, 
        shares_df, 
        post_embeddings_dict, 
        post_owners_dict,
        friend_graph,
        embedding_dim
    )
    logger.info(f"   ✅ Đã tạo {len(user_vectors)} user vectors từ interactions")
    
    # 13. Tạo DEFAULT User Vectors cho users chưa có tương tác
    # QUAN TRỌNG: Mỗi user cần vector KHÁC NHAU để có feed khác nhau
    logger.info("👤 Tạo default vectors cho users chưa có tương tác...")
    mean_embedding = embeddings.mean(axis=0)  # Base vector
    
    import hashlib
    
    users_without_vectors = 0
    for user_id in all_user_ids:
        if user_id not in user_vectors:
            # Tạo noise dựa trên hash của user_id để mỗi user có vector khác nhau
            user_hash = int(hashlib.md5(user_id.encode()).hexdigest(), 16)
            np.random.seed(user_hash % (2**32))
            
            # Thêm small noise vào mean embedding (±5% mỗi dimension)
            noise = np.random.uniform(-0.05, 0.05, embedding_dim)
            user_vector = mean_embedding + noise
            
            # Normalize vector
            norm = np.linalg.norm(user_vector)
            if norm > 0:
                user_vector = user_vector / norm
            
            user_vectors[user_id] = user_vector
            users_without_vectors += 1
    
    # Reset random seed
    np.random.seed(None)
    
    logger.info(f"   ✅ Đã tạo default vectors cho {users_without_vectors} users")
    logger.info(f"   📊 Tổng: {len(user_vectors)} user vectors")
    
    # 14. Hybrid Score
    logger.info("🔀 Tính Hybrid Score...")
    hybrid_scores = 0.6 * content_scores + 0.4 * cf_scores
    
    # 15. Evaluate Model
    logger.info("📈 Đánh giá Model...")
    metrics = evaluate_model(embeddings, df, user_vectors, friend_graph)
    for key, value in metrics.items():
        logger.info(f"   {key}: {value:.4f}" if isinstance(value, float) else f"   {key}: {value}")
    
    # 16. Lưu ChromaDB
    logger.info("💾 Lưu Posts vào ChromaDB...")
    os.makedirs(CHROMA_PATH, exist_ok=True)
    chroma = chromadb.PersistentClient(path=CHROMA_PATH, settings=ChromaSettings(anonymized_telemetry=False))
    
    # Xóa collections cũ nếu có
    for coll_name in [COLLECTION_NAME, USER_VECTORS_COLLECTION, FRIEND_GRAPH_COLLECTION]:
        try:
            chroma.delete_collection(coll_name)
        except:
            pass
    
    # Tạo collection posts
    collection = chroma.create_collection(name=COLLECTION_NAME)
    
    ids = df['_id'].tolist()
    documents = df['content'].tolist()
    metadatas = [{
        "user_id": str(df.loc[i, 'userId']),
        "group_id": str(df.loc[i, 'groupId']),
        "privacy": str(df.loc[i, 'privacy']),
        "score": float(hybrid_scores[i])
    } for i in range(len(df))]
    
    collection.add(
        ids=ids,
        embeddings=embeddings.tolist(),
        documents=documents,
        metadatas=metadatas
    )
    
    # 16. Lưu User Vectors vào ChromaDB
    if user_vectors:
        logger.info("💾 Lưu User Vectors vào ChromaDB...")
        user_collection = chroma.create_collection(name=USER_VECTORS_COLLECTION)
        
        user_ids = list(user_vectors.keys())
        user_embeddings = [user_vectors[uid].tolist() for uid in user_ids]
        user_docs = [f"user_vector_{uid}" for uid in user_ids]
        user_metas = [{"user_id": uid} for uid in user_ids]
        
        user_collection.add(
            ids=user_ids,
            embeddings=user_embeddings,
            documents=user_docs,
            metadatas=user_metas
        )
    
    # 17. Lưu Friend Graph vào file JSON (để service dùng)
    if friend_graph:
        logger.info("💾 Lưu Friend Graph...")
        friend_graph_path = os.path.join(CHROMA_PATH, "friend_graph.json")
        # Convert sets to lists for JSON serialization
        friend_graph_json = {k: list(v) for k, v in friend_graph.items()}
        with open(friend_graph_path, 'w') as f:
            json.dump(friend_graph_json, f)
    
    # 18. Lưu metrics
    metrics_path = os.path.join(CHROMA_PATH, "metrics.json")
    # Convert numpy float32 to Python float for JSON serialization
    metrics_serializable = {k: float(v) if isinstance(v, (np.floating, np.integer)) else v for k, v in metrics.items()}
    with open(metrics_path, 'w') as f:
        json.dump(metrics_serializable, f, indent=2)
    
    logger.info("=" * 50)
    logger.info("🎉 TRAINING HOÀN TẤT!")
    logger.info(f"   📊 Posts: {len(df)}")
    logger.info(f"   👤 User Vectors: {len(user_vectors)}")
    logger.info(f"   🔄 Reactions: {len(reactions_df) if not reactions_df.empty else 0}")
    logger.info(f"   📤 Shares: {len(shares_df) if not shares_df.empty else 0}")
    logger.info(f"   👥 Friend Relationships: {len(relationships_df) if not relationships_df.empty else 0}")
    logger.info(f"   💾 ChromaDB: {CHROMA_PATH}")
    logger.info("   👉 Chạy: python main.py")
    logger.info("=" * 50)

if __name__ == "__main__":
    train()
