"""
LLM SERVICE
===========
Tích hợp LLM (Ollama/OpenAI) để:
1. Expand query - mở rộng từ khóa tìm kiếm
2. Understand intent - hiểu ý định người dùng
3. Generate topic keywords - tạo keywords từ chủ đề
4. Rerank results - sắp xếp lại kết quả dựa trên context
"""

import os
import httpx
from typing import List, Dict, Optional, Tuple
from loguru import logger
import json
import asyncio

# Config
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "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")
USE_OPENAI = bool(OPENAI_API_KEY)

# Timeout settings
REQUEST_TIMEOUT = 30.0


class LLMService:
    def __init__(self):
        self._client = None
        self._is_available = None
    
    @property
    def client(self):
        if self._client is None:
            self._client = httpx.Client(timeout=REQUEST_TIMEOUT)
        return self._client
    
    async def _async_client(self):
        return httpx.AsyncClient(timeout=REQUEST_TIMEOUT)
    
    def is_available(self) -> bool:
        """Kiểm tra LLM có sẵn không"""
        if self._is_available is not None:
            return self._is_available
        
        try:
            if USE_OPENAI:
                # Check OpenAI
                response = self.client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {OPENAI_API_KEY}"}
                )
                self._is_available = response.status_code == 200
            else:
                # Check Ollama
                response = self.client.get(f"{OLLAMA_HOST}/api/tags")
                self._is_available = response.status_code == 200
            
            if self._is_available:
                logger.info(f"✅ LLM available: {'OpenAI' if USE_OPENAI else 'Ollama'}")
            return self._is_available
        except Exception as e:
            logger.warning(f"⚠️ LLM not available: {e}")
            self._is_available = False
            return False
    
    def _call_ollama(self, prompt: str, system: str = "") -> str:
        """Gọi Ollama API"""
        try:
            response = self.client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "system": system,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 256
                    }
                }
            )
            if response.status_code == 200:
                return response.json().get("response", "")
            return ""
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            return ""
    
    def _call_openai(self, prompt: str, system: str = "") -> str:
        """Gọi OpenAI API"""
        try:
            messages = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})
            
            response = self.client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-3.5-turbo",
                    "messages": messages,
                    "temperature": 0.3,
                    "max_tokens": 256
                }
            )
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"]
            return ""
        except Exception as e:
            logger.error(f"OpenAI error: {e}")
            return ""
    
    def _call_llm(self, prompt: str, system: str = "") -> str:
        """Wrapper để gọi LLM (OpenAI hoặc Ollama)"""
        if not self.is_available():
            return ""
        
        if USE_OPENAI:
            return self._call_openai(prompt, system)
        return self._call_ollama(prompt, system)
    
    # ========================================
    # 1. EXPAND QUERY - Mở rộng từ khóa tìm kiếm
    # ========================================
    def expand_query(self, query: str, language: str = "vi") -> List[str]:
        """
        Mở rộng query thành các từ khóa liên quan.
        Giúp tìm kiếm chính xác hơn.
        
        Input: "phim hay"
        Output: ["phim hay", "movie", "film", "điện ảnh", "xem phim", "review phim"]
        """
        if not self.is_available():
            return [query]
        
        system = """You are a search query expander for a Vietnamese social network.
Given a search query, generate related keywords and synonyms.
Output ONLY a JSON array of strings, nothing else.
Include the original query and 3-5 related terms.
Mix Vietnamese and English if relevant."""
        
        prompt = f'Expand this search query: "{query}"'
        
        try:
            response = self._call_llm(prompt, system)
            # Parse JSON array
            keywords = json.loads(response)
            if isinstance(keywords, list):
                # Ensure original query is first
                if query not in keywords:
                    keywords.insert(0, query)
                return keywords[:6]  # Max 6 keywords
        except:
            pass
        
        return [query]
    
    # ========================================
    # 2. UNDERSTAND INTENT - Hiểu ý định người dùng
    # ========================================
    def understand_intent(self, query: str) -> Dict:
        """
        Phân tích intent của query.
        
        Returns:
            {
                "intent": "search_topic" | "find_person" | "find_group" | "general",
                "topic": "technology" | "entertainment" | "sports" | ...,
                "sentiment": "positive" | "negative" | "neutral",
                "keywords": ["keyword1", "keyword2"]
            }
        """
        if not self.is_available():
            return {
                "intent": "general",
                "topic": "general",
                "sentiment": "neutral",
                "keywords": [query]
            }
        
        system = """You are an intent analyzer for a Vietnamese social network.
Analyze the search query and return a JSON object with:
- intent: "search_topic", "find_person", "find_group", or "general"
- topic: main topic category (technology, entertainment, sports, food, travel, fashion, education, business, health, lifestyle, news, other)
- sentiment: "positive", "negative", or "neutral"
- keywords: list of important keywords

Output ONLY valid JSON, nothing else."""
        
        prompt = f'Analyze this query: "{query}"'
        
        try:
            response = self._call_llm(prompt, system)
            result = json.loads(response)
            if isinstance(result, dict):
                return result
        except:
            pass
        
        return {
            "intent": "general",
            "topic": "general", 
            "sentiment": "neutral",
            "keywords": [query]
        }
    
    # ========================================
    # 3. GENERATE TOPIC KEYWORDS - Tạo keywords từ chủ đề
    # ========================================
    def generate_topic_keywords(self, topic: str) -> List[str]:
        """
        Tạo danh sách keywords cho một chủ đề.
        Dùng để gợi ý posts theo chủ đề.
        
        Input: "công nghệ"
        Output: ["AI", "smartphone", "laptop", "coding", "startup", ...]
        """
        if not self.is_available():
            return [topic]
        
        system = """You are a topic keyword generator for a Vietnamese social network.
Given a topic, generate 10 related keywords that users might post about.
Output ONLY a JSON array of strings, nothing else.
Mix Vietnamese and English keywords."""
        
        prompt = f'Generate keywords for topic: "{topic}"'
        
        try:
            response = self._call_llm(prompt, system)
            keywords = json.loads(response)
            if isinstance(keywords, list):
                return keywords[:10]
        except:
            pass
        
        return [topic]
    
    # ========================================
    # 4. RERANK RESULTS - Sắp xếp lại kết quả
    # ========================================
    def rerank_posts(
        self, 
        query: str, 
        posts: List[Dict], 
        top_k: int = 10
    ) -> List[Dict]:
        """
        Sắp xếp lại posts dựa trên relevance với query.
        Sử dụng LLM để đánh giá độ liên quan.
        
        Chỉ dùng cho số lượng nhỏ posts (< 20) vì tốn resources.
        """
        if not self.is_available() or len(posts) <= top_k:
            return posts[:top_k]
        
        # Chỉ lấy content để rerank (giảm tokens)
        post_contents = [
            {"id": i, "content": p.get("content", "")[:200]} 
            for i, p in enumerate(posts[:20])  # Max 20 posts
        ]
        
        system = """You are a search result ranker for a Vietnamese social network.
Given a query and list of posts, rank them by relevance.
Output ONLY a JSON array of post IDs in order of relevance, nothing else.
Most relevant first."""
        
        prompt = f'''Query: "{query}"

Posts:
{json.dumps(post_contents, ensure_ascii=False)}

Return ranked post IDs as JSON array.'''
        
        try:
            response = self._call_llm(prompt, system)
            ranked_ids = json.loads(response)
            if isinstance(ranked_ids, list):
                # Reorder posts based on ranking
                reranked = []
                for idx in ranked_ids:
                    if isinstance(idx, int) and 0 <= idx < len(posts):
                        reranked.append(posts[idx])
                
                # Add any posts not in ranking
                for i, post in enumerate(posts):
                    if i not in ranked_ids:
                        reranked.append(post)
                
                return reranked[:top_k]
        except:
            pass
        
        return posts[:top_k]
    
    # ========================================
    # 5. ENHANCE SEARCH - Tổng hợp các bước
    # ========================================
    def enhance_search(self, query: str) -> Dict:
        """
        Tổng hợp: expand query + understand intent.
        Trả về thông tin để cải thiện search.
        
        Returns:
            {
                "original_query": "phim hay",
                "expanded_queries": ["phim hay", "movie", ...],
                "intent": {...},
                "search_strategy": "semantic" | "keyword" | "hybrid"
            }
        """
        result = {
            "original_query": query,
            "expanded_queries": [query],
            "intent": {
                "intent": "general",
                "topic": "general",
                "sentiment": "neutral",
                "keywords": [query]
            },
            "search_strategy": "hybrid"
        }
        
        if not self.is_available():
            return result
        
        # Run both in sequence (could be parallel with async)
        result["expanded_queries"] = self.expand_query(query)
        result["intent"] = self.understand_intent(query)
        
        # Determine search strategy based on intent
        intent = result["intent"].get("intent", "general")
        if intent == "find_person":
            result["search_strategy"] = "keyword"  # Exact match for names
        elif intent == "search_topic":
            result["search_strategy"] = "semantic"  # Semantic for topics
        else:
            result["search_strategy"] = "hybrid"
        
        return result


# Singleton
_service: Optional[LLMService] = None

def get_llm_service() -> LLMService:
    global _service
    if _service is None:
        _service = LLMService()
    return _service
