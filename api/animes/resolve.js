const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

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

function fetchText(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': parsed.origin + '/'
        },
        timeout: timeoutMs
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).toString();
          return fetchText(redirectUrl, timeoutMs).then(resolve).catch(reject);
        }
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    } catch (e) {
      reject(e);
    }
  });
}

async function resolveBloggerStreams(token) {
  try {
    const bloggerUrl = `https://www.blogger.com/video.g?token=${token}`;
    const html = await fetchText(bloggerUrl, 7000);
    const fsidM = html.match(/"FdrFJe"\s*:\s*"(-?\d+)"/);
    if (!fsidM) return [];

    const postData = `f.req=${encodeURIComponent(JSON.stringify([[["WcwnYd", JSON.stringify([token, null, 0]), null, "generic"]]]))}`;
    const parsed = new URL('https://www.blogger.com/_/BloggerVideoPlayerUi/data/batchexecute?rpcids=WcwnYd&source-path=%2Fvideo.g&f.sid=' + fsidM[1]);

    const postPromise = new Promise((resolve, reject) => {
      const req = https.request({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': bloggerUrl
        },
        timeout: 7000
      }, res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve(body));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(postData);
      req.end();
    });

    const resBody = await postPromise;
    const urls = [];
    const urlMatches = resBody.matchAll(/https?:\\\/\\\/[^\s"'\\]+googlevideo\.com\\\/videoplayback[^\s"'\\]*/g);
    for (const m of urlMatches) {
      const cleanUrl = m[0].replace(/\\\//g, '/');
      const itagM = cleanUrl.match(/itag=(\d+)/);
      const itag = itagM ? parseInt(itagM[1], 10) : 0;
      const label = itag === 22 ? '720p HD' : (itag === 18 ? '360p SD' : `${itag}p`);
      urls.push({ quality: label, url: cleanUrl });
    }
    return urls;
  } catch (e) {
    return [];
  }
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

  const query = req.query || {};
  const episodeId = (query.episode_id || '').trim();
  const audio = (query.audio || 'legendado').toLowerCase();
  const preferredProvider = query.provider ? query.provider.toLowerCase() : null;
  const preferredQuality = query.quality ? query.quality.toLowerCase() : null;

  if (!episodeId) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, error: 'Parâmetro episode_id obrigatório' }));
    return;
  }

  try {
    const detailsMap = loadDetails();
    let targetEp = null;
    let targetAnime = null;

    for (const aId of Object.keys(detailsMap)) {
      const anime = detailsMap[aId];
      for (const season of (anime.seasons || [])) {
        for (const ep of (season.episodes || [])) {
          if (ep.id === episodeId) {
            targetEp = ep;
            targetAnime = anime;
            break;
          }
        }
        if (targetEp) break;
      }
      if (targetEp) break;
    }

    if (!targetEp) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: 'Episódio não encontrado no catálogo' }));
      return;
    }

    const rawSources = targetEp.sources || [];
    // Filtra fora provedores mortos (animefire)
    const validSources = rawSources.filter(s => s.provider !== 'animefire');

    let streamUrl = null;
    let selectedSource = null;
    let quality = '720p HD';

    // Ordena candidatos
    validSources.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      if (preferredProvider && a.provider === preferredProvider) scoreA += 1000;
      if (preferredProvider && b.provider === preferredProvider) scoreB += 1000;
      if (a.audio_type === audio) scoreA += 200;
      if (b.audio_type === audio) scoreB += 200;
      return scoreB - scoreA;
    });

    for (const src of validSources) {
      selectedSource = src;
      let payload = {};
      try {
        payload = typeof src.extra_payload === 'string' ? JSON.parse(src.extra_payload) : (src.extra_payload || {});
      } catch (e) {}

      if (src.stream_url && src.stream_url.startsWith('http')) {
        streamUrl = src.stream_url;
        quality = src.quality || '720p HD';
        break;
      }

      if (src.provider === 'animesonlinecc') {
        const epUrl = payload.episode_url || `https://animesonlinecc.to/episodio/${src.provider_ep_id}/`;
        try {
          const epHtml = await fetchText(epUrl, 6000);
          const bloggerMatch = epHtml.match(/blogger\.com\/video\.g\?token=([a-zA-Z0-9_-]+)/);
          if (bloggerMatch) {
            const token = bloggerMatch[1];
            const streams = await resolveBloggerStreams(token);
            if (streams && streams.length > 0) {
              const best = (preferredQuality && streams.find(s => s.quality.toLowerCase().includes(preferredQuality.substring(0, 3)))) || streams[0];
              streamUrl = best.url;
              quality = best.quality;
              break;
            } else {
              streamUrl = `https://www.blogger.com/video.g?token=${token}`;
              quality = 'SD';
              break;
            }
          }
        } catch (e) {
          console.error('Erro ao resolver AnimesOnlineCC no Vercel:', e.message);
        }
      } else if (src.provider === 'animesdigital') {
        const epUrl = payload.episode_url || `https://animesdigital.org/video/a/${src.provider_ep_id}/`;
        try {
          const epHtml = await fetchText(epUrl, 6000);
          const mHls = epHtml.match(/https:\/\/api\.anivideo\.net\/videohls\.php\?d=([^"'\s&]+)/);
          if (mHls) {
            streamUrl = mHls[1];
            quality = '720p HD';
            break;
          }
          const mIfr = epHtml.match(/<iframe[^>]+src=["']([^"']+)["']/);
          if (mIfr) {
            streamUrl = mIfr[1];
            quality = '720p HD';
            break;
          }
        } catch (e) {
          console.error('Erro ao resolver AnimesDigital no Vercel:', e.message);
        }
      }
    }

    if (!streamUrl && validSources.length > 0) {
      // Fallback para o primeiro source
      const fallbackSrc = validSources[0];
      selectedSource = fallbackSrc;
      let payload = {};
      try {
        payload = typeof fallbackSrc.extra_payload === 'string' ? JSON.parse(fallbackSrc.extra_payload) : (fallbackSrc.extra_payload || {});
      } catch (e) {}
      if (payload.episode_url) {
        streamUrl = payload.episode_url;
      }
    }

    if (!streamUrl) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: false,
        error: 'Nenhum servidor de vídeo ativo para este episódio no momento.',
        episode_id: episodeId
      }));
      return;
    }

    const isEmbedUrl = (url) => {
      if (!url) return false;
      return url.includes('blogger.com') ||
             url.includes('/video.g') ||
             url.includes('animesonline') ||
             url.includes('animesdigital') ||
             url.includes('embed') ||
             url.includes('iframe') ||
             url.endsWith('.html') ||
             url.endsWith('/');
    };

    const finalPlayerType = isEmbedUrl(streamUrl) ? 'embed' : 'direct';

    const availableSources = validSources.map(s => {
      const sUrl = s.stream_url || streamUrl;
      return {
        provider: s.provider,
        provider_label: s.provider === 'animesdigital' ? 'AnimesDigital' : 'AnimesOnlineCC',
        quality: s.quality || '720p HD',
        quality_label: `${s.quality || '720p HD'} (Verificado)`,
        audio_type: s.audio_type,
        player_type: isEmbedUrl(sUrl) ? 'embed' : 'direct',
        selected: (selectedSource && s.id === selectedSource.id)
      };
    });

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=120, s-maxage=600'
    });
    res.end(JSON.stringify({
      success: true,
      stream_url: streamUrl,
      player_type: finalPlayerType,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      audio_type: selectedSource ? selectedSource.audio_type : audio,
      provider: selectedSource ? selectedSource.provider : 'animesonlinecc',
      provider_label: selectedSource && selectedSource.provider === 'animesdigital' ? 'AnimesDigital' : 'AnimesOnlineCC',
      quality: quality,
      quality_verified: true,
      available_sources: availableSources,
      episode_id: episodeId,
      cached: false
    }));

  } catch (err) {
    console.error('Erro em /api/animes/resolve:', err);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, error: err.message, episode_id: episodeId }));
  }
};

