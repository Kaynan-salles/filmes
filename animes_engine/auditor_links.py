import os
import sys
import time
import json
import re
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from bs4 import BeautifulSoup
from animes_engine.database import get_connection, init_db
from animes_engine.catalog import export_catalog_to_json
from animes_engine.providers.animesonline import resolve_blogger_streams, HEADERS as ANIMESONLINE_HEADERS

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUARANTINE_FILE = os.path.join(BASE_DIR, "WEB_PORTAL", "data", "links_invalidos.json")

def check_anime_health(anime_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Checks if an anime's primary stream transmits valid video/image.
    Returns dict with valid=True/False and detailed diagnostic reason.
    """
    anime_id = anime_data["id"]
    title = anime_data["canonical_title"]
    source_id = anime_data.get("source_id")
    provider = anime_data.get("provider")
    stream_url = anime_data.get("stream_url") or ""
    provider_ep_id = anime_data.get("provider_ep_id")
    extra_payload = anime_data.get("extra_payload") or "{}"

    if not provider or not provider_ep_id:
        return {
            "anime_id": anime_id,
            "title": title,
            "provider": provider or "none",
            "valid": False,
            "stream_url": "",
            "reason": "Nenhuma fonte ou ID de episódio cadastrado no catálogo"
        }

    # 1. AnimesDigital (Direct HLS / MP4)
    if provider == "animesdigital":
        if not stream_url:
            ep_page = f"https://animesdigital.org/video/{provider_ep_id}"
            try:
                with httpx.Client(timeout=4, follow_redirects=True) as client:
                    r = client.get(ep_page)
                    m = re.search(r'(https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*)', r.text)
                    if m:
                        stream_url = m.group(1)
            except Exception as e:
                return {
                    "anime_id": anime_id,
                    "title": title,
                    "provider": provider,
                    "valid": False,
                    "stream_url": "",
                    "reason": f"Falha na página AnimesDigital: {str(e)}"
                }

        if stream_url:
            try:
                with httpx.Client(timeout=4, follow_redirects=True) as client:
                    r = client.get(stream_url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://api.anivideo.net/"})
                    if r.status_code == 200 and ("#EXTM3U" in r.text or "video/" in r.headers.get("content-type", "")):
                        return {
                            "anime_id": anime_id,
                            "title": title,
                            "provider": provider,
                            "valid": True,
                            "stream_url": stream_url,
                            "reason": "OK (HLS ativo)"
                        }
                    return {
                        "anime_id": anime_id,
                        "title": title,
                        "provider": provider,
                        "valid": False,
                        "stream_url": stream_url,
                        "reason": f"Stream retornou status HTTP {r.status_code}"
                    }
            except Exception as e:
                return {
                    "anime_id": anime_id,
                    "title": title,
                    "provider": provider,
                    "valid": False,
                    "stream_url": stream_url,
                    "reason": f"Stream inacessível: {str(e)}"
                }

    # 2. AnimesOnlineCC
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
            with httpx.Client(timeout=5, follow_redirects=True) as client:
                r = client.get(ep_url, headers={"User-Agent": "Mozilla/5.0"})
                if r.status_code != 200:
                    return {
                        "anime_id": anime_id,
                        "title": title,
                        "provider": provider,
                        "valid": False,
                        "stream_url": ep_url,
                        "reason": f"Página do episódio HTTP {r.status_code}"
                    }

                soup = BeautifulSoup(r.text, "html.parser")
                iframes = [f.get("src") for f in soup.find_all("iframe") if f.get("src")]
                if not iframes:
                    return {
                        "anime_id": anime_id,
                        "title": title,
                        "provider": provider,
                        "valid": False,
                        "stream_url": ep_url,
                        "reason": "Nenhum iframe de vídeo encontrado na página"
                    }

                # Check Blogger tokens via batchexecute to verify if video streams are truly available
                has_blogger = False
                for ifr in iframes:
                    m = re.search(r"token=([^&\s\"']+)", ifr)
                    if m:
                        has_blogger = True
                        token = m.group(1)
                        streams = resolve_blogger_streams(token, timeout=3)
                        if streams:
                            return {
                                "anime_id": anime_id,
                                "title": title,
                                "provider": provider,
                                "valid": True,
                                "stream_url": streams[0][1],
                                "reason": f"OK ({streams[0][0]} direto ativo)"
                            }

                if has_blogger:
                    return {
                        "anime_id": anime_id,
                        "title": title,
                        "provider": provider,
                        "valid": False,
                        "stream_url": ep_url,
                        "reason": "Blogger: Vídeo não disponível ou removido pelo host (!)"
                    }

                # Non-blogger iframe fallback check (embeds)
                first_ifr = iframes[0]
                try:
                    ifr_resp = client.get(first_ifr, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://animesonlinecc.to/"})
                    if ifr_resp.status_code == 200 and len(ifr_resp.text) > 300:
                        return {
                            "anime_id": anime_id,
                            "title": title,
                            "provider": provider,
                            "valid": True,
                            "stream_url": first_ifr,
                            "reason": "OK (Player iframe ativo)"
                        }
                except Exception:
                    pass

                return {
                    "anime_id": anime_id,
                    "title": title,
                    "provider": provider,
                    "valid": False,
                    "stream_url": first_ifr,
                    "reason": f"Iframe inacessível ou offline: {first_ifr[:60]}"
                }
        except Exception as e:
            return {
                "anime_id": anime_id,
                "title": title,
                "provider": provider,
                "valid": False,
                "stream_url": ep_url,
                "reason": f"Erro de conexão: {str(e)}"
            }

    return {
        "anime_id": anime_id,
        "title": title,
        "provider": provider,
        "valid": False,
        "stream_url": stream_url,
        "reason": f"Provedor não suportado: {provider}"
    }

def audit_all_animes(max_workers: int = 25) -> Dict[str, Any]:
    """
    Audits every anime in animes_catalog.db.
    Hides invalid ones in SQLite and saves a complete quarantine record.
    """
    init_db()
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT a.id, a.canonical_title, es.id as source_id, es.provider, es.stream_url, es.provider_ep_id, es.extra_payload
        FROM animes a
        LEFT JOIN episodes ep ON ep.anime_id = a.id AND ep.episode_number = 1
        LEFT JOIN episode_sources es ON es.episode_id = ep.id
        GROUP BY a.id
        ORDER BY a.canonical_title ASC
    """)
    animes = [dict(r) for r in cur.fetchall()]
    total_animes = len(animes)
    print(f"[*] Iniciando Auditoria Completa de {total_animes} animes com {max_workers} threads...", flush=True)

    t0 = time.time()
    valid_list = []
    invalid_list = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(check_anime_health, a): a for a in animes}
        completed = 0
        for f in as_completed(futures):
            res = f.result()
            completed += 1
            if res["valid"]:
                valid_list.append(res)
            else:
                invalid_list.append(res)

            if completed % 100 == 0 or completed == total_animes:
                print(f"[{completed}/{total_animes}] {len(valid_list)} Válidos | {len(invalid_list)} Inválidos...", flush=True)

    t1 = time.time()
    duration = round(t1 - t0, 2)
    print(f"\n[+] Auditoria concluída em {duration}s!")
    print(f"    Total analisados: {total_animes}")
    print(f"    Válidos (transmitindo imagem): {len(valid_list)}")
    print(f"    Inválidos (ocultados e guardados): {len(invalid_list)}")

    # Update SQLite database: hide invalid, show valid
    print("[*] Atualizando banco de dados SQLite com as ocultações...", flush=True)
    invalid_ids = [item["anime_id"] for item in invalid_list]
    valid_ids = [item["anime_id"] for item in valid_list]

    cur.execute("UPDATE animes SET is_hidden = 1 WHERE id IN (%s)" % ",".join("?" * len(invalid_ids)), tuple(invalid_ids))
    if valid_ids:
        cur.execute("UPDATE animes SET is_hidden = 0 WHERE id IN (%s)" % ",".join("?" * len(valid_ids)), tuple(valid_ids))

    # Insert into invalid_links_quarantine table
    cur.execute("DELETE FROM invalid_links_quarantine WHERE content_type = 'anime'")
    for item in invalid_list:
        quar_id = f"quar_{item['anime_id']}"
        cur.execute("""
            INSERT OR REPLACE INTO invalid_links_quarantine 
            (id, content_type, content_id, title, provider, stream_url, error_reason)
            VALUES (?, 'anime', ?, ?, ?, ?, ?)
        """, (quar_id, item["anime_id"], item["title"], item["provider"], item.get("stream_url", ""), item["reason"]))

    conn.commit()
    conn.close()

    # Save to JSON quarantine file for viewing and management
    quarantine_payload = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_analisados": total_animes,
        "total_validos": len(valid_list),
        "total_invalidos": len(invalid_list),
        "duracao_segundos": duration,
        "links_invalidos": invalid_list,
        "links_validos_amostra": valid_list[:20]
    }

    os.makedirs(os.path.dirname(QUARANTINE_FILE), exist_ok=True)
    with open(QUARANTINE_FILE, "w", encoding="utf-8") as f:
        json.dump(quarantine_payload, f, ensure_ascii=False, indent=2)

    print(f"[+] Relatório de links inválidos salvo com sucesso em: {QUARANTINE_FILE}")

    # Re-export active clean animes into WEB_PORTAL/data/animes.json
    export_catalog_to_json()
    print("[+] Catálogo público atualizado: apenas títulos 100% funcionais estão visíveis aos clientes!")

    return quarantine_payload

if __name__ == "__main__":
    audit_all_animes(max_workers=30)
