-- DropZone R146 — workspaces privados de produtora, convites e membros.
-- Produtora só nasce por convite do admin; equipe interna é vinculada por auth_user_id.

create table if not exists public.produtora_membros (
  id uuid primary key default gen_random_uuid(),
  produtora_id uuid not null references public.produtoras(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  cargo text not null default 'visualizacao'
    check (cargo in ('proprietario','administrador','operacao','pontuador','financeiro','comercial','visualizacao')),
  pode_ver boolean not null default true,
  pode_administrar boolean not null default false,
  pode_operar boolean not null default false,
  pode_pontuar boolean not null default false,
  pode_financeiro boolean not null default false,
  pode_comercial boolean not null default false,
  pode_gerenciar_membros boolean not null default false,
  pode_criar_campeonato boolean not null default false,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  convidado_por_auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (produtora_id, auth_user_id)
);

create index if not exists produtora_membros_auth_idx
  on public.produtora_membros (auth_user_id, status, produtora_id);
create index if not exists produtora_membros_produtora_idx
  on public.produtora_membros (produtora_id, status, created_at);

alter table public.produtora_membros enable row level security;
revoke all on table public.produtora_membros from anon, authenticated;

create table if not exists public.produtora_convites (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('criacao','membro')),
  email text not null,
  destinatario_auth_user_id uuid not null references auth.users(id) on delete cascade,
  produtora_id uuid references public.produtoras(id) on delete cascade,
  nome_produtora text,
  cargo text check (cargo is null or cargo in ('administrador','operacao','pontuador','financeiro','comercial','visualizacao')),
  token_hash text not null unique,
  convidado_por_auth_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pendente'
    check (status in ('pendente','aceito','recusado','cancelado','expirado')),
  expira_em timestamptz not null,
  respondido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint produtora_convites_contexto_check check (
    (tipo = 'criacao' and produtora_id is null and nome_produtora is not null and cargo is null)
    or
    (tipo = 'membro' and produtora_id is not null and nome_produtora is null and cargo is not null)
  )
);

create index if not exists produtora_convites_destinatario_idx
  on public.produtora_convites (destinatario_auth_user_id, status, created_at desc);
create index if not exists produtora_convites_produtora_idx
  on public.produtora_convites (produtora_id, status, created_at desc);
create unique index if not exists produtora_convites_criacao_pendente_unique
  on public.produtora_convites (destinatario_auth_user_id)
  where tipo = 'criacao' and status = 'pendente';
create unique index if not exists produtora_convites_membro_pendente_unique
  on public.produtora_convites (produtora_id, destinatario_auth_user_id)
  where tipo = 'membro' and status = 'pendente';

alter table public.produtora_convites enable row level security;
revoke all on table public.produtora_convites from anon, authenticated;

-- Garante que toda produtora tenha seu proprietário representado na tabela de membros.
create or replace function public.dropzone_sync_produtora_owner_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.produtora_membros (
    produtora_id,
    auth_user_id,
    cargo,
    pode_ver,
    pode_administrar,
    pode_operar,
    pode_pontuar,
    pode_financeiro,
    pode_comercial,
    pode_gerenciar_membros,
    pode_criar_campeonato,
    status,
    convidado_por_auth_user_id,
    updated_at
  ) values (
    new.id,
    new.auth_user_id,
    'proprietario',
    true,true,true,true,true,true,true,true,
    'ativo',
    new.auth_user_id,
    now()
  )
  on conflict (produtora_id, auth_user_id) do update set
    cargo = 'proprietario',
    pode_ver = true,
    pode_administrar = true,
    pode_operar = true,
    pode_pontuar = true,
    pode_financeiro = true,
    pode_comercial = true,
    pode_gerenciar_membros = true,
    pode_criar_campeonato = true,
    status = 'ativo',
    updated_at = now();
  return new;
end;
$$;

revoke all on function public.dropzone_sync_produtora_owner_member() from public;

drop trigger if exists dropzone_produtora_owner_member_trigger on public.produtoras;
create trigger dropzone_produtora_owner_member_trigger
after insert or update of auth_user_id on public.produtoras
for each row execute function public.dropzone_sync_produtora_owner_member();

insert into public.produtora_membros (
  produtora_id, auth_user_id, cargo,
  pode_ver, pode_administrar, pode_operar, pode_pontuar,
  pode_financeiro, pode_comercial, pode_gerenciar_membros, pode_criar_campeonato,
  status, convidado_por_auth_user_id
)
select
  p.id, p.auth_user_id, 'proprietario',
  true,true,true,true,true,true,true,true,
  'ativo', p.auth_user_id
from public.produtoras p
on conflict (produtora_id, auth_user_id) do update set
  cargo = 'proprietario',
  pode_ver = true,
  pode_administrar = true,
  pode_operar = true,
  pode_pontuar = true,
  pode_financeiro = true,
  pode_comercial = true,
  pode_gerenciar_membros = true,
  pode_criar_campeonato = true,
  status = 'ativo',
  updated_at = now();

-- /api/me passa a devolver workspaces de produtora também para membros autorizados.
create or replace function public.dropzone_perfis_por_auth(p_auth_user_id uuid)
returns table(id uuid, profile_type text, auth_user_id uuid, username text, nome text, status text, data jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    'produtora'::text,
    p_auth_user_id,
    p.username,
    p.nome,
    p.status,
    to_jsonb(p)
      || jsonb_build_object(
        'auth_user_id', p_auth_user_id,
        'workspace_owner_auth_user_id', p.auth_user_id,
        'workspace_role', 'proprietario',
        'workspace_permissions', jsonb_build_object(
          'pode_ver', true,
          'pode_administrar', true,
          'pode_operar', true,
          'pode_pontuar', true,
          'pode_financeiro', true,
          'pode_comercial', true,
          'pode_gerenciar_membros', true,
          'pode_criar_campeonato', true
        )
      )
  from public.produtoras p
  where p.auth_user_id = p_auth_user_id
    and coalesce(p.status, 'ativo') <> 'deletado'

  union all

  select
    p.id,
    'produtora'::text,
    p_auth_user_id,
    p.username,
    p.nome,
    p.status,
    to_jsonb(p)
      || jsonb_build_object(
        'auth_user_id', p_auth_user_id,
        'workspace_owner_auth_user_id', p.auth_user_id,
        'workspace_member_id', pm.id,
        'workspace_role', pm.cargo,
        'workspace_permissions', jsonb_build_object(
          'pode_ver', pm.pode_ver,
          'pode_administrar', pm.pode_administrar,
          'pode_operar', pm.pode_operar,
          'pode_pontuar', pm.pode_pontuar,
          'pode_financeiro', pm.pode_financeiro,
          'pode_comercial', pm.pode_comercial,
          'pode_gerenciar_membros', pm.pode_gerenciar_membros,
          'pode_criar_campeonato', pm.pode_criar_campeonato
        )
      )
  from public.produtora_membros pm
  join public.produtoras p on p.id = pm.produtora_id
  where pm.auth_user_id = p_auth_user_id
    and pm.status = 'ativo'
    and p.auth_user_id <> p_auth_user_id
    and coalesce(p.status, 'ativo') <> 'deletado'

  union all

  select e.id, 'equipe'::text, e.auth_user_id, e.username, e.nome, e.status, to_jsonb(e)
  from public.equipes e
  where e.auth_user_id = p_auth_user_id

  union all

  select j.id, 'jogador'::text, j.auth_user_id, j.username, j.nome, j.status, to_jsonb(j)
  from public.jogadores j
  where j.auth_user_id = p_auth_user_id

  union all

  select m.id, 'manager'::text, m.auth_user_id, m.username, m.nome, m.status, to_jsonb(m)
  from public.managers m
  where m.auth_user_id = p_auth_user_id

  union all

  select b.id, 'broadcast'::text, b.auth_user_id, b.username, b.nome, b.status, to_jsonb(b)
  from public.broadcasts b
  where b.auth_user_id = p_auth_user_id;
$$;

revoke all on function public.dropzone_perfis_por_auth(uuid) from public, anon, authenticated;
grant execute on function public.dropzone_perfis_por_auth(uuid) to service_role;
