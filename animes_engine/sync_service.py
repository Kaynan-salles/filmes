import time
import json
import threading
from typing import Dict, Any, List, Optional, Tuple

import httpx

from animes_engine.database import get_connection, db_transaction
from animes_engine.catalog import (
    upsert_anime,
    upsert_episode,
    upsert_episode_source,
    export_catalog_to_json,
    sync_anime_from_provider,
    import_anime_by_id
)
from animes_engine.providers import get_provider, list_providers, BaseAnimeProvider
from animes_engine.providers.base import StreamResolution

# In-memory stream resolution cache with TTL
_STREAM_CACHE: Dict[str, Tuple[float, StreamResolution]] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour

# In-memory catalog page listing cache with TTL
_ANIMES_PAGE_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
PAGE_CACHE_TTL_SECONDS = 300  # 5 minutes

# Mutex to prevent multiple concurrent background syncs
SYNC_MUTEX = threading.Lock()
# Event flag for graceful pausing/stopping
SYNC_STOP_EVENT = threading.Event()


def invalidate_animes_cache() -> None:
    """Invalidate all cached catalog listing pages."""
    global _ANIMES_PAGE_CACHE
    _ANIMES_PAGE_CACHE.clear()


def get_cached_stream(cache_key: str) -> Optional[StreamResolution]:
    """Retrieve stream from cache if valid and not expired."""
    cached = _STREAM_CACHE.get(cache_key)
    if cached:
        timestamp, res = cached
        if time.time() - timestamp < CACHE_TTL_SECONDS:
            return res
        else:
            del _STREAM_CACHE[cache_key]
    return None


def set_cached_stream(cache_key: str, resolution: StreamResolution) -> None:
    """Store resolved stream in memory with current timestamp."""
    _STREAM_CACHE[cache_key] = (time.time(), resolution)


def _auto_enrich_episode_sources(episode_id: str) -> None:
    """
    Search and link AnimesOnlineCC and AnimesDigital if an episode only has dead/legacy sources (e.g. AnimeFire 404).
    Uses canonical title, title parts, and aliases without creating duplicate animes.
    """
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT a.id, a.canonical_title, a.normalized_title, e.season_number, e.episode_number
            FROM episodes e
            JOIN animes a ON e.anime_id = a.id
            WHERE e.id = ?
            """,
            (episode_id,)
        )
        meta = cur.fetchone()
        if not meta:
            conn.close()
            return

        title = meta["canonical_title"]
        anime_id = meta["id"]

        # Fetch aliases
        cur.execute("SELECT alias FROM anime_aliases WHERE anime_id = ?", (anime_id,))
        aliases = [r["alias"] for r in cur.fetchall()]
        conn.close()

        queries_to_try = [title]
        if ":" in title:
            queries_to_try.extend([p.strip() for p in title.split(":") if p.strip()])
        if "-" in title:
            queries_to_try.extend([p.strip() for p in title.split("-") if p.strip()])
        queries_to_try.extend(aliases)

        for p_name in ("animesonlinecc", "animesdigital"):
            prov = get_provider(p_name)
            if not prov:
                continue
            matched_id = None
            for q in queries_to_try:
                try:
                    results = prov.search_anime(q)
                    if results:
                        matched_id = results[0].provider_anime_id
                        break
                except Exception:
                    continue

            if matched_id:
                try:
                    with db_transaction() as sub_conn:
                        import_anime_by_id(p_name, matched_id, sub_conn)
                except Exception:
                    pass
    except Exception:
        pass


def resolve_episode_stream(
    episode_id: str,
    preferred_audio: str = "legendado",
    preferred_provider: Optional[str] = None,
    preferred_quality: Optional[str] = None
) -> Dict[str, Any]:
    """
    Resolve a stream for the specified episode with multi-provider selection.
    - Inspects available episode sources in database (AnimesDigital, AnimesOnlineCC, AnimeFire).
    - If episode only has broken/legacy sources, auto-enriches alternative sources on-demand.
    - Allows choosing provider (AnimesDigital vs AnimesOnlineCC) and verified quality (720p HD vs 360p SD).
    - If primary choice fails (e.g. 404), seamlessly falls back to working alternatives.
    - Returns full list of available sources with verified resolution metadata.
    """
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM episode_sources WHERE episode_id = ?", (episode_id,))
    sources = [dict(r) for r in cur.fetchall()]
    conn.close()

    # If only animefire or empty, auto-enrich with AnimesOnlineCC / AnimesDigital
    has_working_provider = any(s["provider"] in ("animesonlinecc", "animesdigital") for s in sources)
    if not has_working_provider:
        _auto_enrich_episode_sources(episode_id)
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM episode_sources WHERE episode_id = ?", (episode_id,))
        sources = [dict(r) for r in cur.fetchall()]
        conn.close()

    if not sources:
        return {
            "success": False,
            "error": "Nenhuma fonte de reprodução encontrada para este episódio.",
            "episode_id": episode_id
        }

    # Build available candidates list
    candidates: List[Dict[str, Any]] = []
    for s in sources:
        prov = s["provider"]
        audio = s["audio_type"]
        is_dyn = bool(s.get("is_dynamic", 1))
        stream_u = s.get("stream_url") or ""
        if prov == "animesdigital":
            candidates.append({
                "source_id": s["id"],
                "provider": "animesdigital",
                "provider_label": "AnimesDigital",
                "audio_type": audio,
                "quality": "720p HD",
                "quality_label": "720p HD (Verificado)",
                "verified": True,
                "notes": "HLS 720p (sem marca d'água observada nas amostras)",
                "player_type": "direct",
                "provider_ep_id": s["provider_ep_id"],
                "extra_payload": s["extra_payload"],
                "is_dynamic": is_dyn,
                "stream_url": stream_u
            })
        elif prov == "animesonlinecc":
            s_qual = s.get("quality", "HD")
            if "360" in s_qual:
                candidates.append({
                    "source_id": s["id"],
                    "provider": "animesonlinecc",
                    "provider_label": "AnimesOnlineCC",
                    "audio_type": audio,
                    "quality": "360p SD",
                    "quality_label": "360p SD",
                    "verified": True,
                    "notes": "MP4 360p econômico",
                    "player_type": "direct",
                    "provider_ep_id": s["provider_ep_id"],
                    "extra_payload": s["extra_payload"],
                    "is_dynamic": is_dyn,
                    "stream_url": stream_u
                })
            elif "720" in s_qual:
                candidates.append({
                    "source_id": s["id"],
                    "provider": "animesonlinecc",
                    "provider_label": "AnimesOnlineCC",
                    "audio_type": audio,
                    "quality": "720p HD",
                    "quality_label": "720p HD (Verificado)",
                    "verified": True,
                    "notes": "MP4 720p nativo GoogleVideo",
                    "player_type": "direct",
                    "provider_ep_id": s["provider_ep_id"],
                    "extra_payload": s["extra_payload"],
                    "is_dynamic": is_dyn,
                    "stream_url": stream_u
                })
            else:
                candidates.append({
                    "source_id": s["id"],
                    "provider": "animesonlinecc",
                    "provider_label": "AnimesOnlineCC",
                    "audio_type": audio,
                    "quality": "720p HD",
                    "quality_label": "720p HD (Verificado)",
                    "verified": True,
                    "notes": "MP4 720p nativo GoogleVideo",
                    "player_type": "direct",
                    "provider_ep_id": s["provider_ep_id"],
                    "extra_payload": s["extra_payload"],
                    "is_dynamic": is_dyn,
                    "stream_url": stream_u
                })
                candidates.append({
                    "source_id": s["id"],
                    "provider": "animesonlinecc",
                    "provider_label": "AnimesOnlineCC",
                    "audio_type": audio,
                    "quality": "360p SD",
                    "quality_label": "360p SD",
                    "verified": True,
                    "notes": "MP4 360p econômico",
                    "player_type": "direct",
                    "provider_ep_id": s["provider_ep_id"],
                    "extra_payload": s["extra_payload"],
                    "is_dynamic": is_dyn,
                    "stream_url": ""
                })
        elif prov == "animefire":
            candidates.append({
                "source_id": s["id"],
                "provider": "animefire",
                "provider_label": "AnimeFire",
                "audio_type": audio,
                "quality": "HD",
                "quality_label": "HD",
                "verified": False,
                "notes": "Legado (instável)",
                "player_type": s["player_type"],
                "provider_ep_id": s["provider_ep_id"],
                "extra_payload": s["extra_payload"],
                "is_dynamic": is_dyn,
                "stream_url": stream_u
            })

    # Deduplicate candidates by (provider, quality, audio_type)
    unique_candidates: List[Dict[str, Any]] = []
    seen_keys = set()
    for c in candidates:
        key = (c["provider"], c["quality"], c["audio_type"])
        if key not in seen_keys:
            seen_keys.add(key)
            unique_candidates.append(c)

    # Ranking score based on user preferences
    def calc_score(cand: Dict[str, Any]) -> int:
        score = 0
        if preferred_provider and cand["provider"].lower() == preferred_provider.lower():
            score += 1000
        if preferred_quality and cand["quality"].lower().startswith(preferred_quality[:3].lower()):
            score += 500
        if preferred_audio and cand["audio_type"].lower() == preferred_audio.lower():
            score += 200
        if cand["provider"] == "animesdigital":
            score += 250
        if cand["provider"] == "animefire":
            score -= 5000
        return score

    unique_candidates.sort(key=calc_score, reverse=True)

    last_error = None
    for cand in unique_candidates:
        source_id = cand["source_id"]
        cache_key = f"{source_id}:{cand['quality']}"

        # 1. Check in-memory cache (only accept verified valid cached streams)
        cached = get_cached_stream(cache_key)
        if cached and cached.success and cached.stream_url:
            # If cached stream is direct GoogleVideo, verify it is still accessible
            is_valid_cache = True
            if "googlevideo.com" in cached.stream_url:
                try:
                    with httpx.Client(timeout=2.0) as check_client:
                        check_resp = check_client.get(cached.stream_url, headers={"User-Agent": "Mozilla/5.0"})
                        if check_resp.status_code >= 400:
                            is_valid_cache = False
                            if cache_key in _STREAM_CACHE:
                                del _STREAM_CACHE[cache_key]
                except Exception:
                    is_valid_cache = False

            if is_valid_cache:
                for c in unique_candidates:
                    c["selected"] = (c is cand)
                return {
                    "success": True,
                    "stream_url": cached.stream_url,
                    "player_type": cached.player_type,
                    "headers": cached.headers,
                    "audio_type": cand["audio_type"],
                    "provider": cand["provider"],
                    "provider_label": cand["provider_label"],
                    "quality": cached.quality or cand["quality"],
                    "quality_verified": cand["verified"],
                    "notes": cand["notes"],
                    "available_sources": [
                        {
                            "provider": c["provider"],
                            "provider_label": c["provider_label"],
                            "quality": c["quality"],
                            "quality_label": c["quality_label"],
                            "audio_type": c["audio_type"],
                            "player_type": c["player_type"],
                            "notes": c["notes"],
                            "selected": c.get("selected", False)
                        }
                        for c in unique_candidates
                    ],
                    "episode_id": episode_id,
                    "source_id": source_id,
                    "cached": True
                }

        # 2. Resolution: static stream vs dynamic resolution via provider
        try:
            if not cand.get("is_dynamic") and cand.get("stream_url"):
                resolution = StreamResolution(
                    success=True,
                    stream_url=cand["stream_url"],
                    player_type=cand.get("player_type", "direct"),
                    quality=cand["quality"]
                )
            else:
                provider = get_provider(cand["provider"])
                if not provider:
                    last_error = f"Provedor '{cand['provider']}' indisponível."
                    continue

                extra_payload = json.loads(cand["extra_payload"]) if cand["extra_payload"] else {}
                extra_payload["audio"] = cand["audio_type"]
                extra_payload["quality"] = cand["quality"]
                resolution = provider.resolve_stream(cand["provider_ep_id"], extra_payload)

            if resolution and resolution.success and resolution.stream_url:
                # Lightweight probe to guarantee stream is not 404 (ignore example.com test URLs)
                is_playable = True
                if resolution.player_type == "direct" and resolution.stream_url.startswith("http") and "example.com" not in resolution.stream_url:
                    try:
                        probe_headers = {"User-Agent": "Mozilla/5.0"}
                        if resolution.headers and "Referer" in resolution.headers:
                            probe_headers["Referer"] = resolution.headers["Referer"]
                        if resolution.headers and "Origin" in resolution.headers:
                            probe_headers["Origin"] = resolution.headers["Origin"]
                        with httpx.Client(timeout=1.5) as probe_client:
                            probe_resp = probe_client.get(resolution.stream_url, headers=probe_headers, follow_redirects=True)
                            if probe_resp.status_code >= 400 or probe_resp.status_code in (401, 403, 404, 410, 500, 502, 503):
                                is_playable = False
                                last_error = f"Stream do servidor {cand['provider_label']} indisponível (HTTP {probe_resp.status_code})"
                    except Exception:
                        pass

                if is_playable:
                    set_cached_stream(cache_key, resolution)
                    for c in unique_candidates:
                        c["selected"] = (c is cand)
                    return {
                        "success": True,
                        "stream_url": resolution.stream_url,
                        "player_type": resolution.player_type,
                        "headers": resolution.headers,
                        "audio_type": cand["audio_type"],
                        "provider": cand["provider"],
                        "provider_label": cand["provider_label"],
                        "quality": resolution.quality or cand["quality"],
                        "quality_verified": cand["verified"],
                        "notes": cand["notes"],
                        "available_sources": [
                            {
                                "provider": c["provider"],
                                "provider_label": c["provider_label"],
                                "quality": c["quality"],
                                "quality_label": c["quality_label"],
                                "audio_type": c["audio_type"],
                                "player_type": c["player_type"],
                                "notes": c["notes"],
                                "selected": c.get("selected", False)
                            }
                            for c in unique_candidates
                        ],
                        "episode_id": episode_id,
                        "source_id": source_id,
                        "cached": False
                    }
            else:
                last_error = (resolution.error_message if resolution else None) or "Falha ao resolver stream."
        except Exception as e:
            last_error = str(e)
            continue

    # Se todas as opções falharam e ainda não houve auto-enrich nesta chamada, tenta enriquecer e re-executar
    if not has_working_provider:
        _auto_enrich_episode_sources(episode_id)
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM episode_sources WHERE episode_id = ? AND provider IN ('animesonlinecc', 'animesdigital')", (episode_id,))
        fresh_sources = cur.fetchall()
        conn.close()
        if fresh_sources:
            return resolve_episode_stream(episode_id, preferred_audio, preferred_provider, preferred_quality)

    return {
        "success": False,
        "error": f"Não foi possível iniciar a reprodução. Fontes do episódio temporariamente indisponíveis ({last_error or 'Servidor de vídeo sem resposta'}).",
        "episode_id": episode_id
    }


def get_season_episodes(anime_id: str, season_number: int = 1) -> List[Dict[str, Any]]:
    """Fetch on-demand episodes strictly for the requested season."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT * FROM episodes
        WHERE anime_id = ? AND season_number = ?
        ORDER BY episode_number ASC
        """,
        (anime_id, season_number)
    )
    episodes_rows = [dict(r) for r in cur.fetchall()]
    if not episodes_rows:
        conn.close()
        return []

    cur.execute(
        """
        SELECT es.* FROM episode_sources es
        JOIN episodes e ON es.episode_id = e.id
        WHERE e.anime_id = ? AND e.season_number = ?
        """,
        (anime_id, season_number)
    )
    sources_rows = cur.fetchall()
    conn.close()

    sources_by_ep: Dict[str, List[Dict[str, Any]]] = {}
    for s in sources_rows:
        sources_by_ep.setdefault(s["episode_id"], []).append(dict(s))

    for ep in episodes_rows:
        ep_sources = sources_by_ep.get(ep["id"], [])
        ep["audios"] = list({s["audio_type"] for s in ep_sources}) or ["legendado"]
        ep["providers"] = list({s["provider"] for s in ep_sources}) or []
        ep["sources_count"] = len(ep_sources)

    return episodes_rows


def get_paginated_animes(
    page: int = 1,
    limit: int = 24,
    search: str = "",
    genre: str = "",
    sort: str = "padrao"
) -> Dict[str, Any]:
    """
    Paginate, search, filter, and sort anime catalog with high-performance memory caching.
    Delivers lightweight card payloads (<5KB) without massive episode arrays.
    """
    page = max(1, page)
    limit = max(1, min(limit, 60))
    cache_key = f"{page}:{limit}:{search.strip().lower()}:{genre.strip().lower()}:{sort}"

    cached = _ANIMES_PAGE_CACHE.get(cache_key)
    if cached:
        timestamp, data = cached
        if time.time() - timestamp < PAGE_CACHE_TTL_SECONDS:
            return data

    conn = get_connection()
    cur = conn.cursor()

    where_clauses = ["1=1"]
    params = []

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        where_clauses.append("""
            (
                a.canonical_title LIKE ? OR
                a.normalized_title LIKE ? OR
                EXISTS (SELECT 1 FROM anime_aliases al WHERE al.anime_id = a.id AND al.alias LIKE ?)
            )
        """)
        params.extend([term, term, term])

    if genre and genre.strip():
        g_term = f"%{genre.strip().lower()}%"
        where_clauses.append("LOWER(a.genres) LIKE ?")
        params.append(g_term)

    where_sql = " AND ".join(where_clauses)

    # 1. Total items count
    cur.execute(f"SELECT COUNT(*) FROM animes a WHERE {where_sql}", tuple(params))
    total_items = cur.fetchone()[0]

    # 2. Total catalog episodes count
    cur.execute("SELECT COALESCE(SUM(total_episodes), 0) FROM animes")
    total_catalog_eps = cur.fetchone()[0]

    # 3. Sort order
    order_by = "a.created_at DESC"
    if sort == "az":
        order_by = "a.canonical_title COLLATE NOCASE ASC"
    elif sort == "za":
        order_by = "a.canonical_title COLLATE NOCASE DESC"
    elif sort == "ano":
        order_by = "a.year DESC NULLS LAST, a.created_at DESC"
    elif sort == "episodios":
        order_by = "a.total_episodes DESC, a.created_at DESC"

    offset = (page - 1) * limit
    fetch_params = tuple(params) + (limit, offset)

    cur.execute(
        f"""
        SELECT a.id, a.canonical_title, a.poster, a.year, a.season, a.format, a.total_episodes, a.genres
        FROM animes a
        WHERE {where_sql}
        ORDER BY {order_by}
        LIMIT ? OFFSET ?
        """,
        fetch_params
    )
    rows = cur.fetchall()
    conn.close()

    total_pages = max(1, (total_items + limit - 1) // limit)
    items = []
    for r in rows:
        genres_list = json.loads(r["genres"]) if r["genres"] else ["Anime"]
        items.append({
            "id": r["id"],
            "t": r["canonical_title"],
            "p": r["poster"],
            "ano": r["year"] or 2024,
            "temporadas": r["season"],
            "total_episodios": r["total_episodes"],
            "generos": genres_list,
            "format": r["format"],
            "is_anime": True
        })

    result = {
        "page": page,
        "limit": limit,
        "total_items": total_items,
        "total_count": total_items,
        "total_pages": total_pages,
        "has_more": page < total_pages,
        "total_catalog_episodes": total_catalog_eps,
        "items": items,
        "animes": items
    }

    _ANIMES_PAGE_CACHE[cache_key] = (time.time(), result)
    return result


def get_sync_status(provider_name: Optional[str] = None) -> Dict[str, Any]:
    """Retrieve live sync state and progress from database."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM sync_progress")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    is_any_running = any(r.get("is_running") for r in rows) or SYNC_MUTEX.locked()
    target_prov = provider_name or "animesonlinecc"
    primary = next((r for r in rows if r.get("provider") == target_prov), (rows[0] if rows else {}))

    status = primary.get("status", "RUNNING" if is_any_running else "IDLE")
    pause_reason = primary.get("pause_reason", "")
    last_page = primary.get("last_page", 0)
    current_page = primary.get("current_page", last_page)
    current_batch = primary.get("current_batch", 0)
    pages_completed = primary.get("pages_completed", 0)
    total_synced = primary.get("total_synced", 0)
    new_titles = primary.get("new_titles", 0)
    updated_titles = primary.get("updated_titles", 0)
    errors_count = primary.get("errors_count", 0)
    last_error = primary.get("last_error", "")
    raw_est = primary.get("total_pages_estimated")
    if raw_est and 1 <= raw_est <= 2000:
        total_est = raw_est
        remaining = max(0, total_est - last_page)
    else:
        total_est = None
        remaining = None

    return {
        "status": status,
        "is_running": 1 if is_any_running else 0,
        "pause_reason": pause_reason,
        "provider": primary.get("provider", target_prov),
        "current_page": current_page,
        "last_page": last_page,
        "current_batch": current_batch,
        "pages_completed": pages_completed,
        "total_synced": total_synced,
        "new_titles": new_titles,
        "updated_titles": updated_titles,
        "errors_count": errors_count,
        "last_error": last_error,
        "total_pages_estimated": total_est,
        "remaining_pages": remaining,
        "providers": rows
    }


def pause_background_sync(provider_name: str = "animesonlinecc", reason: str = "Pausado pelo usuário") -> Dict[str, Any]:
    """Request graceful pause of the running background synchronization."""
    SYNC_STOP_EVENT.set()
    canonical_provider = "animesonlinecc" if provider_name in ("animesonlinecc", "animesonline") else provider_name
    with db_transaction() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE sync_progress SET
                status = 'PAUSED',
                pause_reason = ?,
                is_running = 0,
                last_synced_at = CURRENT_TIMESTAMP
            WHERE provider = ?
            """,
            (reason, canonical_provider)
        )
    return {
        "success": True,
        "status": "PAUSED",
        "message": f"Pausa solicitada com sucesso para '{canonical_provider}'. Motivo: {reason}",
        "provider": canonical_provider
    }


def resume_background_sync(provider_name: str = "animesonlinecc") -> Dict[str, Any]:
    """Resume synchronization from last persisted checkpoint."""
    return start_background_sync(provider_name=provider_name, batch_size=2, continuous=True)


def _worker_sync_provider(
    provider_name: str,
    batch_size: int = 2,
    continuous: bool = True,
    delay: float = 0.4,
    pause_between_batches: float = 2.5
) -> None:
    """
    Internal thread worker that executes synchronization in small chained batches
    automatically, with pauses between batches, request limits, persistent checkpointing,
    and support for pause/resume.
    """
    canonical_provider = "animesonlinecc" if provider_name in ("animesonlinecc", "animesonline") else provider_name
    SYNC_STOP_EVENT.clear()

    with SYNC_MUTEX:
        provider = get_provider(canonical_provider)
        if not provider:
            return

        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM sync_progress WHERE provider = ?", (canonical_provider,))
        row = cur.fetchone()
        conn.close()

        last_page = row["last_page"] if row else 0
        current_batch = row["current_batch"] if (row and "current_batch" in row.keys() and row["current_batch"]) else 0
        total_synced = row["total_synced"] if row else 0
        pages_completed = row["pages_completed"] if (row and "pages_completed" in row.keys() and row["pages_completed"] is not None) else 0
        new_titles = row["new_titles"] if (row and "new_titles" in row.keys() and row["new_titles"] is not None) else 0
        updated_titles = row["updated_titles"] if (row and "updated_titles" in row.keys() and row["updated_titles"] is not None) else 0
        errors_count = row["errors_count"] if (row and "errors_count" in row.keys() and row["errors_count"] is not None) else 0
        last_error = row["last_error"] if (row and "last_error" in row.keys() and row["last_error"] is not None) else ""
        raw_est = row["total_pages_estimated"] if (row and "total_pages_estimated" in row.keys()) else None
        total_pages_estimated = raw_est if (raw_est and 1 <= raw_est <= 2000) else 0

        start_page = last_page + 1

        with db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO sync_progress (
                    provider, status, pause_reason, last_page, current_page, current_batch,
                    pages_completed, total_synced, new_titles, updated_titles, errors_count,
                    last_error, total_pages_estimated, is_running, last_synced_at
                ) VALUES (?, 'RUNNING', '', ?, ?, ?, ?, ?, ?, ?, ?, '', ?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(provider) DO UPDATE SET
                    status = 'RUNNING',
                    pause_reason = '',
                    current_page = excluded.current_page,
                    is_running = 1,
                    last_synced_at = CURRENT_TIMESTAMP
                """,
                (canonical_provider, last_page, start_page, current_batch, pages_completed, total_synced, new_titles, updated_titles, errors_count, total_pages_estimated)
            )

        try:
            if canonical_provider == "animesonlinecc":
                while not SYNC_STOP_EVENT.is_set():
                    # Check if reached verifiable end of pagination
                    if total_pages_estimated > 0 and last_page >= total_pages_estimated:
                        with db_transaction() as conn:
                            cur = conn.cursor()
                            cur.execute(
                                """
                                UPDATE sync_progress SET
                                    status = 'COMPLETED',
                                    pause_reason = 'Fim verificável da paginação alcançado',
                                    is_running = 0,
                                    last_synced_at = CURRENT_TIMESTAMP
                                WHERE provider = ?
                                """,
                                (canonical_provider,)
                            )
                        break

                    current_batch += 1
                    batch_start = last_page + 1
                    batch_end = (batch_start + batch_size - 1) if (total_pages_estimated <= 0) else min(total_pages_estimated, batch_start + batch_size - 1)

                    with db_transaction() as conn:
                        cur = conn.cursor()
                        cur.execute(
                            """
                            UPDATE sync_progress SET
                                current_batch = ?,
                                status = 'RUNNING',
                                last_synced_at = CURRENT_TIMESTAMP
                            WHERE provider = ?
                            """,
                            (current_batch, canonical_provider)
                        )

                    # Process pages in current batch
                    for page_num in range(batch_start, batch_end + 1):
                        if SYNC_STOP_EVENT.is_set():
                            break

                        with db_transaction() as conn:
                            cur = conn.cursor()
                            cur.execute(
                                "UPDATE sync_progress SET current_page = ?, last_synced_at = CURRENT_TIMESTAMP WHERE provider = ?",
                                (page_num, canonical_provider)
                            )

                        # Fetch catalog page with retries and deep inspection
                        page_detail = None
                        for attempt in range(3):
                            if hasattr(provider, "get_catalog_page_detailed"):
                                page_detail = provider.get_catalog_page_detailed(page_num)
                            elif hasattr(provider, "get_catalog_page_with_meta"):
                                res_items, est_tot = provider.get_catalog_page_with_meta(page_num)
                                page_detail = {
                                    "results": res_items,
                                    "total_pages": est_tot,
                                    "is_end_of_catalog": (est_tot > 0 and page_num > est_tot and len(res_items) == 0),
                                    "is_blocked": False,
                                    "is_error": False,
                                    "error_message": ""
                                }
                            else:
                                res_items = provider.get_catalog_page(page_num)
                                page_detail = {
                                    "results": res_items,
                                    "total_pages": 0,
                                    "is_end_of_catalog": False,
                                    "is_blocked": False,
                                    "is_error": False,
                                    "error_message": ""
                                }

                            if not page_detail["is_error"] and not page_detail.get("is_blocked"):
                                break
                            time.sleep(2.0 * (attempt + 1))

                        if page_detail.get("total_pages", 0) > 0 and 1 <= page_detail["total_pages"] <= 2000:
                            total_pages_estimated = page_detail["total_pages"]

                        # Check for verified end of pagination
                        if page_detail.get("is_end_of_catalog"):
                            evidence = page_detail.get("error_message") or f"Página {page_num} confirmou fim do catálogo"
                            with db_transaction() as conn:
                                cur = conn.cursor()
                                cur.execute(
                                    """
                                    UPDATE sync_progress SET
                                        status = 'COMPLETED',
                                        pause_reason = ?,
                                        is_running = 0,
                                        last_synced_at = CURRENT_TIMESTAMP
                                    WHERE provider = ?
                                    """,
                                    (f"Fim verificável alcançado na página {last_page} (página {page_num}: {evidence})", canonical_provider)
                                )
                            break

                        # Check for error or anti-bot block after all retries
                        if page_detail.get("is_error") or page_detail.get("is_blocked"):
                            errors_count += 1
                            last_error = page_detail.get("error_message") or f"Falha na página {page_num}"
                            with db_transaction() as conn:
                                cur = conn.cursor()
                                cur.execute(
                                    """
                                    UPDATE sync_progress SET
                                        errors_count = ?,
                                        last_error = ?,
                                        last_synced_at = CURRENT_TIMESTAMP
                                    WHERE provider = ?
                                    """,
                                    (errors_count, last_error, canonical_provider)
                                )
                            # Do NOT mark COMPLETED; preserve checkpoint and break batch
                            break

                        results = page_detail.get("results", [])

                        for item in results:
                            if SYNC_STOP_EVENT.is_set():
                                break

                            success = False
                            retry_err = ""
                            for attempt in range(2):
                                try:
                                    with db_transaction() as conn:
                                        anime_id, eps_count, is_new = import_anime_by_id(canonical_provider, item.provider_anime_id, conn)
                                        total_synced += 1
                                        if is_new:
                                            new_titles += 1
                                        else:
                                            updated_titles += 1
                                    success = True
                                    break
                                except Exception as e:
                                    retry_err = str(e)
                                    time.sleep(1.0)

                            if not success:
                                errors_count += 1
                                last_error = f"Erro ao importar {item.provider_anime_id}: {retry_err[:100]}"

                            # Live checkpoint after each anime
                            with db_transaction() as conn:
                                cur = conn.cursor()
                                cur.execute(
                                    """
                                    UPDATE sync_progress SET
                                        current_page = ?,
                                        total_synced = ?,
                                        new_titles = ?,
                                        updated_titles = ?,
                                        errors_count = ?,
                                        last_error = ?,
                                        total_pages_estimated = ?,
                                        last_synced_at = CURRENT_TIMESTAMP
                                    WHERE provider = ?
                                    """,
                                    (page_num, total_synced, new_titles, updated_titles, errors_count, last_error, total_pages_estimated, canonical_provider)
                                )

                            time.sleep(delay)

                        # Checkpoint completion of the entire page
                        if not SYNC_STOP_EVENT.is_set():
                            last_page = page_num
                            pages_completed += 1

                            with db_transaction() as conn:
                                cur = conn.cursor()
                                cur.execute(
                                    """
                                    UPDATE sync_progress SET
                                        last_page = ?,
                                        current_page = ?,
                                        pages_completed = ?,
                                        total_synced = ?,
                                        new_titles = ?,
                                        updated_titles = ?,
                                        errors_count = ?,
                                        total_pages_estimated = ?,
                                        last_synced_at = CURRENT_TIMESTAMP
                                    WHERE provider = ?
                                    """,
                                    (last_page, last_page, pages_completed, total_synced, new_titles, updated_titles, errors_count, total_pages_estimated, canonical_provider)
                                )

                            invalidate_animes_cache()
                            export_catalog_to_json()

                    if SYNC_STOP_EVENT.is_set():
                        break

                    if not continuous:
                        break

                    # Pause between chained batches
                    time.sleep(pause_between_batches)

            elif canonical_provider == "animefire":
                # Sync fresh lancamentos
                results = provider.get_catalog_lancamentos(limit=max_pages * 10)
                for item in results:
                    success = False
                    for attempt in range(2):
                        try:
                            with db_transaction() as conn:
                                anime_id, eps_count, is_new = import_anime_by_id(canonical_provider, item.provider_anime_id, conn)
                                total_synced += 1
                                if is_new:
                                    new_titles += 1
                                else:
                                    updated_titles += 1
                            success = True
                            break
                        except Exception as e:
                            time.sleep(1.0)

                    if not success:
                        errors_count += 1

                    time.sleep(delay)

                with db_transaction() as conn:
                    cur = conn.cursor()
                    cur.execute(
                        """
                        UPDATE sync_progress SET
                            last_page = last_page + 1,
                            pages_completed = pages_completed + 1,
                            total_synced = ?,
                            new_titles = ?,
                            updated_titles = ?,
                            errors_count = ?,
                            last_synced_at = CURRENT_TIMESTAMP
                        WHERE provider = ?
                        """,
                        (total_synced, new_titles, updated_titles, errors_count, canonical_provider)
                    )
                invalidate_animes_cache()
                export_catalog_to_json()

        finally:
            with db_transaction() as conn:
                cur = conn.cursor()
                cur.execute("SELECT status FROM sync_progress WHERE provider = ?", (canonical_provider,))
                s_row = cur.fetchone()
                cur_status = s_row["status"] if s_row else "IDLE"
                if cur_status != "COMPLETED":
                    final_status = "PAUSED" if SYNC_STOP_EVENT.is_set() else "IDLE"
                    pause_reason = "Pausado pelo usuário" if SYNC_STOP_EVENT.is_set() else ""
                    cur.execute(
                        """
                        UPDATE sync_progress SET
                            status = ?,
                            pause_reason = ?,
                            is_running = 0,
                            last_synced_at = CURRENT_TIMESTAMP
                        WHERE provider = ?
                        """,
                        (final_status, pause_reason, canonical_provider)
                    )
                else:
                    cur.execute("UPDATE sync_progress SET is_running = 0 WHERE provider = ?", (canonical_provider,))
            invalidate_animes_cache()


def start_background_sync(
    provider_name: str = "animesonlinecc",
    batch_size: int = 2,
    continuous: bool = True,
    delay: float = 0.4,
    pause_between_batches: float = 2.5
) -> Dict[str, Any]:
    """Start non-blocking chained background synchronization with concurrency locks."""
    if SYNC_MUTEX.locked():
        return {
            "success": False,
            "status": "BUSY",
            "message": "Outra sincronização já está em execução no momento."
        }

    SYNC_STOP_EVENT.clear()
    t = threading.Thread(
        target=_worker_sync_provider,
        args=(provider_name, batch_size, continuous, delay, pause_between_batches),
        daemon=True,
        name=f"SyncWorker-{provider_name}"
    )
    t.start()
    return {
        "success": True,
        "status": "STARTED",
        "message": f"Sincronização em segundo plano encadeada iniciada para '{provider_name}' (lotes de {batch_size} páginas).",
        "provider": provider_name,
        "batch_size": batch_size,
        "continuous": continuous
    }


def get_anime_full_details(anime_id: str) -> Dict[str, Any]:
    """
    Retrieve full hierarchical details of an anime:
    - Metadata
    - List of seasons
    - Episodes grouped by season
    - Available audio versions per episode (Dublado / Legendado)
    - Available providers
    """
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM animes WHERE id = ?", (anime_id,))
    anime_row = cur.fetchone()
    if not anime_row:
        conn.close()
        return {}

    anime = dict(anime_row)
    anime["genres"] = json.loads(anime["genres"]) if anime["genres"] else []

    # Fetch episodes
    cur.execute(
        """
        SELECT * FROM episodes
        WHERE anime_id = ?
        ORDER BY season_number ASC, episode_number ASC
        """,
        (anime_id,)
    )
    episodes_rows = cur.fetchall()

    # Fetch sources for all episodes
    cur.execute(
        """
        SELECT es.* FROM episode_sources es
        JOIN episodes e ON es.episode_id = e.id
        WHERE e.anime_id = ?
        """,
        (anime_id,)
    )
    sources_rows = cur.fetchall()
    conn.close()

    # Map sources by episode_id
    sources_by_ep: Dict[str, List[Dict[str, Any]]] = {}
    for s in sources_rows:
        sources_by_ep.setdefault(s["episode_id"], []).append(dict(s))

    # Group episodes by season
    seasons_dict: Dict[int, List[Dict[str, Any]]] = {}
    for ep in episodes_rows:
        ep_dict = dict(ep)
        ep_sources = sources_by_ep.get(ep["id"], [])
        
        # Audio tracks available for this episode
        available_audios = list({s["audio_type"] for s in ep_sources}) or ["legendado"]
        available_providers = list({s["provider"] for s in ep_sources}) or []

        ep_dict["audios"] = available_audios
        ep_dict["providers"] = available_providers
        ep_dict["sources_count"] = len(ep_sources)
        ep_dict["sources"] = ep_sources

        seasons_dict.setdefault(ep["season_number"], []).append(ep_dict)

    seasons = [
        {"season_number": s_num, "episodes": eps}
        for s_num, eps in sorted(seasons_dict.items())
    ]

    anime["seasons"] = seasons
    anime["total_seasons"] = len(seasons)
    anime["total_episodes"] = len(episodes_rows)
    return anime


def toggle_user_favorite(user_id: str, content_id: str, title: str = "", poster: str = "") -> Dict[str, Any]:
    """Toggle a content item in user favorites."""
    with db_transaction() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM user_favorites WHERE user_id = ? AND content_id = ?",
            (user_id, content_id)
        )
        existing = cur.fetchone()
        if existing:
            cur.execute("DELETE FROM user_favorites WHERE id = ?", (existing["id"],))
            is_fav = False
        else:
            cur.execute(
                """
                INSERT INTO user_favorites (user_id, content_id, content_type, title, poster)
                VALUES (?, ?, 'anime', ?, ?)
                """,
                (user_id, content_id, title, poster)
            )
            is_fav = True

    return {"success": True, "is_favorite": is_fav, "content_id": content_id}


def save_user_watch_progress(
    user_id: str,
    content_id: str,
    episode_id: str,
    season_number: int = 1,
    episode_number: float = 1.0,
    episode_title: str = "",
    position_seconds: float = 0.0,
    duration_seconds: float = 0.0,
    content_type: str = "anime",
    content_title: str = "",
    poster: str = "",
    stream_url: str = ""
) -> Dict[str, Any]:
    """Save or update watch progress for continuation."""
    with db_transaction() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO user_watch_progress (
                user_id, content_id, content_type, content_title, poster, stream_url,
                episode_id, season_number, episode_number, episode_title,
                position_seconds, duration_seconds, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, content_id) DO UPDATE SET
                content_type = excluded.content_type,
                content_title = CASE WHEN excluded.content_title != '' THEN excluded.content_title ELSE user_watch_progress.content_title END,
                poster = CASE WHEN excluded.poster != '' THEN excluded.poster ELSE user_watch_progress.poster END,
                stream_url = CASE WHEN excluded.stream_url != '' THEN excluded.stream_url ELSE user_watch_progress.stream_url END,
                episode_id = excluded.episode_id,
                season_number = excluded.season_number,
                episode_number = excluded.episode_number,
                episode_title = excluded.episode_title,
                position_seconds = excluded.position_seconds,
                duration_seconds = excluded.duration_seconds,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                user_id, content_id, content_type, content_title, poster, stream_url,
                episode_id, season_number, episode_number, episode_title,
                position_seconds, duration_seconds
            )
        )
    return {"success": True}


def delete_user_watch_progress(user_id: str, content_id: Optional[str] = None) -> Dict[str, Any]:
    """Delete single item or clear all watch progress for a user."""
    with db_transaction() as conn:
        cur = conn.cursor()
        if content_id:
            cur.execute(
                "DELETE FROM user_watch_progress WHERE user_id = ? AND content_id = ?",
                (user_id, content_id)
            )
        else:
            cur.execute(
                "DELETE FROM user_watch_progress WHERE user_id = ?",
                (user_id,)
            )
    return {"success": True}


def get_user_activity(user_id: str) -> Dict[str, Any]:
    """Get list of user favorites and continue-watching items."""
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT uf.*, a.canonical_title, a.poster as anime_poster, a.total_episodes
        FROM user_favorites uf
        LEFT JOIN animes a ON uf.content_id = a.id
        WHERE uf.user_id = ?
        ORDER BY uf.created_at DESC
        """,
        (user_id,)
    )
    favorites = [dict(r) for r in cur.fetchall()]

    cur.execute(
        """
        SELECT wp.*, 
               COALESCE(NULLIF(wp.content_title, ''), a.canonical_title, '') as canonical_title,
               COALESCE(NULLIF(wp.poster, ''), a.poster, '') as anime_poster
        FROM user_watch_progress wp
        LEFT JOIN animes a ON wp.content_id = a.id
        WHERE wp.user_id = ?
        ORDER BY wp.updated_at DESC
        LIMIT 50
        """,
        (user_id,)
    )
    continue_watching = [dict(r) for r in cur.fetchall()]
    conn.close()

    return {
        "favorites": favorites,
        "continue_watching": continue_watching
    }
