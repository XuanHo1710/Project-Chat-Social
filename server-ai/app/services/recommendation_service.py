"""
RECOMMENDATION SERVICE - OPTIMIZED
===================================
Chỉ giữ các hàm cần thiết:
1. search(query, ...) - Tìm posts theo query
2. recommend(user_id, ...) - Gợi ý cho user dựa trên interactions từ MongoDB
3. similar(post_id, ...) - Tìm posts tương tự
4. get_newsfeed(user_id, ...) - Alias cho recommend

Sử dụng COSINE SIMILARITY (góc tọa độ):
- Cosine = 1: Cùng hướng (giống nhau hoàn toàn)
- Cosine = 0: Vuông góc (không liên quan)
- Cosine = -1: Ngược hướng (đối lập)
"""

import os
import hashlib
import random
from typing import List, Dict, Optional, Tuple
from loguru import logger
import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer
from pymongo import MongoClient
from bson import ObjectId
import numpy as np
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Đường dẫn tuyệt đối đến thư mục chứa chroma_db
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CHROMA_PATH = os.getenv("CHROMA_PERSIST_DIR", os.path.join(BASE_DIR, "chroma_db"))
# Nếu CHROMA_PATH là relative path, convert thành absolute path
if not os.path.isabs(CHROMA_PATH):
    CHROMA_PATH = os.path.join(BASE_DIR, CHROMA_PATH)
    
COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_POSTS", "posts")
MODEL_NAME = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")

# MongoDB Config từ .env
MONGO_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DATABASE")

# Weights cho các interaction types
INTERACTION_WEIGHTS = {
    "SHARE": 2.5,      # Chia sẻ = quan tâm nhất
    "COMMENT": 1.5,    # Bình luận = quan tâm cao
    "LOVE": 1.3,
    "LIKE": 1.0,
    "HAHA": 0.8,
    "WOW": 0.7,
    "SAD": 0.3,
    "ANGRY": -0.5
}

# Recency boost config
RECENT_DAYS = 20  # Posts within this many days get boosted
RECENT_BOOST_MAX = 1.5  # Max boost for very recent posts (today)
VIEWED_PENALTY = 0.3  # Reduce score by this factor for already viewed posts


class RecommendationService:
    def __init__(self):
        self._collection = None
        self._model = None
        self._mongo_client = None
    
    @property
    def collection(self):
        """Lazy load ChromaDB collection"""
        if self._collection is None:
            if not os.path.exists(CHROMA_PATH):
                logger.error("❌ Chưa train! Chạy: python train.py")
                return None
            client = chromadb.PersistentClient(
                path=CHROMA_PATH, 
                settings=ChromaSettings(anonymized_telemetry=False)
            )
            try:
                self._collection = client.get_collection(COLLECTION_NAME)
                logger.info(f"✅ Loaded {self._collection.count()} posts từ ChromaDB")
            except:
                logger.error("❌ Collection không tồn tại! Chạy: python train.py")
                return None
        return self._collection
    
    @property
    def model(self):
        """Lazy load SentenceTransformer model"""
        if self._model is None:
            logger.info(f"⬇️ Loading model {MODEL_NAME}...")
            self._model = SentenceTransformer(MODEL_NAME)
            logger.info("✅ Model loaded!")
        return self._model
    
    @property
    def mongo_client(self):
        """Lazy load MongoDB client - reuse connection"""
        if self._mongo_client is None:
            self._mongo_client = MongoClient(MONGO_URI, maxPoolSize=10)
        return self._mongo_client
    
    def is_ready(self) -> bool:
        return self.collection is not None and self.collection.count() > 0
    
    def get_total_posts(self) -> int:
        if not self.is_ready():
            return 0
        return self.collection.count()
    
    # ========================================
    # CORE: Lấy User Vector từ MongoDB interactions
    # ========================================
    def get_user_vector(self, user_id: str) -> Tuple[Optional[np.ndarray], int]:
        """
        Lấy user preference vector từ MongoDB dựa trên TẤT CẢ interactions.
        
        Returns:
            Tuple (user_vector, total_interactions)
            - user_vector: None nếu không có interactions
            - total_interactions: Số posts đã tương tác
        """
        try:
            db = self.mongo_client[DB_NAME]
            user_oid = ObjectId(user_id)
            
            # Dict để track post_id -> max_weight (tránh duplicate)
            post_weights: Dict[str, float] = {}
            
            # 1. REACTIONS
            reactions = db.reactions.find({
                "userId": user_oid,
                "typeFactor": "POST"
            }, {"factorId": 1, "type": 1})
            
            for r in reactions:
                post_id = str(r.get('factorId', ''))
                if not post_id:
                    continue
                reaction_type = r.get('type', 'LIKE')
                weight = INTERACTION_WEIGHTS.get(reaction_type, 0.5)
                # Lấy weight cao nhất nếu có nhiều reactions cho cùng post
                post_weights[post_id] = max(post_weights.get(post_id, 0), weight)
            
            # 2. COMMENTS
            comments = db.comments.find({"userId": user_oid}, {"postId": 1})
            for c in comments:
                post_id = str(c.get('postId', ''))
                if not post_id:
                    continue
                weight = INTERACTION_WEIGHTS["COMMENT"]
                post_weights[post_id] = max(post_weights.get(post_id, 0), weight)
            
            # 3. SHARES (posts có sharedPostId)
            shares = db.posts.find({
                "userId": user_oid,
                "sharedPostId": {"$exists": True, "$ne": None}
            }, {"sharedPostId": 1})
            
            for s in shares:
                shared_id = s.get('sharedPostId')
                if not shared_id:
                    continue
                post_id = str(shared_id)
                weight = INTERACTION_WEIGHTS["SHARE"]
                post_weights[post_id] = max(post_weights.get(post_id, 0), weight)
            
            if not post_weights:
                logger.info(f"👤 User {user_id}: Không có interactions")
                return None, 0
            
            logger.info(f"👤 User {user_id}: Found {len(post_weights)} interacted posts")
            
            # Lấy embeddings từ ChromaDB (batch query)
            post_ids = list(post_weights.keys())
            try:
                result = self.collection.get(ids=post_ids, include=["embeddings"])
            except Exception as e:
                logger.warning(f"ChromaDB get error: {e}")
                return None, 0
            
            embeddings = result.get('embeddings')
            ids = result.get('ids', [])
            
            # Check embeddings có tồn tại không (tránh numpy array truth value error)
            if embeddings is None or len(embeddings) == 0:
                logger.info(f"👤 User {user_id}: Không tìm thấy embeddings trong ChromaDB")
                return None, 0
            
            # Tính weighted average
            weighted_sum = None
            total_weight = 0.0
            found_count = 0
            
            for i, pid in enumerate(ids):
                if i >= len(embeddings):
                    continue
                emb_data = embeddings[i]
                # Check nếu embedding là None hoặc empty
                if emb_data is None or (hasattr(emb_data, '__len__') and len(emb_data) == 0):
                    continue
                    
                weight = post_weights.get(pid, 1.0)
                emb = np.array(emb_data)
                
                if weighted_sum is None:
                    weighted_sum = emb * weight
                else:
                    weighted_sum += emb * weight
                total_weight += abs(weight)
                found_count += 1
            
            if weighted_sum is None or total_weight == 0:
                return None, 0
            
            # Normalize user vector
            user_vector = weighted_sum / total_weight
            norm = np.linalg.norm(user_vector)
            if norm > 0:
                user_vector = user_vector / norm
            
            logger.info(f"✅ User {user_id}: {found_count} embeddings → user vector ready")
            return user_vector, found_count
            
        except Exception as e:
            logger.error(f"❌ get_user_vector error: {e}")
            return None, 0
    
    # ========================================
    # Privacy Filter
    # ========================================
    def _filter_privacy(
        self, 
        posts: List[Dict], 
        user_id: str, 
        friend_ids: List[str]
    ) -> List[Dict]:
        """Filter posts theo privacy rules"""
        friend_set = set(friend_ids) if friend_ids else set()
        filtered = []
        
        for post in posts:
            privacy = post.get('privacy', 'PUBLIC')
            owner = post.get('user_id', '')
            group_id = post.get('group_id', '')
            
            # Own posts
            if owner == user_id:
                filtered.append(post)
            # PUBLIC
            elif privacy == 'PUBLIC':
                filtered.append(post)
            # FRIEND - chỉ nếu owner là bạn
            elif privacy == 'FRIEND' and owner in friend_set:
                filtered.append(post)
            # GROUP - có groupId
            elif privacy == 'GROUP' and group_id and group_id != 'no_group':
                filtered.append(post)
        
        return filtered
    
    def _get_user_interacted_post_ids(self, user_id: str) -> set:
        """
        Get set of post IDs that user has already interacted with.
        Used to reduce score for already-seen posts.
        """
        try:
            db = self.mongo_client[DB_NAME]
            user_oid = ObjectId(user_id)
            interacted_ids = set()
            
            # Get reactions
            reactions = db.reactions.find(
                {"userId": user_oid, "typeFactor": "POST"},
                {"factorId": 1}
            )
            for r in reactions:
                if r.get('factorId'):
                    interacted_ids.add(str(r['factorId']))
            
            # Get comments
            comments = db.comments.find(
                {"userId": user_oid},
                {"postId": 1}
            )
            for c in comments:
                if c.get('postId'):
                    interacted_ids.add(str(c['postId']))
            
            # Get shares
            shares = db.posts.find(
                {"userId": user_oid, "sharedPostId": {"$exists": True, "$ne": None}},
                {"sharedPostId": 1}
            )
            for s in shares:
                if s.get('sharedPostId'):
                    interacted_ids.add(str(s['sharedPostId']))
            
            return interacted_ids
        except Exception as e:
            logger.warning(f"Failed to get interacted posts: {e}")
            return set()
    
    def _calculate_recency_boost(self, created_at_str: str) -> float:
        """
        Calculate recency boost based on post creation date.
        Posts within RECENT_DAYS get boosted, newer = higher boost.
        Returns multiplier between 1.0 and RECENT_BOOST_MAX
        """
        if not created_at_str:
            return 1.0
        
        try:
            from datetime import datetime, timedelta
            
            # Parse created_at (ISO format or timestamp)
            if isinstance(created_at_str, str):
                # Try ISO format first
                try:
                    created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                except:
                    # Try timestamp
                    try:
                        created_at = datetime.fromtimestamp(float(created_at_str))
                    except:
                        return 1.0
            else:
                return 1.0
            
            now = datetime.now(created_at.tzinfo) if created_at.tzinfo else datetime.now()
            days_old = (now - created_at).days
            
            if days_old < 0:
                days_old = 0
            
            if days_old >= RECENT_DAYS:
                return 1.0  # No boost for old posts
            
            # Linear interpolation: 0 days -> RECENT_BOOST_MAX, RECENT_DAYS days -> 1.0
            boost = 1.0 + (RECENT_BOOST_MAX - 1.0) * (1 - days_old / RECENT_DAYS)
            return boost
            
        except Exception as e:
            logger.warning(f"Recency boost calculation error: {e}")
            return 1.0
    
    # ========================================
    # 1. SEARCH - Tìm posts theo query
    # ========================================
    def search(
        self, 
        query: str, 
        current_user_id: str = "",
        friend_ids: List[str] = None,
        limit: int = 20, 
        page: int = 1
    ) -> Tuple[List[Dict], int]:
        """
        Tìm posts theo query sử dụng cosine similarity.
        """
        if not self.is_ready():
            return [], 0
        
        try:
            # Encode query
            query_emb = self.model.encode(query, convert_to_numpy=True)
            
            # ChromaDB query (đã dùng cosine distance internally)
            n_results = min(200, self.collection.count())
            results = self.collection.query(
                query_embeddings=[query_emb.tolist()],
                n_results=n_results,
                include=["metadatas", "distances"]
            )
            
            posts = []
            if results['ids'] and results['ids'][0]:
                for i, post_id in enumerate(results['ids'][0]):
                    # ChromaDB distance = 1 - cosine_similarity
                    distance = results['distances'][0][i] if results['distances'] else 0
                    similarity = 1 - distance  # Convert back to similarity
                    
                    meta = results['metadatas'][0][i]
                    posts.append({
                        "post_id": post_id,
                        "score": round(similarity, 4),
                        "user_id": meta.get('user_id', ''),
                        "group_id": meta.get('group_id', ''),
                        "privacy": meta.get('privacy', 'PUBLIC')
                    })
            
            # Privacy filter
            if current_user_id:
                posts = self._filter_privacy(posts, current_user_id, friend_ids or [])
            
            total = len(posts)
            
            # Paginate
            offset = (page - 1) * limit
            return posts[offset:offset + limit], total
            
        except Exception as e:
            logger.error(f"Search error: {e}")
            return [], 0
    
    def recommend(
        self, 
        user_id: str, 
        friend_ids: List[str] = None,
        limit: int = 20, 
        page: int = 1
    ) -> Tuple[List[Dict], int]:
        """
        Gợi ý posts cho user dựa trên cosine similarity với user vector.
        
        Logic:
        1. Lấy user vector từ interactions (reactions, comments, shares)
        2. Query ChromaDB với user vector
        3. Rank theo cosine similarity (góc nhỏ = giống nhau = score cao)
        4. Boost posts từ bạn bè (+20%)
        5. Boost posts gần đây (trong 20 ngày)
        6. Giảm score posts đã xem/tương tác
        7. Weighted random selection
        8. Filter privacy + paginate
        """
        if not self.is_ready():
            return [], 0
        
        try:
            friend_set = set(friend_ids) if friend_ids else set()
            
            # Lấy user vector
            user_vector, interaction_count = self.get_user_vector(user_id)
            
            # Get posts user has already interacted with
            interacted_post_ids = self._get_user_interacted_post_ids(user_id)
            logger.info(f"👤 User {user_id}: {len(interacted_post_ids)} previously interacted posts")
            
            # Nếu không có interactions, tạo random vector unique cho user
            if user_vector is None:
                logger.info(f"👤 User {user_id}: No interactions, using random preference")
                # Lấy sample posts để tạo random preference
                sample = self.collection.get(include=["embeddings"], limit=50)
                sample_embeddings = sample.get('embeddings', [])
                if sample_embeddings is not None and len(sample_embeddings) > 0:
                    # Dùng user_id hash để chọn random nhưng consistent
                    user_hash = int(hashlib.md5(user_id.encode()).hexdigest(), 16)
                    np.random.seed(user_hash % (2**32))
                    
                    emb_array = np.array(sample_embeddings)
                    n = min(10, len(emb_array))
                    indices = np.random.choice(len(emb_array), size=n, replace=False)
                    user_vector = emb_array[indices].mean(axis=0)
                    
                    norm = np.linalg.norm(user_vector)
                    if norm > 0:
                        user_vector = user_vector / norm
                    np.random.seed(None)
                else:
                    return [], 0
            
            # Query ChromaDB với user vector
            n_results = min(500, self.collection.count())  # Query more for better selection
            results = self.collection.query(
                query_embeddings=[user_vector.tolist()],
                n_results=n_results,
                include=["metadatas", "distances"]
            )
            
            posts = []
            if results['ids'] and results['ids'][0]:
                for i, post_id in enumerate(results['ids'][0]):
                    distance = results['distances'][0][i] if results['distances'] else 0
                    # Cosine similarity (góc nhỏ = giống = score cao)
                    similarity = 1 - distance
                    
                    meta = results['metadatas'][0][i]
                    owner = meta.get('user_id', '')
                    created_at = meta.get('created_at', '')
                    
                    # Score base = cosine similarity
                    score = similarity
                    
                    # 1. Boost 20% cho posts từ bạn bè
                    if owner in friend_set:
                        score *= 1.2
                    
                    # 2. Giảm 50% cho posts của chính mình
                    if owner == user_id:
                        score *= 0.5
                    
                    # 3. Boost bài post gần đây (trong 20 ngày)
                    recency_boost = self._calculate_recency_boost(created_at)
                    score *= recency_boost
                    
                    # 4. Giảm score cho posts đã xem/tương tác
                    if post_id in interacted_post_ids:
                        score *= (1.0 - VIEWED_PENALTY)
                    
                    posts.append({
                        "post_id": post_id,
                        "score": round(score, 4),
                        "user_id": owner,
                        "group_id": meta.get('group_id', ''),
                        "privacy": meta.get('privacy', 'PUBLIC'),
                        "is_viewed": post_id in interacted_post_ids,
                        "recency_boost": round(recency_boost, 2)
                    })
            
            # Privacy filter
            posts = self._filter_privacy(posts, user_id, friend_ids or [])
            
            total = len(posts)
            
            # ========================================
            # WEIGHTED RANDOM SELECTION
            # Posts với score cao hơn có xác suất được chọn cao hơn
            # Nhưng vẫn có cơ hội cho posts score thấp hơn
            # ========================================
            if len(posts) > 5:
                # Separate into tiers for better diversity
                high_score = [p for p in posts if p['score'] >= 0.6]
                medium_score = [p for p in posts if 0.4 <= p['score'] < 0.6]
                low_score = [p for p in posts if p['score'] < 0.4]
                
                # Weighted random shuffle each tier
                def weighted_shuffle(post_list):
                    if not post_list:
                        return []
                    # Convert scores to probabilities
                    scores = np.array([p['score'] for p in post_list])
                    scores = np.maximum(scores, 0.01)  # Avoid zero
                    probs = scores / scores.sum()
                    
                    # Sample without replacement based on probabilities
                    try:
                        indices = np.random.choice(
                            len(post_list), 
                            size=len(post_list), 
                            replace=False, 
                            p=probs
                        )
                        return [post_list[i] for i in indices]
                    except:
                        # Fallback to simple shuffle
                        random.shuffle(post_list)
                        return post_list
                
                high_score = weighted_shuffle(high_score)
                medium_score = weighted_shuffle(medium_score)
                # Low score just shuffle normally
                random.shuffle(low_score)
                
                # Combine: high first, then medium, then low
                posts = high_score + medium_score + low_score
            
            # Paginate
            offset = (page - 1) * limit
            paginated = posts[offset:offset + limit]
            
            logger.info(f"📰 Recommend {user_id}: {interaction_count} interactions, {total} posts, page {page}")
            return paginated, total
            
        except Exception as e:
            logger.error(f"Recommend error: {e}")
            import traceback
            traceback.print_exc()
            return [], 0
    
    # Alias
    def get_newsfeed(
        self,
        user_id: str,
        friend_ids: List[str] = None,
        limit: int = 20,
        page: int = 1
    ) -> Tuple[List[Dict], int]:
        """Alias cho recommend()"""
        return self.recommend(user_id, friend_ids, limit, page)
    
    # ========================================
    # 3. SIMILAR - Tìm posts tương tự
    # ========================================
    def similar(
        self, 
        post_id: str, 
        limit: int = 10, 
        page: int = 1
    ) -> Tuple[List[Dict], int]:
        """
        Tìm posts tương tự với post_id dựa trên cosine similarity.
        """
        if not self.is_ready():
            return [], 0
        
        try:
            # Lấy embedding của post
            result = self.collection.get(ids=[post_id], include=["embeddings"])
            if not result['embeddings'] or len(result['embeddings']) == 0:
                logger.warning(f"Post {post_id} không tồn tại")
                return [], 0
            
            source_emb = result['embeddings'][0]
            
            # Query similar posts
            n_results = min(100, self.collection.count())
            results = self.collection.query(
                query_embeddings=[source_emb],
                n_results=n_results,
                include=["metadatas", "distances"]
            )
            
            posts = []
            if results['ids'] and results['ids'][0]:
                for i, pid in enumerate(results['ids'][0]):
                    if pid == post_id:  # Skip chính nó
                        continue
                    
                    distance = results['distances'][0][i] if results['distances'] else 0
                    similarity = 1 - distance
                    
                    meta = results['metadatas'][0][i]
                    posts.append({
                        "post_id": pid,
                        "score": round(similarity, 4),
                        "user_id": meta.get('user_id', ''),
                        "group_id": meta.get('group_id', ''),
                        "privacy": meta.get('privacy', 'PUBLIC')
                    })
            
            # Sort by similarity
            posts.sort(key=lambda x: x['score'], reverse=True)
            
            total = len(posts)
            offset = (page - 1) * limit
            return posts[offset:offset + limit], total
            
        except Exception as e:
            logger.error(f"Similar error: {e}")
            return [], 0


# Singleton
_service: Optional[RecommendationService] = None

def get_recommendation_service() -> RecommendationService:
    global _service
    if _service is None:
        _service = RecommendationService()
    return _service
