create table if not exists public.site_home_config (
  id text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.site_home_config enable row level security;

comment on table public.site_home_config is
  'Configuração visual da página inicial pública. Leitura e escrita passam pela API do site; gravação é restrita ao administrador do sistema.';

insert into public.site_home_config (id, config)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;
