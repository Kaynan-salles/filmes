/**
 * K-Cine - Módulo de Autenticação e Gestão de Clientes
 * Suporta Supabase na nuvem + Fallback em Armazenamento Local
 */

const AuthManager = (() => {
  const STORAGE_KEYS = {
    SESSION: 'kcine_user_session',
    CONFIG: 'kcine_supabase_config',
    CLIENTS: 'kcine_local_clientes'
  };

  let supabase = null;

  // Função auxiliar para normalização de nomes de usuário (ignora acentos e maiúsculas/minúsculas)
  function normalizeUsername(str) {
    return (str || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  // Função flexível para validação de credenciais de clientes
  function matchClient(c, normUsername, cleanPassword) {
    if (!c || !c.username || !c.password) return false;

    const cNorm = normalizeUsername(c.username);
    const cNormNoSpaces = cNorm.replace(/\s+/g, '');
    const userNormNoSpaces = normUsername.replace(/\s+/g, '');
    const cFirstName = cNorm.split(/\s+/)[0];

    // Checa nome: completo, sem espaços ou primeiro nome
    const userMatches = (
      cNorm === normUsername ||
      cNormNoSpaces === userNormNoSpaces ||
      (cFirstName.length >= 3 && cFirstName === normUsername)
    );

    if (!userMatches) return false;

    // Checa senha: exata, com # ou sem #
    const cleanPwNoHash = cleanPassword.replace(/^#+/, '');
    const cPwNoHash = String(c.password).trim().replace(/^#+/, '');

    const passMatches = (
      c.password === cleanPassword ||
      cPwNoHash === cleanPwNoHash ||
      c.password === '#' + cleanPassword ||
      cleanPassword === '#' + c.password
    );

    return passMatches;
  }

  // Administrador Principal e Clientes Autorizados
  const DEFAULT_CLIENTS = [
    {
      id: 'admin-kayna',
      username: 'Kaynã',
      password: '102587',
      role: 'admin',
      status: 'ativo',
      notes: 'Kaynã - Único Dono & Administrador Geral do K-Cine',
      created_at: '2026-10-21T00:00:00.000Z'
    },
    {
      id: 'cli-gleydson',
      username: 'Gleydson',
      password: '#123456',
      role: 'cliente',
      status: 'ativo',
      notes: 'Sem observações',
      created_at: '2026-10-22T00:00:00.000Z'
    },
    {
      id: 'cli-lisnildo',
      username: 'Lisnildo',
      password: '#23456',
      role: 'cliente',
      status: 'ativo',
      notes: 'Sem observações',
      created_at: '2026-10-21T23:30:00.000Z'
    },
    {
      id: 'cli-gabriel-aires',
      username: 'Gabriel Aires',
      password: '#123456',
      role: 'cliente',
      status: 'ativo',
      notes: 'Sem observações',
      created_at: '2026-10-21T23:30:00.000Z'
    },
    {
      id: 'cli-leticia-castro',
      username: 'Letícia Castro',
      password: '#123456',
      role: 'cliente',
      status: 'ativo',
      notes: 'Sem observações',
      created_at: '2026-10-21T23:30:00.000Z'
    }
  ];

  // Inicialização
  function init() {
    initLocalClients();
    initSupabase();
  }

  function initLocalClients() {
    let clients = getLocalClients();

    // Remove qualquer conta legada (como 'admin' ou 'cliente1')
    clients = clients.filter(c => 
      normalizeUsername(c.username) !== 'admin' && 
      c.username !== 'cliente1' &&
      c.id !== 'admin-2' &&
      c.id !== 'cli-demo'
    );

    // Garante que todos os clientes autorizados de DEFAULT_CLIENTS existam
    DEFAULT_CLIENTS.forEach(defCli => {
      const idx = clients.findIndex(c => normalizeUsername(c.username) === normalizeUsername(defCli.username));
      if (idx === -1) {
        clients.push({ ...defCli });
      } else {
        // Se a senha estiver vazia, sincroniza
        if (!clients[idx].password) {
          clients[idx].password = defCli.password;
        }
      }
    });

    // Garante que o Admin Principal Kaynã esteja com a senha 102587
    const kaynaIndex = clients.findIndex(c => normalizeUsername(c.username) === 'kayna');

    if (kaynaIndex !== -1) {
      clients[kaynaIndex].username = 'Kaynã';
      clients[kaynaIndex].password = '102587';
      clients[kaynaIndex].role = 'admin';
      clients[kaynaIndex].status = 'ativo';
      clients[kaynaIndex].notes = 'Kaynã - Único Dono & Administrador Geral do K-Cine';
    } else {
      clients.unshift({
        id: 'admin-kayna',
        username: 'Kaynã',
        password: '102587',
        role: 'admin',
        status: 'ativo',
        notes: 'Kaynã - Único Dono & Administrador Geral do K-Cine',
        created_at: new Date().toISOString()
      });
    }

    saveLocalClients(clients, false);

    // Sincroniza em segundo plano com data/clientes.json se disponível
    syncSharedClients();
  }

  async function syncSharedClients() {
    try {
      const resp = await fetch('data/clientes.json?t=' + Date.now());
      if (resp.ok) {
        const shared = await resp.json();
        if (Array.isArray(shared) && shared.length) {
          let current = getLocalClients();
          let changed = false;
          shared.forEach(sc => {
            const idx = current.findIndex(c => normalizeUsername(c.username) === normalizeUsername(sc.username));
            if (idx === -1) {
              current.push({ ...sc });
              changed = true;
            } else {
              if (sc.password && current[idx].password !== sc.password) {
                current[idx].password = sc.password;
                changed = true;
              }
              if (sc.status && current[idx].status !== sc.status) {
                current[idx].status = sc.status;
                changed = true;
              }
            }
          });
          if (changed) {
            saveLocalClients(current, false);
          }
        }
      }
    } catch (e) {}
  }

  async function persistClientsToServer(list) {
    try {
      await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(list)
      });
    } catch (e) {}
  }

  function getLocalClients() {
    try {
      // Tenta obter pela chave atual ou legada
      let stored = localStorage.getItem(STORAGE_KEYS.CLIENTS);
      if (!stored) {
        stored = localStorage.getItem('cinestream_local_clientes');
      }
      return stored ? JSON.parse(stored) : DEFAULT_CLIENTS;
    } catch (e) {
      return DEFAULT_CLIENTS;
    }
  }

  function saveLocalClients(list, syncServer = true) {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(list));
    if (syncServer) {
      persistClientsToServer(list);
    }
  }

  // Inicializa o cliente do Supabase com as credenciais salvas
  function initSupabase() {
    try {
      const config = getSupabaseConfig();
      if (config && config.url && config.anonKey && window.supabase) {
        supabase = window.supabase.createClient(config.url, config.anonKey);
        console.log('[Auth] Supabase conectado com sucesso.');
      } else {
        supabase = null;
      }
    } catch (err) {
      console.warn('[Auth] Erro ao inicializar Supabase:', err);
      supabase = null;
    }
  }

  function getSupabaseConfig() {
    // 1. Verifica configuração limpa definida em código (supabase-config.js)
    if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey) {
      const url = window.SUPABASE_CONFIG.url.trim();
      const key = window.SUPABASE_CONFIG.anonKey.trim();
      if (url && key && !url.includes('exemplo.supabase.co')) {
        try {
          const stored = localStorage.getItem(STORAGE_KEYS.CONFIG);
          if (!stored || JSON.parse(stored).url !== url) {
            localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify({ url, anonKey: key }));
          }
        } catch (e) {}
        return { url, anonKey: key };
      }
    }

    // 2. Fallback para chave em armazenamento
    try {
      let cfg = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (!cfg) {
        cfg = localStorage.getItem('cinestream_supabase_config');
      }
      return cfg ? JSON.parse(cfg) : null;
    } catch (e) {
      return null;
    }
  }

  function saveSupabaseConfig(url, anonKey) {
    const cleanUrl = (url || '').trim().replace(/\/$/, '');
    const cleanKey = (anonKey || '').trim();
    if (!cleanUrl || !cleanKey) {
      localStorage.removeItem(STORAGE_KEYS.CONFIG);
      supabase = null;
      return false;
    }
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify({ url: cleanUrl, anonKey: cleanKey }));
    initSupabase();
    return true;
  }

  function isSupabaseConnected() {
    return !!supabase;
  }

  // Testar conexão com Supabase
  async function testSupabaseConnection(url, anonKey) {
    try {
      if (!window.supabase) {
        return { success: false, message: 'Biblioteca Supabase SDK ainda não foi carregada.' };
      }
      const testClient = window.supabase.createClient(url.trim(), anonKey.trim());
      const { data, error } = await testClient.from('clientes').select('id').limit(1);
      if (error) {
        return { success: false, message: `Erro no Supabase: ${error.message} (Verifique se executou o script supabase_schema.sql no SQL Editor).` };
      }
      return { success: true, message: 'Conexão com o Supabase estabelecida com sucesso!' };
    } catch (e) {
      return { success: false, message: `Falha na requisição: ${e.message}` };
    }
  }

  // Sessão atual
  function getCurrentUser() {
    try {
      let session = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (!session) {
        session = localStorage.getItem('cinestream_user_session');
      }
      return session ? JSON.parse(session) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(user) {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    localStorage.removeItem('cinestream_user_session');
  }

  // Login de usuário ou cliente
  async function login(username, password) {
    const rawUsername = (username || '').trim();
    const normUsername = normalizeUsername(rawUsername);
    const cleanPassword = (password || '').trim();

    if (!normUsername || !cleanPassword) {
      return { success: false, message: 'Por favor, informe seu usuário e senha.' };
    }

    // Acesso direto garantido exclusivamente para o Administrador Principal Kaynã (Único Dono)
    if (normUsername === 'kayna' && cleanPassword === '102587') {
      const adminUser = {
        id: 'admin-kayna',
        username: 'Kaynã',
        role: 'admin',
        status: 'ativo',
        notes: 'Kaynã - Único Dono & Administrador Geral do K-Cine'
      };
      setSession(adminUser);
      return { success: true, user: adminUser };
    }

    // 1. Se o Supabase estiver ativo, verifica no Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('*');

        if (!error && data && data.length) {
          const match = data.find(c => matchClient(c, normUsername, cleanPassword));

          if (match) {
            if (match.status === 'bloqueado') {
              return {
                success: false,
                blocked: true,
                message: 'Seu acesso está bloqueado pelo administrador. Entre em contato para regularizar seu plano.'
              };
            }
            const userObj = {
              id: match.id,
              username: match.username,
              role: match.role || 'cliente',
              status: match.status || 'ativo',
              notes: match.notes || ''
            };
            setSession(userObj);
            return { success: true, user: userObj };
          }
        }
      } catch (err) {
        console.warn('[Auth] Falha de rede no Supabase, verificando modo local:', err);
      }
    }

    // 2. Verificação no Armazenamento Local
    let localClients = getLocalClients();
    let user = localClients.find(c => matchClient(c, normUsername, cleanPassword));

    // 3. Fallback garantido no catálogo DEFAULT_CLIENTS (garante login em qualquer dispositivo mesmo sem banco conectado)
    if (!user) {
      user = DEFAULT_CLIENTS.find(c => matchClient(c, normUsername, cleanPassword));
      if (user) {
        localClients.push({ ...user });
        saveLocalClients(localClients);
      }
    }

    // 4. Fallback remoto em data/clientes.json caso seja um cliente recém adicionado
    if (!user) {
      try {
        const resp = await fetch('data/clientes.json?t=' + Date.now());
        if (resp.ok) {
          const shared = await resp.json();
          if (Array.isArray(shared)) {
            user = shared.find(c => matchClient(c, normUsername, cleanPassword));
            if (user) {
              localClients.push({ ...user });
              saveLocalClients(localClients);
            }
          }
        }
      } catch (e) {}
    }

    if (!user) {
      return { success: false, message: 'Usuário ou senha incorretos. Verifique suas credenciais.' };
    }

    if (user.status === 'bloqueado') {
      return {
        success: false,
        blocked: true,
        message: 'Seu acesso está bloqueado pelo administrador. Entre em contato para regularizar seu plano.'
      };
    }

    const userObj = {
      id: user.id,
      username: user.username,
      role: user.role || 'cliente',
      status: user.status || 'ativo',
      notes: user.notes || ''
    };
    setSession(userObj);
    return { success: true, user: userObj };
  }

  // Verifica em tempo real se o usuário ativo ainda está desbloqueado
  async function verifyCurrentSession() {
    const user = getCurrentUser();
    if (!user) return null;

    // Admin principal nunca é bloqueado
    if (user.role === 'admin' || normalizeUsername(user.username) === 'kayna') {
      return { valid: true, user };
    }

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('status, role')
          .ilike('username', user.username)
          .maybeSingle();

        if (!error && data) {
          if (data.status === 'bloqueado') {
            logout();
            return { valid: false, blocked: true };
          }
          user.status = data.status;
          user.role = data.role;
          setSession(user);
          return { valid: true, user };
        }
      } catch (e) {
        // Ignora erro temporário de rede
      }
    }

    // Checagem local
    const localClients = getLocalClients();
    const found = localClients.find(c => normalizeUsername(c.username) === normalizeUsername(user.username));
    if (found) {
      if (found.status === 'bloqueado') {
        logout();
        return { valid: false, blocked: true };
      }
      return { valid: true, user };
    }

    return { valid: true, user };
  }

  // Listar todos os clientes (Apenas Admin)
  async function listClients() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          saveLocalClients(data);
          return data;
        }
      } catch (e) {
        console.warn('[Auth] Erro ao buscar do Supabase, usando local:', e);
      }
    }
    return getLocalClients();
  }

  // Criar novo cliente
  async function createClient(username, password, notes = '') {
    const cleanUsername = (username || '').trim();
    const cleanPassword = (password || '').trim();
    const cleanNotes = (notes || '').trim();

    if (!cleanUsername || !cleanPassword) {
      return { success: false, message: 'Nome de usuário e senha são obrigatórios.' };
    }

    if (cleanUsername.length < 3) {
      return { success: false, message: 'O nome de usuário deve ter pelo menos 3 caracteres.' };
    }

    // Impedir criação com nome de admin reservado
    if (normalizeUsername(cleanUsername) === 'kayna' || normalizeUsername(cleanUsername) === 'admin') {
      return { success: false, message: 'Este nome de usuário é reservado para o administrador.' };
    }

    // Verificar duplicidade local
    const local = getLocalClients();
    if (local.some(c => normalizeUsername(c.username) === normalizeUsername(cleanUsername))) {
      return { success: false, message: `O usuário "${cleanUsername}" já existe no catálogo.` };
    }

    const newClient = {
      id: 'cli-' + Date.now(),
      username: cleanUsername,
      password: cleanPassword,
      role: 'cliente',
      status: 'ativo',
      notes: cleanNotes,
      created_at: new Date().toISOString()
    };

    // Salva no Supabase se conectado
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .insert([{
            username: cleanUsername,
            password: cleanPassword,
            role: 'cliente',
            status: 'ativo',
            notes: cleanNotes
          }])
          .select()
          .single();

        if (error) {
          return { success: false, message: `Erro ao salvar no Supabase: ${error.message}` };
        }
        if (data) {
          newClient.id = data.id;
        }
      } catch (err) {
        return { success: false, message: `Falha de rede ao conectar com Supabase: ${err.message}` };
      }
    }

    // Salva no armazenamento local
    local.unshift(newClient);
    saveLocalClients(local);

    return { success: true, client: newClient };
  }

  // Alternar Bloqueio / Desbloqueio do Cliente
  async function toggleBlockClient(clientId) {
    const local = getLocalClients();
    const client = local.find(c => c.id === clientId || c.username === clientId);
    if (!client) {
      return { success: false, message: 'Cliente não encontrado.' };
    }

    if (client.role === 'admin' || normalizeUsername(client.username) === 'kayna') {
      return { success: false, message: 'Não é possível bloquear o Administrador Principal.' };
    }

    const newStatus = client.status === 'ativo' ? 'bloqueado' : 'ativo';
    client.status = newStatus;
    client.updated_at = new Date().toISOString();

    if (supabase) {
      try {
        await supabase
          .from('clientes')
          .update({ status: newStatus, updated_at: client.updated_at })
          .eq('id', client.id);
      } catch (e) {
        console.warn('[Auth] Erro ao sincronizar bloqueio com Supabase:', e);
      }
    }

    saveLocalClients(local);
    return { success: true, newStatus, client };
  }

  // Redefinir Senha do Cliente (Apenas Admin pode fazer isso)
  async function updateClientPassword(clientId, newPassword) {
    const cleanPw = (newPassword || '').trim();
    if (!cleanPw) {
      return { success: false, message: 'A nova senha não pode ser vazia.' };
    }

    const local = getLocalClients();
    const client = local.find(c => c.id === clientId || c.username === clientId);
    if (!client) {
      return { success: false, message: 'Cliente não encontrado.' };
    }

    client.password = cleanPw;
    client.updated_at = new Date().toISOString();

    if (supabase) {
      try {
        await supabase
          .from('clientes')
          .update({ password: cleanPw, updated_at: client.updated_at })
          .eq('id', client.id);
      } catch (e) {
        console.warn('[Auth] Erro ao sincronizar nova senha com Supabase:', e);
      }
    }

    saveLocalClients(local);
    return { success: true, client };
  }

  // Excluir Cliente
  async function deleteClient(clientId) {
    let local = getLocalClients();
    const client = local.find(c => c.id === clientId || c.username === clientId);
    if (!client) {
      return { success: false, message: 'Cliente não encontrado.' };
    }

    if (client.role === 'admin' || normalizeUsername(client.username) === 'kayna') {
      return { success: false, message: 'Não é permitido excluir o Administrador Principal Kaynã.' };
    }

    if (supabase) {
      try {
        await supabase
          .from('clientes')
          .delete()
          .eq('id', client.id);
      } catch (e) {
        console.warn('[Auth] Erro ao excluir do Supabase:', e);
      }
    }

    local = local.filter(c => c.id !== clientId && c.username !== clientId);
    saveLocalClients(local);
    return { success: true };
  }

  // Sincronizar clientes locais para o Supabase
  async function syncLocalToSupabase() {
    if (!supabase) {
      return { success: false, message: 'Supabase não está configurado ou conectado.' };
    }

    try {
      const local = getLocalClients();
      let syncedCount = 0;

      for (const item of local) {
        const { error } = await supabase
          .from('clientes')
          .upsert({
            username: item.username,
            password: item.password,
            role: item.role || 'cliente',
            status: item.status || 'ativo',
            notes: item.notes || ''
          }, { onConflict: 'username' });

        if (!error) syncedCount++;
      }

      const { data } = await supabase.from('clientes').select('*');
      if (data) saveLocalClients(data);

      return { success: true, count: syncedCount, message: `${syncedCount} clientes sincronizados com o Supabase com sucesso!` };
    } catch (err) {
      return { success: false, message: `Erro durante sincronização: ${err.message}` };
    }
  }

  // Inicializa imediatamente
  init();

  return {
    init,
    login,
    logout,
    getCurrentUser,
    verifyCurrentSession,
    listClients,
    createClient,
    toggleBlockClient,
    updateClientPassword,
    deleteClient,
    getSupabaseConfig,
    saveSupabaseConfig,
    isSupabaseConnected,
    testSupabaseConnection,
    syncLocalToSupabase
  };
})();
