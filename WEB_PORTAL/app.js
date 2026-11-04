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
  seriesViewMode: 'all', // 'all' (todos os capítulos) | 'grouped' (agrupado por série)
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
  }
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

  // Hero Banner
  heroBanner: document.getElementById('heroBanner'),
  heroBackdrop: document.getElementById('heroBackdrop'),
  heroTitle: document.getElementById('heroTitle'),
  heroCategory: document.getElementById('heroCategory'),
  heroDesc: document.getElementById('heroDesc'),
  btnHeroPlay: document.getElementById('btnHeroPlay'),
  btnHeroCopy: document.getElementById('btnHeroCopy'),
  btnHeroVlc: document.getElementById('btnHeroVlc'),

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
  btnTypeHistorico: document.getElementById('btnTypeHistorico'),

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

  // 2. Carregar Manifesto de Filmes e Séries APENAS se autenticado
  if (isAuthenticated) {
    await loadManifesto();
    renderContinueWatching();
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

  // Filtros de Tipo (Todos / Filmes / Séries / Animes / Histórico)
  dom.btnTypeTodos?.addEventListener('click', () => switchType('todos'));
  dom.btnTypeFilmes?.addEventListener('click', () => switchType('filmes'));
  dom.btnTypeSeries?.addEventListener('click', () => switchType('series'));
  dom.btnTypeAnimes?.addEventListener('click', () => switchType('animes'));
  dom.btnTypeHistorico?.addEventListener('click', () => switchType('historico'));

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

  // Busca Inteligente com debounce de 400ms
  dom.searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    dom.clearSearchBtn.style.display = val ? 'block' : 'none';
    clearTimeout(state.searchTimeout);
    state.searchTimeout = setTimeout(() => handleSearch(val), 400);
  });

  dom.clearSearchBtn.addEventListener('click', () => {
    dom.searchInput.value = '';
    dom.clearSearchBtn.style.display = 'none';
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
  [dom.btnTypeTodos, dom.btnTypeFilmes, dom.btnTypeSeries, dom.btnTypeAnimes, dom.btnTypeHistorico].filter(Boolean).forEach(b => b.classList.remove('active'));
  if (type === 'todos') dom.btnTypeTodos?.classList.add('active');
  if (type === 'filmes') dom.btnTypeFilmes?.classList.add('active');
  if (type === 'series') dom.btnTypeSeries?.classList.add('active');
  if (type === 'animes') {
    dom.btnTypeAnimes?.classList.add('active');
    selectCategory('animes', '🌸 Animes');
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

function prepareHeroBanner() {
  if (!state.manifesto || !state.manifesto.categorias.length) return;
  const lancamentos = state.manifesto.categorias.find(c => c.id.includes('lancamentos')) || state.manifesto.categorias[0];
  if (lancamentos && lancamentos.destaques) {
    state.heroItems = lancamentos.destaques.filter(i => i.p && i.p.includes('http'));
  }

  if (state.heroItems.length > 0) {
    updateHeroItem(state.heroItems[0]);
    setInterval(() => {
      state.heroIndex = (state.heroIndex + 1) % state.heroItems.length;
      updateHeroItem(state.heroItems[state.heroIndex]);
    }, 12000);
  }
}

function updateHeroItem(item) {
  if (!item) return;
  dom.heroTitle.textContent = item.t;
  dom.heroCategory.textContent = "Filmes em Destaque";
  dom.heroBackdrop.style.backgroundImage = `url('${item.p || FALLBACK_POSTER}')`;

  if (dom.btnHeroPlay) {
    dom.btnHeroPlay.onclick = () => openPlayer(item.t, 'Filmes em Destaque', item.u);
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

  state.rawItems = pool;
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
    loadAnimesPage(1, '');
    return;
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

  // Substituição de página: Limpa o grid e exibe skeletons leves (máximo 6 placeholders)
  dom.cardsGrid.innerHTML = `
    <div class="card-skeleton"></div>
    <div class="card-skeleton"></div>
    <div class="card-skeleton"></div>
    <div class="card-skeleton"></div>
    <div class="card-skeleton"></div>
    <div class="card-skeleton"></div>
  `;
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
      console.warn('API /api/animes indisponível, usando fallback estático CDN...', apiErr);
    }

    if (!data || !data.animes || !Array.isArray(data.animes) || (data.animes.length === 0 && !search && !genre)) {
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

    // Injeta exatamente os 24 cards da página ativa no DOM (memória constante)
    const fragment = document.createDocumentFragment();
    animesList.forEach((anime, idx) => {
      const cardItem = {
        id: anime.id,
        t: anime.canonical_title || anime.t || anime.title,
        p: anime.poster || anime.p,
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
    state.currentItems = [...state.rawItems];
  } else if (state.seriesViewMode === 'grouped') {
    const { groups, nonSeries } = groupItemsBySeries(state.rawItems);
    state.currentItems = [...groups, ...nonSeries];
  } else {
    state.currentItems = [...state.rawItems];
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
      if (animeNormalizedTitles.has(normSeries)) {
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
// CRIAÇÃO DE CARDS (SUPORTE A CAPÍTULOS, BADGES E AGRUPAMENTO)
// =====================================================================
function createSeriesGroupCard(group, index) {
  const card = document.createElement('div');
  card.className = 'video-card is-series-group';

  const posterUrl = group.poster && group.poster.startsWith('http') ? group.poster : FALLBACK_POSTER;
  const categoryName = group.catNome || 'Série';

  card.innerHTML = `
    <div class="card-poster">
      <img src="${posterUrl}" alt="${escapeHtml(group.seriesName)}" loading="lazy" onerror="this.src='${FALLBACK_POSTER}'">
      <span class="card-badge group-badge">${group.totalEpisodes} EPISÓDIOS</span>
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
        <span>${group.totalEpisodes} Episódios • ${group.totalSeasons} Temporada${group.totalSeasons > 1 ? 's' : ''}</span>
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
  state.rawItems = results;
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
    let resolveUrl = `/api/animes/resolve?episode_id=${encodeURIComponent(ep.id)}&audio=${encodeURIComponent(preferredAudio)}`;
    if (state.activeAnimeProvider) resolveUrl += `&provider=${encodeURIComponent(state.activeAnimeProvider)}`;
    if (state.activeAnimeQuality) resolveUrl += `&quality=${encodeURIComponent(state.activeAnimeQuality)}`;

    let data = null;
    try {
      const resp = await fetch(resolveUrl);
      if (resp.ok) {
        data = await resp.json();
      }
    } catch (apiErr) {
      console.warn('API /api/animes/resolve falhou ou indisponível:', apiErr);
    }

    if (!data || !data.success || !data.stream_url) {
      // Fallback estático a partir dos sources do episódio
      const epSources = (ep.sources || []).filter(s => s.provider !== 'animefire');
      if (epSources.length > 0) {
        const matchingSrc = epSources.find(s => s.audio_type === preferredAudio) || epSources[0];
        let pLoad = {};
        try {
          pLoad = typeof matchingSrc.extra_payload === 'string' ? JSON.parse(matchingSrc.extra_payload) : (matchingSrc.extra_payload || {});
        } catch (e) {}

        const streamUrlCandidate = matchingSrc.stream_url || pLoad.episode_url;
        if (streamUrlCandidate) {
          data = {
            success: true,
            stream_url: streamUrlCandidate,
            player_type: matchingSrc.player_type || 'direct',
            audio_type: matchingSrc.audio_type || preferredAudio,
            provider: matchingSrc.provider,
            provider_label: matchingSrc.provider === 'animesdigital' ? 'AnimesDigital' : 'AnimesOnlineCC',
            quality: matchingSrc.quality || '720p HD',
            available_sources: epSources.map(s => ({
              provider: s.provider,
              provider_label: s.provider === 'animesdigital' ? 'AnimesDigital' : 'AnimesOnlineCC',
              quality: s.quality || '720p HD',
              quality_label: `${s.quality || '720p HD'} (Verificado)`,
              audio_type: s.audio_type,
              player_type: s.player_type || 'direct',
              selected: s.id === matchingSrc.id
            }))
          };
        }
      }
    }

    if (!data || !data.success || !data.stream_url) {
      throw new Error((data && data.error) || 'Vídeo temporariamente indisponível no servidor. Tente outro episódio ou servidor.');
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
          ${p.provider === 'animesdigital' ? '🌸 AnimesDigital' : (p.provider === 'animesonlinecc' ? '🎬 AnimesOnlineCC' : '⚡ ' + p.provider_label)}
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
        uniqueQualMap.set(data.quality || '720p HD', {
          quality: data.quality || '720p HD',
          quality_label: `${data.quality || '720p HD'} (Verificado)`
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

    if (data.player_type === 'embed') {
      // Player iframe embed
      if (dom.htmlVideoPlayer) dom.htmlVideoPlayer.style.display = 'none';
      if (dom.iframeVideoPlayer) {
        dom.iframeVideoPlayer.style.display = 'block';
        dom.iframeVideoPlayer.src = data.stream_url;
      }
      dom.playerLoading.classList.remove('active');
    } else {
      // Player nativo HTML5 / HLS
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

        // Auto fallback se houver falha de rede ou link bloqueado pela CDN
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
