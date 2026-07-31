-- DROPZONE — Rodada 85A
-- Fundação para campeonatos mistos, séries, edições e Diários por horário.
-- Esta migration é aditiva: campeonatos atuais continuam funcionando sem vínculo obrigatório.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at_rodada_85a()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Nome histórico do campeonato, independente das edições operacionais.
create table if not exists public.campeonato_franquias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text,
  descricao text,
  logo_url text,
  banner_url text,
  criado_por uuid references auth.users(id) on delete set null,
  status text not null default 'ativo' check (status in ('ativo', 'inativo', 'arquivado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists campeonato_franquias_slug_unique
  on public.campeonato_franquias (lower(slug))
  where slug is not null and btrim(slug) <> '';

-- Cada edição aponta para um campeonato operacional já existente.
create table if not exists public.campeonato_edicoes (
  id uuid primary key default gen_random_uuid(),
  franquia_id uuid not null references public.campeonato_franquias(id) on delete cascade,
  campeonato_id uuid not null unique references public.campeonatos(id) on delete cascade,
  numero_edicao integer,
  temporada text,
  titulo_publico text,
  data_inicio date,
  data_fim date,
  status text not null default 'planejada' check (status in ('planejada', 'ativa', 'encerrada', 'cancelada', 'arquivada')),
  metadados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (numero_edicao is null or numero_edicao > 0),
  check (data_fim is null or data_inicio is null or data_fim >= data_inicio)
);

create unique index if not exists campeonato_edicoes_numero_unique
  on public.campeonato_edicoes (franquia_id, numero_edicao)
  where numero_edicao is not null;

create unique index if not exists campeonato_edicoes_temporada_unique
  on public.campeonato_edicoes (franquia_id, lower(temporada))
  where temporada is not null and btrim(temporada) <> '';

-- Série/divisão dentro de uma edição: C, B, A ou qualquer nome configurável.
create table if not exists public.campeonato_divisoes (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.campeonato_edicoes(id) on delete cascade,
  nome text not null,
  codigo text,
  ordem integer not null default 1 check (ordem > 0),
  descricao text,
  premiacao_descricao text,
  premiacao_valor numeric(14,2),
  premiacao_moeda text not null default 'BRL',
  premia_mvp boolean not null default false,
  status text not null default 'planejada' check (status in ('planejada', 'ativa', 'encerrada', 'cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (premiacao_valor is null or premiacao_valor >= 0)
);

create unique index if not exists campeonato_divisoes_nome_unique
  on public.campeonato_divisoes (edicao_id, lower(nome));

create unique index if not exists campeonato_divisoes_ordem_unique
  on public.campeonato_divisoes (edicao_id, ordem);

-- Etapa operacional. Uma divisão pode ter Qualificatória + Pontos Corridos,
-- e campeonatos sem divisão podem criar etapas diretamente na edição.
create table if not exists public.campeonato_etapas (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.campeonato_edicoes(id) on delete cascade,
  divisao_id uuid references public.campeonato_divisoes(id) on delete cascade,
  nome text not null,
  ordem integer not null default 1 check (ordem > 0),
  tipo text not null default 'outra' check (tipo in ('qualificatoria', 'pontos_corridos', 'mata_mata', 'final', 'outra')),
  formato text not null default 'outro' check (formato in ('mata_mata', 'pontos_corridos', 'jogo_unico', 'misto', 'outro')),
  capacidade_total integer check (capacidade_total is null or capacidade_total > 0),
  vagas_venda_direta integer not null default 0 check (vagas_venda_direta >= 0),
  valor_vaga numeric(14,2) check (valor_vaga is null or valor_vaga >= 0),
  moeda text not null default 'BRL',
  venda_inicio timestamptz,
  venda_fim timestamptz,
  premiacao_descricao text,
  premiacao_valor numeric(14,2) check (premiacao_valor is null or premiacao_valor >= 0),
  premia_mvp boolean not null default false,
  classificam_quantidade integer check (classificam_quantidade is null or classificam_quantidade >= 0),
  status text not null default 'planejada' check (status in ('planejada', 'vendas_abertas', 'ativa', 'encerrada', 'cancelada')),
  metadados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (venda_fim is null or venda_inicio is null or venda_fim >= venda_inicio),
  check (capacidade_total is null or vagas_venda_direta <= capacidade_total)
);

create unique index if not exists campeonato_etapas_contexto_ordem_unique
  on public.campeonato_etapas (edicao_id, coalesce(divisao_id, '00000000-0000-0000-0000-000000000000'::uuid), ordem);

create unique index if not exists campeonato_etapas_contexto_nome_unique
  on public.campeonato_etapas (edicao_id, coalesce(divisao_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nome));

-- Composição da capacidade da etapa: classificadas, promovidas, venda direta,
-- convites ou inclusão manual. Permite somar várias origens na mesma fase.
create table if not exists public.campeonato_etapa_fontes (
  id uuid primary key default gen_random_uuid(),
  etapa_destino_id uuid not null references public.campeonato_etapas(id) on delete cascade,
  tipo_origem text not null check (tipo_origem in ('qualificatoria', 'promocao', 'venda_direta', 'convite', 'manual', 'outra_etapa')),
  etapa_origem_id uuid references public.campeonato_etapas(id) on delete set null,
  divisao_origem_id uuid references public.campeonato_divisoes(id) on delete set null,
  quantidade integer not null check (quantidade > 0),
  descricao text,
  created_at timestamptz not null default now(),
  check (etapa_origem_id is null or etapa_origem_id <> etapa_destino_id),
  check (
    tipo_origem in ('venda_direta', 'convite', 'manual')
    or etapa_origem_id is not null
    or divisao_origem_id is not null
  )
);

create index if not exists campeonato_etapa_fontes_destino_idx
  on public.campeonato_etapa_fontes (etapa_destino_id);

-- Regra explícita de destino. Promoção é o padrão; permanência e
-- rebaixamento são opcionais e nunca são presumidos pelo sistema.
create table if not exists public.campeonato_progressao_regras (
  id uuid primary key default gen_random_uuid(),
  etapa_origem_id uuid not null references public.campeonato_etapas(id) on delete cascade,
  etapa_destino_id uuid references public.campeonato_etapas(id) on delete set null,
  divisao_destino_id uuid references public.campeonato_divisoes(id) on delete set null,
  tipo text not null check (tipo in ('avanco', 'promocao', 'eliminacao', 'rebaixamento', 'permanencia', 'premiacao')),
  posicao_inicio integer,
  posicao_fim integer,
  quantidade integer,
  automatica boolean not null default false,
  descricao text,
  created_at timestamptz not null default now(),
  check (posicao_inicio is null or posicao_inicio > 0),
  check (posicao_fim is null or posicao_fim > 0),
  check (posicao_fim is null or posicao_inicio is null or posicao_fim >= posicao_inicio),
  check (quantidade is null or quantidade > 0),
  check (
    tipo in ('eliminacao', 'premiacao')
    or etapa_destino_id is not null
    or divisao_destino_id is not null
  )
);

create index if not exists campeonato_progressao_origem_idx
  on public.campeonato_progressao_regras (etapa_origem_id);

-- Premiação detalhada por etapa, incluindo MVP sem forçar formato fixo.
create table if not exists public.campeonato_etapa_premiacoes (
  id uuid primary key default gen_random_uuid(),
  etapa_id uuid not null references public.campeonato_etapas(id) on delete cascade,
  tipo text not null check (tipo in ('colocacao', 'mvp', 'outro')),
  posicao integer,
  titulo text,
  valor numeric(14,2),
  moeda text not null default 'BRL',
  descricao text,
  created_at timestamptz not null default now(),
  check (posicao is null or posicao > 0),
  check (valor is null or valor >= 0)
);

create unique index if not exists campeonato_etapa_premiacoes_colocacao_unique
  on public.campeonato_etapa_premiacoes (etapa_id, tipo, posicao)
  where posicao is not null;

-- Diário: cada horário é uma unidade independente, vinculável a um grupo
-- já existente. A interface poderá exibir 19:00, 20:00 etc. no lugar de A/B/C.
create table if not exists public.campeonato_diario_horarios (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  grupo_id uuid unique references public.campeonato_grupos(id) on delete set null,
  horario time not null,
  nome_exibicao text,
  capacidade integer check (capacidade is null or capacidade > 0),
  valor_vaga numeric(14,2) check (valor_vaga is null or valor_vaga >= 0),
  moeda text not null default 'BRL',
  premiacao_descricao text,
  premiacao_valor numeric(14,2) check (premiacao_valor is null or premiacao_valor >= 0),
  mapa text,
  numero_quedas integer not null default 1 check (numero_quedas > 0),
  status text not null default 'aberto' check (status in ('rascunho', 'aberto', 'lotado', 'iniciado', 'encerrado', 'cancelado')),
  metadados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists campeonato_diario_horarios_unique
  on public.campeonato_diario_horarios (campeonato_id, horario);

-- Compatibilidade opcional com a estrutura operacional atual.
alter table public.campeonato_fases
  add column if not exists etapa_id uuid references public.campeonato_etapas(id) on delete set null;

create index if not exists campeonato_fases_etapa_idx
  on public.campeonato_fases (etapa_id);

alter table public.campeonato_grupos
  add column if not exists diario_horario_id uuid references public.campeonato_diario_horarios(id) on delete set null;

create unique index if not exists campeonato_grupos_diario_horario_unique
  on public.campeonato_grupos (diario_horario_id)
  where diario_horario_id is not null;

-- Proteção padrão: as APIs usarão service role com autorização própria nas
-- próximas rodadas. Nenhuma tabela nova fica acessível diretamente ao cliente.
alter table public.campeonato_franquias enable row level security;
alter table public.campeonato_edicoes enable row level security;
alter table public.campeonato_divisoes enable row level security;
alter table public.campeonato_etapas enable row level security;
alter table public.campeonato_etapa_fontes enable row level security;
alter table public.campeonato_progressao_regras enable row level security;
alter table public.campeonato_etapa_premiacoes enable row level security;
alter table public.campeonato_diario_horarios enable row level security;

-- Triggers de atualização idempotentes.
do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'campeonato_franquias',
    'campeonato_edicoes',
    'campeonato_divisoes',
    'campeonato_etapas',
    'campeonato_diario_horarios'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || tabela || '_updated_at', tabela);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at_rodada_85a()',
      'trg_' || tabela || '_updated_at',
      tabela
    );
  end loop;
end $$;

comment on table public.campeonato_franquias is 'Identidade histórica de um campeonato, reunindo suas edições/temporadas.';
comment on table public.campeonato_edicoes is 'Vínculo entre uma franquia histórica e um campeonato operacional existente.';
comment on table public.campeonato_divisoes is 'Séries ou divisões configuráveis, como C, B e A.';
comment on table public.campeonato_etapas is 'Etapas independentes por edição/divisão, com capacidade, venda e premiação próprias.';
comment on table public.campeonato_etapa_fontes is 'Composição de entrada de uma etapa: classificadas, promovidas, vendas, convites ou inclusão manual.';
comment on table public.campeonato_progressao_regras is 'Destino configurável das equipes; promoção, avanço, eliminação, rebaixamento e permanência são opcionais.';
comment on table public.campeonato_diario_horarios is 'Horários independentes de campeonatos Diários, cada um com vagas, premiação e jogo próprios.';

commit;
