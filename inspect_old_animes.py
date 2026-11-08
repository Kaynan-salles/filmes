import subprocess
import json

raw = subprocess.check_output(['git', 'show', '54a4181:WEB_PORTAL/data/animes.json'])
animes = json.loads(raw.decode('utf-8'))
print('Total animes in 54a4181:', len(animes))
print('Sample animes:', [a.get('canonical_title') or a.get('t') for a in animes[:15]])

raw_det = subprocess.check_output(['git', 'show', '54a4181:WEB_PORTAL/data/animes_details.json'])
det = json.loads(raw_det.decode('utf-8'))
print('Total details in 54a4181:', len(det))

