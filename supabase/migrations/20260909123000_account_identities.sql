begin;

create table if not exists public.account_identities (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_identities_username_format check (username ~ '^[a-z0-9._]{3,24}$'),
  constraint account_identities_display_name_length check (char_length(display_name) between 2 and 60)
);

create unique index if not exists account_identities_username_unique
  on public.account_identities (lower(username));

alter table public.account_identities enable row level security;
revoke all on table public.account_identities from anon, authenticated;

create or replace function public.sync_account_identity_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account_username text;
  account_display_name text;
  account_avatar_url text;
begin
  account_username := lower(trim(leading '@' from coalesce(new.raw_user_meta_data ->> 'account_username', '')));
  account_display_name := trim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  ));
  account_avatar_url := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture',
    ''
  )), '');

  if account_username ~ '^[a-z0-9._]{3,24}$'
     and char_length(account_display_name) between 2 and 60 then
    insert into public.account_identities (
      auth_user_id,
      username,
      display_name,
      avatar_url,
      updated_at
    ) values (
      new.id,
      account_username,
      account_display_name,
      account_avatar_url,
      now()
    )
    on conflict (auth_user_id) do update set
      username = excluded.username,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists sync_account_identity_from_auth on auth.users;
create trigger sync_account_identity_from_auth
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.sync_account_identity_from_auth();

revoke execute on function public.sync_account_identity_from_auth() from public, anon, authenticated;

commit;
