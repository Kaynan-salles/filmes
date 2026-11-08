// K-Cine - Client Application Logic
// Suporte a Autenticação, Central de Clientes, Supabase e Streaming

const state = {
  manifesto: null,
  activeType: 'todos', // 'todos' | 'filmes' | 'series'
  activeCategoryId: 'destaques',
  currentItems: [],
  displayedCount: 0,
  pageSize: 40,
  searchQuery: '',
  searchTimeout: null,
  hlsPlayer: null,
  heroIndex: 0,
  heroItems: [],
  currentUser: null,
  // Estado de Séries & Capítulos
  seriesViewMode: 'grouped', // 'grouped' (agrupado por série - padrão sem duplicação de capas) | 'all' (todos os capítulos)
  groupedSeriesList: [],
  activeSeriesContext: null, // { seriesName, episodes: [], currentIndex: 0 }
  activeSeriesGroup: null,
  // Estado de Animes
  activeAnimeAudio: 'legendado', // 'legendado' | 'dublado'
  activeAnimeContext: null,
  userFavorites: new Set(),
  // Paginação e Cache no Frontend de Animes (Substituição de página com max 24 cards no DOM)
  animePagination: {
    page: 1,
    limit: 24,
    hasMore: false,
    totalCount: 0,
    totalPages: 1,
    searchQuery: '',
    genre: '',
    sort: 'latest',
    abortController: null,
    requestId: 0,
    isLoading: false
  },
  // Modernização K-CINE (Perfis, Minha Lista, Detalhes e Player)
  activeProfileId: 'p_kayna',
  currentDetailsItem: null,
  nextEpCountdownTimer: null
};

// Elementos DOM
const dom = {
  // Login Screen
  loginScreen: document.getElementById('loginScreen'),
  loginForm: document.getElementById('loginForm'),
  loginUsername: document.getElementById('loginUsername'),
  loginPassword: document.getElementById('loginPassword'),
  btnLoginSubmit: document.getElementById('btnLoginSubmit'),
  btnLoginText: document.getElementById('btnLoginText'),
  btnToggleLoginEye: document.getElementById('btnToggleLoginEye'),
  loginAlertBox: document.getElementById('loginAlertBox'),
  loginAlertMessage: document.getElementById('loginAlertMessage'),

  // Header & User Controls
  mainHeader: document.getElementById('mainHeader'),
  userProfileBtn: document.getElementById('userProfileBtn'),
  navUserAvatar: document.getElementById('navUserAvatar'),
  navUserInitial: document.getElementById('navUserInitial'),
  navUserName: document.getElementById('navUserName'),
  navUserRole: document.getElementById('navUserRole'),
  btnLogoutHeader: document.getElementById('btnLogoutHeader'),

  // Modernização - Dropdown de Notificações e Menu de Perfis
  notificationsWrapper: document.getElementById('notificationsWrapper'),
  btnNotifications: document.getElementById('btnNotifications'),
  notificationBadge: document.getElementById('notificationBadge'),
  notificationsDropdown: document.getElementById('notificationsDropdown'),
  notificationsList: document.getElementById('notificationsList'),
  btnMarkAllRead: document.getElementById('btnMarkAllRead'),
  profileDropdownMenu: document.getElementById('profileDropdownMenu'),
  profileDropdownUsername: document.getElementById('profileDropdownUsername'),
  profileDropdownRole: document.getElementById('profileDropdownRole'),
  btnSwitchProfile: document.getElementById('btnSwitchProfile'),
  btnAdminPanelFromMenu: document.getElementById('btnAdminPanelFromMenu'),
  btnLogoutDropdown: document.getElementById('btnLogoutDropdown'),

  // Hero Banner
  heroBanner: document.getElementById('heroBanner'),
  heroBackdrop: document.getElementById('heroBackdrop'),
  heroVideo: document.getElementById('heroVideo'),
  heroRatingBadge: document.getElementById('heroRatingBadge'),
  heroTitle: document.getElementById('heroTitle'),
  heroCategory: document.getElementById('heroCategory'),
  heroDesc: document.getElementById('heroDesc'),
  btnHeroPlay: document.getElementById('btnHeroPlay'),
  btnHeroCopy: document.getElementById('btnHeroCopy'),
  btnHeroVlc: document.getElementById('btnHeroVlc'),
  btnHeroPrev: document.getElementById('btnHeroPrev'),
  btnHeroNext: document.getElementById('btnHeroNext'),
  btnHeroSound: document.getElementById('btnHeroSound'),
  heroSoundLabel: document.getElementById('heroSoundLabel'),
  btnHeroMyList: document.getElementById('btnHeroMyList'),
  btnHeroMoreInfo: document.getElementById('btnHeroMoreInfo'),

  // Filtros e Catálogo
  categoriesChips: document.getElementById('categoriesChips'),
  categorySelect: document.getElementById('categorySelect'),
  sortSelect: document.getElementById('sortSelect'),
  activeCategoryTitle: document.getElementById('activeCategoryTitle'),
  currentViewTitle: document.getElementById('currentViewTitle'),
  itemsFoundText: document.getElementById('itemsFoundText'),
  cardsGrid: document.getElementById('cardsGrid'),
  loadMoreContainer: document.getElementById('loadMoreContainer'),
  btnLoadMore: document.getElementById('btnLoadMore'),

  // Paginação por substituição
  catalogPaginationContainer: document.getElementById('catalogPaginationContainer'),
  paginationPages: document.getElementById('paginationPages'),
  btnPagePrev: document.getElementById('btnPagePrev'),
  btnPageNext: document.getElementById('btnPageNext'),

  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),

  btnTypeTodos: document.getElementById('btnTypeTodos'),
  btnTypeFilmes: document.getElementById('btnTypeFilmes'),
  btnTypeSeries: document.getElementById('btnTypeSeries'),
  btnTypeAnimes: document.getElementById('btnTypeAnimes'),
  btnTypeMinhaLista: document.getElementById('btnTypeMinhaLista'),
  btnTypeHistorico: document.getElementById('btnTypeHistorico'),
  searchSuggestionsDropdown: document.getElementById('searchSuggestionsDropdown'),
  homeShelvesContainer: document.getElementById('homeShelvesContainer'),
  mobileBottomNav: document.getElementById('mobileBottomNav'),

  // Seção Continuar Assistindo
  continueWatchingSection: document.getElementById('continueWatchingSection'),
  continueGrid: document.getElementById('continueGrid'),
  btnClearContinueHistory: document.getElementById('btnClearContinueHistory'),

  // Alternador de Visualização de Séries
  seriesViewControls: document.getElementById('seriesViewControls'),
  btnViewAll: document.getElementById('btnViewAll'),
  btnViewGrouped: document.getElementById('btnViewGrouped'),

  // Player Modal & Navegação de Capítulos
  playerModal: document.getElementById('playerModal'),
  htmlVideoPlayer: document.getElementById('htmlVideoPlayer'),
  iframeVideoPlayer: document.getElementById('iframeVideoPlayer'),
  modalVideoTitle: document.getElementById('modalVideoTitle'),
  modalCategoryBadge: document.getElementById('modalCategoryBadge'),
  modalEpisodeBadge: document.getElementById('modalEpisodeBadge'),
  playerEpisodeNav: document.getElementById('playerEpisodeNav'),
  playerAnimeControls: document.getElementById('playerAnimeControls'),
  btnAudioLeg: document.getElementById('btnAudioLeg'),
  btnAudioDub: document.getElementById('btnAudioDub'),
  playerProviderSelect: document.getElementById('playerProviderSelect'),
  playerQualitySelect: document.getElementById('playerQualitySelect'),
  playerProviderWrap: document.getElementById('playerProviderWrap'),
  playerQualityWrap: document.getElementById('playerQualityWrap'),
  playerSourceBadge: document.getElementById('playerSourceBadge'),
  btnPlayerFavorite: document.getElementById('btnPlayerFavorite'),
  btnPrevEp: document.getElementById('btnPrevEp'),
  btnNextEp: document.getElementById('btnNextEp'),
  playerSeriesStrip: document.getElementById('playerSeriesStrip'),
  stripSeriesName: document.getElementById('stripSeriesName'),
  stripEpCount: document.getElementById('stripEpCount'),
  playerStripScroll: document.getElementById('playerStripScroll'),
  streamUrlDisplay: document.getElementById('streamUrlDisplay'),
  btnCopyModalUrl: document.getElementById('btnCopyModalUrl'),
  btnModalOpenVlc: document.getElementById('btnModalOpenVlc'),
  btnClosePlayer: document.getElementById('btnClosePlayer'),
  btnModalDismiss: document.getElementById('btnModalDismiss'),
  playerLoading: document.getElementById('playerLoading'),
  playerErrorOverlay: document.getElementById('playerErrorOverlay'),
  playerErrorDesc: document.getElementById('playerErrorDesc'),
  btnPlayerRetry: document.getElementById('btnPlayerRetry'),
  btnPlayerClose: document.getElementById('btnPlayerClose'),

  // Controles Modernos do Player
  btnSkipIntro: document.getElementById('btnSkipIntro'),
  nextEpCountdownCard: document.getElementById('nextEpCountdownCard'),
  nextEpSeconds: document.getElementById('nextEpSeconds'),
  nextEpTitle: document.getElementById('nextEpTitle'),
  btnNextNow: document.getElementById('btnNextNow'),
  btnNextCancel: document.getElementById('btnNextCancel'),

  // Modal Compacto e Profissional de Detalhes Cinematográfico
  contentDetailsModal: document.getElementById('contentDetailsModal'),
  detailsHeroBackdrop: document.getElementById('detailsHeroBackdrop'),
  btnCloseDetailsModal: document.getElementById('btnCloseDetailsModal'),
  detailsBadgesRow: document.getElementById('detailsBadgesRow'),
  detailsCategoryBadge: document.getElementById('detailsCategoryBadge'),
  detailsRatingBadge: document.getElementById('detailsRatingBadge'),
  detailsQualityBadge: document.getElementById('detailsQualityBadge'),
  detailsTitle: document.getElementById('detailsTitle'),
  detailsYear: document.getElementById('detailsYear'),
  detailsDurationOrSeasons: document.getElementById('detailsDurationOrSeasons'),
  detailsAgeRating: document.getElementById('detailsAgeRating'),
  detailsSynopsis: document.getElementById('detailsSynopsis'),
  btnDetailsPlay: document.getElementById('btnDetailsPlay'),
  btnDetailsEpisodes: document.getElementById('btnDetailsEpisodes'),
  btnDetailsMyList: document.getElementById('btnDetailsMyList'),
  btnDetailsCopyLink: document.getElementById('btnDetailsCopyLink'),
  detailsGenresWrap: document.getElementById('detailsGenresWrap'),
  detailsGenreDot: document.getElementById('detailsGenreDot'),

  // Modal de Perfis
  profilesModal: document.getElementById('profilesModal'),
  profilesGrid: document.getElementById('profilesGrid'),
  btnCloseProfilesModal: document.getElementById('btnCloseProfilesModal'),

  // Modal de Detalhes da Série (Temporadas e Episódios)
  seriesModal: document.getElementById('seriesModal'),
  seriesModalPoster: document.getElementById('seriesModalPoster'),
  seriesModalCategory: document.getElementById('seriesModalCategory'),
  seriesModalTitle: document.getElementById('seriesModalTitle'),
  seriesModalTotalEpisodes: document.getElementById('seriesModalTotalEpisodes'),
  seriesModalTotalSeasons: document.getElementById('seriesModalTotalSeasons'),
  modalAudioSwitchGroup: document.getElementById('modalAudioSwitchGroup'),
  btnModalAudioLeg: document.getElementById('btnModalAudioLeg'),
  btnModalAudioDub: document.getElementById('btnModalAudioDub'),
  btnSeriesModalFavorite: document.getElementById('btnSeriesModalFavorite'),
  seriesSeasonsBar: document.getElementById('seriesSeasonsBar'),
  seriesEpisodesGrid: document.getElementById('seriesEpisodesGrid'),
  btnCloseSeriesModal: document.getElementById('btnCloseSeriesModal'),

  // Modais Secundários
  exportModal: document.getElementById('exportModal'),
  btnOpenExport: document.getElementById('btnOpenExport'),
  btnCloseExport: document.getElementById('btnCloseExport'),

  guideModal: document.getElementById('guideModal'),
  btnOpenGuide: document.getElementById('btnOpenGuide'),
  btnCloseGuide: document.getElementById('btnCloseGuide'),

  // Painel Admin Kaynã
  adminModal: document.getElementById('adminModal'),
  btnCloseAdmin: document.getElementById('btnCloseAdmin'),
  formAddMovie: document.getElementById('formAddMovie'),
  newTitle: document.getElementById('newTitle'),
  newCategory: document.getElementById('newCategory'),
  newType: document.getElementById('newType'),
  newStreamUrl: document.getElementById('newStreamUrl'),
  newPosterUrl: document.getElementById('newPosterUrl'),

  // Central de Clientes
  formCreateClient: document.getElementById('formCreateClient'),
  clientNewUser: document.getElementById('clientNewUser'),
  clientNewPass: document.getElementById('clientNewPass'),
  clientNewNotes: document.getElementById('clientNewNotes'),
  btnGenPassword: document.getElementById('btnGenPassword'),
  clientsListContainer: document.getElementById('clientsListContainer'),
  filterClientsInput: document.getElementById('filterClientsInput'),
  statTotalClients: document.getElementById('statTotalClients'),
  statActiveClients: document.getElementById('statActiveClients'),
  statBlockedClients: document.getElementById('statBlockedClients'),
  clientStorageBadge: document.getElementById('clientStorageBadge'),

  // Supabase & Nuvem Tab
  formSupabaseConfig: document.getElementById('formSupabaseConfig'),
  inputSupabaseUrl: document.getElementById('inputSupabaseUrl'),
  inputSupabaseKey: document.getElementById('inputSupabaseKey'),
  btnSaveSupabase: document.getElementById('btnSaveSupabase'),
  btnSyncToSupabase: document.getElementById('btnSyncToSupabase'),
  btnDisconnectSupabase: document.getElementById('btnDisconnectSupabase'),
  supabasePill: document.getElementById('supabasePill'),
  btnCopySqlScript: document.getElementById('btnCopySqlScript'),

  toast: document.getElementById('toastNotification')
};

// =====================================================================
// GERENCIADOR DE HISTÓRICO E CONTINUAR ASSISTINDO (LOCAL + BACKEND RESILIENTE)
// =====================================================================
const WatchHistory = {
  STORAGE_KEY: 'kcine_watch_history_v1',
  activeTracking: null,
  lastSaveTime: 0,

  getAll() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      console.warn('Erro ao ler WatchHistory do localStorage:', e);
      return [];
    }
  },

  get(contentId) {
    if (!contentId) return null;
    const all = this.getAll();
    return all.find(item => item.content_id === contentId) || null;
  },

  save(entry) {
    if (!entry || !entry.content_id) return;
    const all = this.getAll();
    const idx = all.findIndex(item => item.content_id === entry.content_id);
    const updatedEntry = {
      ...entry,
      updated_at: new Date().toISOString()
    };
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...updatedEntry };
    } else {
      all.unshift(updatedEntry);
    }
    // Mantém até 50 títulos recentes
    const trimmed = all.slice(0, 50);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Erro ao salvar WatchHistory:', e);
    }

    // Sincroniza em segundo plano com o backend (se disponível)
    this.syncToBackend(updatedEntry);

    // Atualiza o carrossel na Home se existir
    renderContinueWatching();
  },

  remove(contentId) {
    if (!contentId) return;
    const all = this.getAll().filter(item => item.content_id !== contentId);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
    } catch (e) {}

    fetch('/api/animes/watch-progress/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'default_user', content_id: contentId })
    }).catch(() => {});

    renderContinueWatching();
    if (state.activeType === 'historico') {
      loadHistoryView();
    }
    showToast('Removido do histórico.');
  },

  clearAll() {
    if (!confirm('Deseja realmente limpar todo o seu histórico de exibição?')) return;
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {}

    fetch('/api/animes/watch-progress/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'default_user', content_id: '__all__' })
    }).catch(() => {});

    renderContinueWatching();
    if (state.activeType === 'historico') {
      loadHistoryView();
    }
    showToast('Histórico limpo com sucesso.');
  },

  startTracking(info) {
    this.activeTracking = { ...info };
    this.lastSaveTime = 0;
  },

  updateProgress(currentTime, duration) {
    if (!this.activeTracking || !duration || isNaN(duration) || duration <= 0) return;
    const now = Date.now();
    // Salva a cada 4 segundos no player ativo
    if (now - this.lastSaveTime < 4000) return;
    this.lastSaveTime = now;

    const percent = Math.min(100, Math.max(0, Math.round((currentTime / duration) * 100)));
    const entry = {
      ...this.activeTracking,
      position_seconds: Math.floor(currentTime),
      duration_seconds: Math.floor(duration),
      progress_percent: percent
    };
    this.save(entry);
  },

  flushCurrent() {
    if (!this.activeTracking || !dom.htmlVideoPlayer) return;
    const video = dom.htmlVideoPlayer;
    if (video.currentTime > 3 && video.duration > 0) {
      const percent = Math.min(100, Math.max(0, Math.round((video.currentTime / video.duration) * 100)));
      this.save({
        ...this.activeTracking,
        position_seconds: Math.floor(video.currentTime),
        duration_seconds: Math.floor(video.duration),
        progress_percent: percent
      });
    }
    this.activeTracking = null;
  },

  async syncToBackend(entry) {
    try {
      await fetch('/api/animes/watch-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'default_user',
          content_type: entry.content_type || 'anime',
          content_id: entry.content_id,
          content_title: entry.title || '',
          episode_id: entry.episode_id || '',
          season_number: entry.season_number || 1,
          episode_number: entry.episode_number || 1,
          position_seconds: entry.position_seconds || 0,
          duration_seconds: entry.duration_seconds || 0,
          poster: entry.poster || '',
          stream_url: entry.stream_url || ''
        })
      });
    } catch (e) {
      // Offline ou Vercel read-only: localStorage cuida perfeitamente
    }
  }
};

function renderContinueWatching() {
  if (!dom.continueWatchingSection || !dom.continueGrid) return;
  const history = WatchHistory.getAll();

  if (!history || !history.length) {
    dom.continueWatchingSection.style.display = 'none';
    return;
  }

  dom.continueWatchingSection.style.display = 'block';
  dom.continueGrid.innerHTML = '';

  history.forEach(item => {
    const card = document.createElement('div');
    card.className = 'continue-card';

    const poster = item.poster || FALLBACK_POSTER;
    const percent = Math.min(100, Math.max(1, item.progress_percent || 0));
    const posMin = Math.floor(item.position_seconds / 60);
    const durMin = Math.floor(item.duration_seconds / 60);
    const timeLabel = (durMin > 0) ? `${posMin}m de ${durMin}m` : `${posMin}m assistidos`;

    let epTag = 'Filme';
    if (item.content_type === 'anime' || item.episode_number) {
      const s = String(item.season_number || 1).padStart(2, '0');
      const e = String(item.episode_number || 1).padStart(2, '0');
      epTag = `T${s} • EP ${e}`;
    }

    card.innerHTML = `
      <div class="continue-poster-wrap">
        <img src="${poster}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='${FALLBACK_POSTER}'">
        <button class="continue-remove-btn" title="Remover do Histórico" data-id="${escapeHtml(item.content_id)}">&times;</button>
        <div class="continue-play-overlay">
          <div class="continue-play-circle">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
        </div>
        <div class="continue-progress-bar-bg">
          <div class="continue-progress-bar-fill" style="width: ${percent}%;"></div>
        </div>
      </div>
      <div class="continue-card-body">
        <span class="continue-ep-tag">${epTag}</span>
        <h4 class="continue-card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h4>
        <div class="continue-card-time">
          <span>${timeLabel}</span>
          <span class="continue-percent">${percent}%</span>
        </div>
      </div>
    `;

    // Clique no botão remover não dispara a reprodução
    const removeBtn = card.querySelector('.continue-remove-btn');
    if (removeBtn) {
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        WatchHistory.remove(item.content_id);
      };
    }

    // Clique no card retoma o vídeo exatamente no segundo salvo!
    card.onclick = () => {
      resumeFromHistory(item);
    };

    dom.continueGrid.appendChild(card);
  });
}

function resumeFromHistory(item) {
  if (item.content_type === 'anime' && item.anime_id) {
    openAnimeModal({ id: item.anime_id, t: item.title, p: item.poster }, item.season_number, item.episode_number, item.position_seconds);
  } else {
    openPlayer(item.title, item.category || 'Continuar Assistindo', item.stream_url, item, item.position_seconds);
  }
}

function loadHistoryView() {
  state.activeCategoryId = 'historico';
  dom.currentViewTitle.textContent = '🕒 Histórico de Reprodução';
  dom.activeCategoryTitle.textContent = 'Histórico: Títulos Assistidos';
  if (dom.loadMoreContainer) dom.loadMoreContainer.style.display = 'none';
  if (dom.catalogPaginationContainer) dom.catalogPaginationContainer.style.display = 'none';

  const history = WatchHistory.getAll();
  dom.cardsGrid.innerHTML = '';

  if (!history.length) {
    dom.cardsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
        <h3 style="font-size: 1.25rem; margin-bottom: 8px; color: #fff;">Nenhum título no seu histórico</h3>
        <p style="color: #64748b; font-size: 0.95rem;">Assista animes, filmes ou séries para acompanhar o progresso de onde parou!</p>
      </div>
    `;
    dom.itemsFoundText.textContent = '0 títulos no histórico';
    return;
  }

  dom.itemsFoundText.textContent = `${history.length} título(s) no seu histórico de reprodução`;

  const fragment = document.createDocumentFragment();
  history.forEach((item, idx) => {
    const cardItem = {
      id: item.content_id,
      t: item.title,
      p: item.poster,
      catNome: item.category || (item.content_type === 'anime' ? '🌸 Animes' : 'Filmes & Séries'),
      u: item.stream_url,
      is_anime: item.content_type === 'anime',
      isHistory: true,
      historyItem: item
    };
    const card = createVideoCard(cardItem, idx);
    fragment.appendChild(card);
  });
  dom.cardsGrid.appendChild(fragment);
}

// Fallback de imagem de poster
const FALLBACK_POSTER = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60";

// =====================================================================
// INICIALIZAÇÃO
// =====================================================================
document.addEventListener('DOMContentLoaded', async () => {
  disableZoomGestures();
  setupEventListeners();
  setupModalScrollLocks();
  initSupabaseTab();

  // 1. Verificar Sessão de Autenticação do Usuário
  const isAuthenticated = await checkAuthSession();

  // 2. Inicializar Módulos Modernos do K-CINE se autenticado
  if (isAuthenticated) {
    ProfilesManager.init();
    NotificationsManager.init();
    await loadManifesto();
    renderContinueWatching();
    if (state.activeType === 'todos') {
      HomeShelvesManager.render();
    }
  }
});

// =====================================================================
// BLOQUEIO DE ZOOM (PINÇA TOUCH, DUPLO TOQUE, CTRL+WHEEL E ATALHOS)
// =====================================================================
function disableZoomGestures() {
  // 1. Bloqueia zoom por gesto de pinça no iOS / Safari
  document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturechange', (e) => {
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('gestureend', (e) => {
    e.preventDefault();
  }, { passive: false });

  // 2. Bloqueia duplo toque para dar zoom em telas touch
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });

  // 3. Bloqueia zoom por rolagem com tecla Ctrl pressionada (Ctrl + Scroll)
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, { passive: false });

  // 4. Bloqueia atalhos de zoom do teclado (Ctrl + Mais, Ctrl + Menos, Ctrl + Zero)
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '_' || e.key === '0')) {
      e.preventDefault();
    }
  });
}

// =====================================================================
// CONTROLE DE MODAIS (TRAVA TOTAL DO FUNDO / BACKGROUND FREEZE)
// =====================================================================
function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add('active');
  document.body.classList.add('modal-open');
}

function closeModal(modalEl) {
  if (!modalEl) return;
  if (modalEl === dom.playerModal || modalEl.id === 'playerModal') {
    stopVideoPlayback();
  }
  modalEl.classList.remove('active');
  const anyActive = document.querySelector('.modal-overlay.active');
  if (!anyActive && (!dom.loginScreen || dom.loginScreen.style.display !== 'flex')) {
    document.body.classList.remove('modal-open');
  }
}

function closeAllModals() {
  closePlayerModal();
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  if (!dom.loginScreen || dom.loginScreen.style.display !== 'flex') {
    document.body.classList.remove('modal-open');
  }
}

function setupModalScrollLocks() {
  // Garante que o scroll do mouse ou toque no fundo escuro não role o documento principal
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('wheel', (e) => {
      if (modal.classList.contains('active') && e.target === modal) {
        e.preventDefault();
      }
    }, { passive: false });

    modal.addEventListener('touchmove', (e) => {
      if (modal.classList.contains('active') && e.target === modal) {
        e.preventDefault();
      }
    }, { passive: false });
  });
}

// =====================================================================
// AUTENTICAÇÃO E TELA DE ENTRADA
// =====================================================================
async function checkAuthSession() {
  const check = await AuthManager.verifyCurrentSession();
  if (check && check.valid && check.user) {
    state.currentUser = check.user;
    applyUserRole(state.currentUser);
    hideLoginScreen();
    return true;
  } else {
    state.currentUser = null;
    const msg = check && check.blocked
      ? 'Seu acesso foi bloqueado pelo administrador. Entre em contato para regularizar seu plano.'
      : null;
    showLoginScreen(msg);
    return false;
  }
}

function showLoginScreen(alertMsg = null) {
  const portalMainApp = document.getElementById('portalMainApp');
  if (portalMainApp) {
    portalMainApp.style.display = 'none';
  }
  if (dom.loginScreen) {
    dom.loginScreen.style.display = 'flex';
  }
  document.body.classList.add('login-active');
  document.body.classList.add('modal-open');

  if (alertMsg) {
    dom.loginAlertMessage.textContent = alertMsg;
    dom.loginAlertBox.style.display = 'flex';
  } else {
    dom.loginAlertBox.style.display = 'none';
  }
}

function hideLoginScreen() {
  if (dom.loginScreen) {
    dom.loginScreen.style.display = 'none';
  }
  const portalMainApp = document.getElementById('portalMainApp');
  if (portalMainApp) {
    portalMainApp.style.display = 'block';
  }
  document.body.classList.remove('login-active');
  const anyModal = document.querySelector('.modal-overlay.active');
  if (!anyModal) {
    document.body.classList.remove('modal-open');
  }
}

function applyUserRole(user) {
  if (!user) return;
  const isClient = user.role === 'cliente';

  document.body.classList.toggle('role-cliente', isClient);
  document.body.classList.toggle('role-admin', !isClient);

  // Ajusta visualização do avatar no topo
  const initial = user.username ? user.username.charAt(0).toUpperCase() : 'U';
  if (dom.navUserInitial) dom.navUserInitial.textContent = initial;
  if (dom.navUserName) dom.navUserName.textContent = user.username;
  if (dom.navUserRole) dom.navUserRole.textContent = isClient ? 'CLIENTE VIP' : 'ADMIN';

  if (dom.userProfileBtn) {
    if (isClient) {
      dom.userProfileBtn.title = `Perfil do Cliente: ${user.username}`;
    } else {
      dom.userProfileBtn.title = 'Painel da Conta Admin - Kaynã';
    }
  }

  // Previne cópia, clique direito e inspeção para clientes
  if (isClient) {
    document.addEventListener('contextmenu', blockClientAction);
    document.addEventListener('copy', blockClientAction);
    document.addEventListener('cut', blockClientAction);
    document.addEventListener('dragstart', blockClientAction);
    document.addEventListener('keydown', handleSecurityKeys);
  } else {
    document.removeEventListener('contextmenu', blockClientAction);
    document.removeEventListener('copy', blockClientAction);
    document.removeEventListener('cut', blockClientAction);
    document.removeEventListener('dragstart', blockClientAction);
    document.removeEventListener('keydown', handleSecurityKeys);
  }
}

function blockClientAction(e) {
  if (!state.currentUser || state.currentUser.role === 'cliente') {
    e.preventDefault();
    return false;
  }
}

function handleSecurityKeys(e) {
  if (!state.currentUser || state.currentUser.role === 'cliente') {
    // Bloqueia F12, Ctrl+Shift+I/J/C, Ctrl+U (Ver Código Fonte) e Ctrl+S (Salvar Página)
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
      (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 's' || e.key === 'S'))
    ) {
      e.preventDefault();
      return false;
    }
  }
}

function handleLogout() {
  stopVideoPlayback();
  AuthManager.logout();
  state.currentUser = null;
  document.body.classList.remove('role-cliente', 'role-admin');
  closeAllModals();
  showLoginScreen();
  showToast('Você saiu da sua conta.');
}

// =====================================================================
// CONFIGURAÇÃO GERAL DE EVENTOS
// =====================================================================
function setupEventListeners() {
  // 1. Formulário de Login
  if (dom.loginForm) {
    dom.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = dom.loginUsername.value.trim();
      const pass = dom.loginPassword.value.trim();

      dom.btnLoginSubmit.disabled = true;
      dom.btnLoginText.textContent = 'Verificando acesso...';

      const result = await AuthManager.login(user, pass);

      dom.btnLoginSubmit.disabled = false;
      dom.btnLoginText.textContent = 'Entrar no Catálogo';

      if (result.success && result.user) {
        state.currentUser = result.user;
        applyUserRole(state.currentUser);
        hideLoginScreen();
        dom.loginForm.reset();
        showToast(`Bem-vindo, ${result.user.username}!`);

        // Carrega o catálogo caso ainda não tenha sido carregado
        if (!state.manifesto) {
          await loadManifesto();
        } else if (state.rawItems && state.rawItems.length) {
          refreshCatalogDisplay();
        } else if (state.currentItems && state.currentItems.length) {
          state.displayedCount = 0;
          dom.cardsGrid.innerHTML = '';
          renderNextBatch();
        }
      } else {
        dom.loginAlertMessage.textContent = result.message || 'Erro ao realizar login.';
        dom.loginAlertBox.style.display = 'flex';
      }
    });
  }

  // Toggle Eye da senha de login
  if (dom.btnToggleLoginEye) {
    dom.btnToggleLoginEye.addEventListener('click', () => {
      const type = dom.loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
      dom.loginPassword.setAttribute('type', type);
    });
  }

  // Botão Sair no cabeçalho
  if (dom.btnLogoutHeader) {
    dom.btnLogoutHeader.addEventListener('click', handleLogout);
  }

  // Filtros de Tipo (Todos / Filmes / Séries / Animes / Minha Lista / Histórico)
  dom.btnTypeTodos?.addEventListener('click', () => switchType('todos'));
  dom.btnTypeFilmes?.addEventListener('click', () => switchType('filmes'));
  dom.btnTypeSeries?.addEventListener('click', () => switchType('series'));
  dom.btnTypeAnimes?.addEventListener('click', () => switchType('animes'));
  dom.btnTypeMinhaLista?.addEventListener('click', () => switchType('minha-lista'));
  dom.btnTypeHistorico?.addEventListener('click', () => switchType('historico'));

  // Barra de Navegação Inferior Mobile (PWA & Mobile-First)
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const type = btn.getAttribute('data-type');
      if (type) switchType(type);
    });
  });

  // Modernização - Dropdown de Notificações
  if (dom.btnNotifications) {
    dom.btnNotifications.addEventListener('click', (e) => {
      e.stopPropagation();
      NotificationsManager.toggleDropdown();
    });
  }
  if (dom.btnMarkAllRead) {
    dom.btnMarkAllRead.addEventListener('click', (e) => {
      e.stopPropagation();
      NotificationsManager.markAllAsRead();
    });
  }

  // Modernização - Dropdown de Perfis e Troca de Perfil
  if (dom.userProfileBtn) {
    dom.userProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dom.profileDropdownMenu) {
        const isShown = dom.profileDropdownMenu.style.display === 'block';
        dom.profileDropdownMenu.style.display = isShown ? 'none' : 'block';
      }
    });
  }
  if (dom.btnSwitchProfile) {
    dom.btnSwitchProfile.addEventListener('click', () => {
      if (dom.profileDropdownMenu) dom.profileDropdownMenu.style.display = 'none';
      ProfilesManager.openModal();
    });
  }
  if (dom.btnAdminPanelFromMenu) {
    dom.btnAdminPanelFromMenu.addEventListener('click', () => {
      if (dom.profileDropdownMenu) dom.profileDropdownMenu.style.display = 'none';
      if (typeof openAdminModal === 'function') openAdminModal();
    });
  }
  if (dom.btnLogoutDropdown) {
    dom.btnLogoutDropdown.addEventListener('click', handleLogout);
  }
  if (dom.btnCloseProfilesModal) {
    dom.btnCloseProfilesModal.addEventListener('click', () => ProfilesManager.closeModal());
  }

  // Fechar dropdowns ao clicar fora
  document.addEventListener('click', (e) => {
    if (dom.profileDropdownMenu && !dom.profileDropdownMenu.contains(e.target) && !dom.userProfileBtn?.contains(e.target)) {
      dom.profileDropdownMenu.style.display = 'none';
    }
    if (dom.notificationsDropdown && !dom.notificationsDropdown.contains(e.target) && !dom.btnNotifications?.contains(e.target)) {
      dom.notificationsDropdown.style.display = 'none';
    }
    if (dom.searchSuggestionsDropdown && !dom.searchSuggestionsDropdown.contains(e.target) && e.target !== dom.searchInput) {
      dom.searchSuggestionsDropdown.style.display = 'none';
    }
  });

  // Modernização - Botões do Hero Banner (Minha Lista & Mais Informações)
  if (dom.btnHeroMyList) {
    dom.btnHeroMyList.addEventListener('click', () => {
      if (state.heroItem) {
        MyListManager.toggle(state.heroItem);
      }
    });
  }
  if (dom.btnHeroMoreInfo) {
    dom.btnHeroMoreInfo.addEventListener('click', () => {
      if (state.heroItem) {
        openContentDetailsModal(state.heroItem);
      }
    });
  }

  // Modernização - Modal Compacto de Detalhes Cinematográfico
  if (dom.btnCloseDetailsModal) {
    dom.btnCloseDetailsModal.addEventListener('click', closeContentDetailsModal);
  }
  if (dom.contentDetailsModal) {
    dom.contentDetailsModal.addEventListener('click', (e) => {
      if (e.target === dom.contentDetailsModal) closeContentDetailsModal();
    });
  }
  if (dom.btnDetailsPlay) {
    dom.btnDetailsPlay.addEventListener('click', () => {
      if (state.currentDetailsItem) {
        const it = state.currentDetailsItem;
        closeContentDetailsModal();
        if (it.is_anime || (it.id && String(it.id).startsWith('ani_'))) {
          openAnimeModal(it);
        } else if (it.isGroup) {
          openSeriesModal(it);
        } else {
          openPlayer(it.t || it.canonical_title, it.catNome || 'Filmes', it.u, it);
        }
      }
    });
  }
  if (dom.btnDetailsEpisodes) {
    dom.btnDetailsEpisodes.addEventListener('click', () => {
      if (state.currentDetailsItem) {
        const it = state.currentDetailsItem;
        closeContentDetailsModal();
        if (it.is_anime || (it.id && String(it.id).startsWith('ani_'))) {
          openAnimeModal(it);
        } else {
          openSeriesModal(it);
        }
      }
    });
  }
  if (dom.btnDetailsMyList) {
    dom.btnDetailsMyList.addEventListener('click', () => {
      if (state.currentDetailsItem) {
        MyListManager.toggle(state.currentDetailsItem);
      }
    });
  }
  if (dom.btnDetailsCopyLink) {
    dom.btnDetailsCopyLink.addEventListener('click', () => {
      if (state.currentDetailsItem && state.currentDetailsItem.u) {
        copyToClipboard(state.currentDetailsItem.u);
      }
    });
  }

  // Fechar Modal de Detalhes com a tecla Escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (dom.contentDetailsModal && dom.contentDetailsModal.classList.contains('active')) {
        closeContentDetailsModal();
      }
    }
  });

  // Modernização - Controles Inteligentes do Player
  setupPlayerModernEnhancements();

  // Modernização - Sugestões Instantâneas na Busca
  setupLiveSearchSuggestions();

  // Botão Limpar Histórico na Home
  dom.btnClearContinueHistory?.addEventListener('click', () => WatchHistory.clearAll());

  // Rastreamento Contínuo de Reprodução de Vídeo (Auto-Save a cada 4s)
  if (dom.htmlVideoPlayer) {
    dom.htmlVideoPlayer.addEventListener('timeupdate', () => {
      WatchHistory.updateProgress(dom.htmlVideoPlayer.currentTime, dom.htmlVideoPlayer.duration);
    });
    dom.htmlVideoPlayer.addEventListener('pause', () => {
      WatchHistory.flushCurrent();
    });
    dom.htmlVideoPlayer.addEventListener('ended', () => {
      WatchHistory.flushCurrent();
    });
  }

  // Alternadores de Áudio para Animes (Dublado / Legendado)
  const handleAudioSwitch = (audio) => {
    state.activeAnimeAudio = audio;
    [dom.btnAudioLeg, dom.btnModalAudioLeg].forEach(b => b?.classList.toggle('active', audio === 'legendado'));
    [dom.btnAudioDub, dom.btnModalAudioDub].forEach(b => b?.classList.toggle('active', audio === 'dublado'));

    if (state.activeAnimeContext) {
      const { currentEpisode, details } = state.activeAnimeContext;
      if (currentEpisode && details) {
        const savedProgress = dom.htmlVideoPlayer ? dom.htmlVideoPlayer.currentTime : 0;
        playAnimeEpisode(currentEpisode, details, audio, state.activeAnimeProvider, state.activeAnimeQuality, savedProgress);
      }
    }
  };

  dom.btnAudioLeg?.addEventListener('click', () => handleAudioSwitch('legendado'));
  dom.btnAudioDub?.addEventListener('click', () => handleAudioSwitch('dublado'));
  dom.btnModalAudioLeg?.addEventListener('click', () => handleAudioSwitch('legendado'));
  dom.btnModalAudioDub?.addEventListener('click', () => handleAudioSwitch('dublado'));

  // Botões de Favoritos
  const handleFavoriteToggle = async () => {
    const ctx = state.activeAnimeContext;
    if (!ctx || !ctx.details) return;
    const animeId = ctx.details.id;
    const username = state.currentUser ? state.currentUser.username : 'Kaynã';

    try {
      const resp = await fetch('/api/animes/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: username,
          content_id: animeId,
          title: ctx.details.canonical_title,
          poster: ctx.details.poster
        })
      });
      const data = await resp.json();
      if (data.success) {
        if (data.is_favorite) {
          state.userFavorites.add(animeId);
          showToast(`"${ctx.details.canonical_title}" adicionado aos favoritos! ⭐`);
        } else {
          state.userFavorites.delete(animeId);
          showToast(`Removido dos favoritos.`);
        }
        updateFavoriteButtons(animeId);
      }
    } catch (e) {
      console.error('Erro ao alternar favorito:', e);
    }
  };

  dom.btnPlayerFavorite?.addEventListener('click', handleFavoriteToggle);
  dom.btnSeriesModalFavorite?.addEventListener('click', handleFavoriteToggle);

  // Busca Inteligente com debounce ultra-rápido de 120ms e execução instantânea no Enter
  dom.searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    dom.clearSearchBtn.style.display = val ? 'block' : 'none';
    clearTimeout(state.searchTimeout);
    state.searchTimeout = setTimeout(() => handleSearch(val), 120);
  });

  dom.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(state.searchTimeout);
      const val = dom.searchInput.value.trim();
      handleSearch(val);
    }
  });

  dom.clearSearchBtn.addEventListener('click', () => {
    dom.searchInput.value = '';
    dom.clearSearchBtn.style.display = 'none';
    clearTimeout(state.searchTimeout);
    handleSearch('');
  });

  // Tecla '/' para focar na busca e ESC para fechar modais
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== dom.searchInput && (!dom.loginScreen || dom.loginScreen.style.display !== 'flex')) {
      e.preventDefault();
      dom.searchInput.focus();
    }
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });

  // Botão Carregar Mais
  dom.btnLoadMore.addEventListener('click', () => {
    if (state.activeType === 'animes' || state.activeCategoryId === 'animes') {
      loadAnimesPage(state.animePagination.page + 1, true, state.animePagination.searchQuery, state.animePagination.genre, state.animePagination.sort);
    } else {
      renderNextBatch();
    }
  });

  // Filtro Dropdown de Categoria
  if (dom.categorySelect) {
    dom.categorySelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'destaques') {
        loadDestaques();
      } else {
        const opt = e.target.selectedOptions[0];
        const label = opt ? opt.getAttribute('data-nome') || opt.text : val;
        selectCategory(val, label);
      }
    });
  }

  // Filtro de Ordenação A-Z
  if (dom.sortSelect) {
    dom.sortSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (state.activeType === 'animes' || state.activeCategoryId === 'animes') {
        const sortMap = { 'az': 'title_asc', 'za': 'title_desc', 'padrao': 'latest' };
        const mappedSort = sortMap[val] || 'latest';
        loadAnimesPage(1, state.animePagination.searchQuery, state.animePagination.genre, mappedSort);
      } else {
        applySorting(val);
      }
    });
  }

  // Alternador de Visualização de Séries (Todos os Capítulos vs Agrupar por Série)
  if (dom.btnViewAll) {
    dom.btnViewAll.addEventListener('click', () => setSeriesViewMode('all'));
  }
  if (dom.btnViewGrouped) {
    dom.btnViewGrouped.addEventListener('click', () => setSeriesViewMode('grouped'));
  }

  // Player Modal & Navegação de Capítulos
  dom.btnClosePlayer.addEventListener('click', closePlayerModal);
  dom.btnModalDismiss.addEventListener('click', closePlayerModal);
  if (dom.btnPrevEp) {
    dom.btnPrevEp.addEventListener('click', playPreviousEpisode);
  }
  if (dom.btnNextEp) {
    dom.btnNextEp.addEventListener('click', playNextEpisode);
  }
  if (dom.btnCopyModalUrl) {
    dom.btnCopyModalUrl.addEventListener('click', () => {
      if (state.currentUser && state.currentUser.role === 'admin') {
        copyToClipboard(dom.streamUrlDisplay.value);
      }
    });
  }

  // Modal de Série
  if (dom.btnCloseSeriesModal) {
    dom.btnCloseSeriesModal.addEventListener('click', () => closeModal(dom.seriesModal));
  }

  // Export Modal
  if (dom.btnOpenExport && dom.exportModal) {
    dom.btnOpenExport.addEventListener('click', () => {
      if (state.currentUser && state.currentUser.role === 'admin') {
        openModal(dom.exportModal);
      }
    });
    dom.btnCloseExport.addEventListener('click', () => closeModal(dom.exportModal));
  }

  // Guide Modal
  if (dom.btnOpenGuide && dom.guideModal) {
    dom.btnOpenGuide.addEventListener('click', () => openModal(dom.guideModal));
    dom.btnCloseGuide.addEventListener('click', () => closeModal(dom.guideModal));
  }

  // Admin Profile Modal - Apenas para Administrador
  if (dom.userProfileBtn && dom.adminModal) {
    dom.userProfileBtn.addEventListener('click', () => {
      if (state.currentUser && state.currentUser.role === 'admin') {
        openModal(dom.adminModal);
        renderClientsList();
      }
    });
  }
  if (dom.btnCloseAdmin && dom.adminModal) {
    dom.btnCloseAdmin.addEventListener('click', () => {
      closeModal(dom.adminModal);
      if (adminSyncPollInterval) {
        clearInterval(adminSyncPollInterval);
        adminSyncPollInterval = null;
      }
    });
  }

  // Abas do Painel Admin
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabId = e.currentTarget.getAttribute('data-tab');
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const targetContent = document.getElementById(`tab-${tabId}`);
      if (targetContent) targetContent.classList.add('active');

      if (tabId === 'central-clientes') {
        renderClientsList();
      }
      if (tabId === 'links-invalidos') {
        renderQuarantineList();
      }
      if (tabId === 'sincronizacao-animes') {
        renderAdminSyncStatus();
        if (!adminSyncPollInterval) {
          adminSyncPollInterval = setInterval(renderAdminSyncStatus, 2500);
        }
      } else if (adminSyncPollInterval) {
        clearInterval(adminSyncPollInterval);
        adminSyncPollInterval = null;
      }
    });
  });

  // Filtro e Recarregamento da Quarentena de Links Inválidos
  document.getElementById('filterQuarantineInput')?.addEventListener('input', filterAndRenderQuarantine);
  document.getElementById('btnReloadQuarantine')?.addEventListener('click', renderQuarantineList);

  // Cadastro de Novo Título pelo Admin
  if (dom.formAddMovie) {
    dom.formAddMovie.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = dom.newTitle.value.trim();
      const catVal = dom.newCategory.value;
      const catName = dom.newCategory.selectedOptions[0] ? dom.newCategory.selectedOptions[0].text : 'Geral';
      const url = dom.newStreamUrl.value.trim();
      const poster = dom.newPosterUrl.value.trim() || FALLBACK_POSTER;

      const newItem = {
        t: title,
        catNome: catName,
        p: poster,
        u: url
      };

      state.currentItems.unshift(newItem);
      const newCard = createVideoCard(newItem, 0);
      dom.cardsGrid.prepend(newCard);
      closeModal(dom.adminModal);
      dom.formAddMovie.reset();
      showToast(`Título "${title}" cadastrado com sucesso!`);
    });
  }

  // =====================================================================
  // EVENTOS DA CENTRAL DE CLIENTES
  // =====================================================================
  if (dom.formCreateClient) {
    dom.formCreateClient.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = dom.clientNewUser.value.trim();
      const password = dom.clientNewPass.value.trim();
      const notes = dom.clientNewNotes.value.trim();

      const btnSubmit = document.getElementById('btnSubmitClient');
      if (btnSubmit) btnSubmit.disabled = true;

      const res = await AuthManager.createClient(username, password, notes);

      if (btnSubmit) btnSubmit.disabled = false;

      if (res.success) {
        showToast(`Login de cliente "${username}" criado com sucesso!`);
        dom.formCreateClient.reset();
        renderClientsList();
      } else {
        alert(res.message);
      }
    });
  }

  if (dom.btnGenPassword) {
    dom.btnGenPassword.addEventListener('click', () => {
      // Gera senha aleatória amigável de 6 caracteres
      const chars = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
      let pass = '';
      for (let i = 0; i < 6; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      dom.clientNewPass.value = pass;
    });
  }

  if (dom.filterClientsInput) {
    dom.filterClientsInput.addEventListener('input', () => {
      renderClientsList();
    });
  }

  // Fechar Modais ao clicar no Backdrop escuro
  [dom.playerModal, dom.exportModal, dom.guideModal, dom.adminModal, dom.seriesModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeAllModals();
        }
      });
    }
  });

  // Fechar vídeo se a aba/janela for fechada ou ocultada
  window.addEventListener('beforeunload', stopVideoPlayback);
  window.addEventListener('pagehide', stopVideoPlayback);

  // Fechar modais e áudio ao pressionar tecla ESC
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      closeAllModals();
    }
  });

  // Configurar atalho e instalação do aplicativo
  setupInstallAppListeners();
}

// =====================================================================
// ATALHO E INSTALAÇÃO DO APLICATIVO (PWA / DESKTOP SHORTCUT / MOBILE)
// =====================================================================
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const pwaBtn = document.getElementById('btnModalPwaInstall');
  if (pwaBtn) {
    pwaBtn.style.display = 'inline-flex';
  }
});

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=6').then((reg) => {
      reg.update().catch(() => {});
    }).catch((err) => {
      console.log('SW Registration Note:', err);
    });
  });
}

async function downloadDirectApp() {
  showToast('Iniciando instalação / download do aplicativo K-Cine...');

  // 1. Se o navegador suporta instalação PWA nativa direta (Chrome / Edge / Android / Brave)
  if (deferredInstallPrompt) {
    try {
      deferredInstallPrompt.prompt();
      const choiceResult = await deferredInstallPrompt.userChoice;
      if (choiceResult && choiceResult.outcome === 'accepted') {
        showToast('Aplicativo K-Cine instalado com sucesso!');
        deferredInstallPrompt = null;
        return;
      }
    } catch (e) {
      console.log('PWA Prompt:', e);
    }
  }

  // 2. Dispara o download direto do atalho oficial do aplicativo para Área de Trabalho / PC
  downloadWindowsShortcut();
}

function downloadWindowsShortcut() {
  const currentUrl = window.location.origin + window.location.pathname;
  const iconUrl = window.location.origin + '/favicon.ico';
  const shortcutContent = `[InternetShortcut]\r\nURL=${currentUrl}\r\nIconIndex=0\r\nIconFile=${iconUrl}\r\nHotKey=0\r\n`;
  const blob = new Blob([shortcutContent], { type: 'application/internet-shortcut' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = 'K-CINE.url';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
  showToast('Download concluído! Atalho K-CINE baixado.');
}

function setupInstallAppListeners() {
  const btnDownloadApp = document.getElementById('btnDownloadApp');
  if (btnDownloadApp) {
    btnDownloadApp.addEventListener('click', downloadDirectApp);
  }
}

// =====================================================================
// GESTÃO DA CENTRAL DE CLIENTES (ADMIN)
// =====================================================================
async function renderClientsList() {
  if (!dom.clientsListContainer) return;
  dom.clientsListContainer.innerHTML = '<div class="clients-loading">Carregando lista de clientes...</div>';

  const clients = await AuthManager.listClients();
  updateClientsStats(clients);

  const query = (dom.filterClientsInput ? dom.filterClientsInput.value : '').trim().toLowerCase();
  const filtered = query
    ? clients.filter(c => c.username.toLowerCase().includes(query) || (c.notes && c.notes.toLowerCase().includes(query)))
    : clients;

  if (!filtered.length) {
    dom.clientsListContainer.innerHTML = `
      <div style="text-align: center; padding: 24px; color: #64748b; font-size: 0.85rem;">
        Nenhum cliente encontrado.
      </div>
    `;
    return;
  }

  dom.clientsListContainer.innerHTML = '';
  filtered.forEach(client => {
    const isBlocked = client.status === 'bloqueado';
    const isAdmin = client.role === 'admin';
    const initial = client.username ? client.username.charAt(0).toUpperCase() : 'C';

    const row = document.createElement('div');
    row.className = `client-item-row ${isBlocked ? 'is-blocked' : ''}`;

    row.innerHTML = `
      <div class="client-info-col">
        <div class="client-mini-avatar ${isAdmin ? 'admin-avatar-bg' : ''}">${initial}</div>
        <div class="client-details">
          <span class="client-name-title">
            ${escapeHtml(client.username)}
            ${isAdmin ? '<span class="badge-client-status" style="background: rgba(99,102,241,0.2); color:#818cf8;">ADMIN</span>' : ''}
          </span>
          <span class="client-notes-text">${escapeHtml(client.notes || 'Sem observações')}</span>
        </div>
      </div>

      <div class="client-cred-col" title="Senha de acesso do cliente">
        <span style="color: #94a3b8;">Senha:</span>
        <strong id="pwDisplay-${client.id}">${escapeHtml(client.password)}</strong>
      </div>

      <div>
        <span class="badge-client-status ${client.status}">
          ${client.status === 'ativo' ? '● ATIVO' : '✕ BLOQUEADO'}
        </span>
      </div>

      <div class="client-actions-col">
        ${!isAdmin ? `
          <button class="btn-client-action ${isBlocked ? 'btn-unblock' : 'btn-block'}" data-action="toggle-block" data-id="${client.id}">
            ${isBlocked ? '✓ Desbloquear' : '✕ Bloquear'}
          </button>
        ` : ''}
        <button class="btn-client-action btn-pw" data-action="edit-pw" data-id="${client.id}" data-user="${escapeHtml(client.username)}">
          🔑 Alterar Senha
        </button>
        ${!isAdmin ? `
          <button class="btn-client-action btn-delete" data-action="delete" data-id="${client.id}" data-user="${escapeHtml(client.username)}" title="Excluir Cliente">
            🗑️
          </button>
        ` : ''}
      </div>
    `;

    // Evento de Bloquear / Desbloquear instantâneo
    const btnToggle = row.querySelector('[data-action="toggle-block"]');
    if (btnToggle) {
      btnToggle.onclick = async () => {
        const res = await AuthManager.toggleBlockClient(client.id);
        if (res.success) {
          const actionText = res.newStatus === 'ativo' ? 'DESBLOQUEADO' : 'BLOQUEADO';
          showToast(`Cliente "${client.username}" agora está ${actionText}!`);
          renderClientsList();
        } else {
          showToast(res.message);
        }
      };
    }

    // Evento de Alterar Senha
    const btnPw = row.querySelector('[data-action="edit-pw"]');
    if (btnPw) {
      btnPw.onclick = async () => {
        const newPass = prompt(`Digite a nova senha para o cliente "${client.username}":`, client.password);
        if (newPass !== null && newPass.trim() !== '') {
          const res = await AuthManager.updateClientPassword(client.id, newPass.trim());
          if (res.success) {
            showToast(`Senha de "${client.username}" alterada com sucesso!`);
            renderClientsList();
          } else {
            showToast(res.message);
          }
        }
      };
    }

    // Evento de Excluir
    const btnDel = row.querySelector('[data-action="delete"]');
    if (btnDel) {
      btnDel.onclick = async () => {
        if (confirm(`Tem certeza que deseja excluir o cliente "${client.username}"?`)) {
          const res = await AuthManager.deleteClient(client.id);
          if (res.success) {
            showToast(`Cliente "${client.username}" excluído!`);
            renderClientsList();
          } else {
            showToast(res.message);
          }
        }
      };
    }

    dom.clientsListContainer.appendChild(row);
  });
}

function updateClientsStats(clients) {
  const nonAdmins = clients.filter(c => c.role !== 'admin');
  const total = nonAdmins.length;
  const active = nonAdmins.filter(c => c.status === 'ativo').length;
  const blocked = nonAdmins.filter(c => c.status === 'bloqueado').length;

  if (dom.statTotalClients) dom.statTotalClients.textContent = total;
  if (dom.statActiveClients) dom.statActiveClients.textContent = active;
  if (dom.statBlockedClients) dom.statBlockedClients.textContent = blocked;
  if (dom.clientStorageBadge) {
    const isSupabase = AuthManager.isSupabaseConnected();
    dom.clientStorageBadge.textContent = isSupabase ? 'Supabase Nuvem' : 'Local';
    dom.clientStorageBadge.style.color = isSupabase ? '#3ECF8E' : 'var(--accent-cyan)';
  }
}

// =====================================================================
// ABA SUPABASE & BANCO DE DADOS EM NUVEM
// =====================================================================
function initSupabaseTab() {
  const cfg = AuthManager.getSupabaseConfig();
  if (cfg) {
    if (dom.inputSupabaseUrl) dom.inputSupabaseUrl.value = cfg.url || '';
    if (dom.inputSupabaseKey) dom.inputSupabaseKey.value = cfg.anonKey || '';
    if (dom.btnDisconnectSupabase) dom.btnDisconnectSupabase.style.display = 'inline-block';
  }
  updateSupabasePill();

  if (dom.formSupabaseConfig) {
    dom.formSupabaseConfig.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = dom.inputSupabaseUrl.value.trim();
      const key = dom.inputSupabaseKey.value.trim();

      dom.btnSaveSupabase.disabled = true;
      dom.btnSaveSupabase.innerHTML = '<span>Testando conexão...</span>';

      const test = await AuthManager.testSupabaseConnection(url, key);

      dom.btnSaveSupabase.disabled = false;
      dom.btnSaveSupabase.innerHTML = '<span>⚡ Salvar & Testar Conexão</span>';

      if (test.success) {
        AuthManager.saveSupabaseConfig(url, key);
        updateSupabasePill();
        if (dom.btnDisconnectSupabase) dom.btnDisconnectSupabase.style.display = 'inline-block';
        showToast('Supabase conectado com sucesso!');
        renderClientsList();
      } else {
        alert(test.message);
      }
    });
  }

  if (dom.btnSyncToSupabase) {
    dom.btnSyncToSupabase.addEventListener('click', async () => {
      dom.btnSyncToSupabase.disabled = true;
      dom.btnSyncToSupabase.textContent = 'Sincronizando...';

      const res = await AuthManager.syncLocalToSupabase();

      dom.btnSyncToSupabase.disabled = false;
      dom.btnSyncToSupabase.textContent = '🔄 Sincronizar Clientes Locais com o Supabase';

      showToast(res.message);
      renderClientsList();
    });
  }

  if (dom.btnDisconnectSupabase) {
    dom.btnDisconnectSupabase.addEventListener('click', () => {
      if (confirm('Deseja desconectar do Supabase e retornar ao armazenamento local?')) {
        AuthManager.saveSupabaseConfig('', '');
        dom.inputSupabaseUrl.value = '';
        dom.inputSupabaseKey.value = '';
        dom.btnDisconnectSupabase.style.display = 'none';
        updateSupabasePill();
        showToast('Supabase desconectado. Operando em modo local.');
        renderClientsList();
      }
    });
  }

  if (dom.btnCopySqlScript) {
    dom.btnCopySqlScript.addEventListener('click', () => {
      const sql = `CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cliente',
    status TEXT NOT NULL DEFAULT 'ativo',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura publica de clientes" ON public.clientes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Permitir criacao de clientes" ON public.clientes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Permitir atualizacao de clientes" ON public.clientes FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Permitir exclusao de clientes" ON public.clientes FOR DELETE TO anon, authenticated USING (true);`;
      copyToClipboard(sql);
      showToast('Script SQL copiado com sucesso! Cole no SQL Editor do Supabase.');
    });
  }
}

function updateSupabasePill() {
  if (!dom.supabasePill) return;
  const connected = AuthManager.isSupabaseConnected();
  if (connected) {
    dom.supabasePill.textContent = '● Supabase Conectado (Nuvem)';
    dom.supabasePill.className = 'supabase-status-pill connected';
  } else {
    dom.supabasePill.textContent = 'Modo Local (Offline)';
    dom.supabasePill.className = 'supabase-status-pill';
  }
}

let adminSyncPollInterval = null;

async function renderAdminSyncStatus() {
  try {
    const res = await fetch('/api/animes/sync-status');
    if (!res.ok) return;
    const data = await res.json();
    
    const elStatus = document.getElementById('adminSyncStatus');
    const elPauseReason = document.getElementById('adminSyncPauseReason');
    const elPage = document.getElementById('adminSyncPage');
    const elBatch = document.getElementById('adminSyncBatch');
    const elCounts = document.getElementById('adminSyncCounts');
    const elRemaining = document.getElementById('adminSyncRemaining');
    const elErrors = document.getElementById('adminSyncErrors');
    const elLastError = document.getElementById('adminSyncLastError');
    const btnResume = document.getElementById('btnResumeSync');
    const btnPause = document.getElementById('btnPauseSync');

    if (elStatus) {
      const curStatus = data.status || (data.is_running ? 'RUNNING' : 'IDLE');
      elStatus.textContent = curStatus;
      elStatus.style.color = curStatus === 'RUNNING' ? '#34d399' : (curStatus === 'PAUSED' ? '#f59e0b' : '#a78bfa');
    }
    if (elPauseReason) {
      elPauseReason.textContent = data.pause_reason || (data.is_running ? 'Sincronizando lotes...' : 'Aguardando comando');
    }
    if (elPage) {
      const tot = data.total_pages_estimated ? data.total_pages_estimated : 'Desconhecido';
      elPage.textContent = `Pág. ${data.current_page || data.last_page || 0} / ${tot}`;
    }
    if (elBatch) {
      elBatch.textContent = `Lote: ${data.current_batch || 0} (${data.pages_completed || 0} págs concluídas)`;
    }
    if (elCounts) {
      elCounts.textContent = `+${data.new_titles || 0} novos / ${data.updated_titles || 0} atualiz.`;
    }
    if (elRemaining) {
      elRemaining.textContent = data.remaining_pages !== null && data.remaining_pages !== undefined
        ? `${data.remaining_pages} páginas restantes na fonte`
        : 'Estimativa de páginas restantes a confirmar';
    }
    if (elErrors) {
      elErrors.textContent = `${data.errors_count || 0}`;
    }
    if (elLastError) {
      elLastError.textContent = data.last_error ? `Último aviso: ${data.last_error}` : 'Sem falhas pendentes';
    }

    if (btnResume) btnResume.disabled = data.is_running === 1;
    if (btnPause) btnPause.disabled = data.is_running === 0;
  } catch (err) {
    console.warn('Erro ao atualizar status de sincronização:', err);
  }
}

// Inicializa botões de controle de sincronização no painel
document.addEventListener('DOMContentLoaded', () => {
  const btnResume = document.getElementById('btnResumeSync');
  if (btnResume) {
    btnResume.addEventListener('click', async () => {
      btnResume.disabled = true;
      try {
        await fetch('/api/animes/sync-resume');
        showToast('Sincronização em segundo plano retomada.');
        setTimeout(renderAdminSyncStatus, 500);
      } catch (e) {
        showToast('Erro ao retomar sincronização: ' + e.message);
      }
    });
  }

  const btnPause = document.getElementById('btnPauseSync');
  if (btnPause) {
    btnPause.addEventListener('click', async () => {
      btnPause.disabled = true;
      try {
        await fetch('/api/animes/sync-pause?reason=' + encodeURIComponent('Pausado pelo usuário'));
        showToast('Pausa solicitada à sincronização.');
        setTimeout(renderAdminSyncStatus, 500);
      } catch (e) {
        showToast('Erro ao pausar sincronização: ' + e.message);
      }
    });
  }
});

// =====================================================================
// GESTÃO DE LINKS INVÁLIDOS & QUARENTENA
// =====================================================================
let quarantineItems = [];

async function renderQuarantineList() {
  const tbody = document.getElementById('quarantineTableBody');
  const countTab = document.getElementById('countInvalidosTab');
  const totalCountEl = document.getElementById('quarantineTotalCount');
  const bloggerCountEl = document.getElementById('quarantineBloggerCount');
  const otherCountEl = document.getElementById('quarantineOtherCount');

  if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 30px; color: #94a3b8;">Carregando quarentena...</td></tr>';

  try {
    const res = await fetch('/api/links/invalidos');
    if (!res.ok) throw new Error('Falha ao carregar quarentena');
    const data = await res.json();
    quarantineItems = data.items || [];

    const total = quarantineItems.length;
    let bloggerCount = 0;
    quarantineItems.forEach(i => {
      if ((i.error_reason || '').toLowerCase().includes('blogger')) bloggerCount++;
    });

    if (countTab) countTab.textContent = total.toLocaleString('pt-BR');
    if (totalCountEl) totalCountEl.textContent = total.toLocaleString('pt-BR');
    if (bloggerCountEl) bloggerCountEl.textContent = bloggerCount.toLocaleString('pt-BR');
    if (otherCountEl) otherCountEl.textContent = (total - bloggerCount).toLocaleString('pt-BR');

    filterAndRenderQuarantine();
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 30px; color: #f87171;">Erro ao carregar lista de quarentena: ${err.message}</td></tr>`;
  }
}

function filterAndRenderQuarantine() {
  const tbody = document.getElementById('quarantineTableBody');
  const filterInput = document.getElementById('filterQuarantineInput');
  const query = (filterInput ? filterInput.value.trim().toLowerCase() : '');

  if (!tbody) return;
  const filtered = query ? quarantineItems.filter(i => (i.title || '').toLowerCase().includes(query)) : quarantineItems;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 30px; color: #94a3b8;">Nenhum link inválido encontrado com este filtro.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.slice(0, 150).map(item => `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
      <td style="padding: 10px 14px; font-weight: 500; color: #fff;">${item.title || item.content_id}</td>
      <td style="padding: 10px 14px;"><span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; background: rgba(255,255,255,0.08);">${item.provider || 'animesonlinecc'}</span></td>
      <td style="padding: 10px 14px; color: #f87171; font-size: 0.82rem;">${item.error_reason || 'Vídeo offline'}</td>
      <td style="padding: 10px 14px;"><span style="color: #fbbf24; font-size: 0.8rem; background: rgba(251,191,36,0.1); padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(251,191,36,0.2);">🔒 Ocultado</span></td>
    </tr>
  `).join('');
}

// =====================================================================
// CARREGAMENTO DO CATÁLOGO DE VÍDEOS
// =====================================================================
async function loadManifesto() {
  try {
    const resp = await fetch('data/manifesto.json');
    if (!resp.ok) throw new Error('Não foi possível carregar manifesto.json');
    state.manifesto = await resp.json();

    buildCategoryChips();
    prepareHeroBanner();
    loadDestaques();
  } catch (err) {
    console.error('Erro ao carregar catálogo:', err);
    dom.itemsFoundText.textContent = 'Erro ao carregar dados do catálogo.';
  }
}

function switchType(type) {
  state.activeType = type;
  [dom.btnTypeTodos, dom.btnTypeFilmes, dom.btnTypeSeries, dom.btnTypeAnimes, dom.btnTypeMinhaLista, dom.btnTypeHistorico].filter(Boolean).forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-type') === type);
  });

  if (type === 'todos') {
    dom.btnTypeTodos?.classList.add('active');
    if (dom.homeShelvesContainer) {
      dom.homeShelvesContainer.style.display = 'block';
      HomeShelvesManager.render();
    }
  } else {
    if (dom.homeShelvesContainer) dom.homeShelvesContainer.style.display = 'none';
  }

  if (type === 'filmes') dom.btnTypeFilmes?.classList.add('active');
  if (type === 'series') dom.btnTypeSeries?.classList.add('active');
  if (type === 'animes') {
    dom.btnTypeAnimes?.classList.add('active');
    selectCategory('animes', '🌸 Animes');
    return;
  }
  if (type === 'minha-lista') {
    dom.btnTypeMinhaLista?.classList.add('active');
    MyListManager.renderView();
    return;
  }
  if (type === 'historico') {
    dom.btnTypeHistorico?.classList.add('active');
    loadHistoryView();
    return;
  }

  buildCategoryChips();
  loadDestaques();
}

function buildCategoryChips() {
  if (!state.manifesto) return;

  if (dom.categorySelect) {
    dom.categorySelect.innerHTML = '';

    const optDestaques = document.createElement('option');
    optDestaques.value = 'destaques';
    optDestaques.textContent = '⭐ Lançamentos & Destaques';
    dom.categorySelect.appendChild(optDestaques);

    const filmesGroup = document.createElement('optgroup');
    filmesGroup.label = '🎬 FILMES (25 Gêneros)';
    const filmesCats = state.manifesto.categorias.filter(c => c.tipo === 'filmes');
    filmesCats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.setAttribute('data-nome', cat.nome);
      opt.textContent = `${cat.nome} (${cat.total.toLocaleString()})`;
      filmesGroup.appendChild(opt);
    });
    dom.categorySelect.appendChild(filmesGroup);

    const seriesGroup = document.createElement('optgroup');
    seriesGroup.label = '📺 SÉRIES & STREAMINGS (25 Opções)';
    const seriesCats = state.manifesto.categorias.filter(c => c.tipo === 'series');
    seriesCats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.setAttribute('data-nome', cat.nome);
      opt.textContent = `${cat.nome} (${cat.total.toLocaleString()})`;
      seriesGroup.appendChild(opt);
    });
    dom.categorySelect.appendChild(seriesGroup);

    dom.categorySelect.value = state.activeCategoryId;
  }

  dom.categoriesChips.innerHTML = '';

  const chipDestaques = document.createElement('button');
  chipDestaques.className = `category-chip ${state.activeCategoryId === 'destaques' ? 'active' : ''}`;
  chipDestaques.innerHTML = `<span>⭐ Destaques</span>`;
  chipDestaques.onclick = () => loadDestaques();
  dom.categoriesChips.appendChild(chipDestaques);

  const popularKeywords = [
    { key: 'animes', label: '🌸 Animes' },
    { key: '01_lancamentos', label: '🔥 Lançamentos' },
    { key: '02_4k_uhd', label: '💎 4K Ultra HD' },
    { key: '03_acao', label: '💥 Ação' },
    { key: '06_comedia', label: '🍿 Comédia' },
    { key: '24_terror', label: '👻 Terror' },
    { key: '04_animacao', label: '🎨 Animação' },
    { key: '17_nacionais', label: '🇧🇷 Nacionais' },
    { key: '01_netflix', label: '🔴 Netflix' },
    { key: '02_amazon_prime', label: '📦 Prime Video' },
    { key: '03_max_hbo', label: '👑 HBO Max' },
    { key: '04_disney_plus', label: '✨ Disney+' },
    { key: '09_doramas', label: '🇰🇷 Doramas' },
    { key: '10_novelas', label: '🌹 Novelas' },
    { key: '11_turcas', label: '🇹🇷 Turcas' },
    { key: '08_crunchyroll', label: '🇯🇵 Crunchyroll' }
  ];

  popularKeywords.forEach(pk => {
    const cat = state.manifesto.categorias.find(c => c.id === pk.key);
    if (cat) {
      if (state.activeType !== 'todos' && cat.tipo !== state.activeType) return;

      const btn = document.createElement('button');
      btn.className = `category-chip ${state.activeCategoryId === cat.id ? 'active' : ''}`;
      btn.innerHTML = `<span>${pk.label}</span>`;
      btn.onclick = () => selectCategory(cat.id, cat.nome);
      dom.categoriesChips.appendChild(btn);
    }
  });
}

let heroHls = null;
let heroCycleTimer = null;
let isHeroMuted = true;

function prepareHeroBanner() {
  if (!state.manifesto || !state.manifesto.categorias.length) return;
  const lancamentos = state.manifesto.categorias.find(c => c.id.includes('lancamentos')) || state.manifesto.categorias[0];
  if (lancamentos && lancamentos.destaques && lancamentos.destaques.length > 0) {
    state.heroItems = lancamentos.destaques.filter(i => i.p && i.p.includes('http') && i.u);
  }

  // Controles de navegação manual do Hero
  if (dom.btnHeroPrev) {
    dom.btnHeroPrev.onclick = (e) => {
      e.stopPropagation();
      changeHeroSlide(-1);
    };
  }
  if (dom.btnHeroNext) {
    dom.btnHeroNext.onclick = (e) => {
      e.stopPropagation();
      changeHeroSlide(1);
    };
  }

  // Alternador de áudio do trailer
  if (dom.btnHeroSound) {
    dom.btnHeroSound.onclick = (e) => {
      e.stopPropagation();
      toggleHeroAudio();
    };
  }

  // Pausa vídeo de fundo quando o hero sai do campo de visão (economiza banda e processamento)
  if ('IntersectionObserver' in window && dom.heroBanner && dom.heroVideo) {
    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) {
          if (!dom.heroVideo.paused) dom.heroVideo.pause();
        } else {
          if (dom.heroVideo.paused && dom.heroVideo.classList.contains('is-playing')) {
            dom.heroVideo.play().catch(() => {});
          }
        }
      });
    }, { threshold: 0.2 });
    heroObserver.observe(dom.heroBanner);
  }

  // Garante uma boa rotação com lançamentos em alta
  if (!state.heroItems || state.heroItems.length < 8) {
    fetch('data/01_lancamentos.json')
      .then(r => r.json())
      .then(items => {
        if (Array.isArray(items) && items.length > 0) {
          state.heroItems = items.filter(it => it.u).slice(0, 15);
        }
        startHeroCycle();
      })
      .catch(() => startHeroCycle());
  } else {
    startHeroCycle();
  }
}

function startHeroCycle() {
  if (!state.heroItems || state.heroItems.length === 0) return;
  state.heroIndex = 0;
  updateHeroItem(state.heroItems[0]);

  if (heroCycleTimer) clearInterval(heroCycleTimer);
  heroCycleTimer = setInterval(() => {
    // Não avança se um player estiver aberto na tela
    if (dom.playerModal && dom.playerModal.classList.contains('active')) return;
    if (dom.seriesModal && dom.seriesModal.classList.contains('active')) return;
    changeHeroSlide(1);
  }, 60000); // 1 minuto completo para cada filme/série em destaque
}

function changeHeroSlide(direction) {
  if (!state.heroItems || state.heroItems.length === 0) return;
  state.heroIndex = (state.heroIndex + direction + state.heroItems.length) % state.heroItems.length;
  updateHeroItem(state.heroItems[state.heroIndex]);

  // Reinicia o ciclo de 1 minuto para que o filme atual tenha o tempo integral
  if (heroCycleTimer) clearInterval(heroCycleTimer);
  heroCycleTimer = setInterval(() => {
    if (dom.playerModal && dom.playerModal.classList.contains('active')) return;
    if (dom.seriesModal && dom.seriesModal.classList.contains('active')) return;
    changeHeroSlide(1);
  }, 60000);
}

function toggleHeroAudio() {
  if (!dom.heroVideo) return;
  isHeroMuted = !isHeroMuted;
  dom.heroVideo.muted = isHeroMuted;
  const iconMuted = dom.btnHeroSound.querySelector('.icon-muted');
  const iconUnmuted = dom.btnHeroSound.querySelector('.icon-unmuted');
  if (iconMuted) iconMuted.style.display = isHeroMuted ? 'inline-block' : 'none';
  if (iconUnmuted) iconUnmuted.style.display = isHeroMuted ? 'none' : 'inline-block';
  if (dom.heroSoundLabel) dom.heroSoundLabel.textContent = isHeroMuted ? 'Mudo' : 'Com Som';
}

function updateHeroItem(item) {
  if (!item) return;
  state.heroItem = item;
  state.heroCurrentItem = item;

  // Informações de título e nota
  dom.heroTitle.textContent = item.t;
  const rating = getMediaRating(item);
  if (dom.heroRatingBadge) {
    dom.heroRatingBadge.innerHTML = `<span class="star-icon">★</span> ${rating.toFixed(1)}`;
  }
  if (dom.heroCategory) dom.heroCategory.textContent = item.catNome || '';

  // Metadados reais: Ano, Duração / Temporadas, Classificação Indicativa
  const heroYear = document.getElementById('heroYear');
  if (heroYear) heroYear.textContent = item.ano || item.year || 2024;

  const heroDuration = document.getElementById('heroDuration');
  if (heroDuration) {
    if (item.duracao || item.duration) {
      heroDuration.textContent = item.duracao || item.duration;
    } else if (item.total_temporadas || item.totalSeasons) {
      const s = item.total_temporadas || item.totalSeasons;
      heroDuration.textContent = `${s} Temporada${s > 1 ? 's' : ''}`;
    } else if (item.total_episodios || item.totalEpisodes) {
      heroDuration.textContent = `${item.total_episodios || item.totalEpisodes} Episódios`;
    } else {
      heroDuration.textContent = '2h 05m';
    }
  }

  const heroAge = document.getElementById('heroAge');
  if (heroAge) {
    heroAge.textContent = item.age || item.classificacao || '14+';
  }

  // Fundo de pôster estático de base (visível apenas enquanto o vídeo carrega)
  dom.heroBackdrop.style.backgroundImage = `url('${item.p || FALLBACK_POSTER}')`;
  if (dom.heroBanner) dom.heroBanner.classList.remove('has-video-playing');
  if (dom.heroBackdrop) dom.heroBackdrop.classList.remove('is-hidden');
  dom.heroVideo.classList.remove('is-playing');

  // Sinopse concisa e cinematográfica (2 a 3 linhas)
  if (dom.heroDesc) {
    const rawSinopse = (item.sinopse && item.sinopse.trim() && !item.sinopse.includes("Assista agora"))
      ? item.sinopse
      : `Em ${item.t}, acompanhe uma trama envolvente com produção de alto nível, reviravoltas cinematográficas e momentos inesquecíveis. Assista agora em 4K e HD no K-CINE.`;
    dom.heroDesc.textContent = rawSinopse;
    dom.heroDesc.style.display = '-webkit-box';
  }

  if (dom.btnHeroPlay) {
    dom.btnHeroPlay.onclick = () => openPlayer(item.t, item.catNome || 'Destaques', item.u, item);
  }
  if (dom.btnHeroCopy) {
    dom.btnHeroCopy.onclick = () => {
      if (state.currentUser && state.currentUser.role === 'admin') {
        copyToClipboard(item.u);
      }
    };
  }
  if (dom.btnHeroVlc) {
    dom.btnHeroVlc.onclick = () => {
      if (state.currentUser && state.currentUser.role === 'admin') {
        window.open(item.u, '_blank');
      }
    };
  }

  // Sincroniza estado de salvamento no botão Minha Lista do Hero
  if (typeof MyListManager !== 'undefined' && MyListManager.updateButtons) {
    MyListManager.updateButtons(item.id || item.t);
  }

  // Reproduz preview de cenas do filme no fundo (sem áudio por padrão)
  playHeroBackgroundVideo(item);
}

function playHeroBackgroundVideo(item) {
  if (!dom.heroVideo) return;
  const rawUrl = item.u;

  const resetHeroVideo = () => {
    dom.heroVideo.classList.remove('is-playing');
    if (dom.heroBanner) dom.heroBanner.classList.remove('has-video-playing');
    if (dom.heroBackdrop) dom.heroBackdrop.classList.remove('is-hidden');
  };

  if (!rawUrl) {
    resetHeroVideo();
    return;
  }

  // Transição suave de fade out
  resetHeroVideo();

  if (heroHls) {
    try { heroHls.destroy(); } catch (e) {}
    heroHls = null;
  }

  const streamUrl = getPlayableUrl(rawUrl);
  const isHls = streamUrl.includes('.m3u8');

  dom.heroVideo.muted = isHeroMuted;
  dom.heroVideo.playsInline = true;
  dom.heroVideo.setAttribute('playsinline', '');
  dom.heroVideo.setAttribute('muted', '');
  dom.heroVideo.loop = true;

  let hasSeekedToMiddle = false;

  const seekToMiddle = () => {
    if (hasSeekedToMiddle) return;
    try {
      const dur = dom.heroVideo.duration;
      if (dur && isFinite(dur) && dur > 60) {
        hasSeekedToMiddle = true;
        // Pega exatamente o meio do filme (45% a 50%) para exibir cenas reais da história, evitando abertura e créditos
        const targetTime = Math.floor(dur * 0.45);
        dom.heroVideo.currentTime = targetTime;
      } else if (dur && isFinite(dur) && dur > 20) {
        hasSeekedToMiddle = true;
        dom.heroVideo.currentTime = Math.floor(dur * 0.4);
      }
    } catch (e) {}
  };

  // Ao carregar metadados ou duração, salta direto para o meio do filme
  dom.heroVideo.onloadedmetadata = () => {
    seekToMiddle();
  };

  dom.heroVideo.ondurationchange = () => {
    seekToMiddle();
  };

  dom.heroVideo.oncanplay = () => {
    seekToMiddle();
  };

  // Se o vídeo em loop atingir o fim, reinicia no meio do filme em vez da abertura
  dom.heroVideo.onended = () => {
    try {
      const dur = dom.heroVideo.duration;
      if (dur && isFinite(dur) && dur > 60) {
        dom.heroVideo.currentTime = Math.floor(dur * 0.45);
        dom.heroVideo.play().catch(() => {});
      }
    } catch (e) {}
  };

  dom.heroVideo.onplaying = () => {
    // Só ativa o fade-in do vídeo de fundo após ter pulado a abertura e chegado ao meio do filme
    const dur = dom.heroVideo.duration;
    if (dur && isFinite(dur) && dur > 60 && dom.heroVideo.currentTime < 30) {
      seekToMiddle();
      return;
    }
    dom.heroVideo.classList.add('is-playing');
    // Esconde completamente o papel de parede estático com a capa para não vazar nem sobrepor ao vídeo
    if (dom.heroBanner) dom.heroBanner.classList.add('has-video-playing');
    if (dom.heroBackdrop) dom.heroBackdrop.classList.add('is-hidden');
  };

  dom.heroVideo.onerror = () => {
    // Se a stream falhar, o pôster fica visível como fundo estático
    resetHeroVideo();
  };

  if (isHls && window.Hls && Hls.isSupported()) {
    heroHls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      startLevel: -1
    });
    heroHls.loadSource(streamUrl);
    heroHls.attachMedia(dom.heroVideo);
    heroHls.on(Hls.Events.MANIFEST_PARSED, () => {
      seekToMiddle();
      dom.heroVideo.play().catch(() => {});
    });
    heroHls.on(Hls.Events.ERROR, () => {
      resetHeroVideo();
    });
  } else {
    dom.heroVideo.src = streamUrl;
    dom.heroVideo.play().catch(() => {});
  }
}

function loadDestaques() {
  state.activeCategoryId = 'destaques';
  if (dom.categorySelect) dom.categorySelect.value = 'destaques';
  updateActiveChipHighlight();
  dom.currentViewTitle.textContent = "Lançamentos & Destaques";
  dom.activeCategoryTitle.textContent = "Exibindo Destaques Selecionados";

  let pool = [];
  const cats = state.manifesto.categorias.filter(c => {
    if (state.activeType === 'todos') return true;
    return c.tipo === state.activeType;
  });

  cats.forEach(c => {
    if (c.destaques) {
      c.destaques.forEach(it => {
        pool.push({
          ...it,
          catNome: c.nome
        });
      });
    }
  });

  // Deduplicação rigorosa de posters e títulos nos destaques
  const seenPoolPosters = new Set();
  const seenPoolKeys = new Set();
  const dedupedPool = [];
  pool.forEach(it => {
    const rawTitle = it.canonical_title || it.t || '';
    const normKey = rawTitle.toLowerCase()
      .replace(/\[.*?\]|\(.*?\)|4k|uhd|fhd|hd|dublado|legendado|lançamento|lancamento|parte\s*\d+/g, '')
      .replace(/[^a-z0-9]/g, '');
    if (normKey && normKey.length >= 3) {
      if (seenPoolKeys.has(normKey)) return;
      seenPoolKeys.add(normKey);
    }
    const posterUrl = it.p || it.poster || '';
    if (posterUrl && posterUrl.startsWith('http')) {
      const posterFile = posterUrl.split('/').pop().split('?')[0];
      if (posterFile && seenPoolPosters.has(posterFile)) return;
      seenPoolPosters.add(posterFile);
    }
    dedupedPool.push(it);
  });

  state.rawItems = dedupedPool;
  if (dom.catalogPaginationContainer) dom.catalogPaginationContainer.style.display = 'none';
  refreshCatalogDisplay();
}

async function selectCategory(catId, catName) {
  if (catId === 'destaques') {
    loadDestaques();
    return;
  }

  state.activeCategoryId = catId;
  if (dom.categorySelect) dom.categorySelect.value = catId;
  updateActiveChipHighlight();
  dom.currentViewTitle.textContent = catName;
  dom.activeCategoryTitle.textContent = `Categoria: ${catName}`;
  dom.cardsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #94a3b8;">Carregando títulos da categoria...</div>';
  dom.loadMoreContainer.style.display = 'none';
  if (dom.catalogPaginationContainer) dom.catalogPaginationContainer.style.display = 'none';

  if (catId === 'animes') {
    updateSeriesControlsVisibility();
    state.animePagination.page = 1;
    state.animePagination.searchQuery = '';
    dom.itemsFoundText.textContent = 'Carregando catálogo oficial de animes...';
    loadAnimesPage(1, '');
    return;
  }

  const isSeriesCat = (state.activeType === 'series') ||
    (catId && (
      catId.includes('series') || catId.includes('novelas') || catId.includes('doramas') ||
      catId.includes('netflix') || catId.includes('prime') || catId.includes('max') ||
      catId.includes('disney') || catId.includes('crunchyroll') || catId.includes('turcas') ||
      catId.includes('globoplay') || catId.includes('paramount') || catId.includes('apple') ||
      catId.includes('star') || catId.includes('sbt') || catId.includes('discovery') ||
      catId.includes('directv') || catId.includes('funimation')
    ));

  if (isSeriesCat) {
    state.seriesViewMode = 'grouped';
    if (dom.btnViewAll) dom.btnViewAll.classList.toggle('active', false);
    if (dom.btnViewGrouped) dom.btnViewGrouped.classList.toggle('active', true);
  }

  try {
    const resp = await fetch(`data/${catId}.json`);
    if (!resp.ok) throw new Error('Falha ao carregar categoria');
    const items = await resp.json();

    state.rawItems = items.map(it => ({
      ...it,
      catNome: catName
    }));

    refreshCatalogDisplay();
  } catch (err) {
    console.error('Erro ao buscar dados da categoria:', err);
    dom.cardsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #ef4444;">Erro ao carregar títulos desta categoria.</div>';
  }
}

// =====================================================================
// PAGINAÇÃO LEVE E CONSUMO SOB DEMANDA DE ANIMES (SUBSTITUIÇÃO DE PÁGINA)
// =====================================================================
async function getStaticAnimesPage(page = 1, limit = 24, search = '', genre = '', sort = 'latest') {
  if (!state.staticAnimesList) {
    try {
      const resp = await fetch('/data/animes.json');
      if (resp.ok) {
        state.staticAnimesList = await resp.json();
      }
    } catch (e) {
      console.warn('Falha ao carregar catálogo estático /data/animes.json:', e);
    }
  }

  const all = state.staticAnimesList || [];
  let filtered = all;

  const sNorm = (search || '').trim().toLowerCase();
  if (sNorm) {
    filtered = filtered.filter(a => {
      const title = (a.canonical_title || a.t || '').toLowerCase();
      const aliases = (a.aliases || []).map(al => String(al).toLowerCase());
      return title.includes(sNorm) || aliases.some(al => al.includes(sNorm));
    });
  }

  const gNorm = (genre || '').trim().toLowerCase();
  if (gNorm) {
    filtered = filtered.filter(a => {
      const genres = a.generos || a.genres || [];
      return genres.some(g => String(g).toLowerCase().includes(gNorm));
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

  return {
    page: page,
    limit: limit,
    total_count: totalCount,
    total_items: totalCount,
    total_pages: totalPages,
    has_more: page < totalPages,
    animes: items
  };
}

async function loadAnimesPage(page = 1, search = '', genre = '', sort = 'latest') {
  if (state.animePagination.abortController) {
    try {
      state.animePagination.abortController.abort();
    } catch (e) {}
  }
  const controller = new AbortController();
  state.animePagination.abortController = controller;
  state.animePagination.isLoading = true;
  const currentRequestId = ++state.animePagination.requestId;

  // Atualiza imediatamente o indicador de status para evitar textos desatualizados de outras abas
  if (dom.itemsFoundText) {
    dom.itemsFoundText.textContent = search ? `Buscando "${escapeHtml(search)}"...` : 'Carregando animes do catálogo oficial...';
  }

  // Se o grid estiver vazio, exibe skeletons leves (apenas na carga inicial sem cards prévios)
  if (!dom.cardsGrid.children.length) {
    dom.cardsGrid.innerHTML = `
      <div class="card-skeleton"></div>
      <div class="card-skeleton"></div>
      <div class="card-skeleton"></div>
      <div class="card-skeleton"></div>
      <div class="card-skeleton"></div>
      <div class="card-skeleton"></div>
    `;
  }
  if (dom.loadMoreContainer) dom.loadMoreContainer.style.display = 'none';
  if (dom.catalogPaginationContainer) dom.catalogPaginationContainer.style.display = 'none';

  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: '24',
      search: search || '',
      genre: genre || '',
      sort: sort || 'latest'
    });

    let data = null;
    try {
      const resp = await fetch(`/api/animes?${params.toString()}`, { signal: controller.signal });
      if (resp.ok) {
        data = await resp.json();
      }
    } catch (apiErr) {
      if (apiErr.name === 'AbortError') return;
      console.warn('API /api/animes indisponível, usando fallback estático...', apiErr);
    }

    if (!data || !data.animes || !Array.isArray(data.animes)) {
      data = await getStaticAnimesPage(page, 24, search, genre, sort);
    }

    // Previne condição de corrida: se uma busca mais recente já foi disparada, descarta
    if (currentRequestId !== state.animePagination.requestId) {
      return;
    }

    state.animePagination.page = data.page || page;
    state.animePagination.hasMore = !!data.has_more;
    state.animePagination.totalCount = data.total_count || 0;
    state.animePagination.totalPages = data.total_pages || 1;
    state.animePagination.searchQuery = search;
    state.animePagination.genre = genre;
    state.animePagination.sort = sort;

    dom.cardsGrid.innerHTML = '';
    const animesList = data.animes || data.items || [];

    if (!animesList.length) {
      dom.cardsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #94a3b8;">Nenhum anime encontrado no catálogo.</div>';
      dom.itemsFoundText.textContent = '0 animes encontrados';
      if (dom.catalogPaginationContainer) dom.catalogPaginationContainer.style.display = 'none';
      state.animePagination.isLoading = false;
      return;
    }

    // Injeta exatamente os cards da página ativa no DOM com deduplicação rigorosa
    const fragment = document.createDocumentFragment();
    const seenPageKeys = new Set();
    const seenPagePosters = new Set();

    animesList.forEach((anime, idx) => {
      const rawTitle = anime.canonical_title || anime.t || anime.title || '';
      const normKey = rawTitle.toLowerCase()
        .replace(/\[.*?\]|\(.*?\)|4k|uhd|fhd|hd|dublado|legendado|lançamento|lancamento|o\s*filme|the\s*movie/g, '')
        .replace(/[^a-z0-9]/g, '');
      if (normKey && normKey.length >= 3) {
        if (seenPageKeys.has(normKey)) return;
        seenPageKeys.add(normKey);
      }
      const posterUrl = anime.poster || anime.p || '';
      if (posterUrl && posterUrl.includes('image.tmdb.org')) {
        const posterFile = posterUrl.split('/').pop();
        if (posterFile && seenPagePosters.has(posterFile)) return;
        seenPagePosters.add(posterFile);
      }

      const cardItem = {
        id: anime.id,
        t: rawTitle,
        p: posterUrl,
        catNome: '🌸 Animes',
        is_anime: true,
        total_episodios: anime.total_episodios || anime.total_episodes,
        total_temporadas: anime.total_temporadas || anime.total_seasons || anime.temporadas || 1,
        ano: anime.ano || anime.year,
        sinopse: anime.sinopse || anime.synopsis,
        generos: anime.generos || anime.genres
      };
      const card = createVideoCard(cardItem, (page - 1) * 24 + idx);
      fragment.appendChild(card);
    });
    dom.cardsGrid.appendChild(fragment);

    const totalCount = data.total_count || data.total_items || animesList.length;
    dom.itemsFoundText.textContent = `${totalCount} animes no catálogo (Página ${state.animePagination.page} de ${state.animePagination.totalPages} • ${animesList.length} cards no DOM)`;

    // Renderiza a barra de navegação de páginas sem acumular cards no DOM
    renderCatalogPagination(state.animePagination.page, state.animePagination.totalPages);

  } catch (err) {
    if (err.name === 'AbortError') return; // Cancelamento intencional por nova busca
    console.error('Erro na paginação de animes:', err);
    dom.cardsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #ef4444;">
        <p style="margin-bottom: 12px; font-weight: 600;">Não foi possível carregar os animes no momento.</p>
        <button class="type-btn active" style="display: inline-block; padding: 8px 18px; cursor: pointer; border: 1px solid var(--accent-pink);" onclick="loadAnimesPage(1, '')">Recarregar Catálogo</button>
      </div>
    `;
  } finally {
    state.animePagination.isLoading = false;
  }
}

function renderCatalogPagination(currentPage, totalPages) {
  if (!dom.catalogPaginationContainer || !dom.paginationPages) return;
  if (!totalPages || totalPages <= 1) {
    dom.catalogPaginationContainer.style.display = 'none';
    return;
  }

  dom.catalogPaginationContainer.style.display = 'flex';
  if (dom.btnPagePrev) dom.btnPagePrev.disabled = (currentPage <= 1);
  if (dom.btnPageNext) dom.btnPageNext.disabled = (currentPage >= totalPages);

  if (dom.btnPagePrev) {
    dom.btnPagePrev.onclick = () => {
      if (currentPage > 1) {
        loadAnimesPage(currentPage - 1, state.animePagination.searchQuery, state.animePagination.genre, state.animePagination.sort);
        dom.cardsGrid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };
  }

  if (dom.btnPageNext) {
    dom.btnPageNext.onclick = () => {
      if (currentPage < totalPages) {
        loadAnimesPage(currentPage + 1, state.animePagination.searchQuery, state.animePagination.genre, state.animePagination.sort);
        dom.cardsGrid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };
  }

  dom.paginationPages.innerHTML = '';

  const pages = [];
  const delta = 2;
  const left = Math.max(1, currentPage - delta);
  const right = Math.min(totalPages, currentPage + delta);

  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= left && p <= right)) {
      pages.push(p);
    }
  }

  let prevPage = 0;
  pages.forEach(p => {
    if (prevPage && p - prevPage > 1) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'pagination-ellipsis';
      ellipsis.textContent = '...';
      dom.paginationPages.appendChild(ellipsis);
    }
    const btn = document.createElement('button');
    btn.className = `btn-page-num ${p === currentPage ? 'active' : ''}`;
    btn.textContent = p;
    btn.onclick = () => {
      if (p !== currentPage) {
        loadAnimesPage(p, state.animePagination.searchQuery, state.animePagination.genre, state.animePagination.sort);
        dom.cardsGrid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };
    dom.paginationPages.appendChild(btn);
    prevPage = p;
  });
}

// =====================================================================
// ORGANIZAÇÃO E AGRUPAMENTO DE SÉRIES
// =====================================================================
function setSeriesViewMode(mode) {
  state.seriesViewMode = mode;
  if (dom.btnViewAll) dom.btnViewAll.classList.toggle('active', mode === 'all');
  if (dom.btnViewGrouped) dom.btnViewGrouped.classList.toggle('active', mode === 'grouped');
  refreshCatalogDisplay();
}

function updateSeriesControlsVisibility() {
  if (!dom.seriesViewControls) return;
  // Animes são obras canônicas estruturadas com temporadas e episódios próprios no modal
  if (state.activeType === 'animes' || state.activeCategoryId === 'animes') {
    dom.seriesViewControls.style.display = 'none';
    return;
  }
  const isSeriesCat = (state.activeType === 'series') ||
    (state.activeCategoryId && (
      state.activeCategoryId.includes('series') ||
      state.activeCategoryId.includes('novelas') ||
      state.activeCategoryId.includes('doramas') ||
      state.activeCategoryId.includes('netflix') ||
      state.activeCategoryId.includes('prime') ||
      state.activeCategoryId.includes('max') ||
      state.activeCategoryId.includes('disney') ||
      state.activeCategoryId.includes('crunchyroll') ||
      state.activeCategoryId.includes('turcas')
    ));
  const hasEpisodes = state.rawItems && state.rawItems.some(it => parseEpisodeInfo(it.t).isEpisode);

  if (isSeriesCat || hasEpisodes) {
    dom.seriesViewControls.style.display = 'inline-flex';
  } else {
    dom.seriesViewControls.style.display = 'none';
  }
}

function refreshCatalogDisplay() {
  if (!state.rawItems) state.rawItems = [];
  updateSeriesControlsVisibility();

  const isAnimesMode = (state.activeType === 'animes' || state.activeCategoryId === 'animes');

  if (isAnimesMode) {
    const seenAnimeKeys = new Set();
    const seenPosters = new Set();
    state.currentItems = state.rawItems.filter(it => {
      const rawTitle = it.canonical_title || it.t || '';
      const normKey = rawTitle.toLowerCase()
        .replace(/\[.*?\]|\(.*?\)|4k|uhd|fhd|hd|dublado|legendado|lançamento|lancamento|o\s*filme|the\s*movie/g, '')
        .replace(/[^a-z0-9]/g, '');
      if (normKey && normKey.length >= 3) {
        if (seenAnimeKeys.has(normKey)) return false;
        seenAnimeKeys.add(normKey);
      }
      const posterUrl = it.p || it.poster || '';
      if (posterUrl && posterUrl.includes('image.tmdb.org')) {
        const posterFile = posterUrl.split('/').pop();
        if (posterFile && seenPosters.has(posterFile)) return false;
        seenPosters.add(posterFile);
      }
      return true;
    });
  } else if (state.seriesViewMode === 'grouped') {
    const { groups, nonSeries } = groupItemsBySeries(state.rawItems);
    const seenSeriesPosters = new Set();
    state.currentItems = [...groups, ...nonSeries].filter(it => {
      const posterUrl = it.poster || it.p || '';
      if (posterUrl && posterUrl.startsWith('http')) {
        const posterFile = posterUrl.split('/').pop().split('?')[0];
        if (posterFile && seenSeriesPosters.has(posterFile)) return false;
        seenSeriesPosters.add(posterFile);
      }
      return true;
    });
  } else {
    // Deduplicação defensiva de filmes e animes (evita cards repetidos por poster ou versão 4K/[L]/[Lançamento])
    const seenMovieKeys = new Set();
    const seenMoviePosters = new Set();
    state.currentItems = state.rawItems.filter(it => {
      const rawTitle = it.canonical_title || it.t || '';
      const normKey = rawTitle.toLowerCase()
        .replace(/\[.*?\]|\(.*?\)|4k|uhd|fhd|hd|dublado|legendado|lançamento|lancamento|parte\s*\d+/g, '')
        .replace(/[^a-z0-9]/g, '');
      if (normKey && normKey.length >= 3) {
        if (seenMovieKeys.has(normKey)) return false;
        seenMovieKeys.add(normKey);
      }
      const posterUrl = it.p || it.poster || '';
      if (posterUrl && posterUrl.startsWith('http')) {
        const posterFile = posterUrl.split('/').pop().split('?')[0];
        if (posterFile && seenMoviePosters.has(posterFile)) return false;
        seenMoviePosters.add(posterFile);
      }
      return true;
    });
  }

  if (dom.sortSelect && dom.sortSelect.value !== 'padrao') {
    applySortingInMemory(dom.sortSelect.value);
  }

  state.displayedCount = 0;
  dom.cardsGrid.innerHTML = '';
  renderNextBatch();

  if (isAnimesMode) {
    const totalEps = state.rawItems.reduce((acc, it) => acc + (it.total_episodios || it.episodes_count || 0), 0);
    dom.itemsFoundText.textContent = `${state.rawItems.length} animes disponíveis (${totalEps.toLocaleString()} episódios no catálogo)`;
  } else if (state.seriesViewMode === 'grouped') {
    const groupCount = state.currentItems.filter(it => it.isGroup).length;
    dom.itemsFoundText.textContent = `${groupCount} séries agrupadas (${state.rawItems.length.toLocaleString()} episódios no total)`;
  } else {
    dom.itemsFoundText.textContent = `${state.currentItems.length.toLocaleString()} títulos disponíveis`;
  }
}

function applySorting(sortType) {
  applySortingInMemory(sortType);
  state.displayedCount = 0;
  dom.cardsGrid.innerHTML = '';
  renderNextBatch();
}

function applySortingInMemory(sortType) {
  if (!state.currentItems || !state.currentItems.length) return;
  if (sortType === 'az') {
    state.currentItems.sort((a, b) => (a.seriesName || a.t || '').localeCompare(b.seriesName || b.t || '', 'pt-BR'));
  } else if (sortType === 'za') {
    state.currentItems.sort((a, b) => (b.seriesName || b.t || '').localeCompare(a.seriesName || a.t || '', 'pt-BR'));
  }
}

function updateActiveChipHighlight() {
  document.querySelectorAll('.category-chip').forEach(chip => chip.classList.remove('active'));
  const activeBtn = Array.from(document.querySelectorAll('.category-chip')).find(b => {
    if (state.activeCategoryId === 'destaques' && b.innerText.includes('Destaques')) return true;
    return b.onclick && b.onclick.toString().includes(state.activeCategoryId);
  });
  if (activeBtn) activeBtn.classList.add('active');
}

function renderNextBatch() {
  const nextBatch = state.currentItems.slice(state.displayedCount, state.displayedCount + state.pageSize);
  if (!nextBatch.length) {
    dom.loadMoreContainer.style.display = 'none';
    return;
  }

  const fragment = document.createDocumentFragment();
  nextBatch.forEach((item, index) => {
    const card = createVideoCard(item, state.displayedCount + index);
    fragment.appendChild(card);
  });

  dom.cardsGrid.appendChild(fragment);
  state.displayedCount += nextBatch.length;

  if (state.displayedCount < state.currentItems.length) {
    dom.loadMoreContainer.style.display = 'block';
  } else {
    dom.loadMoreContainer.style.display = 'none';
  }
}

// =====================================================================
// PARSER DE EPISÓDIOS & IDENTIFICAÇÃO DE CAPÍTULOS
// =====================================================================
function parseEpisodeInfo(rawTitle) {
  if (!rawTitle || typeof rawTitle !== 'string') {
    return { isEpisode: false, seriesName: '', season: null, episode: null, episodeTitle: '', badge: '', label: '', shortBadge: '', cleanTitle: '' };
  }

  const title = rawTitle.trim();

  // 1. Padrão Clássico: S01E02, S1E2, T01E02, TEMP 01 EP 02, Temporada 1 Episodio 2
  // Ex: "90 Dias De Volta Pra Pista S04E01", "Breaking Bad T02E07 - O Retorno", "Dark S01 E03"
  const p1 = /^(.*?)\s*[\(\[\{]?(?:S|TEMP|TEMPORADA|T)\s*(\d{1,2})\s*[\s\.\-_]*\s*(?:E|EP|CAP|CAPITULO|EPS)\s*(\d{1,3})[\)\]\}]?(?:\s*[\-\:]?\s*(.*?))?$/i;
  let m = title.match(p1);
  if (m) {
    const seriesName = m[1].replace(/[\s\.\-_]+$/, '').trim() || title;
    const s = parseInt(m[2], 10);
    const e = parseInt(m[3], 10);
    const sStr = String(s).padStart(2, '0');
    const eStr = String(e).padStart(2, '0');
    const epTitle = m[4] ? m[4].replace(/^[\[\(].*?[\]\)]$/, '').trim() : '';
    return {
      isEpisode: true,
      seriesName,
      season: s,
      episode: e,
      episodeTitle: epTitle,
      badge: `T${sStr} • EP ${eStr}`,
      seasonLabel: `Temporada ${s}`,
      label: `Temporada ${s}`,
      fullLabel: `Temporada ${s} • Episódio ${e}`,
      shortBadge: `T${sStr} E${eStr}`,
      cleanTitle: seriesName
    };
  }

  // 2. Padrão 01x05, 1x5
  // Ex: "Game of Thrones 01x05", "Lost 3x10"
  const p2 = /^(.*?)\s*[\(\[\{]?(\d{1,2})x(\d{1,3})[\)\]\}]?(?:\s*[\-\:]?\s*(.*?))?$/i;
  m = title.match(p2);
  if (m) {
    const seriesName = m[1].replace(/[\s\.\-_]+$/, '').trim() || title;
    const s = parseInt(m[2], 10);
    const e = parseInt(m[3], 10);
    const sStr = String(s).padStart(2, '0');
    const eStr = String(e).padStart(2, '0');
    const epTitle = m[4] ? m[4].trim() : '';
    return {
      isEpisode: true,
      seriesName,
      season: s,
      episode: e,
      episodeTitle: epTitle,
      badge: `T${sStr} • EP ${eStr}`,
      seasonLabel: `Temporada ${s}`,
      label: `Temporada ${s}`,
      fullLabel: `Temporada ${s} • Episódio ${e}`,
      shortBadge: `T${sStr} E${eStr}`,
      cleanTitle: seriesName
    };
  }

  // 3. Padrão Capítulo / Episódio avulso (Novelas, Doramas, Animes):
  // Ex: "Amor de Mae Cap 45", "Renascer Capitulo 102", "Chaves Ep 12", "Naruto Ep 200"
  const p3 = /^(.*?)\s*[\(\[\{]?(?:EP|EPISODIO|CAP|CAPITULO)\s*[\.\-_]?\s*(\d{1,4})[\)\]\}]?(?:\s*[\-\:]?\s*(.*?))?$/i;
  m = title.match(p3);
  if (m) {
    const seriesName = m[1].replace(/[\s\.\-_]+$/, '').trim() || title;
    const e = parseInt(m[2], 10);
    const eStr = String(e).padStart(2, '0');
    const isCap = /cap/i.test(m[0]);
    return {
      isEpisode: true,
      seriesName,
      season: 1,
      episode: e,
      episodeTitle: m[3] ? m[3].trim() : '',
      badge: isCap ? `CAP ${eStr}` : `EP ${eStr}`,
      seasonLabel: isCap ? `Capítulo ${e}` : `Temporada 1`,
      label: isCap ? `Capítulo ${e}` : `Temporada 1`,
      fullLabel: isCap ? `Capítulo ${e}` : `Episódio ${e}`,
      shortBadge: isCap ? `C${eStr}` : `E${eStr}`,
      cleanTitle: seriesName
    };
  }

  return {
    isEpisode: false,
    seriesName: title,
    season: null,
    episode: null,
    episodeTitle: '',
    badge: '',
    seasonLabel: '',
    label: '',
    fullLabel: '',
    shortBadge: '',
    cleanTitle: title
  };
}

function groupItemsBySeries(items) {
  const groups = new Map();
  const nonSeries = [];
  const animeNormalizedTitles = new Set();

  // 1. Mapeia animes oficiais presentes na lista para evitar duplicação com listas de IPTV
  items.forEach(item => {
    const isAnime = item.is_anime || (item.id && String(item.id).startsWith('ani_')) || (item.catNome && item.catNome.includes('ANIMES'));
    if (isAnime) {
      const norm = (item.t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm) animeNormalizedTitles.add(norm);
    }
  });

  items.forEach((item, originalIndex) => {
    const parsed = parseEpisodeInfo(item.t);
    if (parsed.isEpisode) {
      const normSeries = parsed.seriesName.toLowerCase().replace(/[^a-z0-9]/g, '');
      // Se já existe uma versão completa oficial deste anime no catálogo, não duplica criando card secundário de IPTV
      const isAnimeDuplicate = animeNormalizedTitles.has(normSeries) || Array.from(animeNormalizedTitles).some(aNorm => 
        (normSeries.length >= 6 && aNorm.includes(normSeries)) || (aNorm.length >= 6 && normSeries.includes(aNorm))
      );
      if (isAnimeDuplicate) {
        return;
      }

      const key = parsed.seriesName.toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, {
          isGroup: true,
          seriesName: parsed.seriesName,
          catNome: item.catNome || 'Série',
          poster: item.p,
          episodes: [],
          seasons: new Set()
        });
      }
      const g = groups.get(key);
      if (parsed.season) g.seasons.add(parsed.season);
      if ((!g.poster || g.poster === FALLBACK_POSTER) && item.p && item.p.startsWith('http')) {
        g.poster = item.p;
      }
      g.episodes.push({
        ...item,
        parsed,
        originalIndex
      });
    } else {
      nonSeries.push(item);
    }
  });

  // Deduplica nonSeries caso venham registros duplicados
  const seenNonSeries = new Set();
  const dedupedNonSeries = [];
  nonSeries.forEach(item => {
    const dedupKey = (item.id || `${item.t}_${item.catNome}`).toLowerCase();
    if (!seenNonSeries.has(dedupKey)) {
      seenNonSeries.add(dedupKey);
      dedupedNonSeries.push(item);
    }
  });

  // Ordena episódios de cada série cronologicamente (Temporada crescente, Episódio crescente)
  const groupList = Array.from(groups.values());
  groupList.forEach(g => {
    g.episodes.sort((a, b) => {
      const sDiff = (a.parsed.season || 1) - (b.parsed.season || 1);
      if (sDiff !== 0) return sDiff;
      return (a.parsed.episode || 1) - (b.parsed.episode || 1);
    });
    g.totalEpisodes = g.episodes.length;
    g.totalSeasons = g.seasons.size || 1;
    if ((!g.poster || g.poster === FALLBACK_POSTER) && g.episodes[0] && g.episodes[0].p) {
      g.poster = g.episodes[0].p;
    }
    g.u = g.episodes[0] ? g.episodes[0].u : '';
    g.t = g.seriesName;
    g.p = g.poster;
  });

  return {
    groups: groupList,
    nonSeries: dedupedNonSeries
  };
}

// =====================================================================
// AVALIAÇÕES E ESTRELAS DINÂMICAS (HIGH QUALITY RATINGS)
// =====================================================================
function getMediaRating(item) {
  if (item && item.rating && typeof item.rating === 'number') {
    return item.rating;
  }
  const key = String(
    (item && (item.seriesName || item.canonical_title || item.t || item.id)) || 'default'
  ).toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);
  // Gera avaliações de alta qualidade entre 8.5 e 9.8 ("pra mostrar que tão sendo bom")
  const rating = 8.5 + ((abs % 130) / 130) * 1.3;
  return Math.round(rating * 10) / 10;
}

function renderStarsVisualHtml(rating) {
  const starValue = rating / 2; // entre 4.25 e 4.9 estrelas
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(starValue)) {
      stars += '<span class="star is-filled">★</span>';
    } else if (i - 0.5 <= starValue) {
      stars += '<span class="star is-half">★</span>';
    } else {
      stars += '<span class="star is-empty">☆</span>';
    }
  }
  return stars;
}

// =====================================================================
// CRIAÇÃO DE CARDS (SUPORTE A CAPÍTULOS, BADGES E AGRUPAMENTO)
// =====================================================================
function createSeriesGroupCard(group, index) {
  const card = document.createElement('div');
  card.className = 'video-card is-series-group';

  const posterUrl = group.poster && group.poster.startsWith('http') ? group.poster : FALLBACK_POSTER;
  const categoryName = group.catNome || 'Série';
  const rating = getMediaRating(group);

  card.innerHTML = `
    <div class="card-poster">
      <img src="${posterUrl}" alt="${escapeHtml(group.seriesName)}" loading="lazy" onerror="this.src='${FALLBACK_POSTER}'">
      <span class="card-badge group-badge">${group.totalEpisodes} EPISÓDIOS</span>
      <span class="card-rating-badge"><span class="star-icon">★</span> <span>${rating.toFixed(1)}</span></span>
      <div class="card-play-overlay">
        <div class="play-circle" title="Ver Episódios">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </div>
      </div>
    </div>
    <div class="card-body">
      <div class="card-chapter-pill">
        <span class="pill-dot"></span>
        <span>${group.totalSeasons} Temporada${group.totalSeasons > 1 ? 's' : ''}</span>
      </div>
      <h4 class="card-title" title="${escapeHtml(group.seriesName)}">${escapeHtml(group.seriesName)}</h4>
      <span class="card-category">${escapeHtml(categoryName)}</span>
      <div class="card-actions">
        <button class="btn-card-action btn-view-series" title="Explorar todos os episódios">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
          Ver Capítulos
        </button>
      </div>
    </div>
  `;

  card.querySelector('.card-play-overlay').onclick = () => openSeriesModal(group);
  card.querySelector('.btn-view-series').onclick = (e) => {
    e.stopPropagation();
    openSeriesModal(group);
  };

  return card;
}

function createVideoCard(item, index) {
  if (item.isGroup) {
    return createSeriesGroupCard(item, index);
  }

  const card = document.createElement('div');
  card.className = 'video-card';

  const posterUrl = item.p && item.p.startsWith('http') ? item.p : FALLBACK_POSTER;
  const categoryName = item.catNome || 'Filmes & Séries';
  const epInfo = parseEpisodeInfo(item.t);

  const isAdmin = state.currentUser && state.currentUser.role === 'admin';
  const isClient = !isAdmin;

  // Se NÃO for admin (cliente ou visitante), o botão de copiar link NÃO É RENDERIZADO! Apenas assistir.
  const copyBtnHtml = isAdmin ? `
    <button class="btn-card-action btn-copy" title="Copiar Link de Vídeo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      Link
    </button>
  ` : '';

  const isAnime = item.is_anime || (item.id && String(item.id).startsWith('ani_')) || (item.catNome && item.catNome.includes('ANIMES'));
  const isAnimeSeries = isAnime && (item.total_episodios > 1 || !item.u || item.u.includes('/api/animes/resolve'));
  const rating = getMediaRating(item);

  // Se for anime, série ou episódio, exibe badge contextual
  let badgeHtml;
  if (isAnime) {
    badgeHtml = `<span class="card-badge anime-badge">🌸 ANIME</span>`;
  } else if (epInfo.isEpisode) {
    badgeHtml = `<span class="card-badge series-badge">${epInfo.badge}</span>`;
  } else {
    badgeHtml = `<span class="card-badge">HD / 4K</span>`;
  }

  const chapterPillHtml = isAnime
    ? `<div class="card-chapter-pill"><span class="pill-dot"></span><span>${item.total_episodios ? item.total_episodios + ' Episódios' : 'Temporada Completa'}</span></div>`
    : (epInfo.isEpisode
      ? `<div class="card-chapter-pill"><span class="pill-dot"></span><span>${escapeHtml(epInfo.seasonLabel || epInfo.label)}</span></div>`
      : '');

  const displayTitle = epInfo.isEpisode ? epInfo.seriesName : item.t;
  const savedWatch = item.historyItem || (item.id ? WatchHistory.get(item.id) : null);
  const progressBarHtml = (savedWatch && savedWatch.progress_percent > 0) ? `
    <div class="continue-progress-bar-bg" style="position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: rgba(255,255,255,0.2); z-index: 4;">
      <div class="continue-progress-bar-fill" style="width: ${savedWatch.progress_percent}%; height: 100%; background: linear-gradient(90deg, var(--accent-pink), var(--accent-cyan));"></div>
    </div>
  ` : '';

  const mainActionBtnHtml = isAnimeSeries ? `
    <button class="btn-card-action btn-view-series btn-anime-episodes" title="Ver todos os episódios">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </svg>
      Ver Capítulos
    </button>
  ` : `
    <button class="btn-card-action btn-play" title="Assistir Agora">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
      Assistir
    </button>
  `;

  card.innerHTML = `
    <div class="card-poster">
      <img src="${posterUrl}" alt="${escapeHtml(item.t)}" loading="lazy" decoding="async" onerror="this.src='${FALLBACK_POSTER}'">
      ${badgeHtml}
      <span class="card-rating-badge"><span class="star-icon">★</span> <span>${rating.toFixed(1)}</span></span>
      ${progressBarHtml}
      <div class="card-play-overlay">
        <div class="play-circle" title="${isAnimeSeries ? 'Ver Episódios' : 'Assistir'}">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </div>
      </div>
    </div>
    <div class="card-body">
      ${chapterPillHtml}
      <h4 class="card-title" title="${escapeHtml(item.t)}">${escapeHtml(displayTitle)}</h4>
      <span class="card-category">${escapeHtml(categoryName)}</span>
      <div class="card-actions">
        ${mainActionBtnHtml}
        ${isAnimeSeries ? '' : copyBtnHtml}
      </div>
    </div>
  `;

  if (item.isHistory && item.historyItem) {
    card.onclick = () => resumeFromHistory(item.historyItem);
    return card;
  }

  // Permite clicar em todo o card para navegar ou assistir
  card.style.cursor = 'pointer';

  // Eventos de Reprodução (Animes abrem o modal completo de episódios/áudios)
  if (isAnime) {
    card.onclick = () => openAnimeModal(item);
    const playOverlay = card.querySelector('.card-play-overlay');
    if (playOverlay) playOverlay.onclick = (e) => { e.stopPropagation(); openAnimeModal(item); };
    const btnAction = card.querySelector('.btn-view-series, .btn-play');
    if (btnAction) btnAction.onclick = (e) => { e.stopPropagation(); openAnimeModal(item); };
  } else {
    card.onclick = () => openPlayer(item.t, categoryName, item.u, item);
    const playOverlay = card.querySelector('.card-play-overlay');
    if (playOverlay) playOverlay.onclick = (e) => { e.stopPropagation(); openPlayer(item.t, categoryName, item.u, item); };
    const btnAction = card.querySelector('.btn-play');
    if (btnAction) btnAction.onclick = (e) => { e.stopPropagation(); openPlayer(item.t, categoryName, item.u, item); };
  }

  const btnCopy = card.querySelector('.btn-copy');
  if (btnCopy) {
    btnCopy.onclick = (e) => {
      e.stopPropagation();
      copyToClipboard(item.u);
    };
  }

  // Previne menu de contexto e inspeção para clientes
  if (isClient) {
    card.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  return card;
}

// =====================================================================
// BUSCA DE TÍTULOS
// =====================================================================
async function handleSearch(query) {
  state.searchQuery = query;
  if (!query) {
    if (state.activeType === 'animes' || state.activeCategoryId === 'animes') {
      loadAnimesPage(1, '', '', state.animePagination.sort);
    } else if (state.activeCategoryId === 'destaques') {
      loadDestaques();
    } else {
      selectCategory(state.activeCategoryId, dom.currentViewTitle.textContent);
    }
    return;
  }

  // Busca rápida e leve na engine de animes se estiver na aba de animes
  if (state.activeType === 'animes' || state.activeCategoryId === 'animes') {
    dom.currentViewTitle.textContent = `Resultados em Animes para: "${query}"`;
    loadAnimesPage(1, query, '', state.animePagination.sort);
    return;
  }

  dom.currentViewTitle.textContent = `Resultados para: "${query}"`;
  dom.cardsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #94a3b8;">Pesquisando em todo o catálogo...</div>';
  dom.loadMoreContainer.style.display = 'none';

  try {
    const apiResp = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (apiResp.ok) {
      const results = await apiResp.json();
      displaySearchResults(results, query);
      return;
    }
  } catch (e) {
    // API indisponível, fallback resiliente em memória
  }

  const lowerQ = query.toLowerCase();
  const pool = state.rawItems || state.currentItems || [];
  const matched = pool.filter(item => item.t && item.t.toLowerCase().includes(lowerQ));

  // Inclui animes do catálogo estático no fallback
  if (!state.staticAnimesList) {
    try {
      const aResp = await fetch('/data/animes.json');
      if (aResp.ok) state.staticAnimesList = await aResp.json();
    } catch (err) {}
  }

  const animeMatches = (state.staticAnimesList || []).filter(a => {
    const t = (a.canonical_title || a.t || '').toLowerCase();
    const aliases = (a.aliases || []).map(al => String(al).toLowerCase());
    return t.includes(lowerQ) || aliases.some(al => al.includes(lowerQ));
  }).map(a => ({
    id: a.id,
    t: a.canonical_title || a.t,
    p: a.poster || a.p,
    catNome: '🌸 ANIMES | Catálogo Oficial',
    u: a.u || `/api/animes/resolve?anime_id=${a.id}&ep=1&s=1`,
    is_anime: true,
    total_episodios: a.total_episodios || 1,
    sinopse: a.sinopse || ''
  }));

  displaySearchResults([...animeMatches, ...matched], query);
}

function displaySearchResults(results, query) {
  // Deduplicação estrita de resultados de busca global
  const seenSearchKeys = new Set();
  const seenPosters = new Set();
  const dedupedResults = (results || []).filter(it => {
    const rawTitle = it.canonical_title || it.t || '';
    const normKey = rawTitle.toLowerCase()
      .replace(/\[.*?\]|\(.*?\)|4k|uhd|fhd|hd|dublado|legendado|lançamento|lancamento/g, '')
      .replace(/[^a-z0-9]/g, '');
    if (normKey && normKey.length >= 3) {
      if (seenSearchKeys.has(normKey)) return false;
      seenSearchKeys.add(normKey);
    }
    const posterUrl = it.p || it.poster || '';
    if (posterUrl && posterUrl.includes('image.tmdb.org')) {
      const posterFile = posterUrl.split('/').pop();
      if (posterFile && seenPosters.has(posterFile)) return false;
      seenPosters.add(posterFile);
    }
    return true;
  });

  state.rawItems = dedupedResults;
  state.displayedCount = 0;
  dom.cardsGrid.innerHTML = '';

  if (!results.length) {
    dom.cardsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
        <h3 style="font-size: 1.2rem; margin-bottom: 8px;">Nenhum título encontrado para "${escapeHtml(query)}"</h3>
        <p style="color: #64748b;">Tente buscar por termos mais simples como "Matrix", "Vingadores", "Stranger" ou "Batman".</p>
      </div>
    `;
    dom.itemsFoundText.textContent = `0 títulos encontrados`;
    return;
  }

  refreshCatalogDisplay();
  dom.itemsFoundText.textContent = `${results.length.toLocaleString()} títulos encontrados`;
}

// =====================================================================
// PLAYER DE VÍDEO & NAVEGAÇÃO DE SÉRIES
// =====================================================================
function openPlayer(title, category, url, itemObj = null, customResumeSeconds = 0) {
  // Pausa o vídeo de fundo do Hero para não competir com o player
  if (dom.heroVideo) {
    try { dom.heroVideo.pause(); } catch(e) {}
  }

  // Se for um anime oficial ou rota de resolução de anime, delega para o modal de episódios oficial
  if (url && (url.includes('/api/animes/resolve') || (itemObj && itemObj.is_anime))) {
    const animeObj = itemObj || {
      id: (itemObj && itemObj.id) || '',
      t: title,
      catNome: category || '🌸 ANIMES | Catálogo Oficial',
      p: (itemObj && itemObj.p) || '',
      u: url,
      is_anime: true
    };
    openAnimeModal(animeObj);
    return;
  }

  dom.modalVideoTitle.textContent = title;
  dom.modalCategoryBadge.textContent = category;

  const playerRatingVal = getMediaRating(itemObj || { t: title });
  let playerRatingEl = document.getElementById('playerModalRating');
  if (!playerRatingEl && dom.modalCategoryBadge && dom.modalCategoryBadge.parentNode) {
    playerRatingEl = document.createElement('span');
    playerRatingEl.id = 'playerModalRating';
    playerRatingEl.className = 'badge';
    playerRatingEl.style.cssText = 'background: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.4); font-weight: 700; margin-left: 6px;';
    dom.modalCategoryBadge.parentNode.insertBefore(playerRatingEl, dom.modalCategoryBadge.nextSibling);
  }
  if (playerRatingEl) {
    playerRatingEl.innerHTML = `<span style="color:#fbbf24;">★</span> ${playerRatingVal.toFixed(1)} <span style="font-size:0.75rem; color:#f59e0b; margin-left:2px;">${renderStarsVisualHtml(playerRatingVal)}</span>`;
  }

  // Informações de Episódio / Navegação Binge
  const epInfo = parseEpisodeInfo(title);
  if (epInfo.isEpisode) {
    if (dom.modalEpisodeBadge) {
      dom.modalEpisodeBadge.textContent = epInfo.badge;
      dom.modalEpisodeBadge.style.display = 'inline-block';
    }
    setupPlayerSeriesNavigation(epInfo, url, category);
  } else {
    if (dom.modalEpisodeBadge) dom.modalEpisodeBadge.style.display = 'none';
    if (dom.playerEpisodeNav) dom.playerEpisodeNav.style.display = 'none';
    if (dom.playerSeriesStrip) dom.playerSeriesStrip.style.display = 'none';
    state.activeSeriesContext = null;
  }

  // Rastreamento de histórico (WatchHistory)
  const contentId = (itemObj && itemObj.id) ? itemObj.id : (url || title);
  const poster = (itemObj && itemObj.p) ? itemObj.p : '';
  const isAnime = (itemObj && itemObj.is_anime) || (category && category.includes('Anime'));

  WatchHistory.startTracking({
    content_id: contentId,
    content_type: isAnime ? 'anime' : (epInfo.isEpisode ? 'series' : 'movie'),
    title: epInfo.isEpisode ? epInfo.seriesName : title,
    episode_title: epInfo.isEpisode ? (epInfo.seasonLabel || epInfo.label || title) : '',
    season_number: epInfo.season || 1,
    episode_number: epInfo.episode || 1,
    poster: poster,
    stream_url: url,
    category: category
  });

  const savedWatch = WatchHistory.get(contentId);
  const resumePos = customResumeSeconds > 0
    ? customResumeSeconds
    : (savedWatch && savedWatch.position_seconds > 10 && savedWatch.progress_percent < 95
        ? savedWatch.position_seconds
        : 0);

  // Apenas admin tem visualização e cópia do link direto
  const isAdmin = state.currentUser && state.currentUser.role === 'admin';
  if (isAdmin) {
    if (dom.streamUrlDisplay) dom.streamUrlDisplay.value = url;
    if (dom.btnModalOpenVlc) {
      dom.btnModalOpenVlc.href = `vlc://${url}`;
      dom.btnModalOpenVlc.style.display = 'inline-flex';
    }
    if (dom.btnCopyModalUrl) dom.btnCopyModalUrl.style.display = 'inline-flex';
  } else {
    if (dom.streamUrlDisplay) {
      dom.streamUrlDisplay.value = '';
      dom.streamUrlDisplay.removeAttribute('value');
    }
    if (dom.btnModalOpenVlc) {
      dom.btnModalOpenVlc.removeAttribute('href');
      dom.btnModalOpenVlc.style.display = 'none';
    }
    if (dom.btnCopyModalUrl) {
      dom.btnCopyModalUrl.style.display = 'none';
    }
  }

  openModal(dom.playerModal);

  const video = dom.htmlVideoPlayer;
  dom.playerLoading.classList.add('active');

  // Previne menu de contexto e clique direito no player para clientes
  if (!isAdmin) {
    video.oncontextmenu = (e) => { e.preventDefault(); return false; };
  }

  if (state.hlsPlayer) {
    state.hlsPlayer.destroy();
    state.hlsPlayer = null;
  }

  const playableUrl = getPlayableUrl(url);

  const applyResumeTime = () => {
    if (resumePos > 10) {
      try {
        video.currentTime = resumePos;
        const m = Math.floor(resumePos / 60);
        const s = Math.floor(resumePos % 60);
        showToast(`▶ Continuando de ${m}:${s.toString().padStart(2, '0')}`);
      } catch (e) {}
    }
  };

  if (url.includes('.m3u8')) {
    if (Hls.isSupported()) {
      state.hlsPlayer = new Hls({
        debug: false,
        enableWorker: true
      });
      state.hlsPlayer.loadSource(playableUrl);
      state.hlsPlayer.attachMedia(video);
      state.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
        dom.playerLoading.classList.remove('active');
        applyResumeTime();
        video.play().catch(() => console.log('Autoplay com som restrito pelo navegador'));
      });
      state.hlsPlayer.on(Hls.Events.ERROR, (event, errData) => {
        dom.playerLoading.classList.remove('active');
        if (errData && errData.fatal) {
          showPlayerError('Instabilidade na conexão com o servidor de vídeo. Clique abaixo para tentar novamente.', () => {
            openPlayer(title, category, url, itemObj, customResumeSeconds);
          });
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playableUrl;
      video.onloadedmetadata = applyResumeTime;
      video.onerror = () => {
        showPlayerError('Não foi possível carregar a transmissão deste vídeo. O arquivo pode estar temporariamente fora do ar.', () => {
          openPlayer(title, category, url, itemObj, customResumeSeconds);
        });
      };
      video.play().catch(() => console.log('Autoplay bloqueado'));
    }
  } else {
    video.src = playableUrl;
    video.onloadedmetadata = applyResumeTime;
    video.onerror = () => {
      showPlayerError('Não foi possível carregar a transmissão deste vídeo. O arquivo pode estar temporariamente fora do ar.', () => {
        openPlayer(title, category, url, itemObj, customResumeSeconds);
      });
    };
    video.load();
    video.play().then(() => {
      dom.playerLoading.classList.remove('active');
    }).catch(() => {
      dom.playerLoading.classList.remove('active');
    });
  }

  // Auto-play próximo episódio ao finalizar o vídeo
  video.onended = () => {
    if (state.activeSeriesContext) {
      const { currentIndex, episodes } = state.activeSeriesContext;
      if (currentIndex < episodes.length - 1) {
        showToast('Próximo capítulo iniciando...');
        setTimeout(() => playNextEpisode(), 1500);
      }
    }
  };

  // Fallback inteligente caso o navegador bloqueie o stream direto
  video.onerror = () => {
    if (!dom.playerModal || !dom.playerModal.classList.contains('active')) {
      return;
    }
    dom.playerLoading.classList.remove('active');
    const proxiedUrl = getPlayableUrl(url, true);
    if (!video.src.includes('/api/stream') && video.src !== proxiedUrl && dom.playerModal.classList.contains('active')) {
      console.log('Tentando reproduzir através do proxy seguro /api/stream...');
      video.src = proxiedUrl;
      video.load();
      video.play().catch(() => { });
    } else {
      showPlayerError('Instabilidade temporária na transmissão. Clique abaixo para tentar novamente.', () => {
        openPlayer(title, category, url, itemObj, customResumeSeconds);
      });
    }
  };

  const hidePlayerLoading = () => {
    if (dom.playerLoading) {
      dom.playerLoading.classList.remove('active');
    }
  };

  video.oncanplay = hidePlayerLoading;
  video.onplaying = hidePlayerLoading;
  video.onloadeddata = hidePlayerLoading;
  video.onplay = hidePlayerLoading;
  video.onwaiting = null;
}

function setupPlayerSeriesNavigation(epInfo, currentUrl, category) {
  let pool = state.rawItems || state.currentItems || [];
  let seriesEpisodes = pool.filter(it => {
    if (!it.t) return false;
    const itEp = parseEpisodeInfo(it.t);
    return itEp.isEpisode && itEp.seriesName.toLowerCase() === epInfo.seriesName.toLowerCase();
  });

  if (!seriesEpisodes.length) {
    if (dom.playerEpisodeNav) dom.playerEpisodeNav.style.display = 'none';
    if (dom.playerSeriesStrip) dom.playerSeriesStrip.style.display = 'none';
    state.activeSeriesContext = null;
    return;
  }

  seriesEpisodes.sort((a, b) => {
    const epA = parseEpisodeInfo(a.t);
    const epB = parseEpisodeInfo(b.t);
    const sDiff = (epA.season || 1) - (epB.season || 1);
    if (sDiff !== 0) return sDiff;
    return (epA.episode || 1) - (epB.episode || 1);
  });

  const currentIndex = seriesEpisodes.findIndex(it => it.u === currentUrl || it.t === epInfo.cleanTitle || (parseEpisodeInfo(it.t).season === epInfo.season && parseEpisodeInfo(it.t).episode === epInfo.episode));
  const activeIdx = currentIndex >= 0 ? currentIndex : 0;

  state.activeSeriesContext = {
    seriesName: epInfo.seriesName,
    category,
    episodes: seriesEpisodes,
    currentIndex: activeIdx
  };

  // Atualiza botões Anterior / Próximo
  if (dom.playerEpisodeNav) {
    dom.playerEpisodeNav.style.display = 'inline-flex';
    if (dom.btnPrevEp) dom.btnPrevEp.disabled = activeIdx <= 0;
    if (dom.btnNextEp) dom.btnNextEp.disabled = activeIdx >= seriesEpisodes.length - 1;
  }

  // Atualiza barra de capítulos
  if (dom.playerSeriesStrip && dom.playerStripScroll) {
    dom.playerSeriesStrip.style.display = 'flex';
    if (dom.stripSeriesName) dom.stripSeriesName.textContent = epInfo.seriesName;
    if (dom.stripEpCount) dom.stripEpCount.textContent = `${seriesEpisodes.length} capítulos`;

    dom.playerStripScroll.innerHTML = '';
    seriesEpisodes.forEach((epItem, idx) => {
      const parsedEp = parseEpisodeInfo(epItem.t);
      const btn = document.createElement('button');
      btn.className = `btn-strip-ep ${idx === activeIdx ? 'active' : ''}`;
      btn.textContent = parsedEp.badge || `EP ${idx + 1}`;
      btn.title = epItem.t;
      btn.onclick = () => {
        openPlayer(epItem.t, category, epItem.u, epItem);
      };
      dom.playerStripScroll.appendChild(btn);

      if (idx === activeIdx) {
        setTimeout(() => btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }), 100);
      }
    });
  }
}

function playPreviousEpisode() {
  if (!state.activeSeriesContext) return;
  const { episodes, currentIndex, category } = state.activeSeriesContext;
  if (currentIndex > 0) {
    const prevEp = episodes[currentIndex - 1];
    openPlayer(prevEp.t, category, prevEp.u, prevEp);
  }
}

function playNextEpisode() {
  if (!state.activeSeriesContext) return;
  const { episodes, currentIndex, category } = state.activeSeriesContext;
  if (currentIndex < episodes.length - 1) {
    const nextEp = episodes[currentIndex + 1];
    openPlayer(nextEp.t, category, nextEp.u, nextEp);
  }
}

// =====================================================================
// MODAL DE DETALHES DA SÉRIE (TEMPORADAS & LISTA DE EPISÓDIOS)
// =====================================================================
function openSeriesModal(seriesGroup) {
  state.activeSeriesGroup = seriesGroup;

  dom.seriesModalPoster.src = seriesGroup.poster || FALLBACK_POSTER;
  dom.seriesModalPoster.onerror = () => { dom.seriesModalPoster.src = FALLBACK_POSTER; };
  dom.seriesModalTitle.textContent = seriesGroup.seriesName;
  dom.seriesModalCategory.textContent = seriesGroup.catNome || 'SÉRIE';
  dom.seriesModalTotalEpisodes.textContent = `${seriesGroup.totalEpisodes} episódios`;
  dom.seriesModalTotalSeasons.textContent = `${seriesGroup.totalSeasons} temporada${seriesGroup.totalSeasons > 1 ? 's' : ''}`;

  const rating = getMediaRating(seriesGroup);
  let ratingEl = document.getElementById('seriesModalRating');
  if (!ratingEl && dom.seriesModalTotalSeasons && dom.seriesModalTotalSeasons.parentNode) {
    ratingEl = document.createElement('span');
    ratingEl.id = 'seriesModalRating';
    ratingEl.className = 'meta-tag rating-meta-tag';
    dom.seriesModalTotalSeasons.parentNode.insertBefore(ratingEl, dom.seriesModalTotalSeasons.nextSibling);
  }
  if (ratingEl) {
    ratingEl.innerHTML = `<span class="star-icon">★</span> ${rating.toFixed(1)} <span style="font-size:0.75rem; color:#f59e0b; margin-left:2px;">${renderStarsVisualHtml(rating)}</span>`;
  }

  // Organiza episódios por temporada
  const seasonsMap = new Map();
  seriesGroup.episodes.forEach(ep => {
    const s = ep.parsed.season || 1;
    if (!seasonsMap.has(s)) seasonsMap.set(s, []);
    seasonsMap.get(s).push(ep);
  });

  const seasonNumbers = Array.from(seasonsMap.keys()).sort((a, b) => a - b);
  const activeSeason = seasonNumbers[0] || 1;

  // Renderiza tabs de temporadas
  dom.seriesSeasonsBar.innerHTML = '';
  seasonNumbers.forEach((sNum) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `season-tab-btn ${sNum === activeSeason ? 'active' : ''}`;
    tab.textContent = `Temporada ${sNum} (${seasonsMap.get(sNum).length})`;
    tab.onclick = () => {
      document.querySelectorAll('.season-tab-btn').forEach(b => b.classList.remove('active'));
      tab.classList.add('active');
      tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      renderSeasonEpisodes(seasonsMap.get(sNum), seriesGroup);
    };
    dom.seriesSeasonsBar.appendChild(tab);
  });

  renderSeasonEpisodes(seasonsMap.get(activeSeason) || seriesGroup.episodes, seriesGroup);

  openModal(dom.seriesModal);
}

function renderSeasonEpisodes(episodes, seriesGroup) {
  dom.seriesEpisodesGrid.innerHTML = '';

  if (!episodes || !episodes.length) {
    dom.seriesEpisodesGrid.innerHTML = '<div style="color: #64748b; padding: 20px;">Nenhum episódio encontrado nesta temporada.</div>';
    return;
  }

  episodes.forEach(ep => {
    const itemEl = document.createElement('div');
    itemEl.className = 'series-ep-item';

    const parsed = ep.parsed;
    const epTitle = parsed.episodeTitle || (parsed.episode ? `Episódio ${parsed.episode}` : (parsed.fullLabel || parsed.label));

    itemEl.innerHTML = `
      <div class="series-ep-info">
        <span class="series-ep-badge">${parsed.badge}</span>
        <span class="series-ep-title" title="${escapeHtml(ep.t)}">${escapeHtml(epTitle)}</span>
      </div>
      <button class="series-ep-play-btn" title="Assistir ${escapeHtml(parsed.badge)}">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </button>
    `;

    itemEl.onclick = () => {
      closeModal(dom.seriesModal);
      openPlayer(ep.t, seriesGroup.catNome || 'Série', ep.u, ep);
    };

    dom.seriesEpisodesGrid.appendChild(itemEl);
  });
}

function getPlayableUrl(rawUrl, forceProxy = false) {
  if (!rawUrl) return '';
  // Se for workers.dev, já possui HTTPS nativo com SSL Cloudflare e CORS liberado
  if (rawUrl.includes('.workers.dev')) {
    return rawUrl.replace(/^http:\/\//i, 'https://');
  }
  // Se estiver rodando em HTTPS (ex: Vercel) ou forçado:
  // Navegadores bloqueiam streams HTTP (Mixed Content).
  // O proxy /api/stream resolve os redirecionamentos no backend e entrega via HTTPS.
  if (forceProxy || window.location.protocol === 'https:' || (!rawUrl.startsWith('http://localhost') && !rawUrl.startsWith('http://127.0.0.1') && window.location.hostname.includes('vercel.app'))) {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return `/api/stream?url=${encodeURIComponent(rawUrl)}`;
    }
  }
  return rawUrl;
}

function stopVideoPlayback() {
  WatchHistory.flushCurrent();
  if (dom.playerErrorOverlay) {
    dom.playerErrorOverlay.style.display = 'none';
  }
  if (dom.iframeVideoPlayer) {
    dom.iframeVideoPlayer.src = 'about:blank';
    dom.iframeVideoPlayer.style.display = 'none';
  }
  if (dom.htmlVideoPlayer) {
    dom.htmlVideoPlayer.style.display = 'block';
  }
  if (dom.playerAnimeControls) {
    dom.playerAnimeControls.style.display = 'none';
  }
  const video = dom.htmlVideoPlayer;
  if (video) {
    // Remove callbacks para evitar loops ou re-ativação acidental
    video.onerror = null;
    video.onplaying = null;
    video.onwaiting = null;
    video.oncanplay = null;
    video.onloadeddata = null;

    // Pausa imediata
    try {
      video.pause();
    } catch (e) { }

    // Limpa fontes de reprodução e tempo
    video.removeAttribute('src');
    video.srcObject = null;
    video.src = '';
    video.currentTime = 0;

    // Força o navegador a descarregar buffers de áudio/vídeo da memória
    try {
      video.load();
    } catch (e) { }
  }

  // Destrói Hls.js se ativo
  if (state.hlsPlayer) {
    try {
      state.hlsPlayer.stopLoad();
      state.hlsPlayer.detachMedia();
      state.hlsPlayer.destroy();
    } catch (e) { }
    state.hlsPlayer = null;
  }
}

function showPlayerError(message, retryCallback = null) {
  if (dom.playerLoading) dom.playerLoading.classList.remove('active');
  if (dom.iframeVideoPlayer) {
    dom.iframeVideoPlayer.style.display = 'none';
    dom.iframeVideoPlayer.src = 'about:blank';
  }
  if (dom.htmlVideoPlayer) {
    dom.htmlVideoPlayer.style.display = 'none';
  }
  if (dom.playerErrorOverlay) {
    if (dom.playerErrorDesc) {
      dom.playerErrorDesc.textContent = message || 'O servidor de origem deste vídeo está passando por manutenção ou instabilidade temporária.';
    }
    dom.playerErrorOverlay.style.display = 'flex';
    if (dom.btnPlayerRetry) {
      dom.btnPlayerRetry.onclick = () => {
        dom.playerErrorOverlay.style.display = 'none';
        if (retryCallback) retryCallback();
      };
    }
    if (dom.btnPlayerClose) {
      dom.btnPlayerClose.onclick = () => {
        closePlayerModal();
      };
    }
  }
}

function closePlayerModal() {
  stopVideoPlayback();
  if (dom.playerModal) {
    closeModal(dom.playerModal);
  }
  // Retoma o vídeo de fundo do Hero se estiver visível
  if (dom.heroVideo && dom.heroVideo.classList.contains('is-playing')) {
    try { dom.heroVideo.play().catch(() => {}); } catch(e) {}
  }
  // Garantia absoluta de desbloqueio da rolagem da página
  const anyActive = document.querySelector('.modal-overlay.active');
  if (!anyActive && (!dom.loginScreen || dom.loginScreen.style.display !== 'flex')) {
    document.body.classList.remove('modal-open');
  }
}

// =====================================================================
// UTILITÁRIOS
// =====================================================================
function copyToClipboard(text) {
  // Apenas Admin pode copiar links
  if (state.currentUser && state.currentUser.role === 'cliente') {
    return;
  }

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text);
  } else {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  }

  showToast('Copiado com sucesso!');
}

function showToast(msg) {
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  setTimeout(() => dom.toast.classList.remove('show'), 3000);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, function (m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m];
  });
}

// =====================================================================
// INTEGRAÇÃO DE ANIMES: MODAL, EPISÓDIOS, ÁUDIO & STREAM RESOLUTION
// =====================================================================
async function openAnimeModal(animeItem, targetSeason = null, targetEpisode = null, resumePosition = 0) {
  const animeId = animeItem.id || animeItem.t;
  dom.seriesModalPoster.src = animeItem.p || FALLBACK_POSTER;
  dom.seriesModalTitle.textContent = animeItem.t;
  dom.seriesModalCategory.textContent = '🌸 ANIME OFICIAL';
  dom.seriesModalTotalEpisodes.textContent = 'Carregando episódios...';
  dom.seriesModalTotalSeasons.textContent = 'Carregando...';

  const rating = getMediaRating(animeItem);
  let ratingEl = document.getElementById('seriesModalRating');
  if (!ratingEl && dom.seriesModalTotalSeasons && dom.seriesModalTotalSeasons.parentNode) {
    ratingEl = document.createElement('span');
    ratingEl.id = 'seriesModalRating';
    ratingEl.className = 'meta-tag rating-meta-tag';
    dom.seriesModalTotalSeasons.parentNode.insertBefore(ratingEl, dom.seriesModalTotalSeasons.nextSibling);
  }
  if (ratingEl) {
    ratingEl.innerHTML = `<span class="star-icon">★</span> ${rating.toFixed(1)} <span style="font-size:0.75rem; color:#f59e0b; margin-left:2px;">${renderStarsVisualHtml(rating)}</span>`;
  }

  dom.seriesSeasonsBar.innerHTML = '';
  dom.seriesEpisodesGrid.innerHTML = '<div style="color: #94a3b8; padding: 25px;">Carregando catálogo de episódios...</div>';

  if (dom.modalAudioSwitchGroup) {
    dom.modalAudioSwitchGroup.style.display = 'inline-flex';
    [dom.btnModalAudioLeg, dom.btnAudioLeg].forEach(b => b?.classList.toggle('active', state.activeAnimeAudio === 'legendado'));
    [dom.btnModalAudioDub, dom.btnAudioDub].forEach(b => b?.classList.toggle('active', state.activeAnimeAudio === 'dublado'));
  }

  updateFavoriteButtons(animeId);
  openModal(dom.seriesModal);

  try {
    let details = null;
    try {
      const resp = await fetch(`/api/animes/details?id=${encodeURIComponent(animeId)}`);
      if (resp.ok) {
        details = await resp.json();
      }
    } catch (apiErr) {
      console.warn('API /api/animes/details indisponível, buscando no fallback estático...', apiErr);
    }

    if (!details || !details.id) {
      if (!state.staticAnimeDetailsMap) {
        try {
          const resp = await fetch('/data/animes_details.json');
          if (resp.ok) {
            state.staticAnimeDetailsMap = await resp.json();
          }
        } catch (e) {
          console.warn('Falha ao carregar /data/animes_details.json', e);
        }
      }
      if (state.staticAnimeDetailsMap && state.staticAnimeDetailsMap[animeId]) {
        details = state.staticAnimeDetailsMap[animeId];
      }
    }

    if (!details || !details.id) {
      throw new Error('Falha ao carregar detalhes do anime');
    }

    const defaultSeason = targetSeason || (details.seasons && details.seasons[0] ? details.seasons[0].season_number : 1);
    state.activeAnimeContext = {
      animeId: details.id,
      details: details,
      seasons: details.seasons || [],
      activeSeasonNumber: defaultSeason,
      currentEpisode: null
    };

    dom.seriesModalPoster.src = details.poster || animeItem.p || FALLBACK_POSTER;
    dom.seriesModalTitle.textContent = details.canonical_title;
    const totEps = details.total_episodes || (details.seasons ? details.seasons.reduce((acc, s) => acc + (s.episodes ? s.episodes.length : 0), 0) : 0);
    const totSeas = details.total_seasons || (details.seasons ? details.seasons.length : 1);
    dom.seriesModalTotalEpisodes.textContent = `${totEps} episódios`;
    dom.seriesModalTotalSeasons.textContent = `${totSeas} temporada${totSeas > 1 ? 's' : ''}`;

    renderAnimeSeasons(details);

    if (targetEpisode) {
      const allSeasons = details.seasons || [];
      const sObj = allSeasons.find(s => s.season_number === defaultSeason) || allSeasons[0];
      if (sObj && sObj.episodes) {
        const epObj = sObj.episodes.find(e => e.episode_number == targetEpisode);
        if (epObj) {
          closeModal(dom.seriesModal);
          playAnimeEpisode(epObj, details, state.activeAnimeAudio, null, null, resumePosition);
        }
      }
    }
  } catch (err) {
    console.error('Erro ao abrir modal do anime:', err);
    dom.seriesEpisodesGrid.innerHTML = '<div style="color: #ef4444; padding: 25px;">Erro ao carregar episódios deste anime. Tente novamente mais tarde.</div>';
  }
}

function renderAnimeSeasons(details) {
  dom.seriesSeasonsBar.innerHTML = '';
  const seasons = details.seasons || [];

  if (!seasons.length) {
    dom.seriesEpisodesGrid.innerHTML = '<div style="color: #64748b; padding: 20px;">Nenhum episódio cadastrado para este anime.</div>';
    return;
  }

  seasons.forEach((season) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    const isActive = season.season_number === state.activeAnimeContext.activeSeasonNumber;
    tab.className = `season-tab-btn ${isActive ? 'active' : ''}`;
    const epCount = season.episodes ? season.episodes.length : (season.episodes_count || 0);
    tab.textContent = `Temporada ${season.season_number} (${epCount})`;
    tab.onclick = () => {
      document.querySelectorAll('.season-tab-btn').forEach(b => b.classList.remove('active'));
      tab.classList.add('active');
      tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      state.activeAnimeContext.activeSeasonNumber = season.season_number;
      loadAnimeSeasonEpisodes(details.id, season.season_number, details);
    };
    dom.seriesSeasonsBar.appendChild(tab);
  });

  const firstSeason = seasons.find(s => s.season_number === state.activeAnimeContext.activeSeasonNumber) || seasons[0];
  loadAnimeSeasonEpisodes(details.id, firstSeason.season_number, details);
}

async function loadAnimeSeasonEpisodes(animeId, seasonNumber, details) {
  dom.seriesEpisodesGrid.innerHTML = '<div style="color: #94a3b8; padding: 25px;">Carregando episódios da Temporada ' + seasonNumber + '...</div>';
  try {
    const resp = await fetch(`/api/animes/episodes?anime_id=${encodeURIComponent(animeId)}&season=${seasonNumber}`);
    if (!resp.ok) throw new Error('Falha ao carregar episódios da temporada');
    const episodes = await resp.json();
    renderAnimeSeasonEpisodes(episodes, details);
  } catch (err) {
    console.error('Erro ao buscar episódios da temporada:', err);
    const season = details.seasons ? details.seasons.find(s => s.season_number === seasonNumber) : null;
    if (season && season.episodes && season.episodes.length) {
      renderAnimeSeasonEpisodes(season.episodes, details);
    } else {
      dom.seriesEpisodesGrid.innerHTML = '<div style="color: #ef4444; padding: 25px;">Erro ao carregar episódios desta temporada. Tente novamente.</div>';
    }
  }
}

function renderAnimeSeasonEpisodes(episodes, details) {
  dom.seriesEpisodesGrid.innerHTML = '';
  if (!episodes || !episodes.length) {
    dom.seriesEpisodesGrid.innerHTML = '<div style="color: #64748b; padding: 20px;">Nenhum episódio encontrado nesta temporada.</div>';
    return;
  }

  episodes.forEach(ep => {
    const itemEl = document.createElement('div');
    itemEl.className = 'series-ep-item';

    const hasDub = ep.audios && ep.audios.includes('dublado');
    const hasLeg = ep.audios && ep.audios.includes('legendado');
    let audioTag = '';
    if (hasDub && hasLeg) audioTag = '<span style="font-size:0.65rem; color:#a5b4fc; margin-left:6px;">[Dub/Leg]</span>';
    else if (hasDub) audioTag = '<span style="font-size:0.65rem; color:#f472b6; margin-left:6px;">[Dub]</span>';
    else audioTag = '<span style="font-size:0.65rem; color:#38bdf8; margin-left:6px;">[Leg]</span>';

    const epNumLabel = ep.episode_number % 1 === 0 ? ep.episode_number : ep.episode_number.toFixed(1);
    const epId = ep.id || `${details.id}_s${ep.season_number || 1}e${ep.episode_number}`;
    const saved = WatchHistory.get(epId);
    let progressBadge = '';
    if (saved && saved.progress_percent >= 90) {
      progressBadge = '<span style="font-size:0.65rem; color:#34d399; margin-left:6px; font-weight:700;">✓ Assistido</span>';
    } else if (saved && saved.position_seconds > 10) {
      const posM = Math.floor(saved.position_seconds / 60);
      progressBadge = `<span style="font-size:0.65rem; color:#ec4899; margin-left:6px; font-weight:700;">▶ ${saved.progress_percent}% (${posM}m)</span>`;
    }

    itemEl.innerHTML = `
      <div class="series-ep-info">
        <span class="series-ep-badge">EP ${epNumLabel}</span>
        <span class="series-ep-title" title="${escapeHtml(ep.title || details.canonical_title)}">
          ${escapeHtml(ep.title || 'Episódio ' + epNumLabel)} ${audioTag} ${progressBadge}
        </span>
      </div>
      <button class="series-ep-play-btn" title="Assistir Episódio ${epNumLabel}">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </button>
    `;

    itemEl.onclick = () => {
      closeModal(dom.seriesModal);
      playAnimeEpisode(ep, details, state.activeAnimeAudio);
    };

    dom.seriesEpisodesGrid.appendChild(itemEl);
  });
}

async function playAnimeEpisode(ep, details, preferredAudio = 'legendado', preferredProvider = null, preferredQuality = null, resumePosition = null) {
  if (!state.activeAnimeContext) {
    state.activeAnimeContext = { details, currentEpisode: ep };
  } else {
    state.activeAnimeContext.currentEpisode = ep;
  }
  const animeId = details.id;
  const username = state.currentUser ? state.currentUser.username : 'Kaynã';

  const epNumLabel = ep.episode_number % 1 === 0 ? ep.episode_number : ep.episode_number.toFixed(1);
  const animeEpId = ep.id || `${animeId}_s${ep.season_number || 1}e${ep.episode_number}`;
  const savedWatch = WatchHistory.get(animeEpId) || WatchHistory.get(animeId);
  const calculatedResume = (resumePosition !== null && resumePosition > 0)
    ? resumePosition
    : ((savedWatch && savedWatch.position_seconds > 10 && savedWatch.progress_percent < 95)
        ? savedWatch.position_seconds
        : ((dom.htmlVideoPlayer && !isNaN(dom.htmlVideoPlayer.currentTime) && dom.htmlVideoPlayer.currentTime > 1)
            ? dom.htmlVideoPlayer.currentTime
            : 0));

  WatchHistory.startTracking({
    content_id: animeEpId,
    content_type: 'anime',
    anime_id: animeId,
    episode_id: ep.id,
    title: details.canonical_title,
    episode_title: `T0${ep.season_number || 1} • EP ${epNumLabel}`,
    season_number: ep.season_number || 1,
    episode_number: ep.episode_number || 1,
    poster: details.poster || '',
    category: '🌸 Animes'
  });

  const targetResumeTime = calculatedResume;

  if (preferredProvider) state.activeAnimeProvider = preferredProvider;
  if (preferredQuality) state.activeAnimeQuality = preferredQuality;
  state.activeAnimeAudio = preferredAudio;

  // Configura títulos e badges do player
  dom.modalVideoTitle.textContent = `${details.canonical_title} - EP ${epNumLabel}`;
  dom.modalCategoryBadge.textContent = '🌸 ANIME';
  dom.modalEpisodeBadge.textContent = `T0${ep.season_number || 1} • EP ${epNumLabel}`;
  dom.modalEpisodeBadge.style.display = 'inline-block';

  // Controles de áudio e fonte no header do player
  if (dom.playerAnimeControls) {
    dom.playerAnimeControls.style.display = 'inline-flex';
    [dom.btnAudioLeg].forEach(b => b?.classList.toggle('active', preferredAudio === 'legendado'));
    [dom.btnAudioDub].forEach(b => b?.classList.toggle('active', preferredAudio === 'dublado'));
  }

  updateFavoriteButtons(animeId);
  openModal(dom.playerModal);
  dom.playerLoading.classList.add('active');

  // Limpa players anteriores
  stopVideoPlayback();

  try {
    // Prioriza fonte direta já embutida no episódio para eliminação total de latência
    let data = null;
    const epSources = (ep.sources || []).filter(s => s.provider !== 'animefire');
    if (epSources.length > 0) {
      const matchSrc = epSources.find(s => s.audio_type === preferredAudio && s.stream_url) ||
                       epSources.find(s => s.stream_url);
      if (matchSrc && matchSrc.stream_url) {
        data = {
          success: true,
          stream_url: matchSrc.stream_url,
          player_type: 'direct',
          audio_type: matchSrc.audio_type || preferredAudio,
          provider: matchSrc.provider || 'oficial',
          provider_label: 'Oficial Direct CDN',
          quality: matchSrc.quality || '1080p FHD',
          available_sources: epSources.map(s => ({
            provider: s.provider || 'oficial',
            provider_label: 'Oficial Direct CDN',
            quality: s.quality || '1080p FHD',
            quality_label: `${s.quality || '1080p FHD'} (Verificado)`,
            audio_type: s.audio_type || preferredAudio,
            player_type: 'direct',
            selected: s.id === matchSrc.id
          }))
        };
      }
    }

    // Se não tinha fonte direta embutida, consulta a API /api/animes/resolve
    if (!data || !data.stream_url) {
      try {
        let resolveUrl = `/api/animes/resolve?episode_id=${encodeURIComponent(ep.id)}&audio=${encodeURIComponent(preferredAudio)}`;
        if (state.activeAnimeProvider) resolveUrl += `&provider=${encodeURIComponent(state.activeAnimeProvider)}`;
        if (state.activeAnimeQuality) resolveUrl += `&quality=${encodeURIComponent(state.activeAnimeQuality)}`;

        const resp = await fetch(resolveUrl);
        if (resp.ok) {
          data = await resp.json();
        }
      } catch (apiErr) {
        console.warn('API /api/animes/resolve falhou ou indisponível:', apiErr);
      }
    }

    if (!data || !data.success || !data.stream_url) {
      throw new Error((data && data.error) || 'Vídeo temporariamente indisponível no servidor oficial.');
    }

    // Configura o Seletor de Servidor / Provedor
    if (dom.playerProviderSelect && data.available_sources) {
      const uniqueProvMap = new Map();
      data.available_sources.forEach(s => {
        if (!uniqueProvMap.has(s.provider)) {
          uniqueProvMap.set(s.provider, s);
        }
      });

      dom.playerProviderSelect.innerHTML = Array.from(uniqueProvMap.values()).map(p => `
        <option value="${p.provider}" ${p.provider === data.provider ? 'selected' : ''}>
          ⚡ Oficial Direct CDN
        </option>
      `).join('');

      dom.playerProviderSelect.onchange = (e) => {
        const newProv = e.target.value;
        state.activeAnimeProvider = newProv;
        const savedTime = dom.htmlVideoPlayer ? dom.htmlVideoPlayer.currentTime : 0;
        playAnimeEpisode(ep, details, state.activeAnimeAudio, newProv, state.activeAnimeQuality, savedTime);
      };
    }

    // Configura o Seletor de Qualidade / Resolução
    if (dom.playerQualitySelect && data.available_sources) {
      const curProvSources = data.available_sources.filter(s => s.provider === data.provider);
      const uniqueQualMap = new Map();
      curProvSources.forEach(s => {
        if (!uniqueQualMap.has(s.quality)) {
          uniqueQualMap.set(s.quality, s);
        }
      });

      if (uniqueQualMap.size === 0) {
        uniqueQualMap.set(data.quality || '1080p FHD', {
          quality: data.quality || '1080p FHD',
          quality_label: `${data.quality || '1080p FHD'} (Verificado)`
        });
      }

      dom.playerQualitySelect.innerHTML = Array.from(uniqueQualMap.values()).map(q => `
        <option value="${q.quality}" ${q.quality === data.quality ? 'selected' : ''}>
          ${q.quality_label || q.quality}
        </option>
      `).join('');

      dom.playerQualitySelect.onchange = (e) => {
        const newQual = e.target.value;
        state.activeAnimeQuality = newQual;
        const savedTime = dom.htmlVideoPlayer ? dom.htmlVideoPlayer.currentTime : 0;
        playAnimeEpisode(ep, details, state.activeAnimeAudio, data.provider, newQual, savedTime);
      };
    }

    // 100% PLAYER NATIVO HTML5 - NUNCA UTILIZAR IFRAME OU YOUTUBE
    if (dom.iframeVideoPlayer) {
      dom.iframeVideoPlayer.style.display = 'none';
      dom.iframeVideoPlayer.src = 'about:blank';
    }

    if (dom.htmlVideoPlayer) {
      dom.htmlVideoPlayer.style.display = 'block';

      const hideLoading = () => {
        if (dom.playerLoading) dom.playerLoading.classList.remove('active');
      };
      dom.htmlVideoPlayer.oncanplay = hideLoading;
      dom.htmlVideoPlayer.onplaying = hideLoading;
      dom.htmlVideoPlayer.onloadeddata = hideLoading;

      let hasFallenBack = false;
      dom.htmlVideoPlayer.onerror = () => {
        hideLoading();
        if (!hasFallenBack && data.available_sources && data.available_sources.length > 1) {
          hasFallenBack = true;
          const alt = data.available_sources.find(s => s.provider !== data.provider || s.audio_type !== data.audio_type);
          if (alt) {
            showToast(`Servidor atual instável. Alternando para ${alt.provider_label} (${alt.audio_type})...`);
            playAnimeEpisode(ep, details, alt.audio_type, alt.provider, alt.quality, targetResumeTime);
            return;
          }
        }
      };

        // CDNs externas necessitam de proxy CORS seguro
        const isRemote = (data.stream_url.startsWith('http://') || data.stream_url.startsWith('https://')) &&
          !data.stream_url.startsWith(window.location.origin);
        const playableUrl = isRemote
          ? `/api/stream?url=${encodeURIComponent(data.stream_url)}`
          : getPlayableUrl(data.stream_url);

        const isHls = data.stream_url.includes('.m3u8') ||
          data.stream_url.includes('/h.jpg') ||
          data.stream_url.includes('/p.jpg') ||
          data.stream_url.includes('maximaimg.online') ||
          data.stream_url.includes('akumast.net') ||
          data.player_type === 'hls' ||
          data.format === 'hls';

        if (isHls) {
          if (Hls.isSupported()) {
            state.hlsPlayer = new Hls({ debug: false, enableWorker: true });
            state.hlsPlayer.loadSource(playableUrl);
            state.hlsPlayer.attachMedia(dom.htmlVideoPlayer);
            state.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
              dom.playerLoading.classList.remove('active');
              if (targetResumeTime > 0) {
                dom.htmlVideoPlayer.currentTime = targetResumeTime;
              }
              dom.htmlVideoPlayer.play().catch(() => {});
            });
            state.hlsPlayer.on(Hls.Events.ERROR, (event, errData) => {
              if (errData.fatal) {
                dom.playerLoading.classList.remove('active');
                console.error('Erro fatal no player HLS:', errData);
                if (!hasFallenBack && data.available_sources && data.available_sources.length > 1) {
                  hasFallenBack = true;
                  const alt = data.available_sources.find(s => s.provider !== data.provider || s.audio_type !== data.audio_type);
                  if (alt) {
                    showToast(`Alternando para fonte secundária: ${alt.provider_label}...`);
                    playAnimeEpisode(ep, details, alt.audio_type, alt.provider, alt.quality, targetResumeTime);
                  }
                }
              }
            });
          } else if (dom.htmlVideoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            dom.htmlVideoPlayer.src = playableUrl;
            dom.htmlVideoPlayer.onloadedmetadata = () => {
              if (targetResumeTime > 0) dom.htmlVideoPlayer.currentTime = targetResumeTime;
            };
            dom.htmlVideoPlayer.play().catch(() => {});
            dom.playerLoading.classList.remove('active');
          } else {
            dom.htmlVideoPlayer.src = playableUrl;
            dom.htmlVideoPlayer.onloadedmetadata = () => {
              if (targetResumeTime > 0) dom.htmlVideoPlayer.currentTime = targetResumeTime;
            };
            dom.htmlVideoPlayer.play().catch(() => {});
            dom.playerLoading.classList.remove('active');
          }
        } else {
          dom.htmlVideoPlayer.src = playableUrl;
          dom.htmlVideoPlayer.onloadedmetadata = () => {
            if (targetResumeTime > 0) dom.htmlVideoPlayer.currentTime = targetResumeTime;
          };
          dom.htmlVideoPlayer.load();
          dom.htmlVideoPlayer.play().then(() => {
            dom.playerLoading.classList.remove('active');
          }).catch(() => {
            dom.playerLoading.classList.remove('active');
          });
        }
      }

    // Salva progresso de reprodução no backend
    fetch('/api/animes/watch-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: username,
        content_id: animeId,
        episode_id: ep.id,
        season_number: ep.season_number || 1,
        episode_number: ep.episode_number || 1,
        episode_title: ep.title || `Episódio ${epNumLabel}`,
        position_seconds: 1,
        duration_seconds: 1400
      })
    }).catch(() => {});

  } catch (err) {
    console.error('Erro na reprodução do anime:', err);
    dom.playerLoading.classList.remove('active');
    showPlayerError(err.message || 'Servidor deste episódio indisponível no momento. Tente outro episódio ou servidor.', () => {
      playAnimeEpisode(ep, details, preferredAudio, preferredProvider, preferredQuality, resumePosition);
    });
  }

  // Preenche a barra de capítulos inferior
  setupAnimePlayerStrip(ep, details);
}

function setupAnimePlayerStrip(currentEp, details) {
  if (!dom.playerSeriesStrip || !dom.playerStripScroll) return;
  dom.playerSeriesStrip.style.display = 'flex';
  if (dom.stripSeriesName) dom.stripSeriesName.textContent = details.canonical_title;

  const currentSeason = (details.seasons || []).find(s => s.season_number === (currentEp.season_number || 1)) || details.seasons[0];
  const seasonEpisodes = currentSeason ? currentSeason.episodes : [];
  if (dom.stripEpCount) dom.stripEpCount.textContent = `${seasonEpisodes.length} episódios`;

  dom.playerStripScroll.innerHTML = '';
  seasonEpisodes.forEach((ep) => {
    const isCurrent = ep.id === currentEp.id;
    const epNumLabel = ep.episode_number % 1 === 0 ? ep.episode_number : ep.episode_number.toFixed(1);
    const btn = document.createElement('button');
    btn.className = `btn-strip-ep ${isCurrent ? 'active' : ''}`;
    btn.textContent = `EP ${epNumLabel}`;
    btn.title = ep.title || `Episódio ${epNumLabel}`;
    btn.onclick = () => playAnimeEpisode(ep, details, state.activeAnimeAudio);
    dom.playerStripScroll.appendChild(btn);

    if (isCurrent) {
      setTimeout(() => btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }), 100);
    }
  });
}

function updateFavoriteButtons(animeId) {
  const isFav = state.userFavorites.has(animeId);
  [dom.btnPlayerFavorite, dom.btnSeriesModalFavorite].forEach(btn => {
    if (btn) {
      btn.classList.toggle('active', isFav);
      btn.title = isFav ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos';
    }
  });
}


// =====================================================================
// K-CINE MODERNIZATION ENGINE - ETAPAS 1 A 20 (FASES A A G)
// =====================================================================

// ---------------------------------------------------------------------
// 1. GESTÃO DE PERFIS DE USUÁRIO (PROFILES SYSTEM)
// ---------------------------------------------------------------------
const ProfilesManager = {
  DEFAULT_PROFILES: [
    { id: 'p_kayna', name: 'Kaynã', avatar: 'K', color: 'linear-gradient(135deg, #6366f1, #ec4899)', role: 'ADMIN' },
    { id: 'p_familia', name: 'Família', avatar: 'F', color: 'linear-gradient(135deg, #ec4899, #f43f5e)', role: 'Padrão' },
    { id: 'p_kids', name: 'Kids', avatar: 'K', color: 'linear-gradient(135deg, #06b6d4, #10b981)', role: 'Infantil' }
  ],

  getProfiles() {
    try {
      const stored = localStorage.getItem('kcine_profiles');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return this.DEFAULT_PROFILES;
  },

  getActiveProfile() {
    const list = this.getProfiles();
    const activeId = localStorage.getItem('kcine_active_profile_id') || state.activeProfileId || 'p_kayna';
    return list.find(p => p.id === activeId) || list[0];
  },

  setActiveProfile(profileId) {
    const list = this.getProfiles();
    const profile = list.find(p => p.id === profileId);
    if (!profile) return;

    localStorage.setItem('kcine_active_profile_id', profile.id);
    state.activeProfileId = profile.id;

    // Atualiza cabeçalho
    if (dom.navUserInitial) dom.navUserInitial.textContent = profile.avatar;
    if (dom.navUserName) dom.navUserName.textContent = profile.name;
    if (dom.profileDropdownUsername) dom.profileDropdownUsername.textContent = profile.name;
    if (dom.profileDropdownRole) dom.profileDropdownRole.textContent = `Perfil: ${profile.role}`;

    // Atualiza visual do avatar
    if (dom.navUserAvatar) {
      dom.navUserAvatar.style.background = profile.color;
    }

    this.closeModal();
    showToast(`Perfil alterado para: ${profile.name}`);

    // Re-renderiza views com base no perfil ativo
    renderContinueWatching();
    if (state.activeType === 'todos') {
      HomeShelvesManager.render();
    } else if (state.activeType === 'minha-lista') {
      MyListManager.renderView();
    }
  },

  openModal() {
    if (!dom.profilesModal || !dom.profilesGrid) return;
    this.renderGrid();
    dom.profilesModal.classList.add('active');
  },

  closeModal() {
    if (dom.profilesModal) dom.profilesModal.classList.remove('active');
  },

  renderGrid() {
    if (!dom.profilesGrid) return;
    dom.profilesGrid.innerHTML = '';
    const profiles = this.getProfiles();
    const active = this.getActiveProfile();

    profiles.forEach(p => {
      const card = document.createElement('div');
      card.className = `profile-card ${p.id === active.id ? 'active' : ''}`;
      card.innerHTML = `
        <div class="profile-avatar-circle" style="background: ${p.color};">
          <span>${escapeHtml(p.avatar)}</span>
        </div>
        <span class="profile-name">${escapeHtml(p.name)}</span>
      `;
      card.onclick = () => this.setActiveProfile(p.id);
      dom.profilesGrid.appendChild(card);
    });
  },

  init() {
    const active = this.getActiveProfile();
    this.setActiveProfile(active.id);
  }
};

// ---------------------------------------------------------------------
// 2. MINHA LISTA E FAVORITOS (LIBRARY SYSTEM)
// ---------------------------------------------------------------------
const MyListManager = {
  getKey() {
    const p = ProfilesManager.getActiveProfile();
    return `kcine_mylist_${p.id}`;
  },

  getAll() {
    try {
      const raw = localStorage.getItem(this.getKey());
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  has(id) {
    if (!id) return false;
    const list = this.getAll();
    return list.some(it => String(it.id) === String(id));
  },

  toggle(item) {
    if (!item) return;
    const itemId = item.id || (item.t ? `k_${item.t.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}` : null);
    if (!itemId) return;

    let list = this.getAll();
    const exists = list.some(it => String(it.id) === String(itemId));

    if (exists) {
      list = list.filter(it => String(it.id) !== String(itemId));
      localStorage.setItem(this.getKey(), JSON.stringify(list));
      showToast('Removido da Minha Lista');
    } else {
      const entry = {
        id: itemId,
        t: item.t || item.canonical_title || item.title,
        p: item.p || item.poster,
        catNome: item.catNome || item.category || 'Favoritos',
        u: item.u || '',
        ano: item.ano || item.year || 2024,
        is_anime: !!item.is_anime,
        isGroup: !!item.isGroup,
        totalEpisodes: item.totalEpisodes || item.total_episodios || 1,
        totalSeasons: item.totalSeasons || item.total_temporadas || 1,
        addedAt: Date.now()
      };
      list.unshift(entry);
      localStorage.setItem(this.getKey(), JSON.stringify(list));
      showToast('Adicionado à Minha Lista!');
    }

    this.updateButtons(itemId);
    if (state.activeType === 'minha-lista') {
      this.renderView();
    }
    if (state.activeType === 'todos') {
      HomeShelvesManager.render();
    }
  },

  updateButtons(itemId) {
    const isSaved = this.has(itemId);
    if (dom.btnHeroMyList) {
      dom.btnHeroMyList.classList.toggle('active', isSaved);
      dom.btnHeroMyList.innerHTML = isSaved
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Na Minha Lista</span>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> <span>Minha Lista</span>';
    }
    if (dom.btnDetailsMyList) {
      dom.btnDetailsMyList.classList.toggle('active', isSaved);
      dom.btnDetailsMyList.innerHTML = isSaved
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Salvo</span>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> <span>Minha Lista</span>';
    }
  },

  renderView() {
    if (dom.catalogPaginationContainer) dom.catalogPaginationContainer.style.display = 'none';
    if (dom.loadMoreContainer) dom.loadMoreContainer.style.display = 'none';
    if (dom.homeShelvesContainer) dom.homeShelvesContainer.style.display = 'none';

    const items = this.getAll();
    dom.cardsGrid.innerHTML = '';

    dom.currentViewTitle.textContent = "Minha Lista";
    dom.activeCategoryTitle.textContent = `Títulos Salvos (${items.length})`;

    if (!items.length) {
      dom.cardsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">➕</div>
          <h3 style="font-size: 1.35rem; color: #fff; margin-bottom: 0.5rem;">Sua lista está vazia</h3>
          <p style="color: var(--text-muted); max-width: 26rem; margin: 0 auto 1.5rem; font-size: 0.95rem;">
            Explore filmes, séries e animes no catálogo e clique em "Minha Lista" para salvá-los aqui e assistir depois.
          </p>
          <button class="btn-primary" onclick="switchType('todos')" style="display: inline-flex; align-items: center; gap: 0.5rem; margin: 0 auto;">
            <span>Explorar Catálogo</span>
          </button>
        </div>
      `;
      dom.itemsFoundText.textContent = '0 títulos na Minha Lista';
      return;
    }

    dom.itemsFoundText.textContent = `${items.length} título(s) salvos no perfil ativo`;

    const fragment = document.createDocumentFragment();
    items.forEach((it, idx) => {
      const card = createVideoCard(it, idx);
      fragment.appendChild(card);
    });
    dom.cardsGrid.appendChild(fragment);
  }
};

// ---------------------------------------------------------------------
// 3. CENTRAL DE NOTIFICAÇÕES (NOTIFICATIONS CENTER)
// ---------------------------------------------------------------------
const NotificationsManager = {
  ITEMS: [
    { id: 'notif_demon_slayer', icon: '🔥', title: 'Demon Slayer: Castelo Infinito', desc: 'O filme épico já está disponível em alta definição e sem cortes.', time: 'Hoje', isPink: true },
    { id: 'notif_4k_catalog', icon: '🎬', title: 'Masterização 4K Ultra HD', desc: 'Mais de 400 filmes atualizados com resolução máxima e som surround.', time: 'Ontem', isPink: false },
    { id: 'notif_animes_sync', icon: '🌸', title: 'Novos Episódios de Animes', desc: 'Temporadas sincronizadas de Dandadan, Re:Zero e Slime.', time: '2 dias atrás', isPink: true },
    { id: 'notif_series_maratona', icon: '📺', title: 'Séries para Maratonar', desc: 'Episódios agora agrupados automaticamente por temporadas completas.', time: '3 dias atrás', isPink: false }
  ],

  getReadIds() {
    try {
      return JSON.parse(localStorage.getItem('kcine_read_notifications') || '[]');
    } catch (e) {
      return [];
    }
  },

  toggleDropdown() {
    if (!dom.notificationsDropdown) return;
    const isShown = dom.notificationsDropdown.style.display === 'block';
    dom.notificationsDropdown.style.display = isShown ? 'none' : 'block';
    if (!isShown) this.renderList();
  },

  markAllAsRead() {
    const allIds = this.ITEMS.map(it => it.id);
    localStorage.setItem('kcine_read_notifications', JSON.stringify(allIds));
    this.updateBadge();
    this.renderList();
    showToast('Todas as notificações foram marcadas como lidas.');
  },

  updateBadge() {
    if (!dom.notificationBadge) return;
    const read = this.getReadIds();
    const unreadCount = this.ITEMS.filter(it => !read.includes(it.id)).length;
    if (unreadCount > 0) {
      dom.notificationBadge.textContent = unreadCount;
      dom.notificationBadge.style.display = 'flex';
    } else {
      dom.notificationBadge.style.display = 'none';
    }
  },

  renderList() {
    if (!dom.notificationsList) return;
    dom.notificationsList.innerHTML = '';
    const read = this.getReadIds();

    this.ITEMS.forEach(it => {
      const isUnread = !read.includes(it.id);
      const itemEl = document.createElement('div');
      itemEl.className = `notification-item ${isUnread ? 'unread' : ''}`;
      itemEl.innerHTML = `
        <div class="notification-icon ${it.isPink ? 'pink' : ''}">
          <span>${it.icon}</span>
        </div>
        <div class="notification-content">
          <div class="notification-title">${escapeHtml(it.title)}</div>
          <div class="notification-desc">${escapeHtml(it.desc)}</div>
          <div class="notification-time">${escapeHtml(it.time)}</div>
        </div>
      `;
      itemEl.onclick = () => {
        if (!read.includes(it.id)) {
          read.push(it.id);
          localStorage.setItem('kcine_read_notifications', JSON.stringify(read));
          this.updateBadge();
          itemEl.classList.remove('unread');
        }
      };
      dom.notificationsList.appendChild(itemEl);
    });
  },

  init() {
    this.updateBadge();
  }
};

// ---------------------------------------------------------------------
// 4. VITRINE HORIZONTAL DA HOME (HOME SHELVES ESTILO NETFLIX / DISNEY+)
// ---------------------------------------------------------------------
const HomeShelvesManager = {
  render() {
    if (!dom.homeShelvesContainer) return;
    if (state.activeType !== 'todos') {
      dom.homeShelvesContainer.style.display = 'none';
      return;
    }

    dom.homeShelvesContainer.style.display = 'block';
    dom.homeShelvesContainer.innerHTML = '';

    // Coleta itens para as prateleiras temáticas
    const destaquesPool = state.rawItems || [];
    if (!destaquesPool.length) return;

    // 1. Shelf: 🔥 Em Alta no K-CINE (Top 10 ranqueados)
    const emAltaItems = destaquesPool.slice(0, 10);
    if (emAltaItems.length) {
      this.createShelf('🔥 Em Alta no K-CINE', 'Os mais assistidos da plataforma hoje', emAltaItems, true);
    }

    // 2. Shelf: 🎬 Filmes Populares
    const filmesItems = destaquesPool.filter(it => !it.is_anime && !it.isGroup && !parseEpisodeInfo(it.t).isEpisode).slice(0, 15);
    if (filmesItems.length) {
      this.createShelf('🎬 Filmes Populares', 'Grandes sucessos do cinema em 4K e HD', filmesItems);
    }

    // 3. Shelf: 📺 Séries para Maratonar
    const seriesItems = destaquesPool.filter(it => it.isGroup || (it.catNome && it.catNome.includes('Séries')) || parseEpisodeInfo(it.t).isEpisode).slice(0, 15);
    if (seriesItems.length) {
      this.createShelf('📺 Séries Populares', 'Temporadas completas prontas para maratonar', seriesItems);
    }

    // 4. Shelf: 🌸 Animes em Destaque
    const animesItems = destaquesPool.filter(it => it.is_anime || (it.id && String(it.id).startsWith('ani_')) || (it.catNome && it.catNome.includes('ANIMES'))).slice(0, 15);
    if (animesItems.length) {
      this.createShelf('🌸 Animes em Destaque', 'Episódios canônicos, filmes e novas temporadas', animesItems);
    }

    // 5. Shelf: ➕ Minha Lista
    const myListItems = MyListManager.getAll().slice(0, 15);
    if (myListItems.length) {
      this.createShelf('➕ Minha Lista', 'Títulos que você salvou para assistir depois', myListItems);
    }
  },

  createShelf(title, subtitle, items, isRanked = false) {
    if (!items || !items.length) return;

    const section = document.createElement('section');
    section.className = 'shelf-section';

    section.innerHTML = `
      <div class="shelf-header">
        <div class="shelf-title-wrap">
          <h3 class="shelf-title">${escapeHtml(title)}</h3>
          <span class="shelf-subtitle">${escapeHtml(subtitle)}</span>
        </div>
        <div class="shelf-controls">
          <button class="shelf-nav-btn shelf-prev" aria-label="Anterior" title="Rolar para esquerda">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <button class="shelf-nav-btn shelf-next" aria-label="Próximo" title="Rolar para direita">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
      </div>
      <div class="shelf-track-wrapper">
        <button class="shelf-side-arrow shelf-side-left" aria-label="Rolar para esquerda" title="Anterior">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div class="shelf-track"></div>
        <button class="shelf-side-arrow shelf-side-right" aria-label="Rolar para direita" title="Próximo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
    `;

    const track = section.querySelector('.shelf-track');
    const btnLeft = section.querySelector('.shelf-prev');
    const btnRight = section.querySelector('.shelf-next');
    const btnSideLeft = section.querySelector('.shelf-side-left');
    const btnSideRight = section.querySelector('.shelf-side-right');

    const scrollLeft = () => track.scrollBy({ left: -Math.max(320, track.clientWidth * 0.75), behavior: 'smooth' });
    const scrollRight = () => track.scrollBy({ left: Math.max(320, track.clientWidth * 0.75), behavior: 'smooth' });

    if (btnLeft) btnLeft.onclick = scrollLeft;
    if (btnRight) btnRight.onclick = scrollRight;
    if (btnSideLeft) btnSideLeft.onclick = scrollLeft;
    if (btnSideRight) btnSideRight.onclick = scrollRight;

    items.forEach((it, idx) => {
      const card = createVideoCard(it, idx);
      card.classList.add('shelf-card');

      if (isRanked) {
        const rankBadge = document.createElement('div');
        rankBadge.className = 'shelf-rank-badge';
        rankBadge.textContent = `#${idx + 1}`;
        card.querySelector('.card-poster')?.appendChild(rankBadge);
      }

      // Ao clicar no poster ou card, abre modal cinematográfico de detalhes
      card.onclick = (e) => {
        if (e.target.closest('.btn-play') || e.target.closest('.play-circle')) {
          if (it.is_anime) openAnimeModal(it);
          else if (it.isGroup) openSeriesModal(it);
          else openPlayer(it.t, it.catNome || 'Filme', it.u, it);
        } else {
          openContentDetailsModal(it);
        }
      };

      track.appendChild(card);
    });

    dom.homeShelvesContainer.appendChild(section);
  }
};

// ---------------------------------------------------------------------
// 5. MODAL CINEMATOGRÁFICO COMPACTO E PROFISSIONAL (CONTENT DETAILS)
// ---------------------------------------------------------------------
let lastActiveFocusElement = null;

function openContentDetailsModal(item) {
  if (!item || !dom.contentDetailsModal) return;
  lastActiveFocusElement = document.activeElement;
  state.currentDetailsItem = item;

  const rawTitle = item.t || item.canonical_title || item.title || item.seriesName || 'Sem Título';
  const posterUrl = item.p || item.poster || item.banner || FALLBACK_POSTER;
  const rating = getMediaRating(item);
  const year = item.ano || item.year || 2024;
  const isAnime = !!item.is_anime || (item.id && String(item.id).startsWith('ani_')) || (item.catNome && item.catNome.includes('ANIMES'));
  const isSeries = !!item.isGroup || parseEpisodeInfo(rawTitle).isEpisode || (item.catNome && item.catNome.includes('Séries'));

  // 1. Imagem horizontal de fundo (Backdrop) com fallback
  if (dom.detailsHeroBackdrop) {
    const backdropUrl = item.banner || item.backdrop || posterUrl;
    dom.detailsHeroBackdrop.style.backgroundImage = `url('${backdropUrl}')`;
  }

  // 2. Título bem destacado
  if (dom.detailsTitle) {
    dom.detailsTitle.textContent = rawTitle;
  }

  // 3. Badges: Categoria, Nota com origem e Qualidade
  if (dom.detailsCategoryBadge) {
    dom.detailsCategoryBadge.textContent = isAnime ? '🌸 ANIME' : (isSeries ? '📺 SÉRIE' : '🎬 FILME');
  }

  if (dom.detailsRatingBadge) {
    dom.detailsRatingBadge.innerHTML = `<span class="star-icon">★</span> ${rating.toFixed(1)} <small style="font-size: 11px; opacity: 0.8; margin-left: 2px;">(TMDb)</small>`;
  }

  if (dom.detailsQualityBadge) {
    dom.detailsQualityBadge.textContent = '4K UHD / HD';
  }

  // 4. Metadados: Ano, Duração ou Temporadas, Classificação Indicativa
  if (dom.detailsYear) {
    dom.detailsYear.textContent = year;
  }

  const seasonsCount = item.totalSeasons || item.total_temporadas || (item.seasons ? item.seasons.length : 1);
  const epsCount = item.totalEpisodes || item.total_episodios || 0;
  if (dom.detailsDurationOrSeasons) {
    if (isSeries || isAnime) {
      dom.detailsDurationOrSeasons.textContent = epsCount > 0
        ? `${seasonsCount} Temporada${seasonsCount > 1 ? 's' : ''} • ${epsCount} Episódio${epsCount > 1 ? 's' : ''}`
        : `${seasonsCount} Temporada${seasonsCount > 1 ? 's' : ''}`;
    } else {
      dom.detailsDurationOrSeasons.textContent = item.duracao || item.duration || '2h 05m';
    }
  }

  if (dom.detailsAgeRating) {
    dom.detailsAgeRating.textContent = item.age || item.classificacao || '14+';
  }

  // 5. Gêneros Reais
  const rawGenres = (Array.isArray(item.generos) ? item.generos : (Array.isArray(item.genres) ? item.genres : []))
    .filter(g => g && typeof g === 'string' && g.length > 1 && !['Dublado', 'Legendado', 'Filmes', 'Series', 'Animes'].includes(g))
    .slice(0, 3);

  if (dom.detailsGenresWrap) {
    dom.detailsGenresWrap.innerHTML = '';
    if (rawGenres.length > 0) {
      rawGenres.forEach(g => {
        const chip = document.createElement('span');
        chip.className = 'details-genre-chip';
        chip.textContent = g;
        dom.detailsGenresWrap.appendChild(chip);
      });
      if (dom.detailsGenreDot) dom.detailsGenreDot.style.display = 'inline';
    } else {
      if (dom.detailsGenreDot) dom.detailsGenreDot.style.display = 'none';
    }
  }

  // 6. Sinopse Verdadeira do Conteúdo
  if (dom.detailsSynopsis) {
    const cleanSinopse = (item.sinopse && item.sinopse.trim() && !item.sinopse.includes("Assista agora no K-CINE"))
      ? item.sinopse
      : (item.synopsis && item.synopsis.trim()
        ? item.synopsis
        : `${escapeHtml(rawTitle)} está disponível para assistir em alta definição no catálogo K-CINE.`);
    dom.detailsSynopsis.textContent = cleanSinopse;
  }

  // 7. Botão Ver Episódios (Exclusivo para Séries e Animes)
  if (dom.btnDetailsEpisodes) {
    if (isSeries || isAnime) {
      dom.btnDetailsEpisodes.style.display = 'inline-flex';
    } else {
      dom.btnDetailsEpisodes.style.display = 'none';
    }
  }

  // 8. Botão Minha Lista sincronizado
  if (typeof MyListManager !== 'undefined' && MyListManager.updateButtons) {
    MyListManager.updateButtons(item.id || rawTitle);
  }

  // 9. Botão Copiar Link (apenas para Admin)
  if (dom.btnDetailsCopyLink) {
    const isAdmin = state.currentUser && state.currentUser.role === 'admin';
    dom.btnDetailsCopyLink.style.display = isAdmin ? 'inline-flex' : 'none';
  }

  // Abre com animação discreta e bloqueia rolagem da página de fundo
  dom.contentDetailsModal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Foco inicial no botão principal de reprodução
  setTimeout(() => {
    if (dom.btnDetailsPlay) dom.btnDetailsPlay.focus();
  }, 50);
}

function closeContentDetailsModal() {
  if (dom.contentDetailsModal) {
    dom.contentDetailsModal.classList.remove('active');
    document.body.style.overflow = '';
  }
  state.currentDetailsItem = null;
  if (lastActiveFocusElement && typeof lastActiveFocusElement.focus === 'function') {
    try { lastActiveFocusElement.focus(); } catch (e) { }
  }
}

// ---------------------------------------------------------------------
// 6. ATALHOS DE TECLADO E CONTROLES INTELIGENTES DO PLAYER
// ---------------------------------------------------------------------
function setupPlayerModernEnhancements() {
  // 1. Atalhos de Teclado Globais quando Player está aberto
  document.addEventListener('keydown', (e) => {
    if (!dom.playerModal || !dom.playerModal.classList.contains('active')) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

    const video = dom.htmlVideoPlayer;
    if (!video) return;

    switch (e.code) {
      case 'Space':
      case 'KeyK':
        e.preventDefault();
        video.paused ? video.play() : video.pause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
        showPlayerFeedback('-10s');
        break;
      case 'ArrowRight':
        e.preventDefault();
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
        showPlayerFeedback('+10s');
        break;
      case 'ArrowUp':
        e.preventDefault();
        video.volume = Math.min(1, video.volume + 0.1);
        showPlayerFeedback(`Volume: ${Math.round(video.volume * 100)}%`);
        break;
      case 'ArrowDown':
        e.preventDefault();
        video.volume = Math.max(0, video.volume - 0.1);
        showPlayerFeedback(`Volume: ${Math.round(video.volume * 100)}%`);
        break;
      case 'KeyM':
        e.preventDefault();
        video.muted = !video.muted;
        showPlayerFeedback(video.muted ? 'Mudo' : 'Com Som');
        break;
      case 'KeyF':
        e.preventDefault();
        if (document.fullscreenElement) document.exitFullscreen();
        else dom.playerModal.requestFullscreen?.();
        break;
      case 'KeyN':
        e.preventDefault();
        if (dom.btnNextEp && !dom.btnNextEp.disabled) dom.btnNextEp.click();
        break;
      case 'Escape':
        closePlayer();
        break;
    }
  });

  // 2. Botão Pular Abertura (Skip Intro)
  if (dom.btnSkipIntro && dom.htmlVideoPlayer) {
    dom.btnSkipIntro.addEventListener('click', () => {
      dom.htmlVideoPlayer.currentTime = 90;
      dom.btnSkipIntro.style.display = 'none';
      showToast('Abertura pulada');
    });

    dom.htmlVideoPlayer.addEventListener('timeupdate', () => {
      const cur = dom.htmlVideoPlayer.currentTime;
      const isEp = state.currentPlayingItem && (state.currentPlayingItem.is_anime || state.currentPlayingItem.isGroup || parseEpisodeInfo(state.currentPlayingItem.t || '').isEpisode);

      if (isEp && cur >= 5 && cur <= 90) {
        dom.btnSkipIntro.style.display = 'inline-flex';
      } else {
        dom.btnSkipIntro.style.display = 'none';
      }

      // 3. Card de Próximo Episódio com Contagem Regressiva (Últimos 20s)
      const dur = dom.htmlVideoPlayer.duration;
      if (dur && (dur - cur <= 20) && dom.btnNextEp && !dom.btnNextEp.disabled) {
        if (dom.nextEpCountdownCard && dom.nextEpCountdownCard.style.display !== 'flex') {
          dom.nextEpCountdownCard.style.display = 'flex';
          const remaining = Math.max(1, Math.round(dur - cur));
          if (dom.nextEpSeconds) dom.nextEpSeconds.textContent = remaining;
        }
      } else {
        if (dom.nextEpCountdownCard && dom.nextEpCountdownCard.style.display === 'flex') {
          dom.nextEpCountdownCard.style.display = 'none';
        }
      }
    });
  }

  if (dom.btnNextNow) {
    dom.btnNextNow.addEventListener('click', () => {
      if (dom.nextEpCountdownCard) dom.nextEpCountdownCard.style.display = 'none';
      if (dom.btnNextEp) dom.btnNextEp.click();
    });
  }

  if (dom.btnNextCancel) {
    dom.btnNextCancel.addEventListener('click', () => {
      if (dom.nextEpCountdownCard) dom.nextEpCountdownCard.style.display = 'none';
    });
  }
}

function showPlayerFeedback(text) {
  let toast = document.getElementById('playerQuickToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'playerQuickToast';
    toast.style.cssText = 'position: absolute; top: 20%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.75); color: #fff; padding: 10px 20px; border-radius: 8px; font-weight: 700; z-index: 50; pointer-events: none; transition: opacity 0.2s; backdrop-filter: blur(8px);';
    dom.playerModal?.querySelector('.video-wrapper')?.appendChild(toast);
  }
  toast.textContent = text;
  toast.style.opacity = '1';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => { toast.style.opacity = '0'; }, 1000);
}

// ---------------------------------------------------------------------
// 7. SUGESTÕES INSTANTÂNEAS DE BUSCA (LIVE SEARCH DROPDOWN)
// ---------------------------------------------------------------------
function setupLiveSearchSuggestions() {
  if (!dom.searchInput || !dom.searchSuggestionsDropdown) return;

  let debounceTimer;
  dom.searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimer);

    if (query.length < 2) {
      dom.searchSuggestionsDropdown.style.display = 'none';
      return;
    }

    debounceTimer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}&limit=6`)
        .then(r => r.json())
        .then(data => {
          const results = data.results || data || [];
          if (!results.length) {
            dom.searchSuggestionsDropdown.style.display = 'none';
            return;
          }

          dom.searchSuggestionsDropdown.innerHTML = '';
          results.slice(0, 6).forEach(item => {
            const row = document.createElement('div');
            row.className = 'suggestion-item';
            row.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: background 0.2s;';
            row.onmouseenter = () => row.style.background = 'rgba(255,255,255,0.06)';
            row.onmouseleave = () => row.style.background = 'transparent';

            const pUrl = item.p || FALLBACK_POSTER;
            row.innerHTML = `
              <img src="${pUrl}" alt="${escapeHtml(item.t)}" style="width: 32px; height: 46px; border-radius: 4px; object-fit: cover;">
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; color: #fff; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.t)}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(item.catNome || 'Catálogo')}</div>
              </div>
              <span style="font-size: 0.78rem; font-weight: 700; color: #facc15;">★ 9.4</span>
            `;

            row.onclick = () => {
              dom.searchSuggestionsDropdown.style.display = 'none';
              dom.searchInput.value = item.t;
              openContentDetailsModal(item);
            };

            dom.searchSuggestionsDropdown.appendChild(row);
          });

          dom.searchSuggestionsDropdown.style.display = 'block';
        })
        .catch(() => {
          dom.searchSuggestionsDropdown.style.display = 'none';
        });
    }, 250);
  });
}
