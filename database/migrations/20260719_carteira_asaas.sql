-- =============================================================================
-- DROPZONE · Carteira interna + pagamentos ASAAS + saques + comissão vendedor
-- Idempotente. Não altera fluxos existentes sem ASAAS_API_KEY.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Config de comissão (percentuais em basis points: 1000 = 10,00%)
-- ---------------------------------------------------------------------------
insert into public.sistema_precos (chave, rotulo, descricao, categoria, valor_centavos, meta) values
  (
    'comissao_vendedor_bps',
    'Comissão vendedor (bps)',
    'Parte da inscrição que vai para a carteira do vendedor. 1000 = 10%. valor_centavos guarda os bps.',
    'recurso',
    1000,
    '{"unit":"bps","default":true}'::jsonb
  ),
  (
    'comissao_plataforma_bps',
    'Taxa plataforma (bps)',
    'Parte da inscrição retida pela plataforma. 500 = 5%.',
    'recurso',
    500,
    '{"unit":"bps","default":true}'::jsonb
  )
on conflict (chave) do nothing;

-- ---------------------------------------------------------------------------
-- Carteiras
-- ---------------------------------------------------------------------------
create table if not exists public.sistema_carteiras (
  id uuid primary key default gen_random_uuid(),
  -- dono da carteira
  dono_tipo text not null
    check (dono_tipo in ('sistema', 'produtora', 'manager', 'vendedor', 'auth_user')),
  dono_id uuid null, -- null só para dono_tipo=sistema
  auth_user_id uuid null references auth.users(id) on delete set null,
  saldo_disponivel_centavos bigint not null default 0
    check (saldo_disponivel_centavos >= 0),
  saldo_bloqueado_centavos bigint not null default 0
    check (saldo_bloqueado_centavos >= 0),
  moeda text not null default 'BRL',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma carteira por dono (exceto sistema único)
create unique index if not exists idx_carteiras_dono
  on public.sistema_carteiras (dono_tipo, dono_id)
  where dono_id is not null;

create unique index if not exists idx_carteiras_sistema
  on public.sistema_carteiras (dono_tipo)
  where dono_tipo = 'sistema';

create index if not exists idx_carteiras_auth
  on public.sistema_carteiras (auth_user_id)
  where auth_user_id is not null;

-- ---------------------------------------------------------------------------
-- Ledger (imutável — só insert)
-- ---------------------------------------------------------------------------
create table if not exists public.sistema_carteira_lancamentos (
  id uuid primary key default gen_random_uuid(),
  carteira_id uuid not null references public.sistema_carteiras(id) on delete restrict,
  tipo text not null
    check (tipo in (
      'credito_pagamento',
      'credito_comissao',
      'debito_saque',
      'debito_taxa',
      'estorno',
      'ajuste_admin',
      'bloqueio',
      'desbloqueio'
    )),
  valor_centavos bigint not null check (valor_centavos > 0),
  -- +credito / -debito no saldo disponível (exceto bloqueio)
  direcao text not null check (direcao in ('credito', 'debito')),
  saldo_apos_centavos bigint not null,
  descricao text,
  referencia_tipo text, -- pagamento | cobranca | inscricao | saque | manual
  referencia_id text,
  meta jsonb not null default '{}'::jsonb,
  criado_por uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_carteira_lancamentos_carteira
  on public.sistema_carteira_lancamentos (carteira_id, created_at desc);

create index if not exists idx_carteira_lancamentos_ref
  on public.sistema_carteira_lancamentos (referencia_tipo, referencia_id);

-- ---------------------------------------------------------------------------
-- Pagamentos ASAAS
-- ---------------------------------------------------------------------------
create table if not exists public.sistema_pagamentos (
  id uuid primary key default gen_random_uuid(),
  -- origem de negócio
  finalidade text not null
    check (finalidade in (
      'cobranca_campeonato',  -- produtora paga o pacote DropZone
      'inscricao_equipe',     -- equipe paga inscrição (futuro)
      'recarga_carteira',     -- opcional
      'outro'
    )),
  referencia_tipo text not null, -- campeonato_cobranca | campeonato_equipes | ...
  referencia_id text not null,
  pagador_auth_user_id uuid null references auth.users(id) on delete set null,
  pagador_tipo text, -- produtora | equipe | manager
  pagador_id uuid,
  -- valores
  valor_centavos integer not null check (valor_centavos > 0),
  descricao text,
  status text not null default 'pendente'
    check (status in (
      'pendente', 'aguardando', 'pago', 'confirmado',
      'vencido', 'estornado', 'cancelado', 'falha'
    )),
  -- ASAAS
  asaas_customer_id text,
  asaas_payment_id text unique,
  asaas_invoice_url text,
  asaas_bank_slip_url text,
  asaas_pix_qrcode text,
  asaas_pix_payload text,
  asaas_status text,
  billing_type text default 'UNDEFINED',
  external_reference text unique,
  payload_criacao jsonb not null default '{}'::jsonb,
  payload_webhook jsonb not null default '{}'::jsonb,
  pago_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pagamentos_ref
  on public.sistema_pagamentos (referencia_tipo, referencia_id);

create index if not exists idx_pagamentos_status
  on public.sistema_pagamentos (status, created_at desc);

create index if not exists idx_pagamentos_pagador
  on public.sistema_pagamentos (pagador_auth_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Saques
-- ---------------------------------------------------------------------------
create table if not exists public.sistema_saques (
  id uuid primary key default gen_random_uuid(),
  carteira_id uuid not null references public.sistema_carteiras(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  valor_centavos integer not null check (valor_centavos > 0),
  status text not null default 'solicitado'
    check (status in (
      'solicitado', 'em_analise', 'aprovado', 'pago', 'rejeitado', 'cancelado'
    )),
  -- dados PIX do sacador
  pix_chave text not null,
  pix_tipo text not null default 'aleatoria'
    check (pix_tipo in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  titular_nome text,
  observacao text,
  rejeicao_motivo text,
  analisado_por uuid null references auth.users(id) on delete set null,
  analisado_em timestamptz,
  pago_em timestamptz,
  -- se pagar via ASAAS transfer (futuro)
  asaas_transfer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saques_carteira
  on public.sistema_saques (carteira_id, created_at desc);

create index if not exists idx_saques_status
  on public.sistema_saques (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Comissão gerada (auditoria de split)
-- ---------------------------------------------------------------------------
create table if not exists public.sistema_comissoes (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid null references public.sistema_pagamentos(id) on delete set null,
  campeonato_id uuid null references public.campeonatos(id) on delete set null,
  vendedor_manager_id uuid null references public.managers(id) on delete set null,
  vendedor_auth_user_id uuid null references auth.users(id) on delete set null,
  valor_bruto_centavos integer not null,
  comissao_vendedor_centavos integer not null default 0,
  comissao_plataforma_centavos integer not null default 0,
  valor_liquido_produtora_centavos integer not null default 0,
  bps_vendedor integer not null default 0,
  bps_plataforma integer not null default 0,
  status text not null default 'calculada'
    check (status in ('calculada', 'creditada', 'estornada')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_comissoes_vendedor
  on public.sistema_comissoes (vendedor_auth_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: só service_role (APIs Next usam supabaseAdmin)
-- ---------------------------------------------------------------------------
alter table public.sistema_carteiras enable row level security;
alter table public.sistema_carteiras force row level security;
alter table public.sistema_carteira_lancamentos enable row level security;
alter table public.sistema_carteira_lancamentos force row level security;
alter table public.sistema_pagamentos enable row level security;
alter table public.sistema_pagamentos force row level security;
alter table public.sistema_saques enable row level security;
alter table public.sistema_saques force row level security;
alter table public.sistema_comissoes enable row level security;
alter table public.sistema_comissoes force row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'sistema_carteiras',
    'sistema_carteira_lancamentos',
    'sistema_pagamentos',
    'sistema_saques',
    'sistema_comissoes'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_service_all', t);
    execute format(
      'create policy %I on public.%I for all using (
        coalesce(current_setting(''request.jwt.claim.role'', true), current_setting(''role'', true))
          in (''service_role'', ''supabase_admin'', ''postgres'')
      ) with check (
        coalesce(current_setting(''request.jwt.claim.role'', true), current_setting(''role'', true))
          in (''service_role'', ''supabase_admin'', ''postgres'')
      )',
      t || '_service_all', t
    );
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- carteira do sistema (única)
insert into public.sistema_carteiras (dono_tipo, dono_id, saldo_disponivel_centavos)
select 'sistema', null, 0
where not exists (
  select 1 from public.sistema_carteiras where dono_tipo = 'sistema'
);
