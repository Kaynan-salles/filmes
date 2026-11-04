const fs = require('fs');
const path = require('path');

let cachedDetails = null;

function loadDetails() {
  if (cachedDetails) return cachedDetails;
  const possiblePaths = [
    path.join(process.cwd(), 'WEB_PORTAL', 'data', 'animes_details.json'),
    path.join(__dirname, '..', '..', 'WEB_PORTAL', 'data', 'animes_details.json'),
    path.join(__dirname, 'data', 'animes_details.json')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        cachedDetails = JSON.parse(raw);
        return cachedDetails;
      } catch (e) {
        console.error('Erro ao ler animes_details.json de', p, e);
      }
    }
  }
  return {};
}

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const query = req.query || {};
    const animeId = (query.anime_id || query.id || '').trim();
    const seasonNum = parseInt(query.season || '1', 10) || 1;

    if (!animeId) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Parâmetro anime_id é obrigatório' }));
      return;
    }

    const detailsMap = loadDetails();
    let anime = detailsMap[animeId];

    if (!anime) {
      const lowId = animeId.toLowerCase();
      for (const k of Object.keys(detailsMap)) {
        const val = detailsMap[k];
        if (k.toLowerCase() === lowId || (val.canonical_title && val.canonical_title.toLowerCase() === lowId)) {
          anime = val;
          break;
        }
      }
    }

    if (!anime) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Anime não encontrado', anime_id: animeId }));
      return;
    }

    const seasons = anime.seasons || [];
    const season = seasons.find(s => s.season_number === seasonNum) || seasons[0];
    const episodes = (season && season.episodes) ? season.episodes : [];

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600'
    });
    res.end(JSON.stringify(episodes));
  } catch (err) {
    console.error('Erro em /api/animes/episodes:', err);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: err.message }));
  }
};
