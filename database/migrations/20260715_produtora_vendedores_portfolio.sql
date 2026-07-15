-- ============================================================================
-- Vendedores da produtora (roster reutilizável) + WhatsApp do manager
-- ============================================================================
-- Fluxo:
--  1) Produtora gera 1 convite (token manager_invite_produtora)
--  2) Manager aceita → entra em produtora_vendedores
--  3) Produtora adiciona o vendedor em campeonatos (campeonato_vendedores)
--  4) Manager escolhe quais anunciar no link /vendedores/{id}
-- ============================================================================

begin;

-- Contato e nome de vendas no perfil do manager
alter table public.managers
  add column if not exists whatsapp_url text,
  add column if not exists nome_publico_vendas text,
  add column if not exists portfolio_anuncios jsonb not null default '[]'::jsonb;

comment on column public.managers.portfolio_anuncios is
  'Lista de campeonato_id que o manager escolheu anunciar no link público. [] = todos os ativos.';

-- Roster da produtora (independente de campeonato)
create table if not exists public.produtora_vendedores (
  id uuid primary key default gen_random_uuid(),
  produtora_id uuid not null references public.produtoras(id) on delete cascade,
  manager_id uuid not null references public.managers(id) on delete cascade,
  manager_auth_user_id uuid,
  nome_publico text,
  whatsapp_url text,
  status text not null default 'ativo',
  token_aceite text,
  criado_por uuid,
  aceito_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint produtora_vendedores_status_check
    check (status = any (array['ativo', 'suspenso', 'cancelado']::text[]))
);

create unique index if not exists produtora_vendedores_produtora_manager_unique
  on public.produtora_vendedores (produtora_id, manager_id);

create index if not exists produtora_vendedores_produtora_status_idx
  on public.produtora_vendedores (produtora_id, status);

create index if not exists produtora_vendedores_manager_idx
  on public.produtora_vendedores (manager_id, status);

-- Backfill: quem já é vendedor ativo em algum campeonato da produtora
insert into public.produtora_vendedores (
  produtora_id, manager_id, manager_auth_user_id, nome_publico, whatsapp_url, status, aceito_em, criado_por
)
select distinct on (cv.produtora_id, cv.manager_id)
  cv.produtora_id,
  cv.manager_id,
  cv.manager_auth_user_id,
  cv.nome_publico,
  cv.whatsapp_url,
  'ativo',
  coalesce(cv.aceito_em, cv.created_at),
  cv.criado_por
from public.campeonato_vendedores cv
where cv.manager_id is not null
  and cv.produtora_id is not null
  and cv.status = 'ativo'
on conflict (produtora_id, manager_id) do nothing;

-- Espelha WhatsApp no perfil do manager quando vazio
update public.managers m
   set whatsapp_url = cv.whatsapp_url,
       nome_publico_vendas = coalesce(m.nome_publico_vendas, cv.nome_publico),
       updated_at = now()
  from (
    select distinct on (manager_id) manager_id, whatsapp_url, nome_publico
      from public.campeonato_vendedores
     where status = 'ativo'
       and manager_id is not null
       and whatsapp_url is not null
     order by manager_id, updated_at desc nulls last
  ) cv
 where m.id = cv.manager_id
   and (m.whatsapp_url is null or trim(m.whatsapp_url) = '');

commit;
