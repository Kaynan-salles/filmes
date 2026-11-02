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
    const detailsMap = loadDetails();
    const query = req.query || {};
    let animeId = (query.id || '').trim();

    if (!animeId) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Parâmetro id é obrigatório' }));
      return;
    }

    let item = detailsMap[animeId];
    if (!item) {
      // Tenta encontrar por busca de título ou slug
      const lowId = animeId.toLowerCase();
      for (const k of Object.keys(detailsMap)) {
        const val = detailsMap[k];
        if (k.toLowerCase() === lowId || (val.canonical_title && val.canonical_title.toLowerCase() === lowId)) {
          item = val;
          break;
        }
      }
    }

    if (!item) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Anime não encontrado', id: animeId }));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600'
    });
    res.end(JSON.stringify(item));
  } catch (err) {
    console.error('Erro em /api/animes/details:', err);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: err.message }));
  }
};
