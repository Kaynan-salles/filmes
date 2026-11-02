from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class AnimeSearchResult:
    provider: str
    provider_anime_id: str
    title: str
    poster: str = ""
    year: Optional[int] = None
    season: int = 1
    format: str = "TV" # TV, MOVIE, OVA, SPECIAL
    url: str = ""
    extra_params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EpisodeResult:
    provider_ep_id: str
    season_number: int
    episode_number: float
    title: str
    thumbnail: str = ""
    episode_type: str = "regular" # regular, special, ova
    audio_type: str = "legendado" # dublado, legendado
    player_type: str = "direct"   # direct (mp4/hls), embed (iframe)
    stream_url: str = ""
    quality: str = "HD"
    is_dynamic: bool = True
    extra_payload: Dict[str, Any] = field(default_factory=dict)


@dataclass
class StreamResolution:
    success: bool
    stream_url: str
    player_type: str = "direct" # direct (mp4/hls) or embed (iframe)
    headers: Dict[str, str] = field(default_factory=dict)
    quality: str = "HD"
    qualities: List[Dict[str, str]] = field(default_factory=list)
    error_message: Optional[str] = None


class BaseAnimeProvider(ABC):
    name: str = "base"
    display_name: str = "Base Provider"
    request_timeout: int = 15

    @abstractmethod
    def search_anime(self, query: str) -> List[AnimeSearchResult]:
        """Search anime by title."""
        pass

    @abstractmethod
    def get_anime_details(self, provider_anime_id: str, extra_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Fetch synopsis, poster, banner, genres, etc."""
        pass

    @abstractmethod
    def get_episodes(self, provider_anime_id: str, extra_params: Optional[Dict[str, Any]] = None) -> List[EpisodeResult]:
        """Fetch list of all available episodes for an anime."""
        pass

    @abstractmethod
    def resolve_stream(self, provider_ep_id: str, extra_payload: Optional[Dict[str, Any]] = None) -> StreamResolution:
        """Resolve dynamic playable video stream (direct MP4/HLS or embed iframe)."""
        pass

