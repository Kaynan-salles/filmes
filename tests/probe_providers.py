import httpx

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

print("=== 1. PROBING ANIMEFIRE ENDPOINTS ===")
for ep in [
    "/animes",
    "/animes?page=1",
    "/animes?page=2",
    "/animes/lancamentos",
    "/animes/populares",
    "/animes/todos",
    "/animes/lista",
]:
    try:
        r = httpx.get("https://api.animefire.one" + ep, headers=headers, timeout=5)
        is_json = "json" in str(r.headers.get("content-type"))
        count = len(r.json().get("data", [])) if is_json and isinstance(r.json().get("data"), list) else "not-list"
        if is_json and isinstance(r.json().get("data"), dict):
            count = f"dict-keys:{list(r.json().get('data', {}).keys())}"
        print(f"AnimeFire {ep}: {r.status_code} | ctype={r.headers.get('content-type')} | data={count}")
    except Exception as e:
        print(f"AnimeFire {ep}: err {e}")

print("\n=== 2. PROBING ANIMESONLINECC PAGINATION ===")
for url in [
    "https://animesonlinecc.to/anime/",
    "https://animesonlinecc.to/anime/page/1/",
    "https://animesonlinecc.to/anime/page/2/",
    "https://animesonlinecc.to/animes/",
]:
    try:
        r = httpx.get(url, headers=headers, follow_redirects=True, timeout=5)
        import bs4
        soup = bs4.BeautifulSoup(r.text, "html.parser")
        items = len(soup.select("article"))
        pagination = bool(soup.select(".pagination, .nav-links, .page-numbers"))
        print(f"AnimesOnlineCC {url}: {r.status_code} | items={items} | has_pagination={pagination}")
    except Exception as e:
        print(f"AnimesOnlineCC {url}: err {e}")

print("\n=== 3. PROBING ANIMESONLINEIO PAGINATION ===")
for url in [
    "https://animesonline.io/anime/",
    "https://animesonline.io/anime/page/1/",
    "https://animesonline.io/anime/page/2/",
]:
    try:
        r = httpx.get(url, headers=headers, follow_redirects=True, timeout=5)
        import bs4
        soup = bs4.BeautifulSoup(r.text, "html.parser")
        items = len(soup.select("article.bs"))
        pagination = bool(soup.select(".pagination, .nav-links, .page-numbers, .hpage"))
        print(f"AnimesOnlineIO {url}: {r.status_code} | items={items} | has_pagination={pagination}")
    except Exception as e:
        print(f"AnimesOnlineIO {url}: err {e}")

