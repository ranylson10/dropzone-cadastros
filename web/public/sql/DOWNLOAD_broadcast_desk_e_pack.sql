-- =============================================================================
-- DROPZONE · Broadcast desk único + composição (pack) de cenas do campeonato
-- Rode no Supabase SQL Editor. Idempotente.
--
-- Mudança de modelo:
--  · 1 controlador + 1 link OBS por perfil Stream (independente de campeonatos)
--  · campeonato_id na sessão = live ATUAL selecionada no controlador
--  · pack do campeonato = overlays escolhidas (+ BG opcional) para os botões da mesa
-- =============================================================================

-- Sessão: campeonato_id passa a ser a live selecionada (pode ser null)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'broadcast_live_sessions'
      and column_name = 'campeonato_id'
      and is_nullable = 'NO'
  ) then
    alter table public.broadcast_live_sessions
      alter column campeonato_id drop not null;
  end if;
end $$;

-- Limpa duplicatas do modelo antigo (1 sessão por campeonato) antes do índice único
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'broadcast_live_sessions'
  ) then
    -- mantém a sessão mais recente de cada broadcast; desativa as demais
    update public.broadcast_live_sessions s
    set ativo = false, updated_at = now()
    where s.ativo = true
      and s.id not in (
        select distinct on (broadcast_id) id
        from public.broadcast_live_sessions
        where ativo = true
        order by broadcast_id, updated_at desc nulls last, created_at desc nulls last
      );
  end if;
end $$;

-- Uma mesa ativa por broadcast (tokens permanentes)
create unique index if not exists idx_broadcast_sessions_one_active_per_broadcast
  on public.broadcast_live_sessions (broadcast_id)
  where (ativo = true);

comment on table public.broadcast_live_sessions is
  'Mesa do Stream: 1 por broadcast. controller_token + obs_token fixos; campeonato_id = live selecionada; active_overlay_id = cena no ar.';

comment on column public.broadcast_live_sessions.campeonato_id is
  'Campeonato (live) atualmente selecionado no controlador. Null = nenhuma live ativa.';

-- Composição da live do campeonato (quais overlays o Stream vê no controlador)
create table if not exists public.campeonato_stream_pack (
  campeonato_id uuid primary key references public.campeonatos(id) on delete cascade,
  -- ordem dos botões no controlador (subset das overlays criadas no editor)
  selected_overlay_ids jsonb not null default '[]'::jsonb,
  -- fundo de pré-visualização / ambientação (image PNG ou video URL)
  bg_type text not null default 'none'
    check (bg_type in ('none', 'image', 'video')),
  bg_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

create index if not exists idx_stream_pack_updated
  on public.campeonato_stream_pack (updated_at desc);

alter table public.campeonato_stream_pack enable row level security;
alter table public.campeonato_stream_pack force row level security;

do $$
begin
  drop policy if exists campeonato_stream_pack_service_all on public.campeonato_stream_pack;
  create policy campeonato_stream_pack_service_all on public.campeonato_stream_pack
    for all using (
      coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
        in ('service_role', 'supabase_admin', 'postgres')
    ) with check (
      coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
        in ('service_role', 'supabase_admin', 'postgres')
    );
  revoke all on public.campeonato_stream_pack from anon, authenticated;
end $$;

comment on table public.campeonato_stream_pack is
  'Composição da live: overlays selecionadas (ordem) + BG opcional. O Stream só opera o que o admin marcou aqui.';
