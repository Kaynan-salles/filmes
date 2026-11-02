import re
import json
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl
from typing import List, Dict, Any, Optional

import httpx

from animes_engine.providers.base import (
    BaseAnimeProvider,
    AnimeSearchResult,
    EpisodeResult,
    StreamResolution
)
from animes_engine.normalizer import (
    detect_season,
    detect_format,
    parse_episode_number
)

API_BASE_URL = "https://api.animefire.one"
SITE_BASE_URL = "https://animefire.one"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": f"{SITE_BASE_URL}/"
}


class AnimeFireProvider(BaseAnimeProvider):
    name = "animefire"
    display_name = "Anime Fire"
    request_timeout = 15

    def _http_get(self, url: str, params: Optional[Dict[str, Any]] = None) -> httpx.Response:
        with httpx.Client(headers=HEADERS, timeout=self.request_timeout, follow_redirects=True) as client:
            return client.get(url, params=params)

    def search_anime(self, query: str) -> List[AnimeSearchResult]:
        if not query or not query.strip():
            return []
        
        try:
            resp = self._http_get(f"{API_BASE_URL}/animes/pesquisar", params={"q": query.strip()})
            if resp.status_code != 200:
                return []
            
            payload = resp.json()
            data = payload.get("data", []) if isinstance(payload, dict) else []
            if not isinstance(data, list):
                return []
            
            results: List[AnimeSearchResult] = []
            for item in data:
                if not isinstance(item, dict) or not item.get("id"):
                    continue
                
                anime_id = str(item["id"])
                titles = item.get("titles")
                if isinstance(titles, dict):
                    # Prefer BR, then US, then any
                    title = titles.get("BR") or titles.get("US") or next(iter(titles.values()), "")
                else:
                    title = str(titles or "")
                
                if not title:
                    continue
                
                poster = item.get("poster_src") or item.get("image") or item.get("poster") or ""
                year = item.get("year")
                if not year and item.get("published_at"):
                    m_year = re.search(r'\b(19\d\d|20\d\d)\b', str(item["published_at"]))
                    if m_year:
                        year = int(m_year.group(1))
                elif year and isinstance(year, str) and year.isdigit():
                    year = int(year)
                elif not isinstance(year, int):
                    year = None
                
                season = detect_season(title, default_season=1)
                fmt = detect_format(title)
                
                results.append(AnimeSearchResult(
                    provider=self.name,
                    provider_anime_id=anime_id,
                    title=title,
                    poster=poster,
                    year=year,
                    season=season,
                    format=fmt,
                    url=f"{SITE_BASE_URL}/anime/{anime_id}",
                    extra_params={"anime_id": anime_id}
                ))
            
            return results
        except Exception:
            return []

    def get_anime_details(self, provider_anime_id: str, extra_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        try:
            resp = self._http_get(f"{API_BASE_URL}/anime/{provider_anime_id}")
            if resp.status_code != 200:
                return {}
            
            payload = resp.json()
            data = payload.get("data", {}) if isinstance(payload, dict) else {}
            hero = data.get("hero", {}) if isinstance(data.get("hero"), dict) else {}
            
            titles = hero.get("titles") or data.get("titles", {})
            if isinstance(titles, dict):
                title = titles.get("BR") or titles.get("US") or next(iter(titles.values()), "")
            else:
                title = str(titles or data.get("title") or "")
            
            synopsis = hero.get("synopsis") or data.get("synopsis") or data.get("description") or ""
            poster = hero.get("poster_src") or data.get("poster_src") or data.get("image") or data.get("poster") or ""
            banner = hero.get("backdrop_src") or data.get("backdrop_src") or data.get("banner") or ""
            
            raw_genres = hero.get("genres") or data.get("genres", [])
            genres = []
            if isinstance(raw_genres, list):
                for g in raw_genres:
                    if isinstance(g, str) and g.strip():
                        genres.append(g.strip())
                    elif isinstance(g, dict) and g.get("name"):
                        genres.append(g["name"].strip())
            
            year = hero.get("year") or data.get("year")
            if not year and (hero.get("published_at") or data.get("published_at")):
                pub = hero.get("published_at") or data.get("published_at")
                m_year = re.search(r'\b(19\d\d|20\d\d)\b', str(pub))
                if m_year:
                    year = int(m_year.group(1))
            elif year and isinstance(year, str) and year.isdigit():
                year = int(year)
            elif not isinstance(year, int):
                year = None
                
            return {
                "title": title,
                "synopsis": synopsis,
                "poster": poster,
                "banner": banner,
                "genres": genres,
                "year": year,
                "status": hero.get("status") or data.get("status", "COMPLETED")
            }
        except Exception:
            return {}

    def get_catalog_lancamentos(self, limit: int = 50) -> List[AnimeSearchResult]:
        """Fetch real trending and latest releases directly from AnimeFire catalog."""
        try:
            resp = self._http_get(f"{API_BASE_URL}/animes/lancamentos")
            if resp.status_code != 200:
                return []
            payload = resp.json()
            data = payload.get("data", {}) if isinstance(payload, dict) else {}
            animes_list = data.get("animes", []) if isinstance(data, dict) else []
            results: List[AnimeSearchResult] = []
            for item in animes_list[:limit]:
                if not isinstance(item, dict) or not item.get("id"):
                    continue
                anime_id = str(item["id"])
                titles = item.get("titles")
                if isinstance(titles, dict):
                    title = titles.get("BR") or titles.get("US") or next(iter(titles.values()), "")
                else:
                    title = str(titles or "")
                if not title:
                    continue
                poster = item.get("poster_src") or item.get("image") or ""
                year = None
                pub = item.get("published_at")
                if pub:
                    m = re.search(r'\b(19\d\d|20\d\d)\b', str(pub))
                    if m:
                        year = int(m.group(1))
                results.append(AnimeSearchResult(
                    provider=self.name,
                    provider_anime_id=anime_id,
                    title=title,
                    poster=poster,
                    year=year,
                    season=detect_season(title, default_season=1),
                    format=detect_format(title),
                    url=f"{SITE_BASE_URL}/anime/{anime_id}",
                    extra_params={"anime_id": anime_id}
                ))
            return results
        except Exception:
            return []

    def get_episodes(self, provider_anime_id: str, extra_params: Optional[Dict[str, Any]] = None) -> List[EpisodeResult]:
        try:
            resp = self._http_get(f"{API_BASE_URL}/anime/{provider_anime_id}")
            if resp.status_code != 200:
                return []
            
            payload = resp.json()
            data = payload.get("data", {}) if isinstance(payload, dict) else {}
            episodes_data = data.get("episodes", [])
            if not isinstance(episodes_data, list):
                return []
            
            results: List[EpisodeResult] = []
            for ep in episodes_data:
                if not isinstance(ep, dict) or not ep.get("id"):
                    continue
                
                ep_id = str(ep["id"])
                season = max(1, int(ep.get("season") or 1))
                ep_num = parse_episode_number(ep.get("number", 1))
                ep_title = ep.get("title") or f"Episódio {int(ep_num) if ep_num.is_integer() else ep_num}"
                thumb = ep.get("still_src") or ep.get("image") or ep.get("thumbnail") or ""
                
                raw_audio = ep.get("audio") or ep.get("audios") or "Legendado"
                audios = []
                if isinstance(raw_audio, list):
                    audios = raw_audio
                else:
                    raw_str = str(raw_audio).lower()
                    if "dub" in raw_str:
                        audios.append("dublado")
                    if "leg" in raw_str or not audios:
                        audios.append("legendado")
                
                for audio in audios:
                    norm_audio = "dublado" if "dub" in audio.lower() else "legendado"
                    results.append(EpisodeResult(
                        provider_ep_id=ep_id,
                        season_number=season,
                        episode_number=ep_num,
                        title=ep_title,
                        thumbnail=thumb,
                        episode_type="regular",
                        audio_type=norm_audio,
                        player_type="direct",
                        stream_url="", # Resolved dynamically on-demand
                        quality="HD",
                        is_dynamic=True,
                        extra_payload={"episode_id": ep_id, "audio": norm_audio}
                    ))
            
            return results
        except Exception:
            return []

    def resolve_stream(self, provider_ep_id: str, extra_payload: Optional[Dict[str, Any]] = None) -> StreamResolution:
        try:
            resp = self._http_get(f"{API_BASE_URL}/episode/{provider_ep_id}")
            if resp.status_code != 200:
                return StreamResolution(success=False, stream_url="", error_message=f"HTTP {resp.status_code}")
            
            payload = resp.json()
            data = payload.get("data", {}) if isinstance(payload, dict) else {}
            streams = data.get("streams", [])
            if not isinstance(streams, list) or not streams:
                return StreamResolution(success=False, stream_url="", error_message="No streams found")
            
            target_audio = (extra_payload or {}).get("audio", "legendado").lower()
            
            # Find streams matching desired audio
            candidates = [s for s in streams if isinstance(s, dict) and not s.get("is_offline") and (s.get("audio", "").lower() == target_audio or not target_audio)]
            if not candidates:
                # Fallback to any online stream
                candidates = [s for s in streams if isinstance(s, dict) and not s.get("is_offline")]
            
            if not candidates:
                return StreamResolution(success=False, stream_url="", error_message="All streams are offline")
            
            selected = candidates[0]
            stream_url = selected.get("url") or ""
            qualities = selected.get("qualities") or ["720p"]
            
            # Remove ip parameter if present
            if stream_url:
                parts = urlsplit(stream_url)
                query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k != "ip"]
                stream_url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
            
            return StreamResolution(
                success=True,
                stream_url=stream_url,
                player_type="direct",
                headers={"Referer": f"{SITE_BASE_URL}/", "Origin": SITE_BASE_URL, "User-Agent": HEADERS["User-Agent"]},
                qualities=[{"quality": str(q), "url": stream_url} for q in qualities]
            )
        except Exception as e:
            return StreamResolution(success=False, stream_url="", error_message=str(e))

