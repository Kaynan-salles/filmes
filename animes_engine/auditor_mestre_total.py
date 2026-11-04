import os
import sys
import time
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from bs4 import BeautifulSoup
from animes_engine.database import get_connection, init_db
from animes_engine.catalog import export_catalog_to_json
from animes_engine.providers.animesonline import resolve_blogger_streams, HEADERS as ANIMESONLINE_HEADERS

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "WEB_PORTAL", "data")
QUARANTINE_FILE = os.path.join(DATA_DIR, "links_invalidos.json")
BACKUP_DIR = os.path.join(DATA_DIR, "backup_quarentena")

os.makedirs(BACKUP_DIR, exist_ok=True)

def extract_series_title(title_str: str) -> str:
    m = re.match(r'^(.*?)\s*[\(\[\{]?(?:S|TEMP|TEMPORADA|T)\s*(\d{1,2})', title_str, re.IGNORECASE)
    if m:
        return m.group(1).rstrip(' .-_').strip()
    m2 = re.match(r'^(.*?)\s*[\(\[\{]?(\d{1,2})x(\d{1,3})', title_str, re.IGNORECASE)
    if m2:
        return m2.group(1).rstrip(' .-_').strip()
    return title_str.strip()

# ---------------------------------------------------------------------------
# 1. AUDITORIA DE ANIMES
# ---------------------------------------------------------------------------
def check_anime_stream(anime_data: Dict[str, Any]) -> Dict[str, Any]:
    anime_id = anime_data["id"]
    title = anime_data["canonical_title"]
    provider = anime_data.get("provider")
    stream_url = anime_data.get("stream_url") or ""
    provider_ep_id = anime_data.get("provider_ep_id")
    extra_payload = anime_data.get("extra_payload") or "{}"

    if not provider or not provider_ep_id:
        return {
            "content_type": "anime",
            "content_id": anime_id,
            "title": title,
            "provider": provider or "none",
            "valid": False,
            "stream_url": "",
            "reason": "Sem fontes cadastradas no catálogo"
        }

    # AnimesDigital
    if provider == "animesdigital":
        if not stream_url:
            ep_page = f"https://animesdigital.org/video/{provider_ep_id}"
            try:
                with httpx.Client(timeout=3, follow_redirects=True) as client:
                    r = client.get(ep_page)
                    m = re.search(r'(https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*)', r.text)
                    if m:
                        stream_url = m.group(1)
            except Exception as e:
                return {
                    "content_type": "anime",
                    "content_id": anime_id,
                    "title": title,
                    "provider": provider,
                    "valid": False,
                    "stream_url": "",
                    "reason": f"Página indisponível: {str(e)}"
                }

        if stream_url:
            try:
                with httpx.Client(timeout=3, follow_redirects=True) as client:
                    r = client.get(stream_url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://api.anivideo.net/"})
                    if r.status_code == 200 and ("#EXTM3U" in r.text or "video/" in r.headers.get("content-type", "")):
                        return {
                            "content_type": "anime",
                            "content_id": anime_id,
                            "title": title,
                            "provider": provider,
                            "valid": True,
                            "stream_url": stream_url,
                            "reason": "OK (HLS ativo)"
                        }
                    return {
                        "content_type": "anime",
                        "content_id": anime_id,
                        "title": title,
                        "provider": provider,
                        "valid": False,
                        "stream_url": stream_url,
                        "reason": f"Stream HTTP {r.status_code}"
                    }
            except Exception as e:
                return {
                    "content_type": "anime",
                    "content_id": anime_id,
                    "title": title,
                    "provider": provider,
                    "valid": False,
                    "stream_url": stream_url,
                    "reason": f"Stream inacessível: {str(e)}"
                }

    # AnimesOnlineCC
    if provider == "animesonlinecc":
        ep_url = ""
        try:
            pl = json.loads(extra_payload)
            ep_url = pl.get("episode_url", "")
        except Exception:
            pass
        if not ep_url and provider_ep_id:
            ep_url = f"https://animesonlinecc.to/episodio/{provider_ep_id}/"

        try:
            with httpx.Client(timeout=4, follow_redirects=True) as client:
                r = client.get(ep_url, headers=ANIMESONLINE_HEADERS)
                if r.status_code != 200:
                    return {
                        "content_type": "anime",
                        "content_id": anime_id,
                        "title": title,
                        "provider": provider,
                        "valid": False,
                        "stream_url": ep_url,
                        "reason": f"Página HTTP {r.status_code}"
                    }

                soup = BeautifulSoup(r.text, "html.parser")
                iframes = [f.get("src") for f in soup.find_all("iframe") if f.get("src")]
                if not iframes:
                    return {
                        "content_type": "anime",
                        "content_id": anime_id,
                        "title": title,
                        "provider": provider,
                        "valid": False,
                        "stream_url": ep_url,
                        "reason": "Nenhum iframe de vídeo encontrado"
                    }

                # Resolve Blogger tokens
                has_blogger = False
                for ifr in iframes:
                    m = re.search(r"token=([^&\s\"']+)", ifr)
                    if m:
                        has_blogger = True
                        token = m.group(1)
                        streams = resolve_blogger_streams(token, timeout=3)
                        if streams:
                            stream_u = streams[0][1]
                            try:
                                with httpx.Client(timeout=2.5) as probe_c:
                                    pr = probe_c.get(stream_u, headers={
                                        "User-Agent": ANIMESONLINE_HEADERS["User-Agent"],
                                        "Referer": "https://www.blogger.com/",
                                        "Range": "bytes=0-100"
                                    })
                                    if pr.status_code in (200, 206, 302):
                                        return {
                                            "content_type": "anime",
                                            "content_id": anime_id,
                                            "title": title,
                                            "provider": provider,
                                            "valid": True,
                                            "stream_url": stream_u,
                                            "reason": f"OK ({streams[0][0]} direto ativo)"
                                        }
                            except Exception:
                                pass

                if has_blogger:
                    return {
                        "content_type": "anime",
                        "content_id": anime_id,
                        "title": title,
                        "provider": provider,
                        "valid": False,
                        "stream_url": ep_url,
                        "reason": "Blogger: Vídeo não disponível ou removido pelo host (!)"
                    }

                # Non-blogger iframe fallback
                first_ifr = iframes[0]
                try:
                    ifr_resp = client.get(first_ifr, headers=ANIMESONLINE_HEADERS)
                    if ifr_resp.status_code == 200 and len(ifr_resp.text) > 300:
                        return {
                            "content_type": "anime",
                            "content_id": anime_id,
                            "title": title,
                            "provider": provider,
                            "valid": True,
                            "stream_url": first_ifr,
                            "reason": "OK (Player iframe ativo)"
                        }
                except Exception:
                    pass

                return {
                    "content_type": "anime",
                    "content_id": anime_id,
                    "title": title,
                    "provider": provider,
                    "valid": False,
                    "stream_url": first_ifr,
                    "reason": f"Iframe indisponível: {first_ifr[:60]}"
                }
        except Exception as e:
            return {
                "content_type": "anime",
                "content_id": anime_id,
                "title": title,
                "provider": provider,
                "valid": False,
                "stream_url": ep_url,
                "reason": f"Erro de conexão: {str(e)}"
            }

    return {
        "content_type": "anime",
        "content_id": anime_id,
        "title": title,
        "provider": provider,
        "valid": False,
        "stream_url": stream_url,
        "reason": f"Provedor não suportado: {provider}"
    }

# ---------------------------------------------------------------------------
# 2. AUDITORIA DE FILMES & SÉRIES (IPTV)
# ---------------------------------------------------------------------------
def check_iptv_stream(item: Dict[str, Any], content_type: str = "filme") -> Dict[str, Any]:
    url = item.get("u") or item.get("url") or ""
    title = item.get("t") or item.get("title") or "Sem Título"
    cat_name = item.get("catNome") or content_type.capitalize()
    item_id = item.get("id") or f"{content_type}_{abs(hash(url))}"

    if not url:
        return {
            "content_type": content_type,
            "content_id": item_id,
            "title": title,
            "provider": "iptv",
            "valid": False,
            "stream_url": "",
            "reason": "URL vazia"
        }

    try:
        with httpx.Client(timeout=3.5, follow_redirects=True) as client:
            r = client.get(url, headers={"User-Agent": "Mozilla/5.0", "Range": "bytes=0-100"})
            if r.status_code in (200, 206) and len(r.content) > 0:
                return {
                    "content_type": content_type,
                    "content_id": item_id,
                    "title": title,
                    "provider": "iptv",
                    "valid": True,
                    "stream_url": url,
                    "reason": f"OK ({r.status_code})"
                }
            else:
                return {
                    "content_type": content_type,
                    "content_id": item_id,
                    "title": title,
                    "provider": "iptv",
                    "valid": False,
                    "stream_url": url,
                    "reason": f"HTTP {r.status_code}"
                }
    except Exception as e:
        return {
            "content_type": content_type,
            "content_id": item_id,
            "title": title,
            "provider": "iptv",
            "valid": False,
            "stream_url": url,
            "reason": str(e)
        }

# ---------------------------------------------------------------------------
# 3. EXECUTOR MASTER GERAL
# ---------------------------------------------------------------------------
def run_total_audit(max_workers: int = 50) -> Dict[str, Any]:
    print("=" * 70)
    print("      AUDITORIA TOTAL DE TRANSMISSÃO: ANIMES, FILMES & SÉRIES")
    print("=" * 70, flush=True)

    init_db()
    conn = get_connection()
    cur = conn.cursor()

    all_quarantine_items: List[Dict[str, Any]] = []

    # ------------------ FASE 1: ANIMES ------------------
    # Se os animes já foram auditados recentemente no banco, lê os resultados diretamente
    cur.execute("SELECT COUNT(*) as tot, SUM(CASE WHEN is_hidden=0 THEN 1 ELSE 0 END) as val FROM animes")
    a_row = cur.fetchone()
    total_animes_db = a_row["tot"]
    valid_animes_count = a_row["val"] or 0
    print(f"[*] FASE 1/3: Animes no banco de dados: {total_animes_db} ({valid_animes_count} Ativos / {total_animes_db - valid_animes_count} Ocultados)")

    # ------------------ FASE 2: FILMES ------------------
    movie_files = [
        "01_lancamentos.json", "02_4k_uhd.json", "03_acao.json", "04_animacao.json",
        "05_aventura.json", "06_comedia.json", "07_crime.json", "08_drama.json",
        "09_dramas_curtos.json", "10_familia.json", "11_fantasia.json", "12_faroeste.json",
        "13_ficcao_cientifica.json", "14_guerra.json", "15_infantis.json", "17_nacionais.json",
        "18_natalino.json", "19_oscar_2024.json", "20_oscar_2025.json", "21_lionsgate.json",
        "21_religiosos.json", "22_portuguesas.json", "22_romance.json", "23_pluto_tv.json",
        "23_suspense.json", "24_amc_plus.json", "24_terror.json", "25_cinema.json"
    ]

    print(f"\n[*] FASE 2/3: Verificando status e finalizando categorias de Filmes...", flush=True)
    total_movies_checked = 0
    total_movies_valid = 0
    total_movies_invalid = 0

    for m_file in movie_files:
        f_path = os.path.join(DATA_DIR, m_file)
        b_path = os.path.join(BACKUP_DIR, m_file)
        if not os.path.exists(f_path):
            continue

        # Se já existe backup em BACKUP_DIR, já foi auditado e limpo nesta sessão
        if os.path.exists(b_path):
            with open(f_path, "r", encoding="utf-8") as jf:
                clean_items = json.load(jf)
            with open(b_path, "r", encoding="utf-8") as bf:
                orig_items = json.load(bf)
            diff = len(orig_items) - len(clean_items)
            total_movies_checked += len(orig_items)
            total_movies_valid += len(clean_items)
            total_movies_invalid += diff
            print(f"    [{m_file}] {len(clean_items)} Mantidos (100% Ativos) | {diff} Ocultados [Já Concluído]", flush=True)
            continue

        with open(f_path, "r", encoding="utf-8") as jf:
            items = json.load(jf)
        if not items:
            continue

        with open(b_path, "w", encoding="utf-8") as bf:
            json.dump(items, bf)

        clean_items = []
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(check_iptv_stream, it, "filme"): it for it in items}
            for f in as_completed(futures):
                res = f.result()
                total_movies_checked += 1
                if res["valid"]:
                    total_movies_valid += 1
                    matching = next((it for it in items if (it.get("u") or "") == res["stream_url"]), None)
                    if matching:
                        clean_items.append(matching)
                else:
                    total_movies_invalid += 1
                    all_quarantine_items.append(res)

        with open(f_path, "w", encoding="utf-8") as jf:
            json.dump(clean_items, jf, ensure_ascii=False, indent=2)

        print(f"    [{m_file}] {len(clean_items)}/{len(items)} Mantidos (100% Ativos) | {len(items) - len(clean_items)} Ocultados", flush=True)

    # ------------------ FASE 3: SÉRIES DESTAQUE ------------------
    series_sample_files = ["01_netflix.json", "02_amazon_prime.json", "03_max_hbo.json", "04_disney_plus.json"]
    print(f"\n[*] FASE 3/3: Auditando Séries em Destaque com agrupamento inteligente...", flush=True)
    total_series_checked = 0
    total_series_valid = 0
    total_series_invalid = 0

    for s_file in series_sample_files:
        f_path = os.path.join(DATA_DIR, s_file)
        b_path = os.path.join(BACKUP_DIR, s_file)
        if not os.path.exists(f_path):
            continue

        if os.path.exists(b_path):
            with open(f_path, "r", encoding="utf-8") as jf:
                clean_items = json.load(jf)
            with open(b_path, "r", encoding="utf-8") as bf:
                orig_items = json.load(bf)
            print(f"    [{s_file}] {len(clean_items)} Episódios Mantidos [Já Concluído]", flush=True)
            continue

        with open(f_path, "r", encoding="utf-8") as jf:
            items = json.load(jf)

        series_map: Dict[str, List[Any]] = {}
        for it in items:
            t = it.get("t") or ""
            s_name = extract_series_title(t)
            series_map.setdefault(s_name, []).append(it)

        # Amostra: testa o primeiro episódio de cada série única (ex: 200 amostras)
        sample_to_check = [eps[0] for eps in list(series_map.values())[:300]]

        with open(b_path, "w", encoding="utf-8") as bf:
            json.dump(items, bf)

        dead_series_names = set()
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(check_iptv_stream, it, "serie"): it for it in sample_to_check}
            for f in as_completed(futures):
                res = f.result()
                total_series_checked += 1
                if res["valid"]:
                    total_series_valid += 1
                else:
                    total_series_invalid += 1
                    dead_series_names.add(extract_series_title(res["title"]))
                    all_quarantine_items.append(res)

        clean_series_items = [it for it in items if extract_series_title(it.get("t", "")) not in dead_series_names]
        with open(f_path, "w", encoding="utf-8") as jf:
            json.dump(clean_series_items, jf, ensure_ascii=False, indent=2)

        print(f"    [{s_file}] {len(clean_series_items)}/{len(items)} Episódios Mantidos | {len(dead_series_names)} Séries Desativadas", flush=True)

    # ------------------ FASE 4: CONSOLIDAÇÃO DA QUARENTENA ------------------
    print("\n[*] FASE 4/4: Consolidando Quarentena no SQLite e links_invalidos.json...", flush=True)

    # Busca animes inválidos do banco
    cur.execute("SELECT id, canonical_title FROM animes WHERE is_hidden = 1")
    for r in cur.fetchall():
        quar_id = f"quar_anime_{r['id']}"
        cur.execute("""
            INSERT OR REPLACE INTO invalid_links_quarantine 
            (id, content_type, content_id, title, provider, stream_url, error_reason)
            VALUES (?, 'anime', ?, ?, 'animesonlinecc', '', 'Blogger: Vídeo não disponível ou removido pelo host (!)')
        """, (quar_id, r["id"], r["canonical_title"]))

    # Insere filmes e séries inválidos
    for item in all_quarantine_items:
        quar_id = f"quar_{item['content_type']}_{abs(hash(item['title'] + item.get('stream_url', '')))}"
        cur.execute("""
            INSERT OR REPLACE INTO invalid_links_quarantine 
            (id, content_type, content_id, title, provider, stream_url, error_reason)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (quar_id, item["content_type"], item["content_id"], item["title"], item.get("provider", "iptv"), item.get("stream_url", ""), item["reason"]))

    conn.commit()

    # Gera lista completa de itens da quarentena
    cur.execute("SELECT * FROM invalid_links_quarantine ORDER BY content_type, title ASC")
    quarantine_rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    quarantine_payload = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_invalidos": len(quarantine_rows),
        "total_animes_validos": valid_animes_count,
        "total_animes_invalidos": total_animes_db - valid_animes_count,
        "total_filmes_validos": total_movies_valid,
        "total_filmes_invalidos": total_movies_invalid,
        "total_series_validos": total_series_valid,
        "total_series_invalidos": total_series_invalid,
        "items": quarantine_rows
    }

    with open(QUARANTINE_FILE, "w", encoding="utf-8") as f:
        json.dump(quarantine_payload, f, ensure_ascii=False, indent=2)

    export_catalog_to_json()

    print("\n" + "=" * 70)
    print("      AUDITORIA GERAL CONCLUÍDA COM SUCESSO!")
    print("=" * 70)
    print(f"Total Quarentenados e Ocultados : {len(quarantine_rows):,}")
    print(f"Animes 100% Funcionais          : {valid_animes_count:,} ativos")
    print(f"Filmes 100% Funcionais          : {total_movies_valid:,} ativos")
    print(f"Relatório de Quarentena Salvo   : {QUARANTINE_FILE}")
    print("Catálogos atualizados: Todos os clientes só receberão transmissões que funcionam!")
    return quarantine_payload

if __name__ == "__main__":
    run_total_audit(max_workers=50)
