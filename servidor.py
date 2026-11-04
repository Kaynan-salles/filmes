import http.server
import socketserver
import urllib.parse
import urllib.request
import urllib.error
import json
import os
import re
import sys
import webbrowser
import socket
import ipaddress

from animes_engine.sync_service import (
    resolve_episode_stream,
    get_anime_full_details,
    toggle_user_favorite,
    save_user_watch_progress,
    delete_user_watch_progress,
    get_user_activity,
    get_paginated_animes,
    get_season_episodes,
    start_background_sync,
    pause_background_sync,
    resume_background_sync,
    get_sync_status
)
from animes_engine.catalog import (
    sync_anime_from_provider,
    export_catalog_to_json
)
from animes_engine.deduplicator import (
    generate_diagnostic_report,
    consolidate_duplicates
)
from animes_engine.database import get_connection

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, "WEB_PORTAL")
M3U_FILE = os.path.join(BASE_DIR, "Filmes-Series.m3u8")

search_index = []

def carregar_indice():
    global search_index
    print("Carregando índice em memória de 316.354 títulos para busca instantânea...")
    if not os.path.exists(M3U_FILE):
        print(f"Aviso: {M3U_FILE} não encontrado.")
        return

    count = 0
    current_inf = None
    with open(M3U_FILE, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            if line.startswith("#EXTINF:"):
                current_inf = line
            elif line.startswith("#"):
                continue
            elif current_inf:
                url = line
                m_group = re.search(r'group-title="([^"]*)"', current_inf)
                grp = m_group.group(1) if m_group else "Geral"
                
                m_name = re.search(r'tvg-name="([^"]*)"', current_inf)
                if m_name and m_name.group(1):
                    name = m_name.group(1)
                else:
                    name = current_inf.split(",")[-1].strip() if "," in current_inf else "Sem Título"
                
                m_logo = re.search(r'tvg-logo="([^"]*)"', current_inf)
                logo = m_logo.group(1) if m_logo else ""

                search_index.append({
                    "t": name,
                    "catNome": grp,
                    "p": logo,
                    "u": url,
                    "s": name.lower()
                })
                current_inf = None
                count += 1

    print(f"Índice carregado com sucesso: {count:,} títulos prontos para busca instantânea (<5ms)!")

# Whitelist de domínios seguros autorizados para o proxy de vídeo (Anti-SSRF)
ALLOWED_PROXY_DOMAINS = [
    "akumast.net",
    "animefire.one",
    "animesonlinecc.to",
    "animesonline.io",
    "blogger.com",
    "googlevideo.com",
    "googleusercontent.com",
    "mywallpaper-4k-image.net",
    "anivideo.net",
    "maximaimg.online",
    "animesdigital.org",
    "tmdb.org",
    "betterstream.net",
    "cdn-anime.com",
    "playercdn.net",
    "blogspot.com"
]

def is_safe_proxy_url(url: str):
    """
    Valida a URL de streaming contra ataques de SSRF (Server-Side Request Forgery).
    - Exige http ou https
    - Valida contra whitelist de provedores de mídia
    - Resolve DNS e bloqueia redes privadas (127.0.0.1, 10.x, 192.168.x, loopback)
    """
    if not url or not isinstance(url, str):
        return False, "URL inválida ou vazia"
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception:
        return False, "Falha ao analisar formato de URL"

    if parsed.scheme not in ("http", "https"):
        return False, f"Esquema de protocolo não permitido: {parsed.scheme}"

    hostname = parsed.hostname
    if not hostname:
        return False, "Hostname ausente na URL"

    host_lower = hostname.lower()
    allowed = any(host_lower == d or host_lower.endswith("." + d) for d in ALLOWED_PROXY_DOMAINS)
    if not allowed:
        return False, f"Domínio não autorizado pelo proxy: {hostname}"

    # Validação de IP resolvido contra faixas privadas / locais
    try:
        addr_info = socket.getaddrinfo(hostname, None)
        for item in addr_info:
            ip_str = item[4][0]
            ip = ipaddress.ip_address(ip_str)
            if ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local or ip.is_multicast:
                return False, f"Acesso a IP local/privado bloqueado: {ip_str}"
    except Exception as e:
        return False, f"Erro na resolução DNS de {hostname}: {str(e)}"

    return True, "OK"

class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Impede redirecionamento aberto (open-redirect) para destinos locais ou inseguros."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        safe, reason = is_safe_proxy_url(newurl)
        if not safe:
            raise urllib.error.HTTPError(newurl, 403, f"Redirecionamento bloqueado por segurança: {reason}", headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl)

class KCineHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def address_string(self):
        # Desativa reverse DNS lookup síncrono do Python no Windows (reduz latência de 2000ms para <2ms)
        host, _ = self.client_address[:2]
        return str(host)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, text, status=200, content_type="text/plain; charset=utf-8"):
        body = text.encode("utf-8") if isinstance(text, str) else text
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Endpoint de catálogo paginado de animes (Performance ultra-leve: <5KB por página, cache TTL)
        if path == "/api/animes":
            query_params = urllib.parse.parse_qs(parsed.query)
            try:
                page = max(1, int(query_params.get("page", ["1"])[0]))
            except ValueError:
                page = 1
            try:
                limit = min(100, max(1, int(query_params.get("limit", ["24"])[0])))
            except ValueError:
                limit = 24
            search = query_params.get("search", [""])[0] or query_params.get("q", [""])[0]
            genre = query_params.get("genre", [""])[0]
            sort = query_params.get("sort", ["latest"])[0]

            data = get_paginated_animes(page=page, limit=limit, search=search, genre=genre, sort=sort)
            self.send_json(data, 200)
            return

        # Endpoint de episódios sob demanda por temporada
        if path == "/api/animes/episodes":
            query_params = urllib.parse.parse_qs(parsed.query)
            anime_id = query_params.get("anime_id", [""])[0].strip()
            try:
                season = int(query_params.get("season", ["1"])[0])
            except ValueError:
                season = 1

            if not anime_id:
                self.send_json({"error": "Parâmetro anime_id é obrigatório"}, 400)
                return

            episodes = get_season_episodes(anime_id, season)
            self.send_json(episodes, 200)
            return

        # Endpoint de status de sincronização em segundo plano
        if path == "/api/animes/sync-status":
            query_params = urllib.parse.parse_qs(parsed.query)
            provider = query_params.get("provider", [None])[0]
            status = get_sync_status(provider)
            self.send_json(status, 200)
            return

        # Endpoint para pausar a sincronização em segundo plano
        if path == "/api/animes/sync-pause":
            query_params = urllib.parse.parse_qs(parsed.query)
            reason = query_params.get("reason", ["Pausado pelo usuário"])[0]
            provider = query_params.get("provider", ["animesonlinecc"])[0]
            res = pause_background_sync(provider, reason=reason)
            self.send_json(res, 200)
            return

        # Endpoint para retomar a sincronização em segundo plano
        if path == "/api/animes/sync-resume":
            query_params = urllib.parse.parse_qs(parsed.query)
            provider = query_params.get("provider", ["animesonlinecc"])[0]
            res = resume_background_sync(provider)
            self.send_json(res, 200)
            return

        # Endpoint de busca instantânea: /api/search?q=nome
        if path == "/api/search":
            query_params = urllib.parse.parse_qs(parsed.query)
            q = query_params.get("q", [""])[0].strip().lower()
            limit = int(query_params.get("limit", ["80"])[0])

            if not q:
                results = []
            else:
                terms = q.split()
                results = []
                anime_titles_normalized = set()

                # Include matching animes first
                try:
                    conn = get_connection()
                    cur = conn.cursor()
                    cur.execute("SELECT id, canonical_title, poster, synopsis, total_episodes FROM animes")
                    for a_row in cur.fetchall():
                        t_lower = a_row["canonical_title"].lower()
                        if all(t in t_lower for t in terms):
                            results.append({
                                "id": a_row["id"],
                                "t": a_row["canonical_title"],
                                "catNome": "🌸 ANIMES | Catálogo Oficial",
                                "p": a_row["poster"],
                                "u": f"/api/animes/resolve?anime_id={a_row['id']}&ep=1&s=1",
                                "is_anime": True,
                                "total_episodios": a_row["total_episodes"],
                                "sinopse": a_row["synopsis"]
                            })
                            norm_t = re.sub(r'[^a-z0-9]', '', t_lower)
                            if norm_t:
                                anime_titles_normalized.add(norm_t)
                    conn.close()
                except Exception:
                    pass

                def _extract_series_key(title_str):
                    m = re.match(r'^(.*?)\s*[\(\[\{]?(?:S|TEMP|TEMPORADA|T)\s*(\d{1,2})\s*[\s\.\-_]*\s*(?:E|EP|CAP|CAPITULO|EPS)\s*(\d{1,3})', title_str, re.IGNORECASE)
                    if m:
                        return m.group(1).rstrip(' .-_').strip()
                    m2 = re.match(r'^(.*?)\s*[\(\[\{]?(\d{1,2})x(\d{1,3})', title_str, re.IGNORECASE)
                    if m2:
                        return m2.group(1).rstrip(' .-_').strip()
                    return title_str.strip()

                for item in search_index:
                    title_lower = item["s"]
                    if all(t in title_lower for t in terms):
                        # Evita duplicar animes oficiais com versões secundárias/incompletas de listas IPTV
                        s_key = _extract_series_key(item["t"]).lower()
                        s_norm = re.sub(r'[^a-z0-9]', '', s_key)
                        if s_norm in anime_titles_normalized:
                            continue

                        results.append({
                            "t": item["t"],
                            "catNome": item["catNome"],
                            "p": item["p"],
                            "u": item["u"]
                        })
                        if len(results) >= limit:
                            break

            self.send_json(results, 200)
            return

        # Endpoint de animes: detalhes completos de um anime
        if path == "/api/animes/details":
            query_params = urllib.parse.parse_qs(parsed.query)
            anime_id = query_params.get("id", [""])[0].strip()
            details = get_anime_full_details(anime_id)
            self.send_json(details or {}, 200 if details else 404)
            return

        # Endpoint de animes: resolução dinâmica de stream para reprodução
        if path == "/api/animes/resolve":
            query_params = urllib.parse.parse_qs(parsed.query)
            ep_id = query_params.get("episode_id", [""])[0].strip()
            anime_id = query_params.get("anime_id", [""])[0].strip()
            audio = query_params.get("audio", ["legendado"])[0].strip()
            provider = query_params.get("provider", [None])[0]
            quality = query_params.get("quality", [None])[0]

            if not ep_id and anime_id:
                # Find first episode of anime
                try:
                    conn = get_connection()
                    cur = conn.cursor()
                    cur.execute(
                        "SELECT id FROM episodes WHERE anime_id = ? ORDER BY season_number ASC, episode_number ASC LIMIT 1",
                        (anime_id,)
                    )
                    row = cur.fetchone()
                    conn.close()
                    if row:
                        ep_id = row["id"]
                except Exception:
                    pass

            if not ep_id:
                self.send_json({"success": False, "error": "Parâmetro episode_id ou anime_id obrigatório"}, 400)
                return

            res = resolve_episode_stream(ep_id, preferred_audio=audio, preferred_provider=provider, preferred_quality=quality)
            self.send_json(res, 200 if res.get("success") else 502)
            return

        # Endpoint de diagnóstico do catálogo de animes
        if path == "/api/animes/diagnostics":
            diag = generate_diagnostic_report()
            self.send_json(diag, 200)
            return

        # Endpoint de favoritos do usuário
        if path == "/api/animes/favorites":
            query_params = urllib.parse.parse_qs(parsed.query)
            user_id = query_params.get("user_id", ["guest"])[0].strip()
            activity = get_user_activity(user_id)
            self.send_json(activity.get("favorites", []), 200)
            return

        # Endpoint de continuar assistindo (watch progress)
        if path == "/api/animes/watch-progress":
            query_params = urllib.parse.parse_qs(parsed.query)
            user_id = query_params.get("user_id", ["guest"])[0].strip()
            activity = get_user_activity(user_id)
            self.send_json(activity.get("continue_watching", []), 200)
            return

        # Endpoint de gerenciamento de clientes: /api/clients
        if path == "/api/clients":
            clients_file = os.path.join(WEB_DIR, "data", "clientes.json")
            if os.path.exists(clients_file):
                try:
                    with open(clients_file, "r", encoding="utf-8") as f:
                        clients_data = json.load(f)
                except Exception:
                    clients_data = []
            else:
                clients_data = []
            self.send_json(clients_data, 200)
            return

        # Endpoint de proxy de streaming seguro: /api/stream?url=...
        if path == "/api/stream":
            query_params = urllib.parse.parse_qs(parsed.query)
            target_url = query_params.get("url", [""])[0].strip()
            if not target_url:
                self.send_text("Parametro url e obrigatorio", 400)
                return

            # Validação rigorosa anti-SSRF e domínios permitidos
            safe, reason = is_safe_proxy_url(target_url)
            if not safe:
                self.send_text(f"Proxy seguro: Acesso negado ({reason})", 403)
                return

            try:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "*/*"
                }
                if "akumast.net" in target_url or "animefire" in target_url:
                    headers["Referer"] = "https://animefire.one/"
                    headers["Origin"] = "https://animefire.one"
                elif "maximaimg.online" in target_url or "animesdigital" in target_url or "anivideo" in target_url:
                    headers["Referer"] = "https://api.anivideo.net/"
                    headers["Origin"] = "https://api.anivideo.net"
                elif "anidrive" in target_url or "animesonline" in target_url:
                    headers["Referer"] = "https://animesonline.io/"

                custom_ref = query_params.get("referer", [None])[0]
                if custom_ref:
                    headers["Referer"] = custom_ref

                if "Range" in self.headers:
                    headers["Range"] = self.headers["Range"]

                req = urllib.request.Request(target_url, headers=headers)
                opener = urllib.request.build_opener(SafeRedirectHandler)
                with opener.open(req, timeout=20) as resp:
                    content_type = str(resp.headers.get("content-type") or "").lower()
                    is_hls_candidate = (
                        "mpegurl" in content_type or 
                        target_url.endswith(".m3u8") or 
                        target_url.endswith("/h.jpg") or 
                        target_url.endswith("/p.jpg")
                    )

                    # Se for playlist HLS (m3u8), reescreve links relativos para passar pelo proxy seguro
                    if resp.status == 200 and is_hls_candidate:
                        raw_bytes = resp.read()
                        try:
                            raw_text = raw_bytes.decode("utf-8")
                        except Exception:
                            raw_text = raw_bytes.decode("latin1")

                        if "#EXTM3U" in raw_text:
                            base_url = target_url.rsplit('/', 1)[0] + '/'
                            output_lines = []
                            for line in raw_text.splitlines():
                                trimmed = line.strip()
                                if not trimmed:
                                    output_lines.append(line)
                                    continue
                                if trimmed.startswith('#'):
                                    def replace_uri(match):
                                        rel = match.group(1)
                                        full = urllib.parse.urljoin(base_url, rel)
                                        return f'URI="/api/stream?url={urllib.parse.quote(full)}"'
                                    rewritten_tag = re.sub(r'URI="([^"]+)"', replace_uri, trimmed)
                                    output_lines.append(rewritten_tag)
                                else:
                                    full = urllib.parse.urljoin(base_url, trimmed)
                                    output_lines.append(f"/api/stream?url={urllib.parse.quote(full)}")
                            rewritten_data = "\n".join(output_lines).encode("utf-8")
                            self.send_response(200)
                            self.send_header("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8")
                            self.send_header("Access-Control-Allow-Origin", "*")
                            self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
                            self.send_header("Access-Control-Allow-Headers", "Range, Content-Type, Accept")
                            self.send_header("Content-Length", str(len(rewritten_data)))
                            self.end_headers()
                            self.wfile.write(rewritten_data)
                            return

                    self.send_response(resp.status)
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
                    self.send_header("Access-Control-Allow-Headers", "Range, Content-Type, Accept")

                    pass_headers = ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"]
                    for h in pass_headers:
                        val = resp.headers.get(h)
                        if val:
                            self.send_header(h.title(), val)

                    if not resp.headers.get("accept-ranges"):
                        self.send_header("Accept-Ranges", "bytes")

                    self.end_headers()

                    try:
                        while True:
                            chunk = resp.read(64 * 1024)
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                    except (BrokenPipeError, ConnectionResetError):
                        pass
                return
            except Exception as e:
                try:
                    self.send_text(f"Erro no streaming proxy: {str(e)}", 502)
                except Exception:
                    pass
                return

        # Rota para acessar arquivos de CANAIS_ORGANIZADOS diretamente
        if path.startswith("/CANAIS_ORGANIZADOS/"):
            rel_path = path[len("/CANAIS_ORGANIZADOS/"):]
            file_path = os.path.join(BASE_DIR, "CANAIS_ORGANIZADOS", urllib.parse.unquote(rel_path))
            if os.path.exists(file_path) and os.path.isfile(file_path):
                with open(file_path, "rb") as f:
                    file_bytes = f.read()
                self.send_response(200)
                if file_path.endswith(".m3u8"):
                    self.send_header("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8")
                    self.send_header("Content-Disposition", f'attachment; filename="{os.path.basename(file_path)}"')
                elif file_path.endswith(".json"):
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                elif file_path.endswith(".csv"):
                    self.send_header("Content-Type", "text/csv; charset=utf-8")
                else:
                    self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(file_bytes)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(file_bytes)
                return

        return super().do_GET()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/clients":
            content_length = int(self.headers.get("Content-Length", 0))
            post_body = self.rfile.read(content_length)
            try:
                data = json.loads(post_body.decode("utf-8"))
                clients_file = os.path.join(WEB_DIR, "data", "clientes.json")
                os.makedirs(os.path.dirname(clients_file), exist_ok=True)
                with open(clients_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_json({"success": True}, 200)
                return
            except Exception as e:
                self.send_json({"success": False, "error": str(e)}, 500)
                return

        # POST /api/animes/sync: sincroniza título por busca OU controla sincronização em segundo plano
        if path == "/api/animes/sync":
            content_length = int(self.headers.get("Content-Length", 0))
            post_body = self.rfile.read(content_length)
            try:
                data = json.loads(post_body.decode("utf-8")) if post_body else {}
                action = data.get("action", "start").lower()
                provider = data.get("provider", "animesonlinecc")
                query = data.get("query", "").strip()

                if action == "pause":
                    res = pause_background_sync(provider, reason=data.get("reason", "Pausado pelo usuário"))
                elif action == "resume":
                    res = resume_background_sync(provider)
                elif query:
                    res = sync_anime_from_provider(provider, query, max_results=int(data.get("max_results", 3)))
                else:
                    batch_size = int(data.get("batch_size", 2))
                    continuous = bool(data.get("continuous", True))
                    res = start_background_sync(provider_name=provider, batch_size=batch_size, continuous=continuous)

                self.send_json(res, 200)
                return
            except Exception as e:
                self.send_json({"success": False, "error": str(e)}, 500)
                return

        # POST /api/animes/consolidate: consolida duplicatas exatas mantendo favoritos e histórico
        if path == "/api/animes/consolidate":
            content_length = int(self.headers.get("Content-Length", 0))
            post_body = self.rfile.read(content_length)
            try:
                data = json.loads(post_body.decode("utf-8")) if post_body else {}
                dry_run = bool(data.get("dry_run", False))
                res = consolidate_duplicates(dry_run=dry_run)
                export_catalog_to_json()
                self.send_json(res, 200)
                return
            except Exception as e:
                self.send_json({"success": False, "error": str(e)}, 500)
                return

        # POST /api/animes/favorites: alternar favorito
        if path == "/api/animes/favorites":
            content_length = int(self.headers.get("Content-Length", 0))
            post_body = self.rfile.read(content_length)
            try:
                data = json.loads(post_body.decode("utf-8"))
                user_id = data.get("user_id", "guest")
                content_id = data.get("content_id", "")
                title = data.get("title", "")
                poster = data.get("poster", "")
                res = toggle_user_favorite(user_id, content_id, title, poster)
                self.send_json(res, 200)
                return
            except Exception as e:
                self.send_json({"success": False, "error": str(e)}, 500)
                return

        # POST /api/animes/watch-progress: salvar progresso de reprodução
        if path == "/api/animes/watch-progress":
            content_length = int(self.headers.get("Content-Length", 0))
            post_body = self.rfile.read(content_length)
            try:
                data = json.loads(post_body.decode("utf-8"))
                res = save_user_watch_progress(
                    user_id=data.get("user_id", "guest"),
                    content_id=data.get("content_id", ""),
                    episode_id=data.get("episode_id", ""),
                    season_number=int(data.get("season_number", 1)),
                    episode_number=float(data.get("episode_number", 1)),
                    episode_title=data.get("episode_title", ""),
                    position_seconds=float(data.get("position_seconds", 0)),
                    duration_seconds=float(data.get("duration_seconds", 0)),
                    content_type=data.get("content_type", "anime"),
                    content_title=data.get("content_title", ""),
                    poster=data.get("poster", ""),
                    stream_url=data.get("stream_url", "")
                )
                self.send_json(res, 200)
                return
            except Exception as e:
                self.send_json({"success": False, "error": str(e)}, 500)
                return

        # POST /api/animes/watch-progress/delete: remover item ou limpar histórico
        if path == "/api/animes/watch-progress/delete":
            content_length = int(self.headers.get("Content-Length", 0))
            post_body = self.rfile.read(content_length)
            try:
                data = json.loads(post_body.decode("utf-8")) if content_length > 0 else {}
                res = delete_user_watch_progress(
                    user_id=data.get("user_id", "guest"),
                    content_id=data.get("content_id", None)
                )
                self.send_json(res, 200)
                return
            except Exception as e:
                self.send_json({"success": False, "error": str(e)}, 500)
                return

        return super().do_POST()

class DualStackServer(http.server.ThreadingHTTPServer):
    address_family = socket.AF_INET6

    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except Exception:
            pass
        return super().server_bind()

def main():
    carregar_indice()
    server_class = DualStackServer
    server_class.allow_reuse_address = True
    bind_addr = "::"
    try:
        with server_class((bind_addr, PORT), KCineHandler) as httpd:
            url = f"http://127.0.0.1:{PORT}"
            print("=" * 65)
            print("            K-CINE - PORTAL DO CANAL DE FILMES E SÉRIES")
            print("=" * 65)
            print(f"\n[+] Servidor ativo em: {url} (e http://localhost:{PORT})")
            print(f"[+] Total de títulos no catálogo: {len(search_index):,}")
            print("\nPressione Ctrl+C para encerrar o servidor.\n")
            
            try:
                webbrowser.open(url)
            except Exception:
                pass
                
            httpd.serve_forever()
    except OSError as e:
        print(f"Porta {PORT} ocupada, tentando porta {PORT + 1}...")
        with server_class((bind_addr, PORT + 1), KCineHandler) as httpd:
            url = f"http://127.0.0.1:{PORT + 1}"
            print(f"[+] Servidor ativo em: {url}")
            try:
                webbrowser.open(url)
            except Exception:
                pass
            httpd.serve_forever()

if __name__ == "__main__":
    main()
