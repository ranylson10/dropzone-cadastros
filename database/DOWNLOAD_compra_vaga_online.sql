-- =============================================================================
-- DROPZONE · Compra de vaga online (ASAAS) → libera próximo grupo → escolha de slot
-- Idempotente. Não quebra inscrição por link nem WhatsApp.
-- Rode DEPOIS de 20260719_carteira_asaas.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Amplia finalidade de sistema_pagamentos (compra_vaga)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'sistema_pagamentos'
  ) then
    alter table public.sistema_pagamentos
      drop constraint if exists sistema_pagamentos_finalidade_check;

    alter table public.sistema_pagamentos
      add constraint sistema_pagamentos_finalidade_check
      check (finalidade in (
        'cobranca_campeonato',
        'inscricao_equipe',
        'compra_vaga',
        'recarga_carteira',
        'outro'
      ));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Compras de vaga (voucher pago → liberado → consumido no slot)
-- ---------------------------------------------------------------------------
create table if not exists public.sistema_compras_vaga (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  produtora_id uuid null references public.produtoras(id) on delete set null,
  -- grupo alvo (próximo com vaga); pode ser reatribuído no claim se encher
  grupo_id uuid null references public.campeonato_grupos(id) on delete set null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  -- atribuição de venda (opcional)
  vendedor_manager_id uuid null references public.managers(id) on delete set null,
  vendedor_auth_user_id uuid null references auth.users(id) on delete set null,
  valor_centavos integer not null check (valor_centavos > 0),
  status text not null default 'pendente'
    check (status in (
      'pendente',   -- aguardando ASAAS
      'pago',       -- webhook confirmou
      'liberado',   -- pronto para escolher slot
      'consumido',  -- entrou no campeonato
      'cancelado',
      'expirado',
      'estornado'
    )),
  pagamento_id uuid null references public.sistema_pagamentos(id) on delete set null,
  -- preenchidos no claim
  equipe_id uuid null references public.equipes(id) on delete set null,
  line_id uuid null,
  slot_id uuid null references public.campeonato_slots(id) on delete set null,
  campeonato_equipe_id uuid null references public.campeonato_equipes(id) on delete set null,
  pago_em timestamptz,
  liberado_em timestamptz,
  consumido_em timestamptz,
  expira_em timestamptz not null default (now() + interval '7 days'),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_compras_vaga_auth
  on public.sistema_compras_vaga (auth_user_id, created_at desc);

create index if not exists idx_compras_vaga_champ
  on public.sistema_compras_vaga (campeonato_id, status);

create index if not exists idx_compras_vaga_status
  on public.sistema_compras_vaga (status, created_at desc);

create index if not exists idx_compras_vaga_pagamento
  on public.sistema_compras_vaga (pagamento_id)
  where pagamento_id is not null;

-- RLS: só service_role (APIs Next usam supabaseAdmin)
alter table public.sistema_compras_vaga enable row level security;
alter table public.sistema_compras_vaga force row level security;

do $$
begin
  drop policy if exists sistema_compras_vaga_service_all on public.sistema_compras_vaga;
  create policy sistema_compras_vaga_service_all on public.sistema_compras_vaga
    for all using (
      coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
        in ('service_role', 'supabase_admin', 'postgres')
    ) with check (
      coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
        in ('service_role', 'supabase_admin', 'postgres')
    );
  revoke all on public.sistema_compras_vaga from anon, authenticated;
exception when others then
  raise notice 'RLS compras_vaga: %', sqlerrm;
end $$;

comment on table public.sistema_compras_vaga is
  'Compra online de vaga (ASAAS). Após pago, libera o próximo grupo com slots livres para o usuário escolher e entrar.';

-- ---------------------------------------------------------------------------
-- origem_entrada: permite marcar participação vinda da compra online
-- ---------------------------------------------------------------------------
alter table public.campeonato_equipes
  drop constraint if exists campeonato_equipes_origem_entrada_check;

alter table public.campeonato_equipes
  add constraint campeonato_equipes_origem_entrada_check
  check (
    origem_entrada = any (
      array[
        'organizador',
        'convite',
        'inscricao',
        'link',
        'vendedor',
        'manual',
        'token',
        'compra_online'
      ]::text[]
    )
  );
