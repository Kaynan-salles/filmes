const fs = require('fs');
const path = require('path');

let cachedDetails = null;

function loadDetails() {
  if (cachedDetails) return cachedDetails;
  const possiblePaths = [
    path.join(__dirname, '..', 'data', 'animes_details.json'),
    path.join(__dirname, 'data', 'animes_details.json'),
    path.join(process.cwd(), 'api', 'data', 'animes_details.json'),
    path.join(process.cwd(), 'WEB_PORTAL', 'data', 'animes_details.json'),
    path.join(__dirname, '..', '..', 'WEB_PORTAL', 'data', 'animes_details.json')
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

  const query = req.query || {};
  const episodeId = (query.episode_id || '').trim();
  const animeId = (query.anime_id || query.id || '').trim();
  const seasonNum = parseInt(query.season || query.s || '1', 10) || 1;
  const epNum = parseFloat(query.episode || query.ep || '1') || 1;
  const audio = (query.audio || 'legendado').toLowerCase();

  const detailsMap = loadDetails();
  let targetEp = null;
  let targetAnime = null;

  if (episodeId) {
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
  }

  if (!targetEp && animeId) {
    const anime = detailsMap[animeId] || detailsMap[animeId.toLowerCase()];
    if (anime) {
      targetAnime = anime;
      const seasons = anime.seasons || [];
      const season = seasons.find(s => s.season_number === seasonNum) || seasons[0];
      if (season && season.episodes) {
        targetEp = season.episodes.find(e => e.episode_number === epNum) || season.episodes[0];
      }
    }
  }

  if (!targetEp) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, error: 'Episódio não encontrado no catálogo oficial' }));
    return;
  }

  const sources = targetEp.sources || [];
  let selectedSource = sources.find(s => s.audio_type === audio && s.stream_url) || sources[0];

  if (!selectedSource || !selectedSource.stream_url) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, error: 'Nenhum servidor de vídeo disponível para este episódio' }));
    return;
  }

  const streamUrl = selectedSource.stream_url;
  const quality = selectedSource.quality || '1080p FHD';

  const availableSources = sources.map(s => ({
    provider: s.provider || 'oficial',
    provider_label: 'Oficial Direct CDN',
    quality: s.quality || '1080p FHD',
    quality_label: `${s.quality || '1080p FHD'} (Verificado)`,
    audio_type: s.audio_type || audio,
    player_type: 'direct',
    selected: s.id === selectedSource.id
  }));

  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300, s-maxage=3600'
  });
  res.end(JSON.stringify({
    success: true,
    stream_url: streamUrl,
    player_type: 'direct',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    audio_type: selectedSource.audio_type || audio,
    provider: selectedSource.provider || 'oficial',
    provider_label: 'Oficial Direct CDN',
    quality: quality,
    quality_verified: true,
    available_sources: availableSources,
    episode_id: targetEp.id,
    cached: true
  }));
};
