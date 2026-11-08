import re

code = open('servidor.py', encoding='utf-8').read()
matches = re.findall(r'@app\.route\([\'"]([^\'"]+)[\'"]', code)
for m in matches:
    if 'anime' in m:
        print("Route:", m)
