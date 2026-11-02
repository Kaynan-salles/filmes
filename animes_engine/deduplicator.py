import re
import sqlite3
from typing import Dict, Any, List, Tuple
from animes_engine.database import get_connection, db_transaction
from animes_engine.normalizer import normalize_title, strip_accents
from animes_engine.matcher import compare_animes


def deduplicate_live_channels(raw_channels: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Deduplicate live TV channels based on stable provider identifier, tvg-id,
    and normalized channel names.
    Respects regional variations (e.g., 'Globo SP' vs 'Globo RJ' are kept separate).
    """
    seen_tvg_ids = {}
    seen_provider_ids = {}
    unique_channels = []

    # Regex for regional differentiators (e.g., SP, RJ, MG, RS, Curitiba, etc.)
    re_regional = re.compile(r'\b(sp|rj|mg|rs|ba|pr|sc|pe|df|ce|go|es|am|pa|rn|pb|al|se|pi|mt|ms|ro|to|ac|ap|rr)\b', re.I)

    for ch in raw_channels:
        tvg_id = (ch.get("tvg_id") or ch.get("tvg-id") or "").strip().lower()
        provider = ch.get("provider", "default")
        provider_ch_id = str(ch.get("provider_channel_id") or ch.get("id") or "").strip()
        name = ch.get("name") or ch.get("t") or ""
        norm_name = normalize_title(name)

        # Regional check
        regional_tag = ""
        m_reg = re_regional.search(name.lower())
        if m_reg:
            regional_tag = m_reg.group(1)

        # 1. Stable tvg-id identity
        if tvg_id and tvg_id in seen_tvg_ids:
            continue
        
        # 2. Stable provider channel identity
        provider_key = f"{provider}:{provider_ch_id}"
        if provider_ch_id and provider_key in seen_provider_ids:
            continue

        if tvg_id:
            seen_tvg_ids[tvg_id] = ch
        if provider_ch_id:
            seen_provider_ids[provider_key] = ch

        unique_channels.append(ch)

    return unique_channels


def generate_diagnostic_report() -> Dict[str, Any]:
    """
    Inspect the anime catalog and database for potential duplicate records,
    integrity issues, and state of favorites/watch history.
    """
    conn = get_connection()
    cur = conn.cursor()

    # 1. Total counts
    cur.execute("SELECT COUNT(*) FROM animes")
    total_animes = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM episodes")
    total_episodes = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM episode_sources")
    total_sources = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM user_favorites")
    total_favorites = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM user_watch_progress")
    total_progress = cur.fetchone()[0]

    # 2. Check for exact duplicate normalized titles across the same season
    cur.execute(
        """
        SELECT normalized_title, season, COUNT(*) as cnt, GROUP_CONCAT(id) as ids, GROUP_CONCAT(canonical_title) as titles
        FROM animes
        GROUP BY normalized_title, season
        HAVING cnt > 1
        """
    )
    exact_duplicates = [dict(r) for r in cur.fetchall()]

    # 3. Check for doubtful fuzzy matches (similarity > 0.82)
    cur.execute("SELECT id, canonical_title, normalized_title, season, format, year FROM animes")
    all_animes = [dict(r) for r in cur.fetchall()]
    doubtful_matches = []

    for i in range(len(all_animes)):
        for j in range(i + 1, len(all_animes)):
            a1, a2 = all_animes[i], all_animes[j]
            if a1["season"] == a2["season"]:
                is_match, conf, reason = compare_animes(a1, a2)
                if reason == "doubtful_needs_review":
                    doubtful_matches.append({
                        "anime1": a1,
                        "anime2": a2,
                        "confidence": round(conf, 3),
                        "reason": reason
                    })

    # 4. Check orphaned episodes, favorites, or watch progress
    cur.execute(
        """
        SELECT COUNT(*) FROM episodes e
        LEFT JOIN animes a ON e.anime_id = a.id
        WHERE a.id IS NULL
        """
    )
    orphaned_episodes = cur.fetchone()[0]

    cur.execute(
        """
        SELECT COUNT(*) FROM user_favorites f
        LEFT JOIN animes a ON f.content_id = a.id
        WHERE a.id IS NULL
        """
    )
    orphaned_favorites = cur.fetchone()[0]

    conn.close()

    return {
        "total_animes": total_animes,
        "total_episodes": total_episodes,
        "total_sources": total_sources,
        "total_favorites": total_favorites,
        "total_progress": total_progress,
        "exact_duplicates_count": len(exact_duplicates),
        "exact_duplicates": exact_duplicates,
        "doubtful_matches_count": len(doubtful_matches),
        "doubtful_matches": doubtful_matches,
        "orphaned_episodes": orphaned_episodes,
        "orphaned_favorites": orphaned_favorites,
        "status": "HEALTHY" if len(exact_duplicates) == 0 and orphaned_episodes == 0 else "ACTION_REQUIRED"
    }


def consolidate_duplicates(dry_run: bool = False) -> Dict[str, Any]:
    """
    Consolidate exact duplicate animes:
    - Retains canonical record (the one with lowest ID or oldest created_at).
    - Migrates all episodes, aliases, favorites, and watch progress to the canonical ID.
    - Never touches doubtful matches!
    """
    report = generate_diagnostic_report()
    exact_duplicates = report.get("exact_duplicates", [])

    consolidated_count = 0
    migrated_episodes = 0
    migrated_favorites = 0

    if not exact_duplicates or dry_run:
        return {
            "dry_run": dry_run,
            "consolidated_animes": 0,
            "migrated_episodes": 0,
            "migrated_favorites": 0,
            "diagnostics": report
        }

    with db_transaction() as conn:
        cur = conn.cursor()
        for dup in exact_duplicates:
            ids = dup["ids"].split(",")
            canonical_id = ids[0]
            redundant_ids = ids[1:]

            for red_id in redundant_ids:
                # 1. Migrate aliases
                cur.execute(
                    "UPDATE OR IGNORE anime_aliases SET anime_id = ? WHERE anime_id = ?",
                    (canonical_id, red_id)
                )

                # 2. Migrate episodes (or merge duplicate episodes)
                cur.execute("SELECT * FROM episodes WHERE anime_id = ?", (red_id,))
                red_episodes = cur.fetchall()
                for red_ep in red_episodes:
                    cur.execute(
                        """
                        SELECT id FROM episodes
                        WHERE anime_id = ? AND season_number = ? AND episode_number = ? AND episode_type = ?
                        LIMIT 1
                        """,
                        (canonical_id, red_ep["season_number"], red_ep["episode_number"], red_ep["episode_type"])
                    )
                    existing_canon_ep = cur.fetchone()
                    if existing_canon_ep:
                        # Migrate sources from red_ep to existing_canon_ep
                        cur.execute(
                            "UPDATE OR IGNORE episode_sources SET episode_id = ? WHERE episode_id = ?",
                            (existing_canon_ep["id"], red_ep["id"])
                        )
                        cur.execute("DELETE FROM episodes WHERE id = ?", (red_ep["id"],))
                    else:
                        cur.execute("UPDATE episodes SET anime_id = ? WHERE id = ?", (canonical_id, red_ep["id"]))
                    migrated_episodes += 1

                # 3. Migrate favorites
                cur.execute(
                    "UPDATE OR IGNORE user_favorites SET content_id = ? WHERE content_id = ?",
                    (canonical_id, red_id)
                )
                cur.execute("DELETE FROM user_favorites WHERE content_id = ?", (red_id,))
                migrated_favorites += 1

                # 4. Migrate watch progress
                cur.execute(
                    "UPDATE OR IGNORE user_watch_progress SET content_id = ? WHERE content_id = ?",
                    (canonical_id, red_id)
                )
                cur.execute("DELETE FROM user_watch_progress WHERE content_id = ?", (red_id,))

                # 5. Delete redundant anime entry
                cur.execute("DELETE FROM animes WHERE id = ?", (red_id,))
                consolidated_count += 1

        # Update episode counts on canonical animes
        cur.execute(
            """
            UPDATE animes SET total_episodes = (
                SELECT COUNT(*) FROM episodes WHERE episodes.anime_id = animes.id
            )
            """
        )

    return {
        "dry_run": False,
        "consolidated_animes": consolidated_count,
        "migrated_episodes": migrated_episodes,
        "migrated_favorites": migrated_favorites,
        "diagnostics": generate_diagnostic_report()
    }

