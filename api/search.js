const fs = require('fs');
const path = require('path');

let cachedIndex = null;

function loadSearchIndex() {
  if (cachedIndex) return cachedIndex;

  const dataDir = path.join(process.cwd(), 'WEB_PORTAL', 'data');
  const index = [];

  // 1. Carrega animes com suporte a sinopse e aliases
  try {
    const animesPath = path.join(dataDir, 'animes.json');
    if (fs.existsSync(animesPath)) {
      const animes = JSON.parse(fs.readFileSync(animesPath, 'utf-8'));
      for (const a of animes) {
        const title = a.canonical_title || a.t || '';
        const aliases = (a.aliases || []).join(' ');
        index.push({
          id: a.id,
          t: title,
          catNome: '🌸 ANIMES | Catálogo Oficial',
          p: a.poster || a.p || '',
          u: a.u || `/api/animes/resolve?anime_id=${a.id}&ep=1&s=1`,
          is_anime: true,
          total_episodios: a.total_episodios || a.total_episodes || 1,
          sinopse: a.sinopse || a.synopsis || '',
          s: `${title} ${aliases}`.toLowerCase()
        });
      }
    }
  } catch (e) {
    console.error('Erro ao carregar animes para busca:', e);
  }

  // 2. Carrega todos os títulos das 51 categorias
  try {
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir).filter(f =>
        f.endsWith('.json') &&
        !f.includes('animes') &&
        !f.includes('details') &&
        !f.includes('report') &&
        !f.includes('clientes') &&
        !f.includes('manifesto')
      );

      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(dataDir, file), 'utf-8');
          const items = JSON.parse(raw);
          if (Array.isArray(items)) {
            for (const it of items) {
              if (it.t) {
                index.push({
                  t: it.t,
                  catNome: it.catNome || file.replace('.json', ''),
                  p: it.p || '',
                  u: it.u || '',
                  s: it.t.toLowerCase()
                });
              }
            }
          }
        } catch (err) {}
      }
    }
  } catch (e) {
    console.error('Erro ao ler diretório data para busca:', e);
  }

  cachedIndex = index;
  return cachedIndex;
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
    const q = (query.q || query.search || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(200, parseInt(query.limit || '80', 10)));

    if (!q) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end('[]');
      return;
    }

    const terms = q.split(/\s+/).filter(Boolean);
    const index = loadSearchIndex();
    const results = [];

    // Primeiro os animes
    for (const item of index) {
      if (item.is_anime) {
        if (terms.every(t => item.s.includes(t))) {
          results.push(item);
          if (results.length >= limit) break;
        }
      }
    }

    // Depois filmes e séries
    if (results.length < limit) {
      for (const item of index) {
        if (!item.is_anime) {
          if (terms.every(t => item.s.includes(t))) {
            results.push(item);
            if (results.length >= limit) break;
          }
        }
      }
    }

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300'
    });
    res.end(JSON.stringify(results));
  } catch (err) {
    console.error('Erro em /api/search:', err);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: err.message }));
  }
};
