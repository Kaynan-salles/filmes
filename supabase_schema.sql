-- =====================================================================
-- K-CINE - ESQUEMA DO BANCO DE DADOS SUPABASE (PROJETO: fedwfhileifzuogihdrn)
-- =====================================================================
-- Instruções:
-- 1. Acesse o SQL Editor do seu projeto Supabase:
--    https://supabase.com/dashboard/project/fedwfhileifzuogihdrn/sql/new
-- 2. Cole todo este código abaixo e clique em "Run" (Executar)
-- 3. As tabelas 'clientes', 'animes', 'episodes', 'episode_sources', 
--    'user_favorites' e 'user_watch_progress' serão criadas com RLS configurado!
-- =====================================================================

-- 1. Criação da Tabela de Clientes e Usuários
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cliente',       -- 'admin' ou 'cliente'
    status TEXT NOT NULL DEFAULT 'ativo',       -- 'ativo' ou 'bloqueado'
    notes TEXT DEFAULT '',                      -- Notas, ex: 'Plano Mensal - Vencimento 30/11'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices para busca ultra-rápida de login
CREATE INDEX IF NOT EXISTS idx_clientes_username ON public.clientes (username);
CREATE INDEX IF NOT EXISTS idx_clientes_status ON public.clientes (status);

-- 3. Habilitação de RLS (Row Level Security)
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Acesso para a chave pública (anon) e autenticada
-- Permite leitura para verificação de login e listagem pela central
DROP POLICY IF EXISTS "Permitir leitura anonima de clientes" ON public.clientes;
CREATE POLICY "Permitir leitura anonima de clientes"
ON public.clientes FOR SELECT
TO anon, authenticated
USING (true);

-- Permite inserção de novos clientes criados pelo Admin
DROP POLICY IF EXISTS "Permitir criacao de clientes" ON public.clientes;
CREATE POLICY "Permitir criacao de clientes"
ON public.clientes FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Permite atualizar status (bloquear/desbloquear) e senhas
DROP POLICY IF EXISTS "Permitir atualizacao de clientes" ON public.clientes;
CREATE POLICY "Permitir atualizacao de clientes"
ON public.clientes FOR UPDATE
TO anon, authenticated
USING (true);

-- Permite exclusão de clientes
DROP POLICY IF EXISTS "Permitir exclusao de clientes" ON public.clientes;
CREATE POLICY "Permitir exclusao de clientes"
ON public.clientes FOR DELETE
TO anon, authenticated
USING (true);

-- 5. Cadastro do Administrador Principal e Clientes Autorizados
INSERT INTO public.clientes (username, password, role, status, notes)
VALUES 
    ('Kaynã', '102587', 'admin', 'ativo', 'Kaynã - Único Dono & Administrador Geral do K-Cine'),
    ('Luana', '#123456', 'cliente', 'ativo', 'Cliente Autorizada'),
    ('Gleydson', '#123456', 'cliente', 'ativo', 'Cliente Autorizado'),
    ('Kaio', '#12345', 'cliente', 'ativo', 'Cliente Autorizado')
ON CONFLICT (username) DO UPDATE 
SET password = EXCLUDED.password, role = EXCLUDED.role, status = EXCLUDED.status;

-- Remove contas de demonstração e admin legadas
DELETE FROM public.clientes WHERE username = 'admin' OR username = 'cliente1';

-- =====================================================================
-- 6. TABELAS DE INTEGRAÇÃO DE ANIMES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.animes (
    id TEXT PRIMARY KEY,
    canonical_title TEXT NOT NULL,
    original_title TEXT,
    normalized_title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    synopsis TEXT DEFAULT '',
    poster TEXT DEFAULT '',
    banner TEXT DEFAULT '',
    year INTEGER,
    season INTEGER NOT NULL DEFAULT 1,
    format TEXT NOT NULL DEFAULT 'TV',
    genres JSONB DEFAULT '[]'::jsonb,
    anilist_id INTEGER,
    mal_id INTEGER,
    total_episodes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'COMPLETED',
    review_pending BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_animes_normalized_title ON public.animes(normalized_title);
CREATE INDEX IF NOT EXISTS idx_animes_slug ON public.animes(slug);

CREATE TABLE IF NOT EXISTS public.anime_aliases (
    id BIGSERIAL PRIMARY KEY,
    anime_id TEXT NOT NULL REFERENCES public.animes(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    normalized_alias TEXT NOT NULL,
    source TEXT DEFAULT 'manual',
    UNIQUE(anime_id, normalized_alias)
);

CREATE TABLE IF NOT EXISTS public.episodes (
    id TEXT PRIMARY KEY,
    anime_id TEXT NOT NULL REFERENCES public.animes(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL DEFAULT 1,
    episode_number NUMERIC NOT NULL,
    episode_type TEXT NOT NULL DEFAULT 'regular',
    title TEXT DEFAULT '',
    thumbnail TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(anime_id, season_number, episode_number, episode_type)
);

CREATE TABLE IF NOT EXISTS public.episode_sources (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_anime_id TEXT NOT NULL,
    provider_ep_id TEXT NOT NULL,
    audio_type TEXT NOT NULL DEFAULT 'legendado',
    player_type TEXT NOT NULL DEFAULT 'direct',
    stream_url TEXT DEFAULT '',
    quality TEXT DEFAULT 'HD',
    is_dynamic BOOLEAN DEFAULT true,
    extra_payload JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(episode_id, provider, audio_type, quality)
);

CREATE TABLE IF NOT EXISTS public.user_favorites (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'anime',
    title TEXT DEFAULT '',
    poster TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, content_id, content_type)
);

CREATE TABLE IF NOT EXISTS public.user_watch_progress (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'anime',
    episode_id TEXT,
    season_number INTEGER DEFAULT 1,
    episode_number NUMERIC DEFAULT 1,
    episode_title TEXT DEFAULT '',
    position_seconds NUMERIC DEFAULT 0,
    duration_seconds NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, content_id)
);

-- Políticas RLS para Animes, Favoritos e Progresso
ALTER TABLE public.animes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episode_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_watch_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura anonima de animes" ON public.animes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Permitir leitura anonima de episodios" ON public.episodes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Permitir leitura anonima de fontes" ON public.episode_sources FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Permitir acesso completo a favoritos" ON public.user_favorites FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acesso completo a progresso" ON public.user_watch_progress FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
