import httpx
from bs4 import BeautifulSoup
import re

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

print("=== 1. CHECKING ANIMESONLINECC TOTAL PAGES ===")
r = httpx.get("https://animesonlinecc.to/anime/", headers=headers, follow_redirects=True, timeout=10)
soup = BeautifulSoup(r.text, "html.parser")
pages = []
for a in soup.select(".pagination a, .nav-links a, a.page-link, .page-numbers"):
    text = a.get_text(strip=True)
    if text.isdigit():
        pages.append(int(text))
    href = a.get("href", "")
    m = re.search(r'/page/(\d+)/?', href)
    if m:
        pages.append(int(m.group(1)))
print("AnimesOnlineCC Max page found in nav:", max(pages) if pages else "None")

# Inspect sample items from page 1
articles = soup.select("article")
print(f"Page 1 has {len(articles)} articles.")
if articles:
    a0 = articles[0]
    link = a0.find("a", href=re.compile(r"/anime/"))
    title = a0.find(["h2", "h3", "h1"])
    img = a0.find("img")
    print(f"Sample: Title='{title.get_text(strip=True) if title else '?'}' | Link='{link['href'] if link else '?'}' | Poster='{img.get('src') if img else '?'}'")

print("\n=== 2. CHECKING ANIMESDIGITAL PAGINATION ===")
data = {"token": "c1deb78cd4", "search": "", "page": "1"}
r_dig = httpx.post("https://animesdigital.org/func/listanime", data=data, headers={"User-Agent": "Mozilla/5.0", "X-Requested-With": "XMLHttpRequest", "Origin": "https://animesdigital.org", "Referer": "https://animesdigital.org/"}, timeout=10)
print(f"AnimesDigital status: {r_dig.status_code}")
try:
    j = r_dig.json()
    print("AnimesDigital keys:", list(j.keys()))
    print("total_results:", j.get("total_results"), "total_page:", j.get("total_page"), "results count:", len(j.get("results", [])))
except Exception as e:
    print("AnimesDigital parse err:", e)

