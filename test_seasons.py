import json
import re

def parse_season_episode(title):
    # Match S01E01 or T01E01 or Temp 1 Ep 1
    m = re.search(r'(?:S|TEMP(?:ORADA)?|T)\s*0*(\d+)[\s\.\-_:]*(?:E|EP|CAP)\s*0*(\d+)', title, re.IGNORECASE)
    if m:
        return int(m.group(1)), int(m.group(2))
    
    # Match just E01 or EP 01
    m = re.search(r'(?:E|EP|CAP)\s*0*(\d+)', title, re.IGNORECASE)
    if m:
        return 1, int(m.group(1))
    
    # Match trailing number
    m = re.search(r'[\s\-_](\d+)$', title.strip())
    if m:
        return 1, int(m.group(1))
    
    return 1, 1

test_titles = [
    "Pokemon S01E01",
    "Pokemon S25E12",
    "Digimon Adventure T01EP05",
    "Yu-Gi-Oh! EP 24",
    "Os Cavaleiros do Zodiaco Saint Seiya S01E01",
    "Yu Yu Hakusho CAP 112"
]

for t in test_titles:
    s, e = parse_season_episode(t)
    print(f"{t} -> Season {s}, Episode {e}")
