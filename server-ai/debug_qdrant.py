from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer
import os
from dotenv import load_dotenv
load_dotenv()

# Use REST instead of gRPC (more stable on free tier)
c = QdrantClient(
    url=os.getenv('QDRANT_URL'),
    api_key=os.getenv('QDRANT_API_KEY'),
    timeout=120,
    prefer_grpc=False
)

info = c.get_collection('posts')
print(f"Posts: {info.points_count}")

uinfo = c.get_collection('user_vectors')
print(f"Users: {uinfo.points_count}")

m = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
emb = m.encode('xin chao')

print("Searching...")
results = c.query_points(
    collection_name='posts',
    query=emb.tolist(),
    limit=5,
    with_payload=True,
).points
print(f"Results: {len(results)}")
for r in results:
    pid = r.payload.get("post_id", "?")
    prv = r.payload.get("privacy", "?")
    print(f"  score={r.score:.4f} post={pid} privacy={prv}")
