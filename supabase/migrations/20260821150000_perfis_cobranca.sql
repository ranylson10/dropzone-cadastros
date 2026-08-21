-- Perfil de cobrança reutilizável. Não armazena cartão, CVV ou token de cartão.
begin;

create table if not exists public.sistema_perfis_cobranca (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  nome_titular text not null check (char_length(trim(nome_titular)) between 3 and 120),
  documento text not null check (documento ~ '^[0-9]{11}([0-9]{3})?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sistema_perfis_cobranca enable row level security;
alter table public.sistema_perfis_cobranca force row level security;

drop policy if exists sistema_perfis_cobranca_service_all on public.sistema_perfis_cobranca;
create policy sistema_perfis_cobranca_service_all on public.sistema_perfis_cobranca
  for all using (
    coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
      in ('service_role', 'supabase_admin', 'postgres')
  ) with check (
    coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
      in ('service_role', 'supabase_admin', 'postgres')
  );

revoke all on public.sistema_perfis_cobranca from anon, authenticated;
comment on table public.sistema_perfis_cobranca is 'Dados de cobrança de uso único por conta. Acesso somente via servidor; cartões e CVV não são armazenados.';
commit;
