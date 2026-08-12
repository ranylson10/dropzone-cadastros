-- Rodada 89T — biblioteca reutilizável de imagens do campeonato.
-- Compartilha apenas assets; artes de postagem e overlays continuam com layouts independentes.

create table if not exists public.campeonato_asset_library (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  created_by uuid not null,
  name text not null default 'Imagem',
  url text not null,
  kind text not null default 'other' check (kind in ('background','cell','card','other')),
  created_at timestamptz not null default now()
);

create unique index if not exists campeonato_asset_library_campeonato_url_uidx
  on public.campeonato_asset_library(campeonato_id, url);

create index if not exists campeonato_asset_library_campeonato_created_idx
  on public.campeonato_asset_library(campeonato_id, created_at desc);

alter table public.campeonato_asset_library enable row level security;

comment on table public.campeonato_asset_library is
  'Biblioteca de imagens reutilizáveis do campeonato. Pode abastecer artes para postagem e, futuramente, overlays sem acoplar seus layouts.';
