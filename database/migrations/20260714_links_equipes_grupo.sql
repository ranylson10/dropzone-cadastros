alter table public.campeonato_links
  add column if not exists metadata jsonb not null default '{}'::jsonb;
