import requests

users = ['69241cbe006d259dc5ee4382', '69241d0d006d259dc5ee4387']

results = {}
for user_id in users:
    resp = requests.get(f'http://localhost:8000/api/v1/newsfeed/{user_id}?limit=5')
    data = resp.json()
    if 'data' in data:
        results[user_id[-8:]] = [p.get('post_id', '')[-8:] for p in data['data'][:5]]

print("User 1 posts:", results.get('c5ee4382', []))
print("User 2 posts:", results.get('c5ee4387', []))
print("Same order?", results.get('c5ee4382') == results.get('c5ee4387'))
