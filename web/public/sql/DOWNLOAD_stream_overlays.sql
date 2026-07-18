-- =============================================================================
-- DROPZONE · Overlays de Stream (character generator)
-- Rode no Supabase SQL Editor (uma vez). Idempotente.
-- =============================================================================

create table if not exists public.campeonato_stream_overlays (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  nome text not null default 'Overlay',
  template text not null default 'custom',
  -- blocos do editor (cards / tabelas + estilos + transições)
  blocks jsonb not null default '[]'::jsonb,
  -- token público para Browser Source / vMix (sem login)
  share_token text not null default encode(gen_random_bytes(18), 'hex'),
  ativo boolean not null default true,
  criado_por uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_stream_overlays_share_token
  on public.campeonato_stream_overlays (share_token);

create index if not exists idx_stream_overlays_campeonato
  on public.campeonato_stream_overlays (campeonato_id, updated_at desc);

comment on table public.campeonato_stream_overlays is
  'Overlays do painel Stream (CG). Backend usa service_role; share_token alimenta Browser Source.';

-- RLS: só service_role (padrão DropZone)
alter table public.campeonato_stream_overlays enable row level security;
alter table public.campeonato_stream_overlays force row level security;

drop policy if exists stream_overlays_service_all on public.campeonato_stream_overlays;
create policy stream_overlays_service_all
  on public.campeonato_stream_overlays
  for all
  using (
    coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
      in ('service_role', 'supabase_admin', 'postgres')
  )
  with check (
    coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
      in ('service_role', 'supabase_admin', 'postgres')
  );

revoke all on public.campeonato_stream_overlays from anon, authenticated;
