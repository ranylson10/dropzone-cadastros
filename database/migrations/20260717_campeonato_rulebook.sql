-- Rulebook Builder Inteligente
-- Regulamento gerado por assistente (perguntas + templates) por campeonato.

create table if not exists public.campeonato_rulebooks (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  perfil text not null default 'comunitario'
    check (perfil in ('comunitario', 'semiprofissional', 'profissional', 'personalizado')),
  etapa_atual integer not null default 0
    check (etapa_atual >= 0 and etapa_atual <= 4),
  respostas jsonb not null default '{}'::jsonb,
  modules_ativos text[] not null default '{}',
  infracoes jsonb not null default '[]'::jsonb,
  alertas jsonb not null default '[]'::jsonb,
  confirmacoes_alertas jsonb not null default '{}'::jsonb,
  documento jsonb not null default '{}'::jsonb,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'em_revisao', 'publicado', 'bloqueado_alertas')),
  catalog_version text not null default '1.0.0',
  versao integer not null default 1,
  publicado_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campeonato_id)
);

create index if not exists campeonato_rulebooks_campeonato_id_idx
  on public.campeonato_rulebooks (campeonato_id);

create index if not exists campeonato_rulebooks_status_idx
  on public.campeonato_rulebooks (status);

comment on table public.campeonato_rulebooks is
  'Rulebook gerado pelo assistente inteligente (perfil, respostas, infrações e documento).';

comment on column public.campeonato_rulebooks.respostas is
  'Mapa question_id -> valor respondido pelo organizador.';

comment on column public.campeonato_rulebooks.infracoes is
  'Lista de infrações configuradas com campos obrigatórios preenchidos.';

comment on column public.campeonato_rulebooks.documento is
  'Documento estruturado: capítulos, artigos numerados, sumário.';

-- Atualiza updated_at
create or replace function public.set_campeonato_rulebooks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists campeonato_rulebooks_updated_at on public.campeonato_rulebooks;
create trigger campeonato_rulebooks_updated_at
  before update on public.campeonato_rulebooks
  for each row
  execute function public.set_campeonato_rulebooks_updated_at();

-- RLS: leitura pública apenas se publicado; escrita via service_role (API backend)
alter table public.campeonato_rulebooks enable row level security;

drop policy if exists campeonato_rulebooks_public_read on public.campeonato_rulebooks;
create policy campeonato_rulebooks_public_read
  on public.campeonato_rulebooks
  for select
  using (status = 'publicado');
