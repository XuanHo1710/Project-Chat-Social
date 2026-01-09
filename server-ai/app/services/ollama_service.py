"""
Unified AI Service
Support Ollama LLM and Custom SentenceTransformer Embeddings
"""

import ollama
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Optional, Any
from loguru import logger
import os

from app.config import get_settings

class OllamaService:
    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[ollama.Client] = None
        self._custom_model = None # For custom trained model
        self._is_available: bool = False
        
    @property
    def client(self) -> ollama.Client:
        if self._client is None:
            self._client = ollama.Client(host=self.settings.ollama_host)
        return self._client
    
    @property
    def custom_model(self):
        if self._custom_model is None and self.settings.embedding_provider == "custom":
            path = self.settings.custom_model_path
            if os.path.exists(path):
                logger.info(f"🧠 Loading custom trained model from {path}")
                self._custom_model = SentenceTransformer(path)
            else:
                logger.warning(f"⚠️ Custom model not found at {path}. Have you run 'train_embedding.py'?")
                logger.info("Falling back to base model: sentence-transformers/all-MiniLM-L6-v2")
                self._custom_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        return self._custom_model

    def is_available(self) -> bool:
        try:
            # Check Ollama for Generation
            self.client.list() 
            self._is_available = True
            return True
        except:
            self._is_available = False
            return False

    def list_models(self) -> List[str]:
        try:
            return [m["name"] for m in self.client.list().get("models", [])]
        except: return []

    # ==================== EMBEDDINGS (AUTO SWITCH) ====================

    def get_embedding(self, text: str) -> List[float]:
        if self.settings.embedding_provider == "custom":
            # Use Python SentenceTransformer
            return self.custom_model.encode(text).tolist()
        else:
            # Use Ollama
            try:
                if not text: return []
                resp = self.client.embeddings(model=self.settings.ollama_embedding_model, prompt=text)
                return resp.get("embedding", [])
            except: 
                return []

    def get_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        if self.settings.embedding_provider == "custom":
            # Batch encode with SentenceTransformer (Very fast on GPU)
            return self.custom_model.encode(texts).tolist()
        else:
            # Sequential Ollama calls (Slower)
            embeddings = []
            for t in texts:
                embeddings.append(self.get_embedding(t))
            return embeddings

    # ==================== GENERATION (OLLAMA ONLY) ====================
    # (Giữ nguyên logic generation cũ)
    
    def generate(self, prompt, system=None, temperature=0.7, max_tokens=500):
        try:
            msgs = []
            if system: msgs.append({"role": "system", "content": system})
            msgs.append({"role": "user", "content": prompt})
            
            resp = self.client.chat(
                model=self.settings.ollama_model,
                messages=msgs,
                options={"temperature": temperature, "num_predict": max_tokens}
            )
            return resp.get("message", {}).get("content", "")
        except Exception as e:
            logger.error(f"Generate error: {e}")
            return ""

    def analyze_post_content(self, content, available_hashtags):
        # (Giữ nguyên logic cũ)
        if not content.strip(): return {"sentiment": "neutral", "topics": [], "suggested_hashtags": [], "summary": "", "is_appropriate": True}
        
        hashtags_list = ", ".join(available_hashtags[:50])
        system = """You are a social media content analyzer. 
Analyze and provide JSON:
{
  "sentiment": "positive|negative|neutral",
  "topics": ["topic1"],
  "suggested_hashtags": ["hashtag1"],
  "summary": "1 sentence",
  "is_appropriate": true
}"""
        user = f"Analyze:\n{content}\n\nChoose hashtags from: {hashtags_list}"
        
        try:
            resp = self.generate(user, system, 0.3, 300)
            import json
            start = resp.find("{")
            end = resp.rfind("}") + 1
            if start != -1:
                result = json.loads(resp[start:end])
                # Filter valid hashtags
                valid = [h for h in result.get("suggested_hashtags", []) 
                        if h.lower() in [ah.lower() for ah in available_hashtags]]
                result["suggested_hashtags"] = valid
                return result
            return {"sentiment": "neutral", "topics": [], "suggested_hashtags": [], "summary": "", "is_appropriate": True}
        except:
            return {"sentiment": "neutral", "topics": [], "suggested_hashtags": [], "summary": "", "is_appropriate": True}

    def generate_search_query_expansion(self, query):
        # (Giữ nguyên logic cũ)
        user = f"Generate 3 related search terms for: {query}. Respond JSON array only."
        try:
            resp = self.generate(user, None, 0.5, 100)
            import json
            start = resp.find("[")
            end = resp.rfind("]") + 1
            if start != -1: return json.loads(resp[start:end])
            return [query]
        except: return [query]

_ollama_service = None
def get_ollama_service():
    global _ollama_service
    if _ollama_service is None: _ollama_service = OllamaService()
    return _ollama_service
