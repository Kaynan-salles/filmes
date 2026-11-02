import re
import unicodedata
from typing import Tuple, Dict, Any, Optional

# Regexes for cleaning and detecting versions
RE_ACCENTS = re.compile(r'[\u0300-\u036f]')
RE_DUBLADO = re.compile(r'\b(dublado|dub|dual\s*audio|dubl)\b', re.IGNORECASE)
RE_LEGENDADO = re.compile(r'\b(legendado|leg|sub|subbed)\b', re.IGNORECASE)
RE_QUALITY = re.compile(r'\b(480p|720p|1080p|2160p|4k|fhd|hd|sd|web-dl|bluray|bdrip)\b', re.IGNORECASE)
RE_FORMAT_MOVIE = re.compile(r'\b(filme|movie|gekijouban|the\s+movie)\b', re.IGNORECASE)
RE_FORMAT_OVA = re.compile(r'\b(ova|oad)\b', re.IGNORECASE)
RE_FORMAT_SPECIAL = re.compile(r'\b(especial|special|sp)\b', re.IGNORECASE)
RE_SEASON = re.compile(r'\b(?:temporada|season|temp|s)\s*(\d{1,2})\b|\b(\d{1,2})(?:st|nd|rd|th)?\s+season\b', re.IGNORECASE)
RE_EPISODE = re.compile(r'\b(?:episodio|ep|capitulo|cap)\s*(\d{1,4}(?:\.\d+)?)\b', re.IGNORECASE)
RE_SITE_BOILERPLATE = re.compile(
    r'\b(todos\s+os\s+epis[oó]dios\s+online|todos\s+os\s+epis[oó]dios|todos\s+epis[oó]dios|'
    r'assistir\s+online|completo\s+online|completo|online\s+hd|online|hd)\b',
    re.IGNORECASE
)
RE_PUNCTUATION = re.compile(r'[^\w\s]', re.UNICODE)
RE_SPACES = re.compile(r'\s+')

# Significant distinction keywords that must NEVER be stripped and differentiate works
DISTINCT_KEYWORDS = [
    'shippuden', 'brotherhood', 'next generations', 'zero', 'super',
    'the final season', 'final season', 'part 1', 'part 2', 'part 3',
    'reloaded', 'revolution', 'classic', 'classico', 'clássico', 'z', 'gt',
    'kai', 'diamond is unbreakable', 'golden wind', 'stone ocean',
    'stardust crusaders', 'phantom blood', 'battle tendency', 'aliciaization',
    'thousand year blood war', 'kessen hen', 'mugen train', 'entertainment district',
    'swordsmith village', 'hashira training'
]


def strip_accents(text: str) -> str:
    """Normalize text and remove diacritics / accents."""
    if not text:
        return ""
    nfkd = unicodedata.normalize('NFKD', text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def detect_audio_type(raw_title: str) -> str:
    """Detect if title or metadata specifies Dublado or Legendado."""
    if not raw_title:
        return "legendado"
    clean = strip_accents(raw_title).lower()
    if RE_DUBLADO.search(clean):
        return "dublado"
    return "legendado"


def detect_format(raw_title: str) -> str:
    """Detect format: TV, MOVIE, OVA, or SPECIAL."""
    if not raw_title:
        return "TV"
    clean = strip_accents(raw_title).lower()
    if RE_FORMAT_MOVIE.search(clean):
        return "MOVIE"
    if RE_FORMAT_OVA.search(clean):
        return "OVA"
    if RE_FORMAT_SPECIAL.search(clean):
        return "SPECIAL"
    return "TV"


def detect_season(raw_title: str, default_season: int = 1) -> int:
    """Extract season number from title or slug."""
    if not raw_title:
        return default_season
    match = RE_SEASON.search(raw_title)
    if match:
        s1 = match.group(1) or match.group(2)
        if s1 and s1.isdigit():
            return int(s1)
    return default_season


def normalize_title(title: str, preserve_distinctions: bool = True) -> str:
    """
    Produce a clean, lowercased, accent-free normalized title for deduplication comparison.
    Preserves differentiating terms (like 'Shippuden', 'Brotherhood') while removing
    noise like '(Dublado)', '1080p', brackets, and multiple spaces.
    """
    if not title:
        return ""
    
    # 1. Strip accents and lower
    clean = strip_accents(title).lower()
    
    # 2. Remove audio and quality noise and site boilerplate
    clean = RE_DUBLADO.sub(' ', clean)
    clean = RE_LEGENDADO.sub(' ', clean)
    clean = RE_QUALITY.sub(' ', clean)
    clean = RE_SITE_BOILERPLATE.sub(' ', clean)
    
    # 3. Remove season indicator if already separated into season field
    clean = RE_SEASON.sub(' ', clean)
    
    # 4. Remove brackets/parens artifacts
    clean = clean.replace('()', '').replace('[]', '').replace('{}', '')
    
    # 5. Remove non-alphanumeric punctuation
    clean = RE_PUNCTUATION.sub(' ', clean)
    
    # 6. Normalize multiple spaces
    clean = RE_SPACES.sub(' ', clean).strip()
    return clean


def parse_anime_info(raw_title: str, hint_season: int = 1) -> Dict[str, Any]:
    """
    Parse a raw title into structured canonical info:
    - display_title: clean presentation title
    - normalized_title: stripped key for comparison
    - audio: 'dublado' | 'legendado'
    - format: 'TV' | 'MOVIE' | 'OVA' | 'SPECIAL'
    - season: integer season
    - slug: URL-safe slug
    """
    audio = detect_audio_type(raw_title)
    fmt = detect_format(raw_title)
    season = detect_season(raw_title, default_season=hint_season)
    
    # Clean display title by removing bracketed/audio/quality noise
    clean_display = raw_title
    clean_display = re.sub(r'\[(Dublado|Legendado|Dub|Leg|Dual\s*Áudio|FHD|HD|4K)[^\]]*\]', '', clean_display, flags=re.I)
    clean_display = re.sub(r'\((Dublado|Legendado|Dub|Leg|Dual\s*Áudio|FHD|HD|4K)[^\)]*\)', '', clean_display, flags=re.I)
    clean_display = RE_QUALITY.sub('', clean_display)
    clean_display = RE_SITE_BOILERPLATE.sub('', clean_display)
    clean_display = re.sub(r'\[\s*\]|\(\s*\)|\{\s*\}', '', clean_display)
    clean_display = RE_SPACES.sub(' ', clean_display).strip()
    
    normalized = normalize_title(clean_display)
    
    # Slug creation
    slug_base = re.sub(r'[^a-z0-9]+', '-', strip_accents(clean_display).lower()).strip('-')
    if season > 1 and f"temporada-{season}" not in slug_base and f"season-{season}" not in slug_base:
        slug = f"{slug_base}-s{season}"
    else:
        slug = slug_base
        
    return {
        "raw_title": raw_title,
        "display_title": clean_display,
        "normalized_title": normalized,
        "audio": audio,
        "format": fmt,
        "season": season,
        "slug": slug
    }


def parse_episode_number(raw_ep: Any) -> float:
    """Parse episode number to float (handles 1, '01', '12.5', 'E01', etc.)."""
    if isinstance(raw_ep, (int, float)):
        return float(raw_ep)
    if not raw_ep:
        return 1.0
    text = str(raw_ep).strip()
    match = RE_EPISODE.search(text)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    # Fallback: find any first float/int in string
    m = re.search(r'\b(\d+(?:\.\d+)?)\b', text)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass
    return 1.0
