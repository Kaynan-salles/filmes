import re
from typing import Dict, Any, Optional, Tuple
from animes_engine.normalizer import (
    normalize_title,
    strip_accents,
    DISTINCT_KEYWORDS
)

try:
    from thefuzz import fuzz
except ImportError:
    # Minimal fallback if thefuzz not present
    class FallbackFuzz:
        @staticmethod
        def ratio(s1: str, s2: str) -> int:
            if s1 == s2:
                return 100
            if not s1 or not s2:
                return 0
            # Simple Jaccard similarity fallback
            set1, set2 = set(s1.split()), set(s2.split())
            if not set1 or not set2:
                return 0
            return int((len(set1 & set2) / len(set1 | set2)) * 100)
    fuzz = FallbackFuzz()


def has_distinct_keyword_conflict(title1: str, title2: str) -> bool:
    """
    Check if one title contains a critical distinction keyword (e.g. 'Shippuden',
    'Brotherhood', 'Zero', 'Final Season') that the other title lacks.
    If so, they MUST NOT be merged, even if similarity is very high.
    """
    t1 = strip_accents(title1).lower()
    t2 = strip_accents(title2).lower()
    for kw in DISTINCT_KEYWORDS:
        in1 = re.search(r'\b' + re.escape(kw) + r'\b', t1) is not None
        in2 = re.search(r'\b' + re.escape(kw) + r'\b', t2) is not None
        if in1 != in2:
            return True
    return False


def compare_animes(anime1: Dict[str, Any], anime2: Dict[str, Any]) -> Tuple[bool, float, str]:
    """
    Determine if two anime entries represent the same work.
    Returns:
        (is_match: bool, confidence: float, match_reason: str)
    """
    # 1. External IDs (Anilist, MyAnimeList)
    if anime1.get('anilist_id') and anime2.get('anilist_id'):
        if anime1['anilist_id'] == anime2['anilist_id']:
            return True, 1.0, "anilist_id_exact"
        return False, 0.0, "anilist_id_mismatch"
        
    if anime1.get('mal_id') and anime2.get('mal_id'):
        if anime1['mal_id'] == anime2['mal_id']:
            return True, 1.0, "mal_id_exact"
        return False, 0.0, "mal_id_mismatch"

    # 2. Check format conflict (e.g. MOVIE vs TV series)
    fmt1 = anime1.get('format', 'TV').upper()
    fmt2 = anime2.get('format', 'TV').upper()
    if fmt1 != fmt2 and (fmt1 == 'MOVIE' or fmt2 == 'MOVIE'):
        return False, 0.0, "format_mismatch_movie_vs_series"

    # 3. Check season conflict (Season 1 vs Season 2)
    s1 = int(anime1.get('season') or 1)
    s2 = int(anime2.get('season') or 1)
    if s1 != s2:
        return False, 0.0, f"season_mismatch_s{s1}_vs_s{s2}"

    # 4. Check critical distinction keywords (e.g. Shippuden, Brotherhood, etc.)
    raw1 = anime1.get('canonical_title') or anime1.get('title') or ""
    raw2 = anime2.get('canonical_title') or anime2.get('title') or ""
    if has_distinct_keyword_conflict(raw1, raw2):
        return False, 0.0, "distinct_subseries_keyword_conflict"

    # 5. Year conflict check: If both entries have known release years and they differ by > 1 year,
    # they represent distinct adaptations/remakes (e.g. 1999 vs 2011, 2001 vs 2019) -> DO NOT MERGE!
    y1 = anime1.get('year')
    y2 = anime2.get('year')
    if y1 and y2:
        try:
            if abs(int(y1) - int(y2)) > 1:
                return False, 0.0, f"year_mismatch_remake_{y1}_vs_{y2}"
        except (ValueError, TypeError):
            pass

    # 6. Normalized title comparison
    norm1 = anime1.get('normalized_title') or normalize_title(raw1)
    norm2 = anime2.get('normalized_title') or normalize_title(raw2)

    if norm1 == norm2 and norm1:
        return True, 1.0, "normalized_title_exact"

    # 7. Check aliases
    aliases1 = set(anime1.get('aliases') or [])
    aliases2 = set(anime2.get('aliases') or [])
    norm_aliases1 = {normalize_title(a) for a in aliases1} | {norm1}
    norm_aliases2 = {normalize_title(a) for a in aliases2} | {norm2}
    
    shared_aliases = norm_aliases1 & norm_aliases2
    # Remove empty string
    shared_aliases.discard("")
    if shared_aliases:
        return True, 0.95, f"shared_alias:{next(iter(shared_aliases))}"

    # 8. Fuzzy similarity with conservative threshold
    score = fuzz.ratio(norm1, norm2) / 100.0

    # Year check if both are present
    year_compatible = True
    if y1 and y2 and abs(int(y1) - int(y2)) > 1:
        year_compatible = False

    # Exact words containment (e.g. "Jujutsu Kaisen" vs "Jujutsu Kaisen TV")
    words1 = set(norm1.split())
    words2 = set(norm2.split())
    if words1 and words2:
        if (words1.issubset(words2) or words2.issubset(words1)) and year_compatible:
            # Check length ratio to avoid single common words matching
            shorter = min(len(norm1), len(norm2))
            longer = max(len(norm1), len(norm2))
            if shorter / max(longer, 1) >= 0.8:
                return True, 0.90, "words_containment_subset"

    if score >= 0.94 and year_compatible:
        return True, score, "high_fuzzy_similarity"

    if score >= 0.82 and year_compatible:
        # Doubtful match -> should NOT merge automatically, must be flagged
        return False, score, "doubtful_needs_review"

    return False, score, "no_match"

