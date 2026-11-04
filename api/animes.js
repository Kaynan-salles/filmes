const fs = require('fs');
const path = require('path');

let cachedAnimes = null;

function loadAnimes() {
  if (cachedAnimes) return cachedAnimes;
  const possiblePaths = [
    path.join(__dirname, 'data', 'animes.json'),
    path.join(process.cwd(), 'api', 'data', 'animes.json'),
    path.join(process.cwd(), 'WEB_PORTAL', 'data', 'animes.json'),
    path.join(__dirname, '..', 'WEB_PORTAL', 'data', 'animes.json')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        cachedAnimes = JSON.parse(raw);
        return cachedAnimes;
      } catch (e) {
        console.error('Erro ao ler animes.json de', p, e);
      }
    }
  }
  return [];
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
    const animes = loadAnimes();
    const query = req.query || {};
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(query.limit || '24', 10)));
    const search = (query.search || query.q || '').trim().toLowerCase();
    const genre = (query.genre || '').trim().toLowerCase();
    const sort = (query.sort || 'latest').toLowerCase();

    let filtered = animes;
    if (search) {
      filtered = filtered.filter(a => {
        const title = (a.canonical_title || a.t || '').toLowerCase();
        const aliases = (a.aliases || []).map(al => String(al).toLowerCase());
        return title.includes(search) || aliases.some(al => al.includes(search));
      });
    }

    if (genre) {
      filtered = filtered.filter(a => {
        const genres = a.generos || a.genres || [];
        return genres.some(g => String(g).toLowerCase().includes(genre));
      });
    }

    if (sort === 'az') {
      filtered.sort((a, b) => (a.canonical_title || a.t || '').localeCompare(b.canonical_title || b.t || ''));
    } else if (sort === 'za') {
      filtered.sort((a, b) => (b.canonical_title || b.t || '').localeCompare(a.canonical_title || a.t || ''));
    } else if (sort === 'ano') {
      filtered.sort((a, b) => (b.ano || b.year || 0) - (a.ano || a.year || 0));
    } else if (sort === 'episodios') {
      filtered.sort((a, b) => (b.total_episodios || 0) - (a.total_episodios || 0));
    }

    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const offset = (page - 1) * limit;
    const items = filtered.slice(offset, offset + limit);

    const result = {
      page: page,
      limit: limit,
      total_count: totalCount,
      total_items: totalCount,
      total_pages: totalPages,
      has_more: page < totalPages,
      animes: items
    };

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300'
    });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('Erro em /api/animes:', err);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: err.message, animes: [] }));
  }
};
