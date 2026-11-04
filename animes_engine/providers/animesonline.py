import re
import json
import urllib.parse
from typing import List, Dict, Any, Optional, Tuple

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

BASE_URL = "https://animesonlinecc.to"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": f"{BASE_URL}/"
}

_EPISODE_PARTS_RE = re.compile(r'/episodio/(?P<slug>.+?)-episodio-(?P<num>\d+(?:\.\d+)?)/?$')
_ANIME_SLUG_RE = re.compile(r'/anime/([^/]+)')


_ITAG_PRIORITY = {22: 720, 18: 360}


def resolve_blogger_streams(token: str, timeout: int = 12) -> List[Tuple[str, str]]:
    """
    Resolve a blogger.com video token to sorted direct streaming URLs.
    Returns list of (quality_label, url), e.g. [("720p HD", url_720), ("360p SD", url_360)].
    """
    try:
        blogger_url = f"https://www.blogger.com/video.g?token={token}"
        with httpx.Client(headers=HEADERS, timeout=timeout, follow_redirects=True) as client:
            r = client.get(blogger_url)
            if r.status_code != 200:
                return []
            
            fsid_m = re.search(r'"FdrFJe"\s*:\s*"(-?\d+)"', r.text)
            bl_m = re.search(r'"cfb2h"\s*:\s*"([^"]+)"', r.text)
            if not fsid_m or not bl_m:
                return []
            
            f_req = json.dumps([[["WcwnYd", json.dumps([token, None, 0]), None, "generic"]]])
            r2 = client.post(
                "https://www.blogger.com/_/BloggerVideoPlayerUi/data/batchexecute",
                params={
                    "rpcids": "WcwnYd",
                    "source-path": "/video.g",
                    "f.sid": fsid_m.group(1),
                    "bl": bl_m.group(1),
                    "hl": "pt-BR",
                    "_reqid": "1",
                    "rt": "c",
                },
                data={"f.req": f_req},
                headers={
                    **HEADERS,
                    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                    "X-Same-Domain": "1",
                    "Referer": blogger_url,
                }
            )
            
            if r2.status_code != 200:
                return []
            
            json_line = next(
                (line.strip() for line in r2.text.split("\n") if line.strip().startswith("[[")),
                None,
            )
            if not json_line:
                return []
            
            outer = json.loads(json_line)
            if not outer or not isinstance(outer, list) or len(outer[0]) < 3 or not outer[0][2]:
                return []
            inner = json.loads(outer[0][2])
            if not isinstance(inner, list) or len(inner) < 3 or not isinstance(inner[2], list):
                return []

            ranked: List[Tuple[int, str, str]] = []
            for stream in inner[2]:
                if not isinstance(stream, list) or not stream or not isinstance(stream[0], str):
                    continue
                url = stream[0]
                if "googlevideo.com" not in url:
                    continue
                itag_m = re.search(r"[?&]itag=(\d+)", url)
                itag = int(itag_m.group(1)) if itag_m else 0
                priority = _ITAG_PRIORITY.get(itag, itag)
                label = "720p HD" if itag == 22 else ("360p SD" if itag == 18 else f"{itag}p")
                ranked.append((priority, label, url))

            ranked.sort(key=lambda item: item[0], reverse=True)
            return [(label, url) for _, label, url in ranked]
    except Exception:
        return []


def _resolve_blogger_to_mp4(token: str, timeout: int = 12) -> Optional[str]:
    """Resolve a blogger.com video token to the highest quality direct MP4 URL (720p HD preferred)."""
    streams = resolve_blogger_streams(token, timeout=timeout)
    return streams[0][1] if streams else None


class AnimesOnlineCCProvider(BaseAnimeProvider):
    name = "animesonlinecc"
    display_name = "Animes Online CC"
    request_timeout = 4

    def _http_get(self, url: str) -> httpx.Response:
        with httpx.Client(headers=HEADERS, timeout=self.request_timeout, follow_redirects=True) as client:
            return client.get(url)

    def get_catalog_page_detailed(self, page: int = 1) -> Dict[str, Any]:
        """
        Fetch a page of animes with robust validation differentiating:
        - Real end of catalog (e.g. HTTP 404 on page > confirmed total or valid HTML with 0 articles)
        - HTTP failures / rate limits / 5xx
        - Anti-bot / Cloudflare blocks
        - Corrupted / unexpected HTML
        """
        url = f"{BASE_URL}/anime/page/{page}/" if page > 1 else f"{BASE_URL}/anime/"
        try:
            resp = self._http_get(url)

            # WordPress 404 indicates page number exceeds pagination (real end of catalog)
            if resp.status_code == 404 and page > 1:
                return {
                    "results": [],
                    "total_pages": 0,
                    "http_status": 404,
                    "is_end_of_catalog": True,
                    "is_blocked": False,
                    "is_error": False,
                    "error_message": f"Página {page} retornou HTTP 404 (fim verificado do catálogo)."
                }

            if resp.status_code != 200:
                return {
                    "results": [],
                    "total_pages": 0,
                    "http_status": resp.status_code,
                    "is_end_of_catalog": False,
                    "is_blocked": (resp.status_code == 403),
                    "is_error": True,
                    "error_message": f"Falha HTTP {resp.status_code} ao requisitar página {page}."
                }

            # Check for Cloudflare / anti-bot block page
            block_markers = ["Just a moment...", "cf-browser-verification", "challenge-running", "Attention Required! | Cloudflare"]
            if any(marker in resp.text[:3000] for marker in block_markers):
                return {
                    "results": [],
                    "total_pages": 0,
                    "http_status": 200,
                    "is_end_of_catalog": False,
                    "is_blocked": True,
                    "is_error": True,
                    "error_message": f"Bloqueio anti-bot / Cloudflare detectado na página {page}."
                }

            soup = BeautifulSoup(resp.text, "html.parser")
            total_pages = 0
            pag_div = soup.find(class_="pagination")
            if pag_div:
                span_txt = pag_div.find("span").get_text(strip=True) if pag_div.find("span") else ""
                m = re.search(r'Pagina\s+\d+\s+de\s+(\d+)', span_txt, re.I)
                if not m:
                    m = re.search(r'Pagina\s+\d+\s+de\s+(\d+)', pag_div.get_text(separator=' '), re.I)
                if m:
                    try:
                        val = int(m.group(1))
                        if 1 <= val <= 2000:
                            total_pages = val
                    except (ValueError, TypeError):
                        pass

            articles = soup.select("article")
            results: List[AnimeSearchResult] = []

            for article in articles:
                a = article.find("a", href=re.compile(r"/anime/"))
                if not a:
                    continue

                title_el = article.find(["h2", "h3"])
                title = title_el.get_text(strip=True) if title_el else a.get_text(strip=True)
                link = a.get("href", "")
                if link.startswith("/"):
                    link = urllib.parse.urljoin(BASE_URL, link)

                slug_m = _ANIME_SLUG_RE.search(link)
                anime_slug = slug_m.group(1) if slug_m else ""
                if not anime_slug or not title:
                    continue

                img = article.find("img")
                poster = img.get("src", "") if img else ""
                if poster.startswith("/"):
                    poster = urllib.parse.urljoin(BASE_URL, poster)

                season = detect_season(title, default_season=1)
                fmt = detect_format(title)

                results.append(AnimeSearchResult(
                    provider=self.name,
                    provider_anime_id=anime_slug,
                    title=title,
                    poster=poster,
                    year=None,
                    season=season,
                    format=fmt,
                    url=link,
                    extra_params={"anime_slug": anime_slug, "anime_url": link}
                ))

            # Validate layout integrity: if 0 results, is it a real empty catalog page or broken HTML?
            has_catalog_layout = bool(pag_div or soup.find(class_="animation-2") or soup.find("div", id="archive-content"))
            if not results:
                if has_catalog_layout and page > 1:
                    return {
                        "results": [],
                        "total_pages": total_pages,
                        "http_status": 200,
                        "is_end_of_catalog": True,
                        "is_blocked": False,
                        "is_error": False,
                        "error_message": f"Página {page} com layout válido porém sem artigos (fim do catálogo)."
                    }
                else:
                    return {
                        "results": [],
                        "total_pages": total_pages,
                        "http_status": 200,
                        "is_end_of_catalog": False,
                        "is_blocked": False,
                        "is_error": True,
                        "error_message": f"Página {page} retornou HTML inesperado ou sem elementos de catálogo."
                    }

            return {
                "results": results,
                "total_pages": total_pages,
                "http_status": 200,
                "is_end_of_catalog": False,
                "is_blocked": False,
                "is_error": False,
                "error_message": ""
            }
        except Exception as e:
            return {
                "results": [],
                "total_pages": 0,
                "http_status": 0,
                "is_end_of_catalog": False,
                "is_blocked": False,
                "is_error": True,
                "error_message": f"Exceção ao carregar página {page}: {str(e)}"
            }

    def get_catalog_page_with_meta(self, page: int = 1) -> Tuple[List[AnimeSearchResult], int]:
        """Fetch a page of animes from the paginated AnimesOnlineCC catalog and extract total pages."""
        det = self.get_catalog_page_detailed(page)
        return det["results"], det["total_pages"]

    def get_catalog_page(self, page: int = 1) -> List[AnimeSearchResult]:
        """Fetch a page of animes from the paginated AnimesOnlineCC catalog."""
        results, _ = self.get_catalog_page_with_meta(page)
        return results

    def search_anime(self, query: str) -> List[AnimeSearchResult]:
        if not query or not query.strip():
            return []
        
        try:
            url = f"{BASE_URL}/search/{urllib.parse.quote(query.strip())}"
            resp = self._http_get(url)
            if resp.status_code != 200:
                return []
            
            soup = BeautifulSoup(resp.text, "html.parser")
            results: List[AnimeSearchResult] = []
            
            for article in soup.select("article"):
                a = article.find("a", href=re.compile(r"/anime/"))
                if not a:
                    continue
                
                title_el = article.find(["h2", "h3"])
                title = title_el.get_text(strip=True) if title_el else a.get_text(strip=True)
                link = a.get("href", "")
                if link.startswith("/"):
                    link = urllib.parse.urljoin(BASE_URL, link)
                
                slug_m = _ANIME_SLUG_RE.search(link)
                anime_slug = slug_m.group(1) if slug_m else ""
                if not anime_slug or not title:
                    continue
                
                img = article.find("img")
                poster = img.get("src", "") if img else ""
                if poster.startswith("/"):
                    poster = urllib.parse.urljoin(BASE_URL, poster)
                
                season = detect_season(title, default_season=1)
                fmt = detect_format(title)
                
                results.append(AnimeSearchResult(
                    provider=self.name,
                    provider_anime_id=anime_slug,
                    title=title,
                    poster=poster,
                    year=None,
                    season=season,
                    format=fmt,
                    url=link,
                    extra_params={"anime_slug": anime_slug, "anime_url": link}
                ))
            
            return results
        except Exception:
            return []

    def get_anime_details(self, provider_anime_id: str, extra_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        try:
            url = f"{BASE_URL}/anime/{provider_anime_id}/"
            resp = self._http_get(url)
            if resp.status_code != 200:
                return {}
            
            soup = BeautifulSoup(resp.text, "html.parser")
            h1 = soup.find(["h1", "h2"])
            title = h1.get_text(strip=True) if h1 else provider_anime_id
            
            synopsis_el = soup.select_one(".content p, .sinopse p, .entry-content p")
            synopsis = synopsis_el.get_text(strip=True) if synopsis_el else ""
            
            poster_el = soup.select_one(".poster img, .thumb img")
            poster = poster_el.get("src", "") if poster_el else ""
            if poster.startswith("/"):
                poster = urllib.parse.urljoin(BASE_URL, poster)
                
            genres = [a.get_text(strip=True) for a in soup.select("a[href*='/genero/']")]
            
            return {
                "title": title,
                "synopsis": synopsis,
                "poster": poster,
                "banner": poster,
                "genres": genres,
                "year": None,
                "status": "COMPLETED"
            }
        except Exception:
            return {}

    def get_episodes(self, provider_anime_id: str, extra_params: Optional[Dict[str, Any]] = None) -> List[EpisodeResult]:
        try:
            url = f"{BASE_URL}/anime/{provider_anime_id}/"
            resp = self._http_get(url)
            if resp.status_code != 200:
                return []
            
            soup = BeautifulSoup(resp.text, "html.parser")
            results: List[EpisodeResult] = []
            seen_urls = set()
            
            for a in soup.find_all("a", href=re.compile(r"/episodio/")):
                href = a.get("href", "")
                full_url = urllib.parse.urljoin(BASE_URL, href)
                if full_url in seen_urls:
                    continue
                
                parts = _EPISODE_PARTS_RE.search(full_url)
                if not parts:
                    continue
                
                seen_urls.add(full_url)
                ep_num = parse_episode_number(parts.group("num"))
                ep_slug = parts.group("slug")
                
                # Check season inference from slug
                season = 1
                if ep_slug.startswith(f"{provider_anime_id}-"):
                    suffix = ep_slug[len(provider_anime_id) + 1:]
                    if suffix.isdigit():
                        season = int(suffix)
                    elif "seiya-kessen" in suffix:
                        season = 2
                    elif "tenjiku" in suffix:
                        season = 3
                    elif re.search(r'\b(2|2nd|segunda)\b', suffix):
                        season = 2
                    elif re.search(r'\b(3|3rd|terceira)\b', suffix):
                        season = 3
                    elif re.search(r'\b(4|4th|quarta)\b', suffix):
                        season = 4
                
                ep_title = f"Episódio {int(ep_num) if ep_num.is_integer() else ep_num}"
                audio = detect_audio_type(a.get_text(strip=True) or ep_slug)
                
                # Extract episode slug as id
                ep_id = full_url.rstrip("/").split("/")[-1]
                
                results.append(EpisodeResult(
                    provider_ep_id=ep_id,
                    season_number=season,
                    episode_number=ep_num,
                    title=ep_title,
                    thumbnail="",
                    episode_type="regular",
                    audio_type=audio,
                    player_type="embed", # default until resolved
                    stream_url="",
                    quality="HD",
                    is_dynamic=True,
                    extra_payload={"episode_url": full_url}
                ))
            
            # Sort episodes by season and number
            results.sort(key=lambda x: (x.season_number, x.episode_number))
            return results
        except Exception:
            return []

    def resolve_stream(self, provider_ep_id: str, extra_payload: Optional[Dict[str, Any]] = None) -> StreamResolution:
        try:
            ep_url = (extra_payload or {}).get("episode_url") or f"{BASE_URL}/episodio/{provider_ep_id}/"
            resp = self._http_get(ep_url)
            if resp.status_code != 200:
                return StreamResolution(success=False, stream_url="", error_message=f"HTTP {resp.status_code}")
            
            soup = BeautifulSoup(resp.text, "html.parser")
            iframes = [urllib.parse.urljoin(ep_url, f.get("src")) for f in soup.find_all("iframe") if f.get("src")]
            
            if not iframes:
                return StreamResolution(success=False, stream_url="", error_message="No player iframe found on episode page")
            
            # Prioritize matching audio if requested, and try all available iframes
            preferred_audio = (extra_payload or {}).get("audio", "legendado").lower()
            candidate_tokens = []
            
            # Check player options
            tabs = soup.select("#playeroptionsul li, .playeroptions li, .playex")
            for ifr_url in iframes:
                m_token = re.search(r"token=([^&\s\"']+)", ifr_url)
                if m_token:
                    candidate_tokens.append(m_token.group(1))

            # Try resolving direct streams in prioritized order (720p HD > 360p SD)
            req_qual = (extra_payload or {}).get("quality", "").lower()
            for token in candidate_tokens:
                streams = resolve_blogger_streams(token, timeout=3)
                if streams:
                    chosen_label, chosen_url = streams[0]
                    if req_qual:
                        for lbl, u in streams:
                            if req_qual in lbl.lower() or ("720" in req_qual and "720" in lbl) or ("360" in req_qual and "360" in lbl):
                                chosen_label, chosen_url = lbl, u
                                break
                    # Probe to ensure the direct GoogleVideo stream is not 403 Forbidden
                    probe_ok = True
                    try:
                        with httpx.Client(timeout=1.5) as probe_c:
                            pr = probe_c.get(chosen_url, headers={"User-Agent": HEADERS["User-Agent"]})
                            if pr.status_code >= 400:
                                probe_ok = False
                    except Exception:
                        probe_ok = False

                    if probe_ok:
                        qualities_list = [{"quality": lbl, "stream_url": u} for lbl, u in streams]
                        return StreamResolution(
                            success=True,
                            stream_url=chosen_url,
                            player_type="direct",
                            headers={"User-Agent": HEADERS["User-Agent"]},
                            quality=chosen_label,
                            qualities=qualities_list
                        )
            
            # Blogger.com iframe não permite embed em sites externos (X-Frame-Options: SAMEORIGIN)
            # Se não conseguiu resolver stream direto MP4 jogável, falha para permitir failover imediato para AnimesDigital
            for ifr in iframes:
                if "blogger.com" not in ifr and "google.com" not in ifr:
                    return StreamResolution(
                        success=True,
                        stream_url=ifr,
                        player_type="embed",
                        headers={"Referer": BASE_URL},
                        quality="SD"
                    )
            return StreamResolution(success=False, stream_url="", error_message="Stream direto indisponível no provedor")
        except Exception as e:
            return StreamResolution(success=False, stream_url="", error_message=str(e))

