import os
import json
import sqlite3

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "WEB_PORTAL", "data")
MANIFESTO_FILE = os.path.join(DATA_DIR, "manifesto.json")
DB_FILE = os.path.join(DATA_DIR, "animes_catalog.db")

with open(MANIFESTO_FILE, "r", encoding="utf-8") as f:
    manifesto = json.load(f)

# Update categorias with actual files and counts
categorias = manifesto.get("categorias", [])

# 1. Update Animes category
conn = sqlite3.connect(DB_FILE)
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM animes WHERE is_hidden = 0")
active_animes_count = cur.fetchone()[0]

cur.execute("""
    SELECT id, canonical_title, poster, synopsis, year, total_episodes 
    FROM animes 
    WHERE is_hidden = 0 
    ORDER BY year DESC, total_episodes DESC 
    LIMIT 12
""")
anime_destaques = []
for r in cur.fetchall():
    anime_destaques.append({
        "id": r[0],
        "t": r[1],
        "catNome": "🌸 ANIMES | Catálogo Oficial",
        "p": r[2],
        "banner": r[2],
        "u": f"/api/animes/resolve?anime_id={r[0]}&ep=1&s=1",
        "sinopse": r[3] or "",
        "ano": r[4] or 2024,
        "total_episodios": r[5] or 12,
        "is_anime": True
    })
conn.close()

# Update or insert animes category
animes_cat = next((c for c in categorias if c.get("id") == "animes"), None)
if animes_cat:
    animes_cat["total"] = active_animes_count
    animes_cat["destaques"] = anime_destaques
    animes_cat["nome"] = "🌸 Animes"
    animes_cat["tipo"] = "animes"

# 2. Update all JSON categories
for cat in categorias:
    cid = cat.get("id")
    if cid == "animes":
        continue
    j_path = os.path.join(DATA_DIR, f"{cid}.json")
    if os.path.exists(j_path):
        try:
            with open(j_path, "r", encoding="utf-8") as jf:
                items = json.load(jf)
            cat["total"] = len(items)
            # update destaques with first valid items
            valid_dest = [it for it in items if it.get("p") and it["p"].startswith("http")][:10]
            if valid_dest:
                cat["destaques"] = valid_dest
        except Exception:
            pass

manifesto["categorias"] = categorias
with open(MANIFESTO_FILE, "w", encoding="utf-8") as f:
    json.dump(manifesto, f, ensure_ascii=False, indent=2)

print(f"Manifesto atualizado com sucesso! Animes ativos: {active_animes_count}")
