import os
import sys
import unittest
import sqlite3

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure isolated test database to protect production data
TEST_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_catalog.db")
os.environ["ANIMES_DB_PATH"] = TEST_DB_PATH

from animes_engine.normalizer import (
    normalize_title,
    strip_accents,
    detect_audio_type,
    detect_season,
    detect_format,
    parse_anime_info,
    parse_episode_number
)
from animes_engine.matcher import compare_animes, has_distinct_keyword_conflict
from animes_engine.database import get_connection, db_transaction, init_db
from animes_engine.catalog import (
    upsert_anime,
    upsert_episode,
    upsert_episode_source,
    export_catalog_to_json,
    generate_anime_id
)
from animes_engine.deduplicator import (
    deduplicate_live_channels,
    generate_diagnostic_report,
    consolidate_duplicates
)
from animes_engine.sync_service import (
    resolve_episode_stream,
    get_anime_full_details,
    toggle_user_favorite,
    save_user_watch_progress,
    get_user_activity
)
from animes_engine.providers.base import EpisodeResult, StreamResolution


class TestAnimesEngine(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        if os.path.exists(TEST_DB_PATH):
            try:
                os.remove(TEST_DB_PATH)
            except Exception:
                pass
        init_db()

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(TEST_DB_PATH):
            try:
                os.remove(TEST_DB_PATH)
            except Exception:
                pass

    def test_01_normalization(self):
        """Test normalization removes noise and site wrappers while preserving core titles."""
        t1 = "Jujutsu Kaisen (Dublado) [1080p FHD]"
        t2 = "Jujutsu Kaisen Todos os Episódios Online"
        t3 = "jujutsu kaisen"
        
        self.assertEqual(normalize_title(t1), "jujutsu kaisen")
        self.assertEqual(normalize_title(t2), "jujutsu kaisen")
        self.assertEqual(normalize_title(t3), "jujutsu kaisen")
        self.assertEqual(detect_audio_type(t1), "dublado")
        self.assertEqual(detect_audio_type(t2), "legendado")

    def test_02_distinct_works_remain_separated(self):
        """Distinct works with similar names (Shippuden, Brotherhood, 0, distinct seasons) must NEVER merge."""
        # Naruto vs Naruto Shippuden
        match, conf, reason = compare_animes(
            {"canonical_title": "Naruto", "season": 1, "format": "TV"},
            {"canonical_title": "Naruto Shippuden", "season": 1, "format": "TV"}
        )
        self.assertFalse(match, "Naruto and Naruto Shippuden must NOT be merged!")

        # Fullmetal Alchemist vs Fullmetal Alchemist: Brotherhood
        match, conf, reason = compare_animes(
            {"canonical_title": "Fullmetal Alchemist", "season": 1, "format": "TV"},
            {"canonical_title": "Fullmetal Alchemist: Brotherhood", "season": 1, "format": "TV"}
        )
        self.assertFalse(match, "Fullmetal Alchemist and Brotherhood must NOT be merged!")

        # Jujutsu Kaisen TV vs Jujutsu Kaisen 0 (Movie)
        match, conf, reason = compare_animes(
            {"canonical_title": "Jujutsu Kaisen", "season": 1, "format": "TV"},
            {"canonical_title": "Jujutsu Kaisen 0", "season": 1, "format": "MOVIE"}
        )
        self.assertFalse(match, "TV series and Movie must NOT be merged!")

        # Bleach Season 1 vs Bleach: Thousand-Year Blood War
        match, conf, reason = compare_animes(
            {"canonical_title": "Bleach", "season": 1, "format": "TV"},
            {"canonical_title": "Bleach: Thousand-Year Blood War", "season": 1, "format": "TV"}
        )
        self.assertFalse(match, "Bleach and Thousand-Year Blood War must NOT be merged!")

        # Season 1 vs Season 2
        match, conf, reason = compare_animes(
            {"canonical_title": "Demon Slayer", "season": 1, "format": "TV"},
            {"canonical_title": "Demon Slayer", "season": 2, "format": "TV"}
        )
        self.assertFalse(match, "Distinct seasons must NOT be merged!")

    def test_03_idempotent_import(self):
        """Importing the same anime twice must NOT increase records count."""
        with db_transaction() as conn:
            anime_data = {
                "canonical_title": "Death Note",
                "synopsis": "Caderno da morte",
                "poster": "https://example.com/deathnote.jpg",
                "season": 1,
                "format": "TV",
                "year": 2006
            }
            # Run 1
            id1, is_new1 = upsert_anime(anime_data, conn)
            # Run 2
            id2, is_new2 = upsert_anime(anime_data, conn)

            self.assertEqual(id1, id2, "ID must be identical")
            self.assertFalse(is_new2, "Second upsert must return is_new=False")

            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM animes WHERE id = ?", (id1,))
            self.assertEqual(cur.fetchone()[0], 1, "Only one Death Note record must exist")

    def test_04_cross_source_same_anime_single_record(self):
        """Same anime from AnimeFire and AnimesOnlineCC must resolve to a single canonical anime."""
        with db_transaction() as conn:
            # Source 1: AnimeFire
            a1 = {
                "canonical_title": "Chainsaw Man",
                "poster": "https://animefire.one/poster.jpg",
                "season": 1,
                "format": "TV",
                "year": 2022
            }
            anime_id_1, _ = upsert_anime(a1, conn)

            # Source 2: AnimesOnlineCC
            a2 = {
                "canonical_title": "Chainsaw Man Todos os Episodios Online",
                "poster": "https://animesonlinecc.to/poster.jpg",
                "season": 1,
                "format": "TV",
                "year": 2022
            }
            anime_id_2, is_new_2 = upsert_anime(a2, conn)

            self.assertEqual(anime_id_1, anime_id_2, "Both sources must link to the same anime ID!")
            self.assertFalse(is_new_2, "Second source must not create a new anime record!")

    def test_05_dubbed_and_subbed_attached_to_same_episode(self):
        """Dublado and Legendado versions must attach as alternate playback options of the SAME episode."""
        with db_transaction() as conn:
            anime_id, _ = upsert_anime({"canonical_title": "One Punch Man", "season": 1, "format": "TV"}, conn)

            # Subbed episode
            ep_sub = EpisodeResult(
                provider_ep_id="opm_ep1_sub",
                season_number=1,
                episode_number=1.0,
                title="Episódio 1 - O Homem Mais Forte",
                audio_type="legendado",
                player_type="direct",
                stream_url="https://video.example.com/opm1_sub.mp4",
                extra_payload={"provider": "animefire"}
            )
            ep_id_1, _ = upsert_episode(anime_id, ep_sub, conn)
            upsert_episode_source(ep_id_1, ep_sub, "animefire", conn)

            # Dubbed episode
            ep_dub = EpisodeResult(
                provider_ep_id="opm_ep1_dub",
                season_number=1,
                episode_number=1.0,
                title="Episódio 1 - O Homem Mais Forte",
                audio_type="dublado",
                player_type="direct",
                stream_url="https://video.example.com/opm1_dub.mp4",
                extra_payload={"provider": "animefire"}
            )
            ep_id_2, _ = upsert_episode(anime_id, ep_dub, conn)
            upsert_episode_source(ep_id_2, ep_dub, "animefire", conn)

            # Crucial assertion: single episode ID for episode 1
            self.assertEqual(ep_id_1, ep_id_2, "Dubbed and Subbed must belong to the exact same episode!")

            # Verify sources attached
            cur = conn.cursor()
            cur.execute("SELECT audio_type, stream_url FROM episode_sources WHERE episode_id = ?", (ep_id_1,))
            sources = {r["audio_type"]: r["stream_url"] for r in cur.fetchall()}
            self.assertIn("legendado", sources)
            self.assertIn("dublado", sources)

    def test_06_channel_deduplication(self):
        """Live TV channels must be deduplicated by tvg-id and provider id, preserving regional channels."""
        channels = [
            {"provider": "iptv", "provider_channel_id": "1", "tvg_id": "globo.br", "name": "Globo HD"},
            {"provider": "iptv", "provider_channel_id": "1", "tvg_id": "globo.br", "name": "Globo HD (Dup)"},
            {"provider": "iptv", "provider_channel_id": "2", "tvg_id": "globo.sp", "name": "Globo SP"},
            {"provider": "iptv", "provider_channel_id": "3", "tvg_id": "globo.rj", "name": "Globo RJ"},
            {"provider": "iptv", "provider_channel_id": "4", "tvg_id": "sbt.br", "name": "SBT Nacional"},
            {"provider": "other", "provider_channel_id": "100", "tvg_id": "sbt.br", "name": "SBT FHD"}, # Same tvg-id
        ]
        deduped = deduplicate_live_channels(channels)
        self.assertEqual(len(deduped), 4, "Must keep Globo HD, Globo SP, Globo RJ, and SBT Nacional")
        names = [c["name"] for c in deduped]
        self.assertIn("Globo SP", names)
        self.assertIn("Globo RJ", names)

    def test_07_favorites_and_progress_preservation(self):
        """User favorites and watch progress must persist and remain valid."""
        import uuid
        anime_id = "ani_one_punch_man_s1"
        user_id = f"test_user_{uuid.uuid4().hex[:8]}"

        # Toggle favorite (Add)
        fav_res = toggle_user_favorite(user_id, anime_id, title="One Punch Man", poster="https://example.com/opm.jpg")
        self.assertTrue(fav_res["is_favorite"], "First toggle must add to favorites")

        # Save watch progress
        save_user_watch_progress(
            user_id=user_id,
            content_id=anime_id,
            episode_id="ep_ani_one_punch_man_s1_e1_regular",
            season_number=1,
            episode_number=1.0,
            episode_title="Episódio 1",
            position_seconds=450.5,
            duration_seconds=1420.0
        )

        activity = get_user_activity(user_id)
        self.assertEqual(len(activity["favorites"]), 1)
        self.assertEqual(activity["favorites"][0]["content_id"], anime_id)

        self.assertEqual(len(activity["continue_watching"]), 1)
        self.assertEqual(activity["continue_watching"][0]["content_id"], anime_id)
        self.assertEqual(activity["continue_watching"][0]["position_seconds"], 450.5)

    def test_08_error_handling_for_unavailable_sources(self):
        """Unavailable sources must return a graceful handled error structure without crashing."""
        res = resolve_episode_stream("non_existent_episode_id_999")
        self.assertFalse(res["success"])
        self.assertIn("error", res)

    def test_09_multi_provider_same_episode(self):
        """EpisodeSources must store multiple providers and resolutions under the SAME episode without duplicating animes."""
        with db_transaction() as conn:
            anime_id, _ = upsert_anime({
                "canonical_title": "Chainsaw Man",
                "season": 1,
                "format": "TV"
            }, conn)

            ep = EpisodeResult(
                provider_ep_id="csm_ep_1",
                season_number=1,
                episode_number=1.0,
                title="Cachorro e Motosserra",
                thumbnail="",
                episode_type="regular",
                audio_type="legendado",
                player_type="direct",
                stream_url="https://example.com/csm_ao.mp4",
                quality="720p HD",
                is_dynamic=False,
                extra_payload={"provider": "animesonlinecc"}
            )
            ep_id, _ = upsert_episode(anime_id, ep, conn)

            # Attach AnimesOnlineCC 720p source
            upsert_episode_source(ep_id, ep, "chainsaw-man", conn)

            # Attach AnimesDigital 720p Dublado source to the SAME episode
            ep_ad = EpisodeResult(
                provider_ep_id="csm_ad_1",
                season_number=1,
                episode_number=1.0,
                title="Cachorro e Motosserra",
                thumbnail="",
                episode_type="regular",
                audio_type="dublado",
                player_type="direct",
                stream_url="https://example.com/csm_ad.m3u8",
                quality="720p HD",
                is_dynamic=False,
                extra_payload={"provider": "animesdigital"}
            )
            ep_id_ad, is_new_ep = upsert_episode(anime_id, ep_ad, conn)
            self.assertEqual(ep_id, ep_id_ad, "Both providers must reference the exact same episode ID!")
            self.assertFalse(is_new_ep, "Second provider must not create a duplicate episode!")

            upsert_episode_source(ep_id, ep_ad, "chainsaw-man", conn)

            # Verify in DB
            cur = conn.cursor()
            cur.execute("SELECT provider, audio_type, quality FROM episode_sources WHERE episode_id = ?", (ep_id,))
            sources = cur.fetchall()
            self.assertEqual(len(sources), 2)
            provs = {s["provider"] for s in sources}
            self.assertIn("animesonlinecc", provs)
            self.assertIn("animesdigital", provs)

    def test_10_provider_and_quality_selection(self):
        """resolve_episode_stream must honor preferred provider and quality while returning available_sources."""
        with db_transaction() as conn:
            anime_id, _ = upsert_anime({
                "canonical_title": "Mob Psycho 100",
                "season": 1,
                "format": "TV"
            }, conn)

            ep = EpisodeResult(
                provider_ep_id="mob_1",
                season_number=1,
                episode_number=1.0,
                title="Episódio 1",
                thumbnail="",
                episode_type="regular",
                audio_type="legendado",
                player_type="direct",
                stream_url="https://example.com/mob_ao_720.mp4",
                quality="720p HD",
                is_dynamic=False,
                extra_payload={"provider": "animesonlinecc"}
            )
            ep_id, _ = upsert_episode(anime_id, ep, conn)
            upsert_episode_source(ep_id, ep, "mob-psycho-100", conn)

            ep_360 = EpisodeResult(
                provider_ep_id="mob_1",
                season_number=1,
                episode_number=1.0,
                title="Episódio 1",
                thumbnail="",
                episode_type="regular",
                audio_type="legendado",
                player_type="direct",
                stream_url="https://example.com/mob_ao_360.mp4",
                quality="360p SD",
                is_dynamic=False,
                extra_payload={"provider": "animesonlinecc"}
            )
            upsert_episode_source(ep_id, ep_360, "mob-psycho-100", conn)

        # Resolve preferred 360p
        res_360 = resolve_episode_stream(ep_id, preferred_quality="360p")
        self.assertTrue(res_360["success"])
        self.assertEqual(res_360["quality"], "360p SD")
        self.assertIn("available_sources", res_360)
        self.assertTrue(len(res_360["available_sources"]) >= 2)


if __name__ == "__main__":
    unittest.main()
