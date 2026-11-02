import os
import sqlite3
from contextlib import contextmanager
from typing import Generator

DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "WEB_PORTAL", "data", "animes_catalog.db")
DB_PATH = os.environ.get("ANIMES_DB_PATH", DEFAULT_DB_PATH)


def set_db_path(path: str):
    """Override database file path dynamically (useful for isolated unit testing)."""
    global DB_PATH
    DB_PATH = path


def get_db_path() -> str:
    """Return the currently configured database file path."""
    return os.environ.get("ANIMES_DB_PATH", DB_PATH)

SCHEMA_SQL = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. Animes Table (Canonical Works)
CREATE TABLE IF NOT EXISTS animes (
    id TEXT PRIMARY KEY,
    canonical_title TEXT NOT NULL,
    original_title TEXT,
    normalized_title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    synopsis TEXT DEFAULT '',
    poster TEXT DEFAULT '',
    banner TEXT DEFAULT '',
    year INTEGER,
    season INTEGER NOT NULL DEFAULT 1,
    format TEXT NOT NULL DEFAULT 'TV',
    genres TEXT DEFAULT '[]',
    anilist_id INTEGER,
    mal_id INTEGER,
    total_episodes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'COMPLETED',
    review_pending INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_animes_normalized_title ON animes(normalized_title);
CREATE INDEX IF NOT EXISTS idx_animes_canonical ON animes(canonical_title);
CREATE INDEX IF NOT EXISTS idx_animes_slug ON animes(slug);
CREATE INDEX IF NOT EXISTS idx_animes_anilist ON animes(anilist_id);
CREATE INDEX IF NOT EXISTS idx_animes_season ON animes(season);
CREATE INDEX IF NOT EXISTS idx_animes_year ON animes(year);
CREATE INDEX IF NOT EXISTS idx_animes_total_eps ON animes(total_episodes);
CREATE INDEX IF NOT EXISTS idx_animes_created ON animes(created_at);

-- 2. Anime Aliases (Alternate Titles)
CREATE TABLE IF NOT EXISTS anime_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anime_id TEXT NOT NULL REFERENCES animes(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    normalized_alias TEXT NOT NULL,
    source TEXT DEFAULT 'manual',
    UNIQUE(anime_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS idx_aliases_normalized ON anime_aliases(normalized_alias);

-- 3. Episodes Table (Strict Identity: anime + season + episode_number + episode_type)
CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    anime_id TEXT NOT NULL REFERENCES animes(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL DEFAULT 1,
    episode_number REAL NOT NULL,
    episode_type TEXT NOT NULL DEFAULT 'regular',
    title TEXT DEFAULT '',
    thumbnail TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(anime_id, season_number, episode_number, episode_type)
);

CREATE INDEX IF NOT EXISTS idx_episodes_anime ON episodes(anime_id, season_number, episode_number);

-- 4. Episode Sources / Players (Multiple providers, audio versions, and qualities for the same episode)
CREATE TABLE IF NOT EXISTS episode_sources (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_anime_id TEXT NOT NULL,
    provider_ep_id TEXT NOT NULL,
    audio_type TEXT NOT NULL DEFAULT 'legendado', -- 'dublado' | 'legendado'
    player_type TEXT NOT NULL DEFAULT 'direct',   -- 'direct' (mp4/hls) | 'embed' (iframe)
    stream_url TEXT DEFAULT '',
    quality TEXT DEFAULT 'HD',
    is_dynamic INTEGER DEFAULT 1,                 -- 1 = resolved dynamically on playback
    extra_payload TEXT DEFAULT '{}',              -- JSON for custom provider headers or params
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(episode_id, provider, audio_type, quality)
);

CREATE INDEX IF NOT EXISTS idx_ep_sources_episode ON episode_sources(episode_id);
CREATE INDEX IF NOT EXISTS idx_ep_sources_provider ON episode_sources(provider);
CREATE INDEX IF NOT EXISTS idx_sources_ep_audio ON episode_sources(episode_id, audio_type);

-- 5. User Favorites (Persists across restarts and consolidations)
CREATE TABLE IF NOT EXISTS user_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'anime',
    title TEXT DEFAULT '',
    poster TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, content_id, content_type)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);

-- 6. User Watch Progress (Continuar Assistindo)
CREATE TABLE IF NOT EXISTS user_watch_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'anime',
    episode_id TEXT,
    season_number INTEGER DEFAULT 1,
    episode_number REAL DEFAULT 1,
    episode_title TEXT DEFAULT '',
    position_seconds REAL DEFAULT 0,
    duration_seconds REAL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, content_id)
);

CREATE INDEX IF NOT EXISTS idx_watch_progress_user ON user_watch_progress(user_id);

-- 7. Live Channels (Strict provider + channel_id / tvg_id deduplication)
CREATE TABLE IF NOT EXISTS live_channels (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_channel_id TEXT NOT NULL,
    tvg_id TEXT,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    logo TEXT DEFAULT '',
    stream_url TEXT NOT NULL,
    group_title TEXT DEFAULT 'Canais',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_channel_id)
);

CREATE INDEX IF NOT EXISTS idx_channels_tvg ON live_channels(tvg_id);
CREATE INDEX IF NOT EXISTS idx_channels_normalized ON live_channels(normalized_name);

-- 8. Sync Logs & Audit History
CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    animes_synced INTEGER DEFAULT 0,
    episodes_synced INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    details TEXT DEFAULT '',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP
);

-- 9. Sync Progress & Checkpoint State
CREATE TABLE IF NOT EXISTS sync_progress (
    provider TEXT PRIMARY KEY,
    status TEXT DEFAULT 'IDLE',
    pause_reason TEXT DEFAULT '',
    last_page INTEGER DEFAULT 0,
    current_page INTEGER DEFAULT 0,
    current_batch INTEGER DEFAULT 0,
    pages_completed INTEGER DEFAULT 0,
    total_synced INTEGER DEFAULT 0,
    new_titles INTEGER DEFAULT 0,
    updated_titles INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    last_error TEXT DEFAULT '',
    total_pages_estimated INTEGER DEFAULT 0,
    is_running INTEGER DEFAULT 0,
    last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


def get_db_path() -> str:
    current = os.environ.get("ANIMES_DB_PATH", DB_PATH)
    os.makedirs(os.path.dirname(current), exist_ok=True)
    return current


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(get_db_path(), timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def db_transaction() -> Generator[sqlite3.Connection, None, None]:
    conn = get_connection()
    try:
        conn.execute("BEGIN TRANSACTION;")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Initialize database tables and indexes with dynamic schema migration."""
    with db_transaction() as conn:
        conn.executescript(SCHEMA_SQL)
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(sync_progress)")
        existing_cols = {row[1] for row in cur.fetchall()}
        columns_to_add = [
            ("status", "TEXT DEFAULT 'IDLE'"),
            ("pause_reason", "TEXT DEFAULT ''"),
            ("current_page", "INTEGER DEFAULT 0"),
            ("current_batch", "INTEGER DEFAULT 0"),
            ("pages_completed", "INTEGER DEFAULT 0"),
            ("new_titles", "INTEGER DEFAULT 0"),
            ("updated_titles", "INTEGER DEFAULT 0"),
            ("errors_count", "INTEGER DEFAULT 0"),
            ("last_error", "TEXT DEFAULT ''"),
            ("total_pages_estimated", "INTEGER DEFAULT 0"),
        ]
        for col_name, col_def in columns_to_add:
            if col_name not in existing_cols:
                cur.execute(f"ALTER TABLE sync_progress ADD COLUMN {col_name} {col_def}")


if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", get_db_path())

