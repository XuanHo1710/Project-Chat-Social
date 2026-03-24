"""
RECOMMENDATION SERVICE — QDRANT CLOUD
=======================================
1. search(query, ...) - Tìm posts theo query
2. recommend(user_id, ...) - Gợi ý cho user
3. similar(post_id, ...) - Tìm posts tương tự
4. get_newsfeed(user_id, ...) - Alias cho recommend

Optimized:
- Uses `userinteractions` collection (from Kafka) for richer signals
- Cosine similarity via Qdrant + numpy for scoring
- Weighted interaction vectors from POST_VIEW, POST_LIKE, POST_COMMENT, etc.
"""

import uuid
import hashlib
import random
import time
from typing import List, Dict, Optional, Tuple
from loguru import logger
from sentence_transformers import SentenceTransformer
from pymongo import MongoClient
from bson import ObjectId
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
import numpy as np
from datetime import datetime

from app.config import get_settings

settings = get_settings()

MODEL_NAME = settings.embedding_model
MONGO_URI = settings.mongodb_uri
DB_NAME = settings.mongodb_database
QDRANT_URL = settings.qdrant_url
QDRANT_API_KEY = settings.qdrant_api_key
COLLECTION_NAME = settings.qdrant_collection_posts
USER_COLLECTION = settings.qdrant_collection_users

# Interaction weights — used for building user preference vectors
# Higher weight = stronger positive signal for recommendation
INTERACTION_WEIGHTS = {
    # From reactions collection
    "SHARE": 2.5, "COMMENT": 1.5, "LOVE": 1.3, "LIKE": 1.0,
    "HAHA": 0.8, "WOW": 0.7, "SAD": 0.3, "ANGRY": -0.5,
    # From userinteractions collection (Kafka events)
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
RECENT_DAYS = 20
RECENT_BOOST_MAX = 1.5
VIEWED_PENALTY = 0.3


def mongo_id_to_uuid(mongo_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, mongo_id))


class RecommendationService:
    def __init__(self):
        self._qdrant = None
        self._model = None
        self._mongo_client = None
        self.user_vectors_cache: Dict[str, np.ndarray] = {}
        self.user_interaction_counts: Dict[str, int] = {}
        # Cache for collection info to avoid repeated Qdrant RPCs
        self._collection_cache: Dict[str, any] = {}
        self._collection_cache_ts: float = 0
        self._CACHE_TTL = 60  # seconds
        # Cache for user interacted post IDs (per request lifecycle)
        self._interacted_cache: Dict[str, set] = {}
        self._interacted_cache_ts: Dict[str, float] = {}

    @property
    def qdrant(self):
        if self._qdrant is None:
            self._qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=120)
        return self._qdrant

    @property
    def model(self):
        if self._model is None:
            logger.info(f"⬇️ Loading model {MODEL_NAME}...")
            self._model = SentenceTransformer(MODEL_NAME)
            logger.info("✅ Model loaded!")
        return self._model

    @property
    def mongo_client(self):
        if self._mongo_client is None:
            self._mongo_client = MongoClient(MONGO_URI, maxPoolSize=10)
        return self._mongo_client

    def _get_collection_info(self):
        """Cached Qdrant collection info to avoid repeated RPCs."""
        now = time.time()
        if now - self._collection_cache_ts < self._CACHE_TTL and COLLECTION_NAME in self._collection_cache:
            return self._collection_cache[COLLECTION_NAME]
        try:
            info = self.qdrant.get_collection(COLLECTION_NAME)
            self._collection_cache[COLLECTION_NAME] = info
            self._collection_cache_ts = now
            return info
        except Exception as e:
            logger.error(f"Qdrant collection error: {e}")
            return None

    def is_ready(self) -> bool:
        info = self._get_collection_info()
        return info is not None and info.points_count > 0

    def get_total_posts(self) -> int:
        info = self._get_collection_info()
        return info.points_count if info else 0

    # ========================================
    # User Vector Management
    # ========================================
    def get_user_vector(self, user_id: str) -> Tuple[Optional[np.ndarray], int]:
        if user_id in self.user_vectors_cache:
            return self.user_vectors_cache[user_id], self.user_interaction_counts.get(user_id, 0)

        # 1. Try Qdrant user_vectors collection first
        try:
            point_uuid = mongo_id_to_uuid(user_id)
            results = self.qdrant.retrieve(
                collection_name=USER_COLLECTION,
                ids=[point_uuid],
                with_vectors=True
            )
            if results and results[0].vector:
                vector = np.array(results[0].vector)
                count = results[0].payload.get("interaction_count", 0)
                self.user_vectors_cache[user_id] = vector
                self.user_interaction_counts[user_id] = count
                logger.debug(f"User vector loaded from Qdrant: {user_id}")
                return vector, count
        except Exception as e:
            logger.debug(f"Qdrant user vector not found: {e}")

        # 2. Fallback: MongoDB
        try:
            db = self.mongo_client[DB_NAME]
            stored = db.ai_user_vectors.find_one({"user_id": user_id})
            if stored and "vector" in stored:
                vector = np.array(stored["vector"])
                count = stored.get("count", 0)
                self.user_vectors_cache[user_id] = vector
                self.user_interaction_counts[user_id] = count
                return vector, count
        except Exception as e:
            logger.error(f"Error loading user vector from MongoDB: {e}")

        # 3. Build from scratch
        return self._build_and_save_vector_from_scratch(user_id)

    def _build_and_save_vector_from_scratch(self, user_id: str) -> Tuple[Optional[np.ndarray], int]:
        try:
            db = self.mongo_client[DB_NAME]
            user_oid = ObjectId(user_id)
            post_weights: Dict[str, float] = {}

            # 1. From reactions collection (legacy/direct)
            for r in db.reactions.find({"userId": user_oid, "typeFactor": "POST"}, {"factorId": 1, "type": 1}):
                pid = str(r.get('factorId', ''))
                if pid:
                    w = INTERACTION_WEIGHTS.get(r.get('type', 'LIKE'), 0.5)
                    post_weights[pid] = max(post_weights.get(pid, 0), w)

            for c in db.comments.find({"userId": user_oid}, {"postId": 1}):
                pid = str(c.get('postId', ''))
                if pid:
                    post_weights[pid] = max(post_weights.get(pid, 0), INTERACTION_WEIGHTS["COMMENT"])

            # 2. From userinteractions collection (Kafka events — richer signals)
            for ui in db.userinteractions.find(
                {"userId": user_oid, "targetType": {"$in": ["POST", "REEL"]}},
                {"targetId": 1, "interactionType": 1, "metadata": 1}
            ):
                tid = str(ui.get('targetId', ''))
                itype = ui.get('interactionType', '')
                if not tid:
                    continue

                w = INTERACTION_WEIGHTS.get(itype, 0.0)
                if w == 0.0:
                    continue

                # For POST_LIKE, check metadata.reactionType for finer weight
                if itype == 'POST_LIKE' and ui.get('metadata', {}).get('reactionType'):
                    reaction_type = ui['metadata']['reactionType']
                    w = INTERACTION_WEIGHTS.get(reaction_type, w)

                # Accumulate: take max weight per post (strongest signal wins)
                post_weights[tid] = max(post_weights.get(tid, 0), w)

            if not post_weights:
                return None, 0

            # Get embeddings from Qdrant
            point_ids = [mongo_id_to_uuid(pid) for pid in post_weights.keys()]
            try:
                results = self.qdrant.retrieve(
                    collection_name=COLLECTION_NAME,
                    ids=point_ids,
                    with_vectors=True
                )
            except:
                return None, 0

            if not results:
                return None, 0

            weighted_sum = None
            total_weight = 0.0
            found_count = 0

            for point in results:
                post_id = point.payload.get("post_id", "")
                if post_id in post_weights:
                    weight = post_weights[post_id]
                    emb = np.array(point.vector)
                    if weighted_sum is None:
                        weighted_sum = emb * weight
                    else:
                        weighted_sum += emb * weight
                    total_weight += abs(weight)
                    found_count += 1

            if weighted_sum is None or total_weight == 0:
                return None, 0

            user_vector = weighted_sum / total_weight
            norm = np.linalg.norm(user_vector)
            if norm > 0: user_vector = user_vector / norm

            self._save_user_vector_to_db(user_id, user_vector, found_count)
            self.user_vectors_cache[user_id] = user_vector
            self.user_interaction_counts[user_id] = found_count
            return user_vector, found_count

        except Exception as e:
            logger.error(f"Build vector error: {e}")
            return None, 0

    def _save_user_vector_to_db(self, user_id: str, vector: np.ndarray, count: int):
        try:
            db = self.mongo_client[DB_NAME]
            db.ai_user_vectors.replace_one(
                {"user_id": user_id},
                {"user_id": user_id, "vector": vector.tolist(), "count": count, "last_updated": datetime.now()},
                upsert=True
            )
        except Exception as e:
            logger.error(f"Save vector error: {e}")

    def update_realtime_vector(self, user_id: str, post_id: str, interaction_type: str) -> bool:
        try:
            if not self.is_ready(): return False
            point_uuid = mongo_id_to_uuid(post_id)
            results = self.qdrant.retrieve(collection_name=COLLECTION_NAME, ids=[point_uuid], with_vectors=True)
            if not results: return False

            post_emb = np.array(results[0].vector)
            # Support both full (POST_LIKE) and short (LIKE) interaction type names
            weight = INTERACTION_WEIGHTS.get(interaction_type, INTERACTION_WEIGHTS.get(interaction_type.replace("POST_", ""), 1.0))

            current_vector = self.user_vectors_cache.get(user_id)
            if current_vector is None:
                current_vector, _ = self.get_user_vector(user_id)
                if current_vector is None:
                    self.user_vectors_cache[user_id] = post_emb / np.linalg.norm(post_emb)
                    self.user_interaction_counts[user_id] = 1
                    self._save_user_vector_to_db(user_id, self.user_vectors_cache[user_id], 1)
                    return True

            alpha = 0.3
            post_emb = post_emb / np.linalg.norm(post_emb)
            new_vector = (1 - alpha) * current_vector + alpha * (weight * post_emb)
            norm = np.linalg.norm(new_vector)
            if norm > 0: new_vector = new_vector / norm

            self.user_vectors_cache[user_id] = new_vector
            self.user_interaction_counts[user_id] = self.user_interaction_counts.get(user_id, 0) + 1
            self._save_user_vector_to_db(user_id, new_vector, self.user_interaction_counts[user_id])
            return True
        except Exception as e:
            logger.error(f"Realtime update error: {e}")
            return False

    # ========================================
    # Privacy & Helpers
    # ========================================
    def _filter_privacy(self, posts: List[Dict], user_id: str, friend_ids: List[str]) -> List[Dict]:
        friend_set = set(friend_ids) if friend_ids else set()
        filtered = []
        for post in posts:
            privacy = post.get('privacy', 'PUBLIC')
            owner = post.get('user_id', '')
            group_id = post.get('group_id', '')
            if owner == user_id or privacy == 'PUBLIC':
                filtered.append(post)
            elif privacy == 'FRIEND' and owner in friend_set:
                filtered.append(post)
            elif privacy == 'GROUP' and group_id and group_id != 'no_group':
                filtered.append(post)
        return filtered

    def _get_user_interacted_post_ids(self, user_id: str) -> set:
        # Short TTL cache (30s) to avoid repeated MongoDB queries within the same session
        now = time.time()
        cached_ts = self._interacted_cache_ts.get(user_id, 0)
        if now - cached_ts < 30 and user_id in self._interacted_cache:
            return self._interacted_cache[user_id]
        try:
            db = self.mongo_client[DB_NAME]
            user_oid = ObjectId(user_id)
            ids = set()
            # Single aggregated query for userinteractions (covers most signals)
            for ui in db.userinteractions.find(
                {"userId": user_oid, "targetType": "POST"},
                {"targetId": 1}
            ):
                if ui.get('targetId'): ids.add(str(ui['targetId']))
            # Reactions not tracked by Kafka
            for r in db.reactions.find({"userId": user_oid, "typeFactor": "POST"}, {"factorId": 1}):
                if r.get('factorId'): ids.add(str(r['factorId']))
            # Comments
            for c in db.comments.find({"userId": user_oid}, {"postId": 1}):
                if c.get('postId'): ids.add(str(c['postId']))
            # Shares
            for s in db.posts.find({"userId": user_oid, "sharedPostId": {"$exists": True, "$ne": None}}, {"sharedPostId": 1}):
                if s.get('sharedPostId'): ids.add(str(s['sharedPostId']))
            self._interacted_cache[user_id] = ids
            self._interacted_cache_ts[user_id] = now
            return ids
        except:
            return set()

    def _calculate_recency_boost(self, created_at_str: str) -> float:
        if not created_at_str: return 1.0
        try:
            if isinstance(created_at_str, str):
                try: created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                except:
                    try: created_at = datetime.fromtimestamp(float(created_at_str))
                    except: return 1.0
            else: return 1.0
            
            now = datetime.now(created_at.tzinfo) if created_at.tzinfo else datetime.now()
            days_old = max(0, (now - created_at).days)
            if days_old >= RECENT_DAYS: return 1.0
            return 1.0 + (RECENT_BOOST_MAX - 1.0) * (1 - days_old / RECENT_DAYS)
        except:
            return 1.0

    # ========================================
    # 1. SEARCH
    # ========================================
    def search(self, query: str, current_user_id: str = "", friend_ids: List[str] = None,
               limit: int = 20, page: int = 1, media_type: Optional[str] = None) -> Tuple[List[Dict], int]:
        if not self.is_ready(): return [], 0
        try:
            query_emb = self.model.encode(query, convert_to_numpy=True)
            results = self.qdrant.query_points(
                collection_name=COLLECTION_NAME,
                query=query_emb.tolist(),
                limit=min(200, self.get_total_posts()),
                with_payload=True
            ).points
            posts = []
            for hit in results:
                p = hit.payload
                posts.append({
                    "post_id": p.get("post_id", ""),
                    "score": round(hit.score, 4),
                    "user_id": p.get("user_id", ""),
                    "group_id": p.get("group_id", ""),
                    "privacy": p.get("privacy", "PUBLIC"),
                })

            if current_user_id:
                posts = self._filter_privacy(posts, current_user_id, friend_ids or [])

            total = len(posts)
            offset = (page - 1) * limit
            return posts[offset:offset + limit], total
        except Exception as e:
            logger.error(f"Search error: {e}")
            return [], 0

    # ========================================
    # 2. RECOMMEND
    # ========================================
    def recommend(self, user_id: str, friend_ids: List[str] = None,
                  limit: int = 20, page: int = 1, media_type: Optional[str] = None) -> Tuple[List[Dict], int]:
        if not self.is_ready(): return [], 0
        try:
            friend_set = set(friend_ids) if friend_ids else set()
            user_vector, interaction_count = self.get_user_vector(user_id)
            interacted_post_ids = self._get_user_interacted_post_ids(user_id)

            # Gather hidden post IDs (POST_HIDE) for strong penalty
            hidden_post_ids = set()
            try:
                db = self.mongo_client[DB_NAME]
                user_oid = ObjectId(user_id)
                for ui in db.userinteractions.find(
                    {"userId": user_oid, "interactionType": "POST_HIDE", "targetType": "POST"},
                    {"targetId": 1}
                ):
                    if ui.get('targetId'):
                        hidden_post_ids.add(str(ui['targetId']))
            except:
                pass

            if user_vector is None:
                # Random preference for new user
                user_hash = int(hashlib.md5(user_id.encode()).hexdigest(), 16)
                np.random.seed(user_hash % (2**32))
                dim = self.model.get_sentence_embedding_dimension()
                user_vector = np.random.randn(dim)
                user_vector = user_vector / np.linalg.norm(user_vector)
                np.random.seed(None)

            results = self.qdrant.query_points(
                collection_name=COLLECTION_NAME,
                query=user_vector.tolist(),
                limit=min(200, self.get_total_posts()),
                with_payload=True
            ).points

            posts = []
            for hit in results:
                p = hit.payload
                post_id = p.get("post_id", "")
                owner = p.get("user_id", "")
                created_at = p.get("created_at", "")

                # Skip hidden posts entirely
                if post_id in hidden_post_ids:
                    continue
                
                score = hit.score
                if owner in friend_set: score *= 1.2
                if owner == user_id: score *= 0.5
                score *= self._calculate_recency_boost(created_at)
                if post_id in interacted_post_ids: score *= (1.0 - VIEWED_PENALTY)

                posts.append({
                    "post_id": post_id,
                    "score": round(score, 4),
                    "user_id": owner,
                    "group_id": p.get("group_id", ""),
                    "privacy": p.get("privacy", "PUBLIC"),
                    "is_viewed": post_id in interacted_post_ids,
                    "recency_boost": round(self._calculate_recency_boost(created_at), 2)
                })

            posts = self._filter_privacy(posts, user_id, friend_ids or [])
            total = len(posts)

            # Weighted random shuffle
            if len(posts) > 5:
                high = [p for p in posts if p['score'] >= 0.6]
                mid = [p for p in posts if 0.4 <= p['score'] < 0.6]
                low = [p for p in posts if p['score'] < 0.4]

                def weighted_shuffle(lst):
                    if not lst: return []
                    scores = np.array([max(p['score'], 0.01) for p in lst])
                    probs = scores / scores.sum()
                    try:
                        indices = np.random.choice(len(lst), size=len(lst), replace=False, p=probs)
                        return [lst[i] for i in indices]
                    except:
                        random.shuffle(lst)
                        return lst

                posts = weighted_shuffle(high) + weighted_shuffle(mid)
                random.shuffle(low)
                posts += low

            offset = (page - 1) * limit
            paginated = posts[offset:offset + limit]
            logger.info(f"📰 Recommend {user_id}: {interaction_count} interactions, {total} posts, page {page}")
            return paginated, total
        except Exception as e:
            logger.error(f"Recommend error: {e}")
            import traceback; traceback.print_exc()
            return [], 0

    def get_newsfeed(self, user_id: str, friend_ids: List[str] = None,
                     limit: int = 20, page: int = 1, media_type: Optional[str] = None) -> Tuple[List[Dict], int]:
        return self.recommend(user_id, friend_ids, limit, page, media_type)

    # ========================================
    # 3. SIMILAR
    # ========================================
    def similar(self, post_id: str, limit: int = 10, page: int = 1) -> Tuple[List[Dict], int]:
        if not self.is_ready(): return [], 0
        try:
            point_uuid = mongo_id_to_uuid(post_id)
            results = self.qdrant.retrieve(collection_name=COLLECTION_NAME, ids=[point_uuid], with_vectors=True)
            if not results: return [], 0

            source_emb = results[0].vector
            search_results = self.qdrant.query_points(
                collection_name=COLLECTION_NAME,
                query=source_emb,
                limit=min(100, self.get_total_posts()),
                with_payload=True
            ).points

            posts = []
            for hit in search_results:
                pid = hit.payload.get("post_id", "")
                if pid == post_id: continue
                posts.append({
                    "post_id": pid,
                    "score": round(hit.score, 4),
                    "user_id": hit.payload.get("user_id", ""),
                    "group_id": hit.payload.get("group_id", ""),
                    "privacy": hit.payload.get("privacy", "PUBLIC")
                })

            total = len(posts)
            offset = (page - 1) * limit
            return posts[offset:offset + limit], total
        except Exception as e:
            logger.error(f"Similar error: {e}")
            return [], 0


_service: Optional[RecommendationService] = None

def get_recommendation_service() -> RecommendationService:
    global _service
    if _service is None:
        _service = RecommendationService()
    return _service
