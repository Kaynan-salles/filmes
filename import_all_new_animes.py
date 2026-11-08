import json
import re
import os
import sqlite3
import unicodedata

def slugify(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8')
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '_', text).strip('_')
    return text

def parse_season_episode(title):
    # Match S01E01 or T01E01 or Temp 1 Ep 1
    m = re.search(r'(?:S|TEMP(?:ORADA)?|T)\s*0*(\d+)[\s\.\-_:]*(?:E|EP|CAP)\s*0*(\d+)', title, re.IGNORECASE)
    if m:
        return int(m.group(1)), int(m.group(2))
    
    # Match just E01 or EP 01
    m = re.search(r'(?:E|EP|CAP)\s*0*(\d+)', title, re.IGNORECASE)
    if m:
        return 1, int(m.group(1))
    
    # Match trailing number
    m = re.search(r'[\s\-_](\d+)$', title.strip())
    if m:
        return 1, int(m.group(1))
    
    return 1, 1

def main():
    anime_keywords = [
        'shippuden', 'naruto', 'dragon ball', 'one piece', 'bleach',
        'hunter x hunter', 'jojo', 'attack on titan', 'shingeki', 'jujutsu',
        'kimetsu', 'demon slayer', 'my hero academia', 'boku no hero', 'death note',
        'tokyo ghoul', 'tokyo revengers', 'fullmetal', 'fairy tail', 'black clover',
        'chainsaw man', 'spy x family', 'vinland', 'haikyuu', 'kuroko', 'sword art',
        're:zero', 'rezero', 'overlord', 'konosuba', 'mob psycho', 'one punch',
        'steins;gate', 'cowboy bebop', 'evangelion', 'code geass', 'berserk',
        'dr. stone', 'fire force', 'blue exorcist', 'inuyasha', 'yu yu hakusho',
        'saint seiya', 'cavaleiros do zodiaco', 'sailor moon', 'digimon', 'pokemon',
        'yugioh', 'yu-gi-oh', 'boruto', 'nanatsu', 'seven deadly', 'solo leveling',
        'mashle', 'kaiju no', 'dandadan', 'frieren', 'hells paradise', 'jigokuraku',
        'zom 100', 'oshi no ko', 'pluto', 'monster', 'erased', 'parasyte', 'kiseijuu',
        'gintama', 'slam dunk', 'vinland saga', 'made in abyss', 'bungo stray',
        'classroom of the elite', 'shield hero', 'tate no yuusha', 'slime data ken',
        'reincarnated as a slime', 'mushoku tensei', 'goblin slayer', 'fate/stay', 'fate/zero',
        'hellsing', 'akame ga kill', 'black lagoon', 'noragami', 'dororo', 'trigun',
        'mob psycho 100', 'drifters', 'kill la kill', 'cyberpunk edgerunners', 'castlevania',
        'record of ragnarok', 'shuumatsu no valkyrie', 'kengan ashura', 'baki'
    ]

    false_positives = [
        'monster high', 'monsterland', 'blaze and the monster', 'fate a saga winx',
        'monster hunter', 'o monstro do pantano', 'jojo nove e meia', 'one piece a serie conteudo extra',
        'pokemon detective'
    ]

    files = [
        ('WEB_PORTAL/data/01_netflix.json', 'Netflix'),
        ('WEB_PORTAL/data/02_amazon_prime.json', 'Amazon Prime'),
        ('WEB_PORTAL/data/03_max_hbo.json', 'Max HBO'),
        ('WEB_PORTAL/data/04_disney_plus.json', 'Disney+'),
        ('WEB_PORTAL/data/05_globoplay.json', 'Globoplay'),
        ('WEB_PORTAL/data/06_apple_tv_plus.json', 'Apple TV+'),
        ('WEB_PORTAL/data/07_paramount_plus.json', 'Paramount+'),
        ('WEB_PORTAL/data/14_star_plus.json', 'Star+'),
        ('WEB_PORTAL/data/25_outras_produtoras.json', 'Outras Produtoras')
    ]

    # Load initial 260 Crunchyroll/Funimation animes
    all_animes = json.load(open('WEB_PORTAL/data/animes.json', encoding='utf-8'))
    # Keep only the original 260
    base_animes = all_animes[:260]
    all_details = json.load(open('WEB_PORTAL/data/animes_details.json', encoding='utf-8'))
    
    # Keep only original 260 details
    base_details = {a['id']: all_details[a['id']] for a in base_animes if a['id'] in all_details}

    current_titles_clean = {re.sub(r'[^a-zA-Z0-9]', '', a['t'].lower()): a['id'] for a in base_animes}
    print(f"Base catalog: {len(base_animes)} series and {sum(a.get('total_episodios', 0) for a in base_animes)} episodes.")

    discovered_series = {}

    for fpath, prov in files:
        if not os.path.exists(fpath):
            continue
        try:
            items = json.load(open(fpath, encoding='utf-8'))
            for it in items:
                t = it.get('t', '').strip()
                t_low = t.lower()
                u = it.get('u', '').strip()
                if not t or not u:
                    continue
                if any(fp in t_low for fp in false_positives):
                    continue

                matched = any(kw in t_low for kw in anime_keywords)
                if not matched:
                    continue

                base = re.sub(r'[\(\[\{].*?[\)\]\}]', '', t)
                base = re.sub(r'\s*(?:S\d+|TEMP(?:ORADA)?\s*\d+|T\d+)\s*(?:E\d+|EP\s*\d+|CAP\s*\d+)?.*$', '', base, flags=re.IGNORECASE)
                base = re.sub(r'[\s\.\-_:]+$', '', base).strip()

                if not base or len(base) < 2:
                    continue

                b_low = base.lower()
                canonical = base
                if 'pokemon' in b_low:
                    if 'horizontes' in b_low:
                        canonical = 'Pokémon Horizontes: A Série'
                    elif 'concierge' in b_low:
                        canonical = 'A Concierge Pokémon'
                    else:
                        canonical = 'Pokémon'
                elif 'digimon' in b_low:
                    if 'adventure 02' in b_low or 'zero two' in b_low:
                        canonical = 'Digimon Adventure 02'
                    elif 'adventure' in b_low:
                        canonical = 'Digimon Adventure'
                    elif 'tamers' in b_low:
                        canonical = 'Digimon Tamers'
                    elif 'savers' in b_low:
                        canonical = 'Digimon Savers'
                    elif 'xros' in b_low:
                        canonical = 'Digimon Xros Wars'
                    else:
                        canonical = 'Digimon'
                elif 'yu-gi-oh' in b_low or 'yugioh' in b_low:
                    canonical = 'Yu-Gi-Oh!'
                elif 'cavaleiros do zodiaco' in b_low or 'saint seiya' in b_low:
                    canonical = 'Os Cavaleiros do Zodíaco (Saint Seiya)'
                elif 'inuyasha' in b_low:
                    canonical = 'InuYasha'
                elif 'cowboy bebop' in b_low:
                    canonical = 'Cowboy Bebop'
                elif 'one punch' in b_low:
                    canonical = 'One Punch Man'
                elif 'sailor moon' in b_low:
                    canonical = 'Sailor Moon'
                elif 'steins' in b_low:
                    canonical = 'Steins;Gate'
                elif 'seven deadly' in b_low or 'nanatsu' in b_low:
                    canonical = 'The Seven Deadly Sins: Os Quatro Cavaleiros do Apocalipse'
                elif 'parasyte' in b_low or 'kiseijuu' in b_low:
                    if 'grey' in b_low:
                        canonical = 'Parasyte: The Grey'
                    else:
                        canonical = 'Parasyte: The Maxim'
                elif 'castlevania' in b_low:
                    canonical = 'Castlevania'
                elif 'edgerunners' in b_low:
                    canonical = 'Cyberpunk: Edgerunners'
                elif 'record of ragnarok' in b_low or 'shuumatsu no valkyrie' in b_low:
                    canonical = 'Record of Ragnarok (Shuumatsu no Valkyrie)'
                elif 'kengan ashura' in b_low:
                    canonical = 'Kengan Ashura'
                elif 'baki' in b_low:
                    canonical = 'Baki Hanma'

                clean_key = re.sub(r'[^a-zA-Z0-9]', '', canonical.lower())
                if clean_key in current_titles_clean:
                    continue

                if canonical not in discovered_series:
                    discovered_series[canonical] = []
                discovered_series[canonical].append(it)
        except Exception as e:
            print(f"Error processing {fpath}: {e}")

    # Connect to SQLite DB
    db_path = 'WEB_PORTAL/data/animes_catalog.db'
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    new_animes_list = []
    total_added_eps = 0

    for canonical, items in sorted(discovered_series.items()):
        anime_id = f"ani_{slugify(canonical)}"
        
        poster = ""
        banner = ""
        for it in items:
            p = it.get('p', '')
            if p and ('image.tmdb.org' in p or 'http' in p) and not poster:
                poster = p
                banner = p
                break
        if not poster:
            poster = "https://image.tmdb.org/t/p/w600_and_h900_bestv2/aesLt9fsKSA6KCgGxA60VVxjtLk.jpg"
            banner = poster

        ep_map = {}
        for it in items:
            t = it.get('t', '')
            u = it.get('u', '')
            if not u:
                continue
            s_num, ep_num = parse_season_episode(t)
            
            audio = "dublado"
            if "leg" in t.lower() or "sub" in t.lower():
                audio = "legendado"

            key = (s_num, ep_num)
            if key not in ep_map:
                ep_map[key] = {
                    'season': s_num,
                    'episode': ep_num,
                    'title': f"Episódio {ep_num}",
                    'poster': poster,
                    'stream_url': u,
                    'audio': audio
                }

        if not ep_map:
            continue

        sorted_keys = sorted(ep_map.keys())
        seasons_dict = {}
        for (s_num, ep_num) in sorted_keys:
            if s_num not in seasons_dict:
                seasons_dict[s_num] = []
            ep_info = ep_map[(s_num, ep_num)]
            seasons_dict[s_num].append(ep_info)

        seasons_list = []
        for s_num in sorted(seasons_dict.keys()):
            eps_for_season = []
            for ep_info in seasons_dict[s_num]:
                ep_num = ep_info['episode']
                ep_id = f"ep_{anime_id}_s{s_num}_e{ep_num}"
                eps_for_season.append({
                    "id": ep_id,
                    "anime_id": anime_id,
                    "season_number": s_num,
                    "episode_number": ep_num,
                    "episode_type": "regular",
                    "title": f"Episódio {ep_num}",
                    "thumbnail": ep_info['poster'],
                    "sources": [
                        {
                            "id": f"src_{ep_id}_iptv",
                            "episode_id": ep_id,
                            "provider": "iptv",
                            "provider_anime_id": anime_id,
                            "provider_ep_id": f"s{s_num}e{ep_num}",
                            "audio_type": ep_info['audio'],
                            "player_type": "direct",
                            "stream_url": ep_info['stream_url'],
                            "quality": "1080p",
                            "is_dynamic": 0
                        }
                    ]
                })
            seasons_list.append({
                "season_number": s_num,
                "episodes": eps_for_season
            })

        total_eps = sum(len(s['episodes']) for s in seasons_list)
        total_seasons = len(seasons_list)
        total_added_eps += total_eps

        synopsis = f"{canonical} completo e organizado com episódios em alta definição 1080p direto do servidor oficial, sem propagandas."

        anime_summary = {
            "id": anime_id,
            "t": canonical,
            "catNome": "🌸 ANIMES | Catálogo Oficial",
            "p": poster,
            "banner": banner,
            "u": f"/api/animes/resolve?anime_id={anime_id}&ep=1&s=1",
            "sinopse": synopsis,
            "ano": 2024,
            "temporadas": total_seasons,
            "total_episodios": total_eps,
            "generos": ["Anime", "Animação", "Ação", "Aventura"],
            "is_anime": True
        }

        anime_detail = {
            "id": anime_id,
            "canonical_title": canonical,
            "synopsis": synopsis,
            "poster": poster,
            "banner": banner,
            "year": 2024,
            "genres": ["Anime", "Animação", "Ação", "Aventura"],
            "total_episodes": total_eps,
            "seasons": seasons_list
        }

        new_animes_list.append(anime_summary)
        base_details[anime_id] = anime_detail

        # Insert into SQLite
        try:
            cur.execute("""
                INSERT OR REPLACE INTO animes (id, canonical_title, normalized_title, slug, synopsis, poster, banner, year, season, total_episodes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (anime_id, canonical, canonical.lower(), slugify(canonical), synopsis, poster, banner, 2024, total_seasons, total_eps))

            for s in seasons_list:
                for ep in s['episodes']:
                    cur.execute("""
                        INSERT OR REPLACE INTO episodes (id, anime_id, season_number, episode_number, episode_type, title, thumbnail)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (ep['id'], anime_id, ep['season_number'], ep['episode_number'], 'regular', ep['title'], ep['thumbnail']))

                    src = ep['sources'][0]
                    cur.execute("""
                        INSERT OR REPLACE INTO episode_sources (id, episode_id, provider, provider_anime_id, provider_ep_id, audio_type, player_type, stream_url, quality, is_dynamic)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (src['id'], ep['id'], 'iptv', anime_id, src['provider_ep_id'], src['audio_type'], 'direct', src['stream_url'], '1080p', 0))
        except Exception as dbe:
            print(f"DB Error on {anime_id}: {dbe}")

    conn.commit()
    conn.close()

    updated_animes = base_animes + new_animes_list
    print(f"Updated catalog: {len(updated_animes)} animes (+{len(new_animes_list)} new series, +{total_added_eps} new episodes).")
    print(f"Total episodes in catalog now: {sum(a.get('total_episodios', 0) for a in updated_animes)}.")

    # Save WEB_PORTAL files
    with open('WEB_PORTAL/data/animes.json', 'w', encoding='utf-8') as f:
        json.dump(updated_animes, f, ensure_ascii=False, indent=2)

    with open('WEB_PORTAL/data/animes_details.json', 'w', encoding='utf-8') as f:
        json.dump(base_details, f, ensure_ascii=False, indent=2)

    # Save api/data files for Vercel
    os.makedirs('api/data', exist_ok=True)
    with open('api/data/animes.json', 'w', encoding='utf-8') as f:
        json.dump(updated_animes, f, ensure_ascii=False, indent=2)

    with open('api/data/animes_details.json', 'w', encoding='utf-8') as f:
        json.dump(base_details, f, ensure_ascii=False, indent=2)

    print("Files saved successfully to both WEB_PORTAL/data/ and api/data/!")

if __name__ == '__main__':
    main()
