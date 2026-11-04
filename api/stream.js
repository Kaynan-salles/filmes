const http = require('http');
const https = require('https');

const MAX_CHUNK = 3.5 * 1024 * 1024; // 3.5 MB (segurança total dentro do limite de 4.5 MB do Vercel)

module.exports = function handler(req, res) {
  // Configura CORS total para players web
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, Location');

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
    if (redirectCount > 8) {
      res.writeHead(508, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Muitos redirecionamentos');
      return;
    }

    // Se a URL (inicial ou após redirect) for do workers.dev, redireciona 307 diretamente via HTTPS
    // Cloudflare Workers tem certificado SSL oficial, suporte a Range nativo e CORS liberado
    if (targetUrl.includes('.workers.dev')) {
      const httpsWorkerUrl = targetUrl.replace(/^http:\/\//i, 'https://');
      res.writeHead(307, {
        'Location': httpsWorkerUrl,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Location'
      });
      res.end();
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

    if (targetUrl.includes('googlevideo.com') || targetUrl.includes('blogger.com') || targetUrl.includes('googleusercontent.com')) {
      headers['Referer'] = 'https://www.blogger.com/';
      headers['Origin'] = 'https://www.blogger.com';
    } else if (targetUrl.includes('akumast.net') || targetUrl.includes('animefire')) {
      headers['Referer'] = 'https://animefire.one/';
      headers['Origin'] = 'https://animefire.one';
    } else if (targetUrl.includes('maximaimg.online') || targetUrl.includes('animesdigital') || targetUrl.includes('anivideo')) {
      headers['Referer'] = 'https://api.anivideo.net/';
      headers['Origin'] = 'https://api.anivideo.net';
    } else if (targetUrl.includes('anidrive') || targetUrl.includes('animesonline')) {
      headers['Referer'] = 'https://animesonline.io/';
    }

    // Determina se é candidato a vídeo direto ou HLS
    const isVideoFile = targetUrl.includes('/movie/') ||
                        targetUrl.includes('/series/') ||
                        targetUrl.includes('.mp4') ||
                        targetUrl.includes('.mkv') ||
                        targetUrl.includes('googlevideo.com');

    // Clamping de Range para evitar estourar o limite de 4.5 MB do Vercel Serverless
    const clientRange = req.headers['range'];

    if (clientRange) {
      const match = clientRange.match(/bytes=(\d+)-(\d*)/i);
      if (match) {
        const start = parseInt(match[1], 10);
        let end = match[2] ? parseInt(match[2], 10) : null;
        if (end === null || (end - start + 1) > MAX_CHUNK) {
          end = start + MAX_CHUNK - 1;
        }
        headers['Range'] = `bytes=${start}-${end}`;
      } else {
        headers['Range'] = clientRange;
      }
    } else if (isVideoFile) {
      // Se for vídeo MP4 e o player não pediu range inicial, solicita o primeiro bloco de 3.5 MB
      headers['Range'] = `bytes=0-${MAX_CHUNK - 1}`;
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
      // Redirecionamento (301, 302, 303, 307, 308)
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        let redirectUrl = proxyRes.headers.location;
        if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
          redirectUrl = new URL(redirectUrl, targetUrl).toString();
        }

        // Se o redirecionamento aponta para o workers.dev da Cloudflare, responde 307 imediatamente!
        if (redirectUrl.includes('.workers.dev')) {
          const httpsWorkerUrl = redirectUrl.replace(/^http:\/\//i, 'https://');
          res.writeHead(307, {
            'Location': httpsWorkerUrl,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'Location'
          });
          res.end();
          proxyRes.resume();
          return;
        }

        proxyRes.resume();
        fetchStream(redirectUrl, redirectCount + 1);
        return;
      }

      const contentType = String(proxyRes.headers['content-type'] || '').toLowerCase();
      const isHlsCandidate = contentType.includes('mpegurl') ||
                             targetUrl.includes('.m3u8') ||
                             targetUrl.includes('/h.jpg') ||
                             targetUrl.includes('/p.jpg');

      // Se for playlist HLS (m3u8), reescreve links para passar pelo proxy /api/stream
      if (proxyRes.statusCode === 200 && isHlsCandidate) {
        let rawBody = '';
        proxyRes.setEncoding('utf-8');
        proxyRes.on('data', chunk => { rawBody += chunk; });
        proxyRes.on('end', () => {
          if (rawBody.includes('#EXTM3U')) {
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
            const lines = rawBody.split(/\r?\n/);
            const rewrittenLines = lines.map(line => {
              const trimmed = line.trim();
              if (!trimmed) return line;
              if (trimmed.startsWith('#')) {
                // Reescreve URIs dentro de tags como #EXT-X-KEY:METHOD=AES-128,URI="..."
                return trimmed.replace(/URI="([^"]+)"/g, (match, relUri) => {
                  const full = new URL(relUri, baseUrl).toString();
                  return `URI="/api/stream?url=${encodeURIComponent(full)}"`;
                });
              } else {
                // Linha de segmento TS / variante
                const full = new URL(trimmed, baseUrl).toString();
                return `/api/stream?url=${encodeURIComponent(full)}`;
              }
            });

            const finalPlaylist = rewrittenLines.join('\n');
            res.writeHead(200, {
              'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
              'Content-Length': Buffer.byteLength(finalPlaylist, 'utf-8'),
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
              'Access-Control-Allow-Headers': 'Range, Content-Type, Accept'
            });
            res.end(finalPlaylist);
            return;
          }

          // Se não tiver #EXTM3U, entrega o conteúdo normalmente
          res.writeHead(proxyRes.statusCode, {
            'Content-Type': contentType || 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(rawBody);
        });
        return;
      }

      // Repassa cabeçalhos essenciais para players HTML5
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
        console.error('Erro no stream proxy:', err);
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
