-- Rodada 89P — artes de redes sociais independentes das overlays de transmissão.

create table if not exists public.campeonato_post_artworks (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  created_by uuid not null,
  updated_by uuid,
  name text not null default 'Nova arte',
  width integer not null default 1080 check (width between 240 and 76800),
  height integer not null default 1350 check (height between 240 and 76800),
  slice_count integer not null default 1 check (slice_count between 1 and 10),
  slice_direction text not null default 'horizontal' check (slice_direction in ('horizontal','vertical')),
  slice_width integer not null default 1080 check (slice_width between 240 and 7680),
  slice_height integer not null default 1350 check (slice_height between 240 and 7680),
  output_format text not null default 'png' check (output_format in ('png','jpg')),
  background_url text,
  background_color text not null default '#ffffff',
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campeonato_post_artworks_campeonato_idx
  on public.campeonato_post_artworks(campeonato_id, updated_at desc);

alter table public.campeonato_post_artworks enable row level security;

comment on table public.campeonato_post_artworks is
  'Templates de artes para redes sociais do campeonato. Independentes do pacote de overlays da transmissão.';
comment on column public.campeonato_post_artworks.blocks is
  'Blocos estatísticos e elementos livres da arte. Não referencia layout de overlay de live.';
