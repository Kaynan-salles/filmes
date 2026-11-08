import json
import re
import os
import sqlite3

def run():
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

    current_animes = json.load(open('WEB_PORTAL/data/animes.json', encoding='utf-8'))
    current_details = json.load(open('WEB_PORTAL/data/animes_details.json', encoding='utf-8'))

    current_titles_clean = {re.sub(r'[^a-zA-Z0-9]', '', a['t'].lower()): a['id'] for a in current_animes}
    print(f"Existing catalog: {len(current_animes)} animes, {len(current_details)} detailed entries.")

    discovered_series = {}

    for fpath, prov in files:
        if not os.path.exists(fpath):
            continue
        try:
            items = json.load(open(fpath, encoding='utf-8'))
            for it in items:
                t = it.get('t', '').strip()
                t_low = t.lower()
                if not t:
                    continue
                if any(fp in t_low for fp in false_positives):
                    continue
                
                # Check anime keyword
                matched_kw = None
                for kw in anime_keywords:
                    if kw in t_low:
                        matched_kw = kw
                        break
                if not matched_kw:
                    continue

                # Clean base series name
                base = re.sub(r'[\(\[\{].*?[\)\]\}]', '', t)
                base = re.sub(r'\s*(?:S\d+|TEMP(?:ORADA)?\s*\d+|T\d+)\s*(?:E\d+|EP\s*\d+|CAP\s*\d+)?.*$', '', base, flags=re.IGNORECASE)
                base = re.sub(r'[\s\.\-_:]+$', '', base).strip()

                if not base or len(base) < 2:
                    continue

                # Normalize specific titles
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
                elif 'parasyte' in b_low:
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
                
                # Check if it already exists in current animes
                if clean_key in current_titles_clean:
                    continue

                if canonical not in discovered_series:
                    discovered_series[canonical] = []
                discovered_series[canonical].append(it)
        except Exception as e:
            print(f"Error reading {fpath}: {e}")

    print(f"Discovered {len(discovered_series)} new anime series!")
    for name, items in sorted(discovered_series.items()):
        print(f"  - {name}: {len(items)} items")

if __name__ == '__main__':
    run()
