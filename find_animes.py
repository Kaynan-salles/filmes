import re

count = 0
groups = {}
with open('Filmes-Series.m3u8', 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        if line.startswith('#EXTINF:'):
            m = re.search(r'group-title="([^"]*)"', line)
            grp = m.group(1) if m else 'None'
            low = grp.lower()
            if 'anime' in low or 'crunchy' in low or 'funi' in low or 'otaku' in low or 'jap' in low:
                groups[grp] = groups.get(grp, 0) + 1
                count += 1

print('Groups:', groups)
print('Total entries:', count)

