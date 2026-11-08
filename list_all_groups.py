import re

groups = {}
with open('Filmes-Series.m3u8', 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        if line.startswith('#EXTINF:'):
            m = re.search(r'group-title="([^"]*)"', line)
            grp = m.group(1) if m else 'None'
            groups[grp] = groups.get(grp, 0) + 1

for grp, count in sorted(groups.items(), key=lambda x: x[1], reverse=True):
    print(f'{grp}: {count}')

