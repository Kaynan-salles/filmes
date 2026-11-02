import re
import json
import urllib.parse
from typing import List, Dict, Any, Optional
import httpx
from bs4 import BeautifulSoup

from animes_engine.providers.base import (
    BaseAnimeProvider,
    AnimeSearchResult,
    EpisodeResult,
    StreamResolution
)
from animes_engine.normalizer import (
    detect_season,
    detect_format,
    detect_audio_type,
    parse_episode_number
)

BASE_URL = "https://animesdigital.org"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": BASE_URL
}


class AnimesDigitalProvider(BaseAnimeProvider):
    name = "animesdigital"
    display_name = "Animes Digital (HLS Clean)"
    request_timeout = 15

    def _http_get(self, url: str) -> httpx.Response:
        with httpx.Client(headers=HEADERS, timeout=self.request_timeout, follow_redirects=True) as client:
            return client.get(url)

    def search_anime(self, query: str) -> List[AnimeSearchResult]:
        if not query or not query.strip():
            return []
        try:
            norm_slug = re.sub(r"[^a-z0-9]+", "-", query.strip().lower()).strip("-")
            url = f"{BASE_URL}/anime/a/{norm_slug}?odr=1"
            resp = self._http_get(url)
            if resp.status_code == 200 and "div.item_ep" in resp.text or "title_anime" in resp.text:
                soup = BeautifulSoup(resp.text, "html.parser")
                title_el = soup.find(["h1", "h2"])
                title = title_el.get_text(strip=True) if title_el else query.title()
                img = soup.find("img")
                poster = img.get("src", "") if img else ""
                if poster.startswith("/"):
                    poster = urllib.parse.urljoin(BASE_URL, poster)
                return [AnimeSearchResult(
                    provider=self.name,
                    provider_anime_id=norm_slug,
                    title=title,
                    poster=poster,
                    year=None,
                    season=detect_season(title, 1),
                    format=detect_format(title),
                    url=url
                )]
            return []
        except Exception:
            return []

    def get_anime_details(self, provider_anime_id: str, extra_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{BASE_URL}/anime/a/{provider_anime_id}?odr=1"
        try:
            resp = self._http_get(url)
            if resp.status_code != 200:
                return {}
            soup = BeautifulSoup(resp.text, "html.parser")
            h1 = soup.find("h1")
            title = h1.get_text(strip=True) if h1 else provider_anime_id.replace("-", " ").title()
            img = soup.find("img")
            poster = img.get("src", "") if img else ""
            if poster.startswith("/"):
                poster = urllib.parse.urljoin(BASE_URL, poster)
            syn_el = soup.find(class_=re.compile(r"sinopse|description", re.I))
            synopsis = syn_el.get_text(strip=True) if syn_el else ""
            return {
                "title": title,
                "poster": poster,
                "synopsis": synopsis,
                "year": None,
                "genres": ["Anime", "Action"]
            }
        except Exception:
            return {}

    def get_episodes(self, provider_anime_id: str, extra_params: Optional[Dict[str, Any]] = None) -> List[EpisodeResult]:
        url = f"{BASE_URL}/anime/a/{provider_anime_id}?odr=1"
        try:
            resp = self._http_get(url)
            if resp.status_code != 200:
                return []
            soup = BeautifulSoup(resp.text, "html.parser")
            episodes: List[EpisodeResult] = []
            for ep_div in soup.select("div.item_ep"):
                link = ep_div.select_one("a")
                if not link:
                    continue
                href = link.get("href", "")
                title_el = ep_div.select_one(".title_anime")
                t_text = title_el.get_text(strip=True) if title_el else ""
                m_ep = re.search(r"Epis[oó]dio\s*(\d+(?:\.\d+)?)", t_text, re.I)
                ep_num = float(m_ep.group(1)) if m_ep else 1.0
                ep_id = href.rstrip("/").split("/")[-1]
                episodes.append(EpisodeResult(
                    provider_ep_id=ep_id,
                    season_number=1,
                    episode_number=ep_num,
                    title=f"Episódio {int(ep_num) if ep_num.is_integer() else ep_num}",
                    thumbnail="",
                    episode_type="regular",
                    audio_type=detect_audio_type(t_text),
                    player_type="direct",
                    stream_url="",
                    quality="720p HD",
                    is_dynamic=True,
                    extra_payload={"episode_url": urllib.parse.urljoin(BASE_URL, href)}
                ))
            episodes.sort(key=lambda e: (e.season_number, e.episode_number))
            return episodes
        except Exception:
            return []

    def resolve_stream(self, provider_ep_id: str, extra_payload: Optional[Dict[str, Any]] = None) -> StreamResolution:
        try:
            ep_url = (extra_payload or {}).get("episode_url") or f"{BASE_URL}/video/a/{provider_ep_id}"
            resp = self._http_get(ep_url)
            if resp.status_code != 200:
                return StreamResolution(success=False, stream_url="", error_message=f"HTTP {resp.status_code}")
            
            # Extract anivideo HLS
            m_hls = re.search(r'https://api\.anivideo\.net/videohls\.php\?d=([^"\'\s&]+)', resp.text)
            if m_hls:
                target_m3u8 = m_hls.group(1)
                return StreamResolution(
                    success=True,
                    stream_url=target_m3u8,
                    player_type="direct",
                    headers={"Referer": "https://api.anivideo.net/", "User-Agent": USER_AGENT},
                    quality="720p HD",
                    qualities=[{"quality": "720p HD", "stream_url": target_m3u8}]
                )
            
            # Fallback to direct MP4 or iframe
            iframes = re.findall(r'<iframe[^>]+src=["\']([^"\']+)["\']', resp.text)
            for ifr in iframes:
                if "anivideo" in ifr:
                    return StreamResolution(
                        success=True,
                        stream_url=ifr,
                        player_type="embed",
                        headers={"Referer": BASE_URL},
                        quality="720p HD"
                    )
            if iframes:
                return StreamResolution(
                    success=True,
                    stream_url=iframes[0],
                    player_type="embed",
                    headers={"Referer": BASE_URL},
                    quality="SD"
                )
            return StreamResolution(success=False, stream_url="", error_message="Nenhuma fonte de reprodução encontrada no AnimesDigital")
        except Exception as e:
            return StreamResolution(success=False, stream_url="", error_message=str(e))

