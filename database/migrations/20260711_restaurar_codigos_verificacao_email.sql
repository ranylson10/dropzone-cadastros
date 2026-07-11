begin;

create table if not exists public.auth_verification_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null check (purpose in ('register', 'reset_password')),
  profile_type text not null check (profile_type in ('produtora', 'equipe', 'jogador', 'manager')),
  username text,
  code_hash text not null,
  attempts integer not null default 0 check (attempts >= 0),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_verification_codes_lookup_idx
  on public.auth_verification_codes (email, purpose, created_at desc);

create index if not exists auth_verification_codes_expiration_idx
  on public.auth_verification_codes (expires_at)
  where consumed_at is null;

alter table public.auth_verification_codes enable row level security;
revoke all on public.auth_verification_codes from anon, authenticated;

commit;
