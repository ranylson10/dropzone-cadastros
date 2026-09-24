-- DropZone R148 — financeiro gerencial privado por produtora e campeonato.
-- O saldo real continua em sistema_carteiras; estas tabelas guardam apenas gestão, metas e lançamentos manuais.

create table public.produtora_financeiro_lancamentos (
  id uuid primary key default gen_random_uuid(),
  produtora_id uuid not null references public.produtoras(id) on delete cascade,
  campeonato_id uuid references public.campeonatos(id) on delete set null,
  tipo text not null check (tipo in ('receita','despesa')),
  categoria text not null check (categoria in (
    'patrocinio','premiacao','design','narracao','servidor','producao','marketing',
    'plataforma','equipe','viagem','imposto','taxa','outros'
  )),
  descricao text not null,
  valor_centavos bigint not null check (valor_centavos > 0),
  data_competencia date not null default current_date,
  status text not null default 'realizado' check (status in ('previsto','realizado','cancelado')),
  observacao text,
  criado_por_auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index produtora_financeiro_lancamentos_produtora_data_idx
  on public.produtora_financeiro_lancamentos (produtora_id, data_competencia desc, created_at desc);
create index produtora_financeiro_lancamentos_campeonato_data_idx
  on public.produtora_financeiro_lancamentos (campeonato_id, data_competencia desc)
  where campeonato_id is not null;
create index produtora_financeiro_lancamentos_criado_por_idx
  on public.produtora_financeiro_lancamentos (criado_por_auth_user_id)
  where criado_por_auth_user_id is not null;

alter table public.produtora_financeiro_lancamentos enable row level security;
revoke all on table public.produtora_financeiro_lancamentos from anon, authenticated;

create table public.produtora_financeiro_metas (
  id uuid primary key default gen_random_uuid(),
  produtora_id uuid not null references public.produtoras(id) on delete cascade,
  competencia date not null,
  meta_receita_centavos bigint not null default 0 check (meta_receita_centavos >= 0),
  meta_lucro_centavos bigint not null default 0 check (meta_lucro_centavos >= 0),
  meta_vagas integer not null default 0 check (meta_vagas >= 0),
  criado_por_auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (produtora_id, competencia),
  check (competencia = date_trunc('month', competencia)::date)
);

create index produtora_financeiro_metas_criado_por_idx
  on public.produtora_financeiro_metas (criado_por_auth_user_id)
  where criado_por_auth_user_id is not null;

alter table public.produtora_financeiro_metas enable row level security;
revoke all on table public.produtora_financeiro_metas from anon, authenticated;
