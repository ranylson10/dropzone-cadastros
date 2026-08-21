-- Espelho da migration Supabase.
begin;
create table if not exists public.sistema_vendas_assistidas (
  id uuid primary key default gen_random_uuid(), token text not null unique,
  vendedor_manager_id uuid not null references public.managers(id) on delete restrict,
  vendedor_auth_user_id uuid not null references auth.users(id) on delete restrict,
  campeonato_id uuid not null references public.campeonatos(id) on delete restrict,
  quantidade_vagas integer not null default 1 check (quantidade_vagas between 1 and 20),
  canal text not null default 'whatsapp' check (canal in ('whatsapp','instagram','tiktok','link','outro')),
  referencia text, status text not null default 'aberta' check (status in ('aberta','checkout_iniciado','paga','expirada','cancelada')),
  comprador_auth_user_id uuid null references auth.users(id) on delete set null,
  compra_vaga_id uuid null references public.sistema_compras_vaga(id) on delete set null,
  expira_em timestamptz not null default (now() + interval '7 days'), meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists sistema_vendas_assistidas_vendedor_idx on public.sistema_vendas_assistidas(vendedor_manager_id, created_at desc);
alter table public.sistema_vendas_assistidas enable row level security;
alter table public.sistema_vendas_assistidas force row level security;
drop policy if exists sistema_vendas_assistidas_service_all on public.sistema_vendas_assistidas;
create policy sistema_vendas_assistidas_service_all on public.sistema_vendas_assistidas for all using (coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true)) in ('service_role','supabase_admin','postgres')) with check (coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true)) in ('service_role','supabase_admin','postgres'));
revoke all on public.sistema_vendas_assistidas from anon, authenticated;
commit;
