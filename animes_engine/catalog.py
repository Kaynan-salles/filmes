import os
import json
import sqlite3
import hashlib
from typing import Dict, Any, List, Optional, Tuple

from animes_engine.database import db_transaction, get_connection
from animes_engine.normalizer import parse_anime_info, normalize_title, strip_accents
from animes_engine.matcher import compare_animes
from animes_engine.providers import get_provider, AnimeSearchResult, EpisodeResult


def generate_anime_id(canonical_title: str, season: int = 1, fmt: str = "TV", year: Optional[int] = None) -> str:
    """Generate a deterministic, clean identifier for an anime."""
    clean = strip_accents(canonical_title).lower()
    clean = "".join(c if c.isalnum() else "_" for c in clean).strip("_")
    clean = "_".join(part for part in clean.split("_") if part)
    if year:
        return f"ani_{clean}_{year}_s{season}"[:60]
    return f"ani_{clean}_s{season}"[:60]


def generate_episode_id(anime_id: str, season_number: int, episode_number: float, episode_type: str = "regular") -> str:
    """Generate a deterministic identifier for an episode."""
    ep_str = f"{int(episode_number)}" if episode_number.is_integer() else f"{episode_number}"
    return f"ep_{anime_id}_s{season_number}_e{ep_str}_{episode_type}"[:80]


def generate_source_id(episode_id: str, provider: str, audio_type: str, quality: str = "HD") -> str:
    """Generate a deterministic identifier for an episode playback source."""
    return f"src_{episode_id}_{provider}_{audio_type}_{quality}"[:90]


def find_existing_anime(anime_data: Dict[str, Any], conn: sqlite3.Connection) -> Optional[sqlite3.Row]:
    """
    Search database for an existing anime matching the given data.
    Uses:
    1. anilist_id or mal_id
    2. slug
    3. normalized_title + season + format
    4. compare_animes() against all candidates with similar title or shared aliases
    """
    cur = conn.cursor()

    # 1. External IDs
    if anime_data.get("anilist_id"):
        cur.execute("SELECT * FROM animes WHERE anilist_id = ? LIMIT 1", (anime_data["anilist_id"],))
        row = cur.fetchone()
        if row:
            return row

    if anime_data.get("mal_id"):
        cur.execute("SELECT * FROM animes WHERE mal_id = ? LIMIT 1", (anime_data["mal_id"],))
        row = cur.fetchone()
        if row:
            return row

    incoming_year = anime_data.get("year")

    # 2. Slug
    slug = anime_data.get("slug")
    if slug:
        cur.execute("SELECT * FROM animes WHERE slug = ? LIMIT 1", (slug,))
        row = cur.fetchone()
        if row:
            if incoming_year and row["year"]:
                try:
                    if abs(int(row["year"]) - int(incoming_year)) > 1:
                        row = None  # Remake com ano distinto
                except (ValueError, TypeError):
                    pass
            if row:
                return row

    # 3. Exact normalized title + season + format
    norm_title = anime_data.get("normalized_title") or normalize_title(anime_data.get("canonical_title") or anime_data.get("title") or "")
    season = int(anime_data.get("season") or 1)
    fmt = (anime_data.get("format") or "TV").upper()

    cur.execute(
        "SELECT * FROM animes WHERE normalized_title = ? AND season = ? AND format = ? LIMIT 1",
        (norm_title, season, fmt)
    )
    row = cur.fetchone()
    if row:
        if incoming_year and row["year"]:
            try:
                if abs(int(row["year"]) - int(incoming_year)) > 1:
                    row = None  # Remake com ano distinto
            except (ValueError, TypeError):
                pass
        if row:
            return row

    # 4. Alias lookup
    cur.execute(
        """
        SELECT a.* FROM animes a
        JOIN anime_aliases al ON a.id = al.anime_id
        WHERE al.normalized_alias = ? AND a.season = ?
        LIMIT 1
        """,
        (norm_title, season)
    )
    row = cur.fetchone()
    if row:
        if incoming_year and row["year"]:
            try:
                if abs(int(row["year"]) - int(incoming_year)) > 1:
                    row = None
            except (ValueError, TypeError):
                pass
        if row:
            return row

    # 5. Fuzzy / Deep comparison against candidates in the same season
    cur.execute("SELECT * FROM animes WHERE season = ?", (season,))
    candidates = cur.fetchall()
    target_dict = {
        "canonical_title": anime_data.get("canonical_title") or anime_data.get("title") or "",
        "normalized_title": norm_title,
        "season": season,
        "format": fmt,
        "year": anime_data.get("year"),
        "anilist_id": anime_data.get("anilist_id"),
        "mal_id": anime_data.get("mal_id"),
    }

    for cand in candidates:
        cand_dict = dict(cand)
        # Fetch aliases of candidate
        cur.execute("SELECT alias FROM anime_aliases WHERE anime_id = ?", (cand["id"],))
        cand_dict["aliases"] = [r["alias"] for r in cur.fetchall()]

        is_match, conf, reason = compare_animes(target_dict, cand_dict)
        if is_match and conf >= 0.90:
            return cand

    return None


def upsert_anime(anime_data: Dict[str, Any], conn: sqlite3.Connection) -> Tuple[str, bool]:
    """
    Idempotently insert or update an anime record.
    Returns (anime_id, is_new: bool).
    """
    cur = conn.cursor()
    info = parse_anime_info(anime_data.get("canonical_title") or anime_data.get("title") or "")
    
    # Merge parsed info with incoming data (sempre usando o display_title limpo de ruídos de site)
    title = info["display_title"] if info.get("display_title") else (anime_data.get("canonical_title") or anime_data.get("title") or "")
    orig_title = anime_data.get("original_title") or title
    norm_title = anime_data.get("normalized_title") or info["normalized_title"]
    slug = anime_data.get("slug") or info["slug"]
    season = int(anime_data.get("season") or info["season"])
    fmt = (anime_data.get("format") or info["format"]).upper()
    poster = anime_data.get("poster") or ""
    banner = anime_data.get("banner") or ""
    synopsis = anime_data.get("synopsis") or ""
    year = anime_data.get("year")
    genres = json.dumps(anime_data.get("genres") or ["Anime"], ensure_ascii=False)
    anilist_id = anime_data.get("anilist_id")
    mal_id = anime_data.get("mal_id")

    check_data = {
        "canonical_title": title,
        "normalized_title": norm_title,
        "slug": slug,
        "season": season,
        "format": fmt,
        "year": year,
        "anilist_id": anilist_id,
        "mal_id": mal_id,
    }

    existing = find_existing_anime(check_data, conn)
    if existing:
        anime_id = existing["id"]
        # Update poster/synopsis/banner if currently empty
        cur.execute(
            """
            UPDATE animes SET
                poster = CASE WHEN poster = '' OR poster IS NULL THEN ? ELSE poster END,
                banner = CASE WHEN banner = '' OR banner IS NULL THEN ? ELSE banner END,
                synopsis = CASE WHEN synopsis = '' OR synopsis IS NULL THEN ? ELSE synopsis END,
                year = CASE WHEN year IS NULL THEN ? ELSE year END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (poster, banner, synopsis, year, anime_id)
        )
        # Store alternate title as alias if distinct
        cur.execute(
            """
            INSERT OR IGNORE INTO anime_aliases (anime_id, alias, normalized_alias, source)
            VALUES (?, ?, ?, 'provider')
            """,
            (anime_id, title, norm_title)
        )
        return anime_id, False

    # Ensure slug uniqueness in case of distinct remake
    cur.execute("SELECT id FROM animes WHERE slug = ?", (slug,))
    if cur.fetchone():
        slug = f"{slug}-{year}" if year else f"{slug}-{hashlib.md5(title.encode()).hexdigest()[:6]}"

    # New record
    anime_id = generate_anime_id(title, season=season, fmt=fmt, year=year)
    # Ensure ID uniqueness in case of collision
    cur.execute("SELECT id FROM animes WHERE id = ?", (anime_id,))
    if cur.fetchone():
        anime_id = f"{anime_id}_{hashlib.md5(slug.encode()).hexdigest()[:6]}"

    cur.execute(
        """
        INSERT INTO animes (
            id, canonical_title, original_title, normalized_title, slug,
            synopsis, poster, banner, year, season, format, genres,
            anilist_id, mal_id, total_episodes, status, review_pending
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'COMPLETED', 0)
        """,
        (
            anime_id, title, orig_title, norm_title, slug,
            synopsis, poster, banner, year, season, fmt, genres,
            anilist_id, mal_id
        )
    )

    # Insert initial alias
    cur.execute(
        """
        INSERT OR IGNORE INTO anime_aliases (anime_id, alias, normalized_alias, source)
        VALUES (?, ?, ?, 'canonical')
        """,
        (anime_id, title, norm_title)
    )

    return anime_id, True


def upsert_episode(anime_id: str, ep: EpisodeResult, conn: sqlite3.Connection) -> Tuple[str, bool]:
    """
    Idempotently insert or retrieve an episode record.
    Returns (episode_id, is_new: bool).
    """
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id FROM episodes
        WHERE anime_id = ? AND season_number = ? AND episode_number = ? AND episode_type = ?
        LIMIT 1
        """,
        (anime_id, ep.season_number, ep.episode_number, ep.episode_type)
    )
    row = cur.fetchone()
    if row:
        episode_id = row["id"]
        # Update title/thumb if available
        if ep.title or ep.thumbnail:
            cur.execute(
                """
                UPDATE episodes SET
                    title = CASE WHEN title = '' OR title IS NULL THEN ? ELSE title END,
                    thumbnail = CASE WHEN thumbnail = '' OR thumbnail IS NULL THEN ? ELSE thumbnail END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (ep.title, ep.thumbnail, episode_id)
            )
        return episode_id, False

    episode_id = generate_episode_id(anime_id, ep.season_number, ep.episode_number, ep.episode_type)
    cur.execute(
        """
        INSERT INTO episodes (
            id, anime_id, season_number, episode_number, episode_type,
            title, thumbnail
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(anime_id, season_number, episode_number, episode_type) DO UPDATE SET
            title = CASE WHEN episodes.title = '' THEN excluded.title ELSE episodes.title END,
            thumbnail = CASE WHEN episodes.thumbnail = '' THEN excluded.thumbnail ELSE episodes.thumbnail END
        """,
        (
            episode_id, anime_id, ep.season_number, ep.episode_number, ep.episode_type,
            ep.title, ep.thumbnail
        )
    )
    
    # Update total_episodes on anime
    cur.execute(
        "UPDATE animes SET total_episodes = (SELECT COUNT(*) FROM episodes WHERE anime_id = ?) WHERE id = ?",
        (anime_id, anime_id)
    )
    return episode_id, True


def upsert_episode_source(episode_id: str, ep: EpisodeResult, provider_anime_id: str, conn: sqlite3.Connection) -> str:
    """
    Idempotently insert or update an episode source / playback option.
    Attaches Dublado/Legendado and different qualities under the SAME episode.
    """
    cur = conn.cursor()
    source_id = generate_source_id(episode_id, ep.extra_payload.get("provider", "provider"), ep.audio_type, ep.quality)
    payload_json = json.dumps(ep.extra_payload or {}, ensure_ascii=False)

    cur.execute(
        """
        INSERT INTO episode_sources (
            id, episode_id, provider, provider_anime_id, provider_ep_id,
            audio_type, player_type, stream_url, quality, is_dynamic, extra_payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(episode_id, provider, audio_type, quality) DO UPDATE SET
            stream_url = CASE WHEN excluded.stream_url != '' THEN excluded.stream_url ELSE episode_sources.stream_url END,
            extra_payload = excluded.extra_payload,
            updated_at = CURRENT_TIMESTAMP
        """,
        (
            source_id, episode_id, ep.extra_payload.get("provider", "provider"),
            provider_anime_id, ep.provider_ep_id, ep.audio_type, ep.player_type,
            ep.stream_url, ep.quality, 1 if ep.is_dynamic else 0, payload_json
        )
    )
    return source_id


def import_anime_by_id(provider_name: str, provider_anime_id: str, conn: sqlite3.Connection) -> Tuple[str, int, bool]:
    """Import a specific anime and its episodes directly by provider anime ID."""
    provider = get_provider(provider_name)
    if not provider:
        raise ValueError(f"Provider '{provider_name}' not found.")
    
    details = provider.get_anime_details(provider_anime_id)
    if not details or not details.get("title"):
        raise ValueError(f"Could not load details for anime ID '{provider_anime_id}'")
        
    anime_dict = {
        "canonical_title": details.get("title"),
        "poster": details.get("poster") or "",
        "banner": details.get("banner") or "",
        "synopsis": details.get("synopsis") or "",
        "year": details.get("year"),
        "season": 1,
        "format": "TV",
        "genres": details.get("genres") or ["Anime"],
    }
    anime_id, is_new = upsert_anime(anime_dict, conn)
    episodes = provider.get_episodes(provider_anime_id)
    for ep in episodes:
        ep.extra_payload["provider"] = provider_name
        ep_id, _ = upsert_episode(anime_id, ep, conn)
        upsert_episode_source(ep_id, ep, provider_anime_id, conn)
        
    return anime_id, len(episodes), is_new


def sync_anime_from_provider(provider_name: str, query: str, max_results: int = 5) -> Dict[str, Any]:
    """
    Search and import animes from a provider into the unified database.
    Atomic transaction ensures partial failures don't leave corrupt data.
    """
    provider = get_provider(provider_name)
    if not provider:
        return {"success": False, "error": f"Provider '{provider_name}' not found."}

    results = provider.search_anime(query)
    if not results:
        return {"success": True, "count": 0, "animes": []}

    imported_animes = []
    with db_transaction() as conn:
        for res in results[:max_results]:
            details = provider.get_anime_details(res.provider_anime_id, res.extra_params)
            anime_dict = {
                "canonical_title": details.get("title") or res.title,
                "poster": details.get("poster") or res.poster,
                "banner": details.get("banner") or "",
                "synopsis": details.get("synopsis") or "",
                "year": details.get("year") or res.year,
                "season": res.season,
                "format": res.format,
                "genres": details.get("genres") or ["Anime"],
            }
            
            anime_id, is_new = upsert_anime(anime_dict, conn)
            
            # Fetch and store episodes
            episodes = provider.get_episodes(res.provider_anime_id, res.extra_params)
            for ep in episodes:
                ep.extra_payload["provider"] = provider_name
                ep_id, _ = upsert_episode(anime_id, ep, conn)
                upsert_episode_source(ep_id, ep, res.provider_anime_id, conn)

            imported_animes.append({
                "anime_id": anime_id,
                "title": anime_dict["canonical_title"],
                "episodes_count": len(episodes),
                "is_new": is_new
            })

    # Update web portal JSON
    export_catalog_to_json()
    return {"success": True, "count": len(imported_animes), "animes": imported_animes}


def export_catalog_to_json() -> str:
    """
    Export all animes from SQLite into WEB_PORTAL/data/animes.json and
    update WEB_PORTAL/data/manifesto.json so the frontend can browse animes seamlessly.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, "WEB_PORTAL", "data")
    os.makedirs(data_dir, exist_ok=True)
    out_file = os.path.join(data_dir, "animes.json")
    manifesto_file = os.path.join(data_dir, "manifesto.json")

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM animes ORDER BY canonical_title ASC")
    animes_rows = cur.fetchall()

    catalog_items = []
    for row in animes_rows:
        anime_id = row["id"]
        # Fetch seasons and episode counts
        cur.execute("SELECT COUNT(*) as ep_count, MAX(season_number) as max_s FROM episodes WHERE anime_id = ?", (anime_id,))
        stats = cur.fetchone()
        ep_count = stats["ep_count"] if stats else 0

        # Primary play link: resolve first available episode stream URL or placeholder
        cur.execute(
            """
            SELECT es.*, e.episode_number, e.season_number, e.title as ep_title
            FROM episode_sources es
            JOIN episodes e ON es.episode_id = e.id
            WHERE e.anime_id = ?
            ORDER BY e.season_number ASC, e.episode_number ASC
            LIMIT 1
            """,
            (anime_id,)
        )
        first_src = cur.fetchone()
        
        play_url = f"/api/animes/resolve?anime_id={anime_id}&ep=1&s=1"
        if first_src and first_src["stream_url"]:
            play_url = first_src["stream_url"]

        genres = json.loads(row["genres"]) if row["genres"] else ["Anime"]

        catalog_items.append({
            "id": anime_id,
            "t": row["canonical_title"],
            "catNome": "ANIMES | Catálogo Oficial",
            "p": row["poster"],
            "banner": row["banner"],
            "u": play_url,
            "sinopse": row["synopsis"] or "Anime completo disponível com áudio Dublado e Legendado em alta definição.",
            "ano": row["year"] or 2024,
            "temporadas": row["season"],
            "total_episodios": ep_count,
            "generos": genres,
            "is_anime": True
        })

    conn.close()

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(catalog_items, f, ensure_ascii=False, indent=2)

    # Update manifesto.json if present
    if os.path.exists(manifesto_file):
        try:
            with open(manifesto_file, "r", encoding="utf-8") as f:
                manifesto = json.load(f)
            
            cats = manifesto.get("categorias", [])
            # Check if animes category already exists
            anime_cat = next((c for c in cats if c.get("id") == "animes"), None)
            if not anime_cat:
                anime_cat = {
                    "id": "animes",
                    "nome": "🌸 Animes",
                    "tipo": "animes",
                    "total": len(catalog_items),
                    "destaques": catalog_items[:10]
                }
                cats.insert(0, anime_cat) # Put Animes at top for easy discovery
            else:
                anime_cat["total"] = len(catalog_items)
                anime_cat["destaques"] = catalog_items[:10]

            manifesto["categorias"] = cats
            with open(manifesto_file, "w", encoding="utf-8") as f:
                json.dump(manifesto, f, ensure_ascii=False, indent=2)
        except Exception as e:
            pass

    return out_file

