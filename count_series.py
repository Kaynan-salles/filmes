import json
import re

def extract_base(t):
    clean = re.sub(r'[\(\[\{].*?[\)\]\}]', '', t)
    clean = re.sub(r'\s*(?:S\d+|TEMP(?:ORADA)?\s*\d+|T\d+)\s*(?:E\d+|EP\s*\d+|CAP\s*\d+)?.*$', '', clean, flags=re.IGNORECASE)
    clean = re.sub(r'\s*(?:EP|E|CAP|CAPITULO)\s*\d+.*$', '', clean, flags=re.IGNORECASE)
    clean = re.sub(r'[\s\.\-_:]+$', '', clean).strip()
    return clean

series_names = set()
for fname in ['WEB_PORTAL/data/08_crunchyroll.json', 'WEB_PORTAL/data/16_funimation.json']:
    data = json.load(open(fname, encoding='utf-8'))
    for item in data:
        base = extract_base(item.get('t', ''))
        if base:
            series_names.add(base)

print('Distinct series from Crunchyroll + Funimation:', len(series_names))
print('Sample series:', list(series_names)[:20])

