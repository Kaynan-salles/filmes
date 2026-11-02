from typing import Dict, List, Optional, Any
from animes_engine.providers.base import (
    BaseAnimeProvider,
    AnimeSearchResult,
    EpisodeResult,
    StreamResolution
)
from animes_engine.providers.animefire import AnimeFireProvider
from animes_engine.providers.animesonline import AnimesOnlineCCProvider
from animes_engine.providers.animesdigital import AnimesDigitalProvider

_PROVIDERS: Dict[str, BaseAnimeProvider] = {
    "animefire": AnimeFireProvider(),
    "animesonlinecc": AnimesOnlineCCProvider(),
    "animesonline": AnimesOnlineCCProvider(),
    "animesdigital": AnimesDigitalProvider(),
}


def get_provider(name: str) -> Optional[BaseAnimeProvider]:
    return _PROVIDERS.get(name.lower())


def list_providers() -> List[Dict[str, Any]]:
    return [
        {
            "id": p.name,
            "name": p.display_name,
            "timeout": p.request_timeout
        }
        for p in _PROVIDERS.values()
    ]
