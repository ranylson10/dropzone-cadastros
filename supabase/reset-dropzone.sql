drop table if exists public."DropZone" cascade;

create table public."DropZone" (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  auth_user_id uuid references auth.users(id) on delete cascade,
  profile_type text,
  username text,
  name text,
  token text,
  parent_id uuid,
  ref_id uuid,
  status text not null default 'ativo',
  data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dropzone_entity_type_check check (
    entity_type in (
      'account',
      'championship',
      'team',
      'championship_team',
      'group',
      'group_team',
      'game',
      'invite_token',
      'player_registration'
    )
  ),
  constraint dropzone_profile_type_check check (
    profile_type is null or profile_type in ('produtora', 'equipe', 'jogador', 'manager')
  )
);

create unique index dropzone_account_username_type_idx
on public."DropZone" (profile_type, lower(username))
where entity_type = 'account' and username is not null;

create unique index dropzone_token_idx
on public."DropZone" (token)
where token is not null;

create index dropzone_entity_type_idx on public."DropZone" (entity_type);
create index dropzone_parent_id_idx on public."DropZone" (parent_id);
create index dropzone_ref_id_idx on public."DropZone" (ref_id);
create index dropzone_auth_user_id_idx on public."DropZone" (auth_user_id);
create index dropzone_data_gin_idx on public."DropZone" using gin (data);

create or replace function public.dropzone_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_dropzone_updated_at
before update on public."DropZone"
for each row
execute function public.dropzone_set_updated_at();

alter table public."DropZone" enable row level security;

create policy "accounts can read themselves"
on public."DropZone"
for select
to authenticated
using (
  entity_type = 'account'
  and auth_user_id = (select auth.uid())
);

create policy "users can read public active rows"
on public."DropZone"
for select
to authenticated
using (
  entity_type <> 'account'
  and status = 'ativo'
);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public."DropZone" to authenticated;
grant select on public."DropZone" to anon;
