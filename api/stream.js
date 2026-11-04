const http = require('http');
const https = require('https');

module.exports = function handler(req, res) {
  // Configura CORS total para players web
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let queryUrl;
  if (req.query && req.query.url) {
    queryUrl = req.query.url;
  } else {
    try {
      const parsedReq = new URL(req.url, 'http://localhost');
      queryUrl = parsedReq.searchParams.get('url');
    } catch (e) {
      queryUrl = null;
    }
  }

  if (!queryUrl) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Parâmetro url é obrigatório');
    return;
  }

  function fetchStream(targetUrl, redirectCount = 0) {
    if (redirectCount > 5) {
      res.writeHead(508, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Muitos redirecionamentos');
      return;
    }

    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('URL inválida');
      return;
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*'
    };

    if (targetUrl.includes('akumast.net') || targetUrl.includes('animefire')) {
      headers['Referer'] = 'https://animefire.one/';
      headers['Origin'] = 'https://animefire.one';
    } else if (targetUrl.includes('maximaimg.online') || targetUrl.includes('animesdigital') || targetUrl.includes('anivideo')) {
      headers['Referer'] = 'https://api.anivideo.net/';
      headers['Origin'] = 'https://api.anivideo.net';
    } else if (targetUrl.includes('anidrive') || targetUrl.includes('animesonline')) {
      headers['Referer'] = 'https://animesonline.io/';
    }

    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const options = {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: headers,
      rejectUnauthorized: false
    };

    const proxyReq = client.request(options, (proxyRes) => {
      // Segue redirecionamentos (301, 302, 307, 308)
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        let redirectUrl = proxyRes.headers.location;
        if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
          redirectUrl = new URL(redirectUrl, targetUrl).toString();
        }
        proxyRes.resume();
        fetchStream(redirectUrl, redirectCount + 1);
        return;
      }

      // Repassa cabeçalhos essenciais para o player HTML5
      const passHeaders = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'last-modified',
        'etag'
      ];

      passHeaders.forEach((h) => {
        if (proxyRes.headers[h]) {
          res.setHeader(h, proxyRes.headers[h]);
        }
      });

      if (!res.getHeader('accept-ranges')) {
        res.setHeader('accept-ranges', 'bytes');
      }

      res.writeHead(proxyRes.statusCode);

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      proxyRes.pipe(res);

      proxyRes.on('error', (err) => {
        console.error('Erro na resposta do stream:', err);
        if (!res.headersSent) {
          res.writeHead(502);
          res.end('Erro ao carregar dados do stream');
        }
      });
    });

    proxyReq.on('error', (err) => {
      console.error('Erro na requisição proxy:', err);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Falha ao conectar ao servidor de vídeo: ' + err.message);
      }
    });

    req.on('close', () => {
      proxyReq.destroy();
    });

    proxyReq.end();
  }

  fetchStream(queryUrl);
};
