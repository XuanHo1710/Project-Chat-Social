"""Qdrant recommendation service with MongoDB-authoritative privacy checks."""

from __future__ import annotations

import hashlib
import queue
import threading
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np
from bson import ObjectId
from loguru import logger
from pymongo import MongoClient
from qdrant_client import QdrantClient
from qdrant_client.models import FieldCondition, Filter, MatchAny, MatchValue, PointStruct
from sentence_transformers import SentenceTransformer

from app.config import get_settings
from app.services.chunking_service import chunk_text


settings = get_settings()
MODEL_NAME = settings.embedding_model
DB_NAME = settings.mongodb_database
COLLECTION_NAME = settings.qdrant_collection_posts
USER_COLLECTION = settings.qdrant_collection_users
QUERY_COLLECTION = settings.qdrant_collection_queries
IS_E5_MODEL = "e5" in MODEL_NAME.lower()

INTERACTION_WEIGHTS = {
    "SHARE": 2.5,
    "COMMENT": 1.5,
    "LOVE": 1.3,
    "LIKE": 1.0,
    "HAHA": 0.8,
    "WOW": 0.7,
    "SAD": 0.3,
    "ANGRY": -0.5,
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
QUERY_STORE_QUEUE_MAX = 500


def mongo_id_to_uuid(value: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, value))


def _valid_object_id(value: str) -> bool:
    return bool(value) and ObjectId.is_valid(value)


def _batched(values: List[str], size: int = 100) -> Iterable[List[str]]:
    for start in range(0, len(values), size):
        yield values[start : start + size]


@dataclass(frozen=True)
class AccessContext:
    actor_id: Optional[ObjectId]
    friend_ids: frozenset[ObjectId]
    blocked_ids: frozenset[ObjectId]
    accessible_group_ids: frozenset[ObjectId]


class RecommendationService:
    def __init__(self):
        self._qdrant: Optional[QdrantClient] = None
        self._model: Optional[SentenceTransformer] = None
        self._mongo_client: Optional[MongoClient] = None
        self._model_lock = threading.RLock()
        self._collection_lock = threading.RLock()
        self._collection_info = None
        self._collection_info_at = 0.0
        self._ready_cache = False
        self._ready_cache_at = 0.0
        self._canonical_count = 0
        self._canonical_count_at = 0.0
        self._query_queue: Optional[queue.Queue] = None
        self.user_vectors_cache: Dict[str, np.ndarray] = {}
        self.user_interaction_counts: Dict[str, int] = {}
        self._interacted_cache: Dict[str, set[str]] = {}
        self._interacted_cache_at: Dict[str, float] = {}

    @property
    def qdrant(self) -> QdrantClient:
        if self._qdrant is None:
            self._qdrant = QdrantClient(
                url=settings.qdrant_url,
                api_key=settings.qdrant_api_key,
                timeout=10,
            )
        return self._qdrant

    @property
    def model(self) -> SentenceTransformer:
        if self._model is None:
            with self._model_lock:
                if self._model is None:
                    logger.info(f"Loading embedding model {MODEL_NAME}")
                    self._model = SentenceTransformer(MODEL_NAME)
        return self._model

    @property
    def mongo_client(self) -> MongoClient:
        if self._mongo_client is None:
            self._mongo_client = MongoClient(
                settings.mongodb_uri,
                maxPoolSize=10,
                serverSelectionTimeoutMS=3000,
                connectTimeoutMS=3000,
                socketTimeoutMS=10000,
            )
        return self._mongo_client

    @property
    def db(self):
        return self.mongo_client[DB_NAME]

    def close(self) -> None:
        if self._qdrant is not None:
            self._qdrant.close()
            self._qdrant = None
        if self._mongo_client is not None:
            self._mongo_client.close()
            self._mongo_client = None

    def _reset_qdrant(self) -> None:
        if self._qdrant is not None:
            try:
                self._qdrant.close()
            except Exception:
                pass
        self._qdrant = None
        self._invalidate_collection_cache()

    def _invalidate_collection_cache(self) -> None:
        self._collection_info = None
        self._collection_info_at = 0.0
        self._ready_cache_at = 0.0

    def refresh_after_retrain(self) -> None:
        self._invalidate_collection_cache()
        self._canonical_count_at = 0.0
        self.user_vectors_cache.clear()
        self.user_interaction_counts.clear()

    def _get_collection_info(self):
        with self._collection_lock:
            if self._collection_info is not None and time.time() - self._collection_info_at < 30:
                return self._collection_info
            try:
                self._collection_info = self.qdrant.get_collection(COLLECTION_NAME)
                self._collection_info_at = time.time()
                return self._collection_info
            except Exception as exc:
                logger.warning(f"Qdrant collection is unavailable: {exc}")
                self._reset_qdrant()
                return None

    def is_ready(self) -> bool:
        if time.time() - self._ready_cache_at < 15:
            return self._ready_cache
        info = self._get_collection_info()
        if info is None or not info.points_count:
            self._ready_cache = False
            self._ready_cache_at = time.time()
            return False
        try:
            points, _ = self.qdrant.scroll(
                collection_name=COLLECTION_NAME,
                limit=1,
                with_payload=["embedding_model"],
                with_vectors=False,
            )
            # Old collections without a model marker must be rebuilt; equal
            # dimensions alone cannot prove semantic compatibility.
            compatible = bool(points) and points[0].payload.get("embedding_model") == MODEL_NAME
            if compatible:
                self.db.command("ping")
            self._ready_cache = compatible
        except Exception as exc:
            logger.warning(f"Unable to verify vector model compatibility: {exc}")
            self._ready_cache = False
        self._ready_cache_at = time.time()
        return self._ready_cache

    def get_total_vectors(self) -> int:
        info = self._get_collection_info()
        return int(info.points_count or 0) if info else 0

    def get_total_posts(self) -> int:
        if time.time() - self._canonical_count_at < 30:
            return self._canonical_count
        try:
            self._canonical_count = self.db.posts.count_documents(
                {
                    "isDeleted": {"$ne": True},
                    "isActive": {"$ne": False},
                    "content": {"$type": "string", "$ne": ""},
                }
            )
            self._canonical_count_at = time.time()
        except Exception as exc:
            logger.warning(f"Unable to count canonical posts: {exc}")
        return self._canonical_count

    def _encode(self, texts, *, normalize: bool = True):
        with self._model_lock:
            return self.model.encode(
                texts,
                convert_to_numpy=True,
                normalize_embeddings=normalize,
            )

    def warm_up(self) -> bool:
        """Load the embedding model eagerly and exercise one encode."""
        try:
            self._encode("warmup")
            return True
        except Exception as exc:
            logger.warning(f"Embedding model warm-up failed: {exc}")
            return False

    def _candidate_limit(self, page: int, limit: int) -> int:
        requested = max(settings.search_top_k, page * limit) * 8
        return min(self.get_total_vectors(), settings.vector_candidate_limit, requested)

    # ------------------------------------------------------------------
    # Canonical privacy
    # ------------------------------------------------------------------
    def _get_access_context(self, user_id: str) -> AccessContext:
        if not _valid_object_id(user_id):
            return AccessContext(None, frozenset(), frozenset(), frozenset())

        actor_id = ObjectId(user_id)
        relationships = self.db.relationships.find(
            {
                "$or": [{"userId": actor_id}, {"friendId": actor_id}],
                "status": {"$in": ["ACCEPTED", "BLOCKED"]},
            },
            {"userId": 1, "friendId": 1, "status": 1},
        )
        friend_ids: set[ObjectId] = set()
        blocked_ids: set[ObjectId] = set()
        for relationship in relationships:
            other = (
                relationship.get("friendId")
                if relationship.get("userId") == actor_id
                else relationship.get("userId")
            )
            if not isinstance(other, ObjectId):
                continue
            if relationship.get("status") == "ACCEPTED":
                friend_ids.add(other)
            elif relationship.get("status") == "BLOCKED":
                blocked_ids.add(other)

        member_group_ids = list(
            self.db.groupmembers.distinct(
                "groupId",
                {"userId": actor_id, "status": "APPROVED"},
            )
        )
        group_query: Dict = {
            "isActive": {"$ne": False},
            "$or": [{"privacy": "PUBLIC"}],
        }
        if member_group_ids:
            group_query["$or"].append({"_id": {"$in": member_group_ids}})
        accessible_group_ids = frozenset(
            group["_id"] for group in self.db.groups.find(group_query, {"_id": 1})
        )
        return AccessContext(
            actor_id,
            frozenset(friend_ids),
            frozenset(blocked_ids),
            accessible_group_ids,
        )

    def _authorized_documents(
        self,
        post_ids: List[str],
        user_id: str,
        projection: Optional[Dict] = None,
        *,
        public_only: bool = False,
        context: Optional[AccessContext] = None,
    ) -> Dict[str, Dict]:
        id_map = {value: ObjectId(value) for value in post_ids if _valid_object_id(value)}
        if not id_map:
            return {}

        context = context or self._get_access_context(user_id)
        base_query: Dict = {
            "_id": {"$in": list(id_map.values())},
            "isDeleted": {"$ne": True},
            "isActive": {"$ne": False},
        }
        public_filter = {"privacy": "PUBLIC", "groupId": None}
        if public_only or context.actor_id is None:
            base_query.update(public_filter)
        else:
            visible = [
                {"userId": context.actor_id, "groupId": None},
                {
                    **public_filter,
                    "userId": {"$nin": list(context.blocked_ids)},
                },
            ]
            if context.friend_ids:
                visible.append(
                    {
                        "privacy": "FRIEND",
                        "groupId": None,
                        "userId": {"$in": list(context.friend_ids - context.blocked_ids)},
                    }
                )
            if context.accessible_group_ids:
                visible.append(
                    {
                        "privacy": "GROUP",
                        "groupId": {"$in": list(context.accessible_group_ids)},
                        "userId": {"$nin": list(context.blocked_ids)},
                    }
                )
            base_query["$or"] = visible

        result: Dict[str, Dict] = {}
        for document in self.db.posts.find(base_query, projection):
            result[str(document["_id"])] = document
        return result

    def filter_authorized_candidates(
        self,
        posts: List[Dict],
        user_id: str,
        *,
        public_only: bool = False,
        context: Optional[AccessContext] = None,
    ) -> List[Dict]:
        allowed = self._authorized_documents(
            [post.get("post_id", "") for post in posts],
            user_id,
            {"_id": 1},
            public_only=public_only,
            context=context,
        )
        return [post for post in posts if post.get("post_id") in allowed]

    def get_rag_documents(self, post_ids: List[str], user_id: str) -> List[Dict]:
        # Private/friend/group content is not exported to an external LLM unless
        # deployment explicitly enables that governance boundary.
        documents = self._authorized_documents(
            post_ids,
            user_id,
            {"content": 1},
            public_only=not settings.llm_rag_allow_non_public,
        )
        return [documents[post_id] for post_id in post_ids if post_id in documents]

    # ------------------------------------------------------------------
    # Vector persistence
    # ------------------------------------------------------------------
    @staticmethod
    def _post_filter(post_ids: List[str]) -> Filter:
        match = MatchValue(value=post_ids[0]) if len(post_ids) == 1 else MatchAny(any=post_ids)
        return Filter(must=[FieldCondition(key="post_id", match=match)])

    def _scroll_post_points(self, post_ids: List[str], *, with_vectors: bool):
        records = []
        for batch in _batched(post_ids):
            offset = None
            while True:
                page, offset = self.qdrant.scroll(
                    collection_name=COLLECTION_NAME,
                    scroll_filter=self._post_filter(batch),
                    limit=256,
                    offset=offset,
                    with_payload=True,
                    with_vectors=with_vectors,
                )
                records.extend(page)
                if offset is None:
                    break
        return records

    def _get_post_vectors(self, post_ids: List[str]) -> Dict[str, np.ndarray]:
        vectors: Dict[str, List[np.ndarray]] = defaultdict(list)
        for point in self._scroll_post_points(post_ids, with_vectors=True):
            post_id = str(point.payload.get("post_id", ""))
            if post_id and point.vector:
                vectors[post_id].append(np.asarray(point.vector, dtype=float))
        result: Dict[str, np.ndarray] = {}
        for post_id, chunks in vectors.items():
            vector = np.mean(chunks, axis=0)
            norm = np.linalg.norm(vector)
            if norm:
                result[post_id] = vector / norm
        return result

    def replace_post_embedding(self, post_id: str) -> int:
        if not _valid_object_id(post_id):
            raise ValueError("Invalid post identifier")
        post = self.db.posts.find_one(
            {
                "_id": ObjectId(post_id),
                "isDeleted": {"$ne": True},
                "isActive": {"$ne": False},
            },
            {"content": 1, "userId": 1, "privacy": 1, "groupId": 1, "createdAt": 1, "media": 1},
        )
        if not post:
            self.delete_post_embeddings(post_id)
            return 0

        content = str(post.get("content", "")).strip()[:10000]
        chunks = chunk_text(content, settings.chunk_max_size, settings.chunk_overlap) if len(content) >= 5 else []
        existing = self._scroll_post_points([post_id], with_vectors=False)
        existing_ids = {str(point.id) for point in existing}
        legacy_id = mongo_id_to_uuid(post_id)

        if not chunks:
            if existing_ids:
                self.qdrant.delete(COLLECTION_NAME, list(existing_ids), wait=True)
            return 0

        texts = [f"passage: {chunk}" if IS_E5_MODEL else chunk for chunk in chunks]
        embeddings = self._encode(texts)
        if embeddings.ndim == 1:
            embeddings = embeddings.reshape(1, -1)

        media = post.get("media") or []
        media_type = "VIDEO" if any(item.get("mediaType") == "VIDEO" for item in media) else ("IMAGE" if media else "TEXT")
        created_at = post.get("createdAt")
        created_at_value = created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at or "")
        new_ids = {mongo_id_to_uuid(f"{post_id}_chunk_{index}") for index in range(len(chunks))}
        points = [
            PointStruct(
                id=mongo_id_to_uuid(f"{post_id}_chunk_{index}"),
                vector=embedding.tolist(),
                payload={
                    "post_id": post_id,
                    "chunk_index": index,
                    "total_chunks": len(chunks),
                    "user_id": str(post.get("userId", "")),
                    "privacy": str(post.get("privacy") or "PUBLIC").upper(),
                    "group_id": str(post.get("groupId") or "no_group"),
                    "media_type": media_type,
                    "created_at": created_at_value,
                    "embedding_model": MODEL_NAME,
                    "score": 0.5,
                },
            )
            for index, embedding in enumerate(embeddings)
        ]
        self.qdrant.upsert(COLLECTION_NAME, points, wait=True)
        stale_ids = (existing_ids | {legacy_id}) - new_ids
        if stale_ids:
            self.qdrant.delete(COLLECTION_NAME, list(stale_ids), wait=True)
        self._invalidate_collection_cache()
        self._canonical_count_at = 0
        return len(points)

    def delete_post_embeddings(self, post_id: str) -> None:
        if not _valid_object_id(post_id):
            raise ValueError("Invalid post identifier")
        self.qdrant.delete(
            collection_name=COLLECTION_NAME,
            points_selector=self._post_filter([post_id]),
            wait=True,
        )
        # Remove a pre-chunking legacy point as well.
        self.qdrant.delete(
            collection_name=COLLECTION_NAME,
            points_selector=[mongo_id_to_uuid(post_id)],
            wait=True,
        )
        self._invalidate_collection_cache()
        self._canonical_count_at = 0

    # ------------------------------------------------------------------
    # User vectors
    # ------------------------------------------------------------------
    def _save_user_vector(self, user_id: str, vector: np.ndarray, count: int) -> None:
        self.db.ai_user_vectors.replace_one(
            {"user_id": user_id},
            {
                "user_id": user_id,
                "vector": vector.tolist(),
                "count": count,
                "embedding_model": MODEL_NAME,
                "last_updated": datetime.utcnow(),
            },
            upsert=True,
        )
        try:
            self.qdrant.upsert(
                collection_name=USER_COLLECTION,
                points=[
                    PointStruct(
                        id=mongo_id_to_uuid(user_id),
                        vector=vector.tolist(),
                        payload={
                            "user_id": user_id,
                            "interaction_count": count,
                            "embedding_model": MODEL_NAME,
                        },
                    )
                ],
                wait=True,
            )
        except Exception as exc:
            logger.warning(f"Unable to persist user vector in Qdrant: {exc}")

    def get_user_vector(self, user_id: str) -> Tuple[Optional[np.ndarray], int]:
        if not _valid_object_id(user_id):
            return None, 0
        cached = self.user_vectors_cache.get(user_id)
        if cached is not None:
            return cached, self.user_interaction_counts.get(user_id, 0)

        try:
            records = self.qdrant.retrieve(
                collection_name=USER_COLLECTION,
                ids=[mongo_id_to_uuid(user_id)],
                with_vectors=True,
            )
            if records and records[0].vector and records[0].payload.get("embedding_model") == MODEL_NAME:
                vector = np.asarray(records[0].vector, dtype=float)
                count = int(records[0].payload.get("interaction_count", 0))
                self.user_vectors_cache[user_id] = vector
                self.user_interaction_counts[user_id] = count
                return vector, count
        except Exception:
            pass

        stored = self.db.ai_user_vectors.find_one(
            {"user_id": user_id, "embedding_model": MODEL_NAME},
            {"vector": 1, "count": 1},
        )
        if stored and stored.get("vector"):
            vector = np.asarray(stored["vector"], dtype=float)
            count = int(stored.get("count", 0))
            self.user_vectors_cache[user_id] = vector
            self.user_interaction_counts[user_id] = count
            return vector, count

        return self._build_and_save_vector_from_scratch(user_id)

    @staticmethod
    def _record_weight(weights: Dict[str, float], post_id, weight: float) -> None:
        value = str(post_id or "")
        if not _valid_object_id(value) or weight == 0:
            return
        existing = weights.get(value)
        if existing is None or abs(weight) > abs(existing):
            weights[value] = weight

    def _build_and_save_vector_from_scratch(self, user_id: str) -> Tuple[Optional[np.ndarray], int]:
        if not _valid_object_id(user_id):
            return None, 0
        actor_id = ObjectId(user_id)
        weights: Dict[str, float] = {}

        for reaction in self.db.reactions.find(
            {"userId": actor_id, "typeFactor": "POST", "isDeleted": {"$ne": True}},
            {"factorId": 1, "type": 1},
        ):
            self._record_weight(
                weights,
                reaction.get("factorId"),
                INTERACTION_WEIGHTS.get(reaction.get("type", "LIKE"), 0.5),
            )
        for comment in self.db.comments.find(
            {"userId": actor_id, "isDeleted": {"$ne": True}},
            {"postId": 1},
        ):
            self._record_weight(weights, comment.get("postId"), INTERACTION_WEIGHTS["COMMENT"])
        for interaction in self.db.userinteractions.find(
            {"userId": actor_id, "targetType": {"$in": ["POST", "REEL"]}},
            {"targetId": 1, "interactionType": 1, "metadata": 1},
        ):
            interaction_type = interaction.get("interactionType", "")
            weight = INTERACTION_WEIGHTS.get(interaction_type, 0.0)
            if interaction_type == "POST_LIKE":
                reaction_type = (interaction.get("metadata") or {}).get("reactionType")
                weight = INTERACTION_WEIGHTS.get(reaction_type, weight)
            self._record_weight(weights, interaction.get("targetId"), weight)

        if not weights:
            return None, 0
        post_vectors = self._get_post_vectors(list(weights))
        weighted = []
        total_weight = 0.0
        for post_id, weight in weights.items():
            vector = post_vectors.get(post_id)
            if vector is None:
                continue
            weighted.append(vector * weight)
            total_weight += abs(weight)
        if not weighted or not total_weight:
            return None, 0

        user_vector = np.sum(weighted, axis=0) / total_weight
        norm = np.linalg.norm(user_vector)
        if not norm:
            return None, 0
        user_vector /= norm
        count = len(weighted)
        self._save_user_vector(user_id, user_vector, count)
        self.user_vectors_cache[user_id] = user_vector
        self.user_interaction_counts[user_id] = count
        return user_vector, count

    def update_realtime_vector(self, user_id: str, post_id: str, _: str) -> bool:
        """Rebuild from canonical interactions so duplicate events are idempotent."""
        if not _valid_object_id(user_id) or not _valid_object_id(post_id) or not self.is_ready():
            return False
        self.user_vectors_cache.pop(user_id, None)
        self.user_interaction_counts.pop(user_id, None)
        vector, _count = self._build_and_save_vector_from_scratch(user_id)
        return vector is not None

    def _get_interacted_post_ids(self, user_id: str) -> set[str]:
        if not _valid_object_id(user_id):
            return set()
        if (
            user_id in self._interacted_cache
            and time.time() - self._interacted_cache_at.get(user_id, 0) < 30
        ):
            return self._interacted_cache[user_id]
        actor_id = ObjectId(user_id)
        ids: set[str] = set()
        for interaction in self.db.userinteractions.find(
            {"userId": actor_id, "targetType": {"$in": ["POST", "REEL"]}},
            {"targetId": 1},
        ):
            if interaction.get("targetId"):
                ids.add(str(interaction["targetId"]))
        for reaction in self.db.reactions.find(
            {"userId": actor_id, "typeFactor": "POST", "isDeleted": {"$ne": True}},
            {"factorId": 1},
        ):
            if reaction.get("factorId"):
                ids.add(str(reaction["factorId"]))
        for comment in self.db.comments.find(
            {"userId": actor_id, "isDeleted": {"$ne": True}},
            {"postId": 1},
        ):
            if comment.get("postId"):
                ids.add(str(comment["postId"]))
        self._interacted_cache[user_id] = ids
        self._interacted_cache_at[user_id] = time.time()
        return ids

    @staticmethod
    def _recency_boost(value: str) -> float:
        if not value:
            return 1.0
        try:
            created_at = datetime.fromisoformat(value.replace("Z", "+00:00"))
            now = datetime.now(created_at.tzinfo) if created_at.tzinfo else datetime.now()
            days_old = max(0, (now - created_at).days)
            if days_old >= RECENT_DAYS:
                return 1.0
            return 1.0 + (RECENT_BOOST_MAX - 1.0) * (1 - days_old / RECENT_DAYS)
        except (TypeError, ValueError, OverflowError):
            return 1.0

    # ------------------------------------------------------------------
    # Search and recommendation
    # ------------------------------------------------------------------
    def _query_points(self, vector: np.ndarray, candidate_limit: int):
        if candidate_limit <= 0:
            return []
        return self.qdrant.query_points(
            collection_name=COLLECTION_NAME,
            query=vector.tolist(),
            limit=candidate_limit,
            with_payload=True,
        ).points

    def search(
        self,
        query: str,
        current_user_id: str = "",
        friend_ids: Optional[List[str]] = None,
        limit: int = 20,
        page: int = 1,
        media_type: Optional[str] = None,
    ) -> Tuple[List[Dict], int]:
        del friend_ids  # Client-supplied friendship is never an authorization source.
        query = query.strip()[:500]
        if not query or not self.is_ready():
            return [], 0
        query_text = f"query: {query}" if IS_E5_MODEL else query
        embedding = self._encode(query_text)
        hits = self._query_points(embedding, self._candidate_limit(page, limit))
        wanted_media = media_type.upper() if media_type else None
        best: Dict[str, Dict] = {}
        for hit in hits:
            payload = hit.payload or {}
            post_id = str(payload.get("post_id", ""))
            if not post_id or (wanted_media and payload.get("media_type") != wanted_media):
                continue
            candidate = {
                "post_id": post_id,
                "score": round(float(hit.score), 4),
                "user_id": str(payload.get("user_id", "")),
                "group_id": str(payload.get("group_id", "")),
                "privacy": str(payload.get("privacy", "PUBLIC")),
            }
            if post_id not in best or candidate["score"] > best[post_id]["score"]:
                best[post_id] = candidate
        posts = sorted(best.values(), key=lambda item: (-item["score"], item["post_id"]))
        posts = self.filter_authorized_candidates(posts, current_user_id)
        total = len(posts)
        offset = (page - 1) * limit
        if settings.store_query_embeddings:
            self._store_query_async(query, embedding, current_user_id)
        return posts[offset : offset + limit], total

    def _ensure_query_store_worker(self) -> None:
        if self._query_queue is None:
            with self._model_lock:
                if self._query_queue is None:
                    self._query_queue = queue.Queue(maxsize=QUERY_STORE_QUEUE_MAX)
                    threading.Thread(
                        target=self._query_store_worker,
                        name="query-embedding-store",
                        daemon=True,
                    ).start()

    def _query_store_worker(self) -> None:
        while True:
            query, embedding, user_id = self._query_queue.get()
            try:
                point_id = mongo_id_to_uuid(
                    f"query_{hashlib.sha256(query.encode()).hexdigest()}_{time.time_ns()}"
                )
                self.qdrant.upsert(
                    QUERY_COLLECTION,
                    [
                        PointStruct(
                            id=point_id,
                            vector=embedding.tolist(),
                            payload={
                                "query": query[:500],
                                "user_id": user_id if _valid_object_id(user_id) else "",
                                "timestamp": datetime.utcnow().isoformat(),
                                "embedding_model": MODEL_NAME,
                            },
                        )
                    ],
                )
            except Exception as exc:
                logger.debug(f"Query embedding was not stored: {exc}")
            finally:
                self._query_queue.task_done()

    def _store_query_async(self, query: str, embedding: np.ndarray, user_id: str) -> None:
        self._ensure_query_store_worker()
        try:
            self._query_queue.put_nowait((query, embedding, user_id))
        except queue.Full:
            logger.debug("Query embedding store queue is full; dropping entry")

    def recommend(
        self,
        user_id: str,
        friend_ids: Optional[List[str]] = None,
        limit: int = 20,
        page: int = 1,
        media_type: Optional[str] = None,
    ) -> Tuple[List[Dict], int]:
        del friend_ids
        if not _valid_object_id(user_id) or not self.is_ready():
            return [], 0
        context = self._get_access_context(user_id)
        friend_set = {str(value) for value in context.friend_ids}
        user_vector, interaction_count = self.get_user_vector(user_id)
        if user_vector is None:
            seed = int(hashlib.sha256(user_id.encode()).hexdigest(), 16) % (2**32)
            rng = np.random.default_rng(seed)
            user_vector = rng.standard_normal(self.model.get_sentence_embedding_dimension())
            user_vector /= np.linalg.norm(user_vector)

        interacted = self._get_interacted_post_ids(user_id)
        hidden = {
            str(value)
            for value in self.db.userinteractions.distinct(
                "targetId",
                {
                    "userId": ObjectId(user_id),
                    "interactionType": "POST_HIDE",
                    "targetType": "POST",
                },
            )
        }
        hits = self._query_points(user_vector, self._candidate_limit(page, limit))
        wanted_media = media_type.upper() if media_type else None
        best: Dict[str, Tuple[float, Dict]] = {}
        for hit in hits:
            payload = hit.payload or {}
            post_id = str(payload.get("post_id", ""))
            if (
                not post_id
                or post_id in hidden
                or (wanted_media and payload.get("media_type") != wanted_media)
            ):
                continue
            if post_id not in best or hit.score > best[post_id][0]:
                best[post_id] = (float(hit.score), payload)

        posts: List[Dict] = []
        for post_id, (base_score, payload) in best.items():
            owner = str(payload.get("user_id", ""))
            boost = self._recency_boost(str(payload.get("created_at", "")))
            score = base_score * boost
            if owner in friend_set:
                score *= 1.2
            if owner == user_id:
                score *= 0.5
            if post_id in interacted:
                score *= 1.0 - VIEWED_PENALTY
            posts.append(
                {
                    "post_id": post_id,
                    "score": round(score, 4),
                    "user_id": owner,
                    "group_id": str(payload.get("group_id", "")),
                    "privacy": str(payload.get("privacy", "PUBLIC")),
                    "is_viewed": post_id in interacted,
                    "recency_boost": round(boost, 2),
                }
            )
        posts.sort(key=lambda item: (-item["score"], item["post_id"]))
        posts = self.filter_authorized_candidates(posts, user_id, context=context)
        total = len(posts)
        offset = (page - 1) * limit
        logger.info(
            f"Recommendation generated for user ({interaction_count} signals, {total} candidates)"
        )
        return posts[offset : offset + limit], total

    def get_newsfeed(
        self,
        user_id: str,
        friend_ids: Optional[List[str]] = None,
        limit: int = 20,
        page: int = 1,
        media_type: Optional[str] = None,
    ) -> Tuple[List[Dict], int]:
        return self.recommend(user_id, friend_ids, limit, page, media_type)

    def similar(
        self,
        post_id: str,
        limit: int = 10,
        page: int = 1,
        current_user_id: str = "",
    ) -> Tuple[List[Dict], int]:
        if not _valid_object_id(post_id) or not self.is_ready():
            return [], 0
        context = self._get_access_context(current_user_id)
        if not self._authorized_documents(
            [post_id],
            current_user_id,
            {"_id": 1},
            context=context,
        ):
            return [], 0
        vectors = self._get_post_vectors([post_id])
        source = vectors.get(post_id)
        if source is None:
            return [], 0
        hits = self._query_points(source, self._candidate_limit(page, limit))
        best: Dict[str, Dict] = {}
        for hit in hits:
            payload = hit.payload or {}
            candidate_id = str(payload.get("post_id", ""))
            if not candidate_id or candidate_id == post_id:
                continue
            candidate = {
                "post_id": candidate_id,
                "score": round(float(hit.score), 4),
                "user_id": str(payload.get("user_id", "")),
                "group_id": str(payload.get("group_id", "")),
                "privacy": str(payload.get("privacy", "PUBLIC")),
            }
            if candidate_id not in best or candidate["score"] > best[candidate_id]["score"]:
                best[candidate_id] = candidate
        posts = sorted(best.values(), key=lambda item: (-item["score"], item["post_id"]))
        posts = self.filter_authorized_candidates(
            posts,
            current_user_id,
            context=context,
        )
        total = len(posts)
        offset = (page - 1) * limit
        return posts[offset : offset + limit], total


_service: Optional[RecommendationService] = None
_service_lock = threading.Lock()


def get_recommendation_service() -> RecommendationService:
    global _service
    if _service is None:
        with _service_lock:
            if _service is None:
                _service = RecommendationService()
    return _service
