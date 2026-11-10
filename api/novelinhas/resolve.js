const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DRAMATIP_KEY = Buffer.from('QC6Ir2trghxRAyyyWZEOEFR4GgLhnfQ4A19I3QBlQkc=', 'base64');
const DRAMATIP_CACHE = new Map(); // key -> { url, expire, type, source }
let dramatipSlugMap = null;

function loadSlugMap() {
  if (dramatipSlugMap) return dramatipSlugMap;
  dramatipSlugMap = {};
  const possiblePaths = [
    path.join(__dirname, '..', 'data', 'catalogo_dramatip.json'),
    path.join(__dirname, 'data', 'catalogo_dramatip.json'),
    path.join(process.cwd(), 'api', 'data', 'catalogo_dramatip.json'),
    path.join(process.cwd(), 'WEB_PORTAL', 'data', 'catalogo_dramatip.json'),
    path.join(__dirname, '..', '..', 'WEB_PORTAL', 'data', 'catalogo_dramatip.json')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item.slug && item.bookId) {
              dramatipSlugMap[item.slug] = String(item.bookId);
            }
          }
          return dramatipSlugMap;
        }
      } catch (e) {
        console.error('Erro ao ler catalogo_dramatip.json:', e);
      }
    }
  }
  return dramatipSlugMap;
}

function fetchDramatipSource(bookId, epNum) {
  return new Promise((resolve, reject) => {
    const apiUrl = `https://dramatip.net/api/episode-source/${encodeURIComponent(bookId)}/${encodeURIComponent(epNum)}?lang=pt`;
    const req = https.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://dramatip.net/',
        'Accept': 'application/json'
      },
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data);
        } catch (e) {
          reject(new Error(`Falha ao processar resposta do servidor DramaTip (HTTP ${res.statusCode})`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Tempo limite esgotado ao contatar DramaTip'));
    });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let bookId = (req.query?.book_id || parsedUrl.searchParams.get('book_id') || '').trim();
    let ep = (req.query?.ep || parsedUrl.searchParams.get('ep') || parsedUrl.searchParams.get('serial') || '1').trim();
    let slug = (req.query?.slug || parsedUrl.searchParams.get('slug') || '').trim();
    const targetUrl = (req.query?.url || parsedUrl.searchParams.get('url') || '').trim();
    const redirectMode = (req.query?.redirect || parsedUrl.searchParams.get('redirect') || '') === '1';

    if (!/^\d+$/.test(ep)) ep = '1';

    if (!bookId) {
      if (targetUrl) {
        const m = targetUrl.match(/\/series\/([^/]+)\/episode-(\d+)/);
        if (m) {
          slug = m[1];
          ep = m[2];
        }
      }
      if (slug) {
        const slugMap = loadSlugMap();
        bookId = slugMap[slug] || '';
      }
    }

    if (!bookId) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: 'Parâmetro book_id ou slug/url obrigatório' }));
      return;
    }

    const cacheKey = `${bookId}:${ep}`;
    const now = Date.now();
    if (DRAMATIP_CACHE.has(cacheKey)) {
      const cached = DRAMATIP_CACHE.get(cacheKey);
      if (now < cached.expire) {
        if (redirectMode) {
          res.writeHead(302, { 'Location': cached.url });
          res.end();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, url: cached.url, type: cached.type, source: cached.source, cached: true }));
        return;
      }
    }

    const data = await fetchDramatipSource(bookId, parseInt(ep, 10));
    const descriptor = data?.descriptor;
    const source = descriptor?.source || 'DramaTip';
    const chain = descriptor?.chain;

    if (!chain || !chain[0] || !chain[0].enc) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: 'Nenhum descritor de stream criptografado encontrado para este capítulo' }));
      return;
    }

    const raw = Buffer.from(chain[0].enc, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(raw.length - 16);
    const ciphertext = raw.subarray(12, raw.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', DRAMATIP_KEY, iv);
    decipher.setAuthTag(tag);
    let streamUrl = decipher.update(ciphertext, null, 'utf8');
    streamUrl += decipher.final('utf8');

    // Upgrade para 1080p FHD quando disponível
    if (streamUrl.includes('q=720p')) {
      streamUrl = streamUrl.replace('q=720p', 'q=1080p');
    } else if (streamUrl.includes('_720p.m3u8')) {
      streamUrl = streamUrl.replace('_720p.m3u8', '_1080p.m3u8');
    } else if (streamUrl.includes('/720p/')) {
      streamUrl = streamUrl.replace('/720p/', '/1080p/');
    }

    const stype = (streamUrl.includes('.m3u8') || streamUrl.includes('/hls/') || chain[0].type === 'hls' || chain[0].type === 'goodshort') ? 'hls' : 'mp4';

    // Salva no cache em memória por 2 horas
    DRAMATIP_CACHE.set(cacheKey, {
      url: streamUrl,
      expire: now + 7200 * 1000,
      type: stype,
      source: source
    });

    if (redirectMode) {
      res.writeHead(302, { 'Location': streamUrl });
      res.end();
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      success: true,
      url: streamUrl,
      type: stype,
      source: source,
      quality: '1080p Full HD'
    }));
  } catch (err) {
    console.error('Erro ao resolver novelinha:', err);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, error: err.message || 'Erro interno ao resolver transmissão' }));
  }
};

