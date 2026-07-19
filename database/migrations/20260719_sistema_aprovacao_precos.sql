-- =============================================================================
-- DROPZONE · Aprovação de produtora/campeonato + precificação
-- Idempotente. Dados existentes ficam APROVADOS (nada quebra no ar).
-- Novos cadastros nascem PENDENTES até o admin liberar.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Aprovação (produtora e campeonato)
-- ---------------------------------------------------------------------------
alter table public.produtoras
  add column if not exists aprovacao_status text;

alter table public.campeonatos
  add column if not exists aprovacao_status text;

-- backfill legado → aprovado
update public.produtoras
set aprovacao_status = 'aprovado'
where aprovacao_status is null or btrim(aprovacao_status) = '';

update public.campeonatos
set aprovacao_status = 'aprovado'
where aprovacao_status is null or btrim(aprovacao_status) = '';

alter table public.produtoras
  alter column aprovacao_status set default 'pendente';

alter table public.campeonatos
  alter column aprovacao_status set default 'pendente';

alter table public.produtoras
  alter column aprovacao_status set not null;

alter table public.campeonatos
  alter column aprovacao_status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'produtoras_aprovacao_status_check'
  ) then
    alter table public.produtoras
      add constraint produtoras_aprovacao_status_check
      check (aprovacao_status in ('pendente', 'aprovado', 'rejeitado'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'campeonatos_aprovacao_status_check'
  ) then
    alter table public.campeonatos
      add constraint campeonatos_aprovacao_status_check
      check (aprovacao_status in ('pendente', 'aprovado', 'rejeitado'));
  end if;
end $$;

alter table public.produtoras
  add column if not exists aprovacao_motivo text,
  add column if not exists aprovado_em timestamptz,
  add column if not exists aprovado_por uuid references auth.users(id) on delete set null;

alter table public.campeonatos
  add column if not exists aprovacao_motivo text,
  add column if not exists aprovado_em timestamptz,
  add column if not exists aprovado_por uuid references auth.users(id) on delete set null;

create index if not exists idx_produtoras_aprovacao
  on public.produtoras (aprovacao_status, created_at desc);

create index if not exists idx_campeonatos_aprovacao
  on public.campeonatos (aprovacao_status, created_at desc);

-- ---------------------------------------------------------------------------
-- 2) Catálogo de preços (editável pelo admin do sistema)
-- ---------------------------------------------------------------------------
create table if not exists public.sistema_precos (
  chave text primary key,
  rotulo text not null,
  descricao text,
  categoria text not null default 'geral'
    check (categoria in ('base', 'por_vaga', 'recurso', 'pacote')),
  valor_centavos integer not null default 0 check (valor_centavos >= 0),
  meta jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.sistema_precos is
  'Tabela de preços DropZone (centavos BRL). Chaves usadas no motor de cálculo.';

-- Seed / upsert (valores de referência — admin pode alterar)
insert into public.sistema_precos (chave, rotulo, descricao, categoria, valor_centavos, meta) values
  ('base_diario',    'Base · Diário',     'Taxa base para campeonato diário', 'base', 4900, '{"tipo":"diario"}'::jsonb),
  ('base_copa',      'Base · Copa',       'Taxa base para copa', 'base', 9900, '{"tipo":"copa"}'::jsonb),
  ('base_liga',      'Base · Liga',       'Taxa base para liga', 'base', 14900, '{"tipo":"liga"}'::jsonb),
  ('base_xtreino',   'Base · X-Treino',   'Taxa base para treino/scrim', 'base', 3900, '{"tipo":"xtreino"}'::jsonb),
  ('base_confronto', 'Base · Confronto',  'Taxa base para confronto', 'base', 7900, '{"tipo":"confronto"}'::jsonb),
  ('por_vaga',       'Por vaga (equipe)', 'Cobrança por slot/vaga do campeonato', 'por_vaga', 800, '{"ate":12}'::jsonb),
  ('por_vaga_extra', 'Por vaga extra',    'Vagas acima de 12 (desconto de escala)', 'por_vaga', 600, '{"acima_de":12}'::jsonb),
  ('rec_export',     'Export / Spec',     'Download de arquivos e planilhas para spec/OBS', 'recurso', 3900, '{"feature":"export"}'::jsonb),
  ('rec_stream',     'Overlays Stream',   'Editor de overlays + composição de live', 'recurso', 7900, '{"feature":"stream"}'::jsonb),
  ('rec_rulebook',   'Rulebook PDF',      'Construtor de regulamento e PDF', 'recurso', 2900, '{"feature":"rulebook"}'::jsonb),
  ('rec_stats',      'Tabelas e stats',   'Estatísticas, sumula e tabelas de classificação', 'recurso', 4900, '{"feature":"stats"}'::jsonb),
  ('rec_broadcast',  'Broadcast pack',    'Chave Stream, pack e painel de live', 'recurso', 5900, '{"feature":"broadcast"}'::jsonb)
on conflict (chave) do update set
  rotulo = excluded.rotulo,
  descricao = excluded.descricao,
  categoria = excluded.categoria,
  -- não sobrescreve valor se admin já personalizou: só se meta seed
  valor_centavos = case
    when public.sistema_precos.meta ? 'custom' then public.sistema_precos.valor_centavos
    else excluded.valor_centavos
  end,
  updated_at = now();

alter table public.sistema_precos enable row level security;
alter table public.sistema_precos force row level security;

do $$
begin
  drop policy if exists sistema_precos_service_all on public.sistema_precos;
  create policy sistema_precos_service_all on public.sistema_precos
    for all using (
      coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
        in ('service_role', 'supabase_admin', 'postgres')
    ) with check (
      coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
        in ('service_role', 'supabase_admin', 'postgres')
    );
  revoke all on public.sistema_precos from anon, authenticated;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Cobrança por campeonato (snapshot do cálculo no momento da criação)
-- ---------------------------------------------------------------------------
create table if not exists public.campeonato_cobranca (
  campeonato_id uuid primary key references public.campeonatos(id) on delete cascade,
  valor_base_centavos integer not null default 0 check (valor_base_centavos >= 0),
  valor_vagas_centavos integer not null default 0 check (valor_vagas_centavos >= 0),
  valor_recursos_centavos integer not null default 0 check (valor_recursos_centavos >= 0),
  valor_total_centavos integer not null default 0 check (valor_total_centavos >= 0),
  breakdown jsonb not null default '[]'::jsonb,
  recursos jsonb not null default '{}'::jsonb,
  numero_vagas integer not null default 0 check (numero_vagas >= 0),
  tipo_campeonato text,
  status text not null default 'pendente'
    check (status in ('pendente', 'pago', 'cortesia', 'isento', 'cancelado')),
  observacao text,
  pago_em timestamptz,
  atualizado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_campeonato_cobranca_status
  on public.campeonato_cobranca (status, updated_at desc);

-- campeonatos já existentes: isento (não cobra retroativo)
insert into public.campeonato_cobranca (
  campeonato_id, valor_total_centavos, status, observacao, numero_vagas, tipo_campeonato
)
select c.id, 0, 'isento', 'Legado — isento na migração de precificação', 0, c.tipo
from public.campeonatos c
where not exists (
  select 1 from public.campeonato_cobranca x where x.campeonato_id = c.id
);

alter table public.campeonato_cobranca enable row level security;
alter table public.campeonato_cobranca force row level security;

do $$
begin
  drop policy if exists campeonato_cobranca_service_all on public.campeonato_cobranca;
  create policy campeonato_cobranca_service_all on public.campeonato_cobranca
    for all using (
      coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
        in ('service_role', 'supabase_admin', 'postgres')
    ) with check (
      coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
        in ('service_role', 'supabase_admin', 'postgres')
    );
  revoke all on public.campeonato_cobranca from anon, authenticated;
end $$;

comment on column public.produtoras.aprovacao_status is
  'pendente|aprovado|rejeitado — só aprovado aparece publicamente e opera no ar';
comment on column public.campeonatos.aprovacao_status is
  'pendente|aprovado|rejeitado — só aprovado vai ao ar (diretório, stream, links públicos)';
