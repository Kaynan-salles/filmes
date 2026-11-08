import subprocess
import json

raw_det = subprocess.check_output(['git', 'show', '54a4181:WEB_PORTAL/data/animes_details.json'])
det = json.loads(raw_det.decode('utf-8'))

other_samples = []
for a in det.values():
    for s in a.get('seasons', []):
        for ep in s.get('episodes', []):
            for src in ep.get('sources', []):
                u = src.get('stream_url', '')
                if not ('blogger.com' in u or 'video.g' in u):
                    if len(other_samples) < 10:
                        other_samples.append({
                            'stream_url': u,
                            'extra_payload': src.get('extra_payload'),
                            'provider': src.get('provider'),
                            'player_type': src.get('player_type')
                        })

for sample in other_samples:
    print(sample)

