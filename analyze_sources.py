import subprocess
import json

raw_det = subprocess.check_output(['git', 'show', '54a4181:WEB_PORTAL/data/animes_details.json'])
det = json.loads(raw_det.decode('utf-8'))

blogger_count = 0
mp4_count = 0
hls_count = 0
other_count = 0

for a in det.values():
    for s in a.get('seasons', []):
        for ep in s.get('episodes', []):
            for src in ep.get('sources', []):
                u = src.get('stream_url', '')
                if 'blogger.com' in u or 'video.g' in u:
                    blogger_count += 1
                elif '.mp4' in u or 'googlevideo.com' in u:
                    mp4_count += 1
                elif '.m3u8' in u:
                    hls_count += 1
                else:
                    other_count += 1

print(f'Blogger: {blogger_count}, Direct MP4: {mp4_count}, HLS: {hls_count}, Other: {other_count}')

