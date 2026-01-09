import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1"

def print_result(title, data):
    print(f"\n=== {title} ===")
    print(json.dumps(data, indent=2, ensure_ascii=False))

def test_sync():
    print("\n[1] Syncing MongoDB to Vector DB...")
    # This might take a while for 500 posts
    try:
        # Check status first
        status = requests.get(f"{BASE_URL}/sync/status").json()
        if status['posts_synced'] > 0:
            print(f"Already synced: {status['posts_synced']} posts")
            return

        # Trigger sync
        resp = requests.post(f"{BASE_URL}/sync")
        print("Sync started:", resp.json())
        
        # Wait for sync to likely finish (just waiting a bit for demo)
        print("Waiting 10s for sync to process some items...")
        time.sleep(10)
    except Exception as e:
        print("Sync failed/error:", e)

def test_search():
    query = "phim gì hay xem cuối tuần"
    print(f"\n[2] Testing Search: '{query}'")
    try:
        resp = requests.post(f"{BASE_URL}/search", json={
            "query": query,
            "limit": 3
        })
        print_result("Search Results", resp.json())
    except Exception as e:
        print("Search failed:", e)

def test_recommendation():
    user_id = "69241cbe006d259dc5ee4382" # ID user arisu
    print(f"\n[3] Testing Recommendations for User: {user_id}")
    try:
        resp = requests.post(f"{BASE_URL}/recommendations", json={
            "user_id": user_id,
            "limit": 3
        })
        print_result("Recommendations", resp.json())
    except Exception as e:
        print("Recommend failed:", e)

def test_hashtag_suggest():
    content = "Con mèo nhà mình hôm nay dễ thương quá, nó cứ ngủ cả ngày"
    print(f"\n[4] Testing Hashtag Suggestion for: '{content}'")
    try:
        resp = requests.post(f"{BASE_URL}/hashtags/suggest", json={
            "content": content,
            "limit": 5
        })
        print_result("Suggested Hashtags", resp.json())
    except Exception as e:
        print("Hashtag suggest failed:", e)

if __name__ == "__main__":
    print("🚀 Starting AI Server Tests...")
    test_sync()
    time.sleep(2)
    test_search()
    time.sleep(2)
    test_recommendation()
    time.sleep(2)
    test_hashtag_suggest()
