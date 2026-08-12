-- Rodada 90F — compartilhamento de pacotes de artes por token curto.
-- O token carrega apenas templates e referências de assets; nunca resultados, equipes ou jogadores.

create table if not exists public.campeonato_post_artwork_share_tokens (
  id uuid primary key default gen_random_uuid(),
  source_campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  created_by uuid not null,
  token text not null,
  name text not null default 'Pacote de artes',
  payload jsonb not null default '{}'::jsonb,
  artwork_count integer not null default 0 check (artwork_count >= 0),
  asset_count integer not null default 0 check (asset_count >= 0),
  use_count integer not null default 0 check (use_count >= 0),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists campeonato_post_artwork_share_tokens_token_uidx
  on public.campeonato_post_artwork_share_tokens(token);

create index if not exists campeonato_post_artwork_share_tokens_source_idx
  on public.campeonato_post_artwork_share_tokens(source_campeonato_id, created_at desc);

alter table public.campeonato_post_artwork_share_tokens enable row level security;

comment on table public.campeonato_post_artwork_share_tokens is
  'Snapshots compartilháveis de templates de artes. Importação exige autenticação e permissão no campeonato de destino.';
