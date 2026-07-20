-- =============================================================================
-- DROPZONE · Schema base de campeonato_configuracoes
-- Idempotente. Garante que ambientes novos tenham a tabela usada pelo backend.
-- =============================================================================

create table if not exists public.campeonato_configuracoes (
  campeonato_id uuid primary key references public.campeonatos(id) on delete cascade,
  premiacao numeric(12,2),
  valor_inscricao numeric(12,2),
  descricao_premiacao text,
  divisao_premiacao text,
  numero_vagas integer,
  formato text,
  plataforma text,
  servidor text,
  tipo_premiacao text,
  tem_trofeu boolean not null default false,
  tem_live boolean not null default false,
  vagas_por_equipe integer,
  jogadores_por_vaga integer,
  permite_jogador_multiplas_equipes boolean not null default false,
  permite_troca_jogadores boolean not null default false,
  data_limite_trocas timestamptz,
  data_limite_inscricao timestamptz,
  aceita_novas_inscricoes_equipes boolean not null default true,
  contatos_whatsapp jsonb not null default '[]'::jsonb,
  cor_principal text not null default '#ff4655',
  cor_secundaria text not null default '#17191d',
  cor_texto_clara text not null default '#ffffff',
  cor_texto_escura text not null default '#17191d',
  bg_opacidade integer not null default 18,
  bg_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campeonato_configuracoes
  add column if not exists premiacao numeric(12,2),
  add column if not exists valor_inscricao numeric(12,2),
  add column if not exists descricao_premiacao text,
  add column if not exists divisao_premiacao text,
  add column if not exists numero_vagas integer,
  add column if not exists formato text,
  add column if not exists plataforma text,
  add column if not exists servidor text,
  add column if not exists tipo_premiacao text,
  add column if not exists tem_trofeu boolean not null default false,
  add column if not exists tem_live boolean not null default false,
  add column if not exists vagas_por_equipe integer,
  add column if not exists jogadores_por_vaga integer,
  add column if not exists permite_jogador_multiplas_equipes boolean not null default false,
  add column if not exists permite_troca_jogadores boolean not null default false,
  add column if not exists data_limite_trocas timestamptz,
  add column if not exists data_limite_inscricao timestamptz,
  add column if not exists aceita_novas_inscricoes_equipes boolean not null default true,
  add column if not exists contatos_whatsapp jsonb not null default '[]'::jsonb,
  add column if not exists cor_principal text not null default '#ff4655',
  add column if not exists cor_secundaria text not null default '#17191d',
  add column if not exists cor_texto_clara text not null default '#ffffff',
  add column if not exists cor_texto_escura text not null default '#17191d',
  add column if not exists bg_opacidade integer not null default 18,
  add column if not exists bg_image_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.campeonato_configuracoes
  drop constraint if exists campeonato_configuracoes_premiacao_check,
  drop constraint if exists campeonato_configuracoes_valor_inscricao_check,
  drop constraint if exists campeonato_configuracoes_numero_vagas_check,
  drop constraint if exists campeonato_configuracoes_vagas_por_equipe_check,
  drop constraint if exists campeonato_configuracoes_jogadores_por_vaga_check,
  drop constraint if exists campeonato_configuracoes_tipo_premiacao_check,
  drop constraint if exists campeonato_configuracoes_bg_opacidade_check,
  drop constraint if exists campeonato_configuracoes_contatos_whatsapp_array;

alter table public.campeonato_configuracoes
  add constraint campeonato_configuracoes_premiacao_check
    check (premiacao is null or premiacao >= 0),
  add constraint campeonato_configuracoes_valor_inscricao_check
    check (valor_inscricao is null or valor_inscricao >= 0),
  add constraint campeonato_configuracoes_numero_vagas_check
    check (numero_vagas is null or numero_vagas > 0),
  add constraint campeonato_configuracoes_vagas_por_equipe_check
    check (vagas_por_equipe is null or vagas_por_equipe > 0),
  add constraint campeonato_configuracoes_jogadores_por_vaga_check
    check (jogadores_por_vaga is null or jogadores_por_vaga > 0),
  add constraint campeonato_configuracoes_tipo_premiacao_check
    check (
      tipo_premiacao is null
      or tipo_premiacao in ('sem_premiacao', 'pix', 'dinheiro', 'brinde')
    ),
  add constraint campeonato_configuracoes_bg_opacidade_check
    check (bg_opacidade between 0 and 100),
  add constraint campeonato_configuracoes_contatos_whatsapp_array
    check (jsonb_typeof(contatos_whatsapp) = 'array');

create index if not exists idx_campeonato_configuracoes_inscricoes
  on public.campeonato_configuracoes (aceita_novas_inscricoes_equipes, data_limite_inscricao);

alter table public.campeonato_configuracoes enable row level security;
alter table public.campeonato_configuracoes force row level security;

do $$
begin
  drop policy if exists campeonato_configuracoes_service_all on public.campeonato_configuracoes;
  create policy campeonato_configuracoes_service_all on public.campeonato_configuracoes
    for all using (
      coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
        in ('service_role', 'supabase_admin', 'postgres')
    ) with check (
      coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
        in ('service_role', 'supabase_admin', 'postgres')
    );
  revoke all on public.campeonato_configuracoes from anon, authenticated;
exception
  when others then
    raise notice 'RLS campeonato_configuracoes: %', sqlerrm;
end $$;
