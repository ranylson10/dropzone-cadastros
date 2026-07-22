-- Um mesmo usuário pode ter tipos diferentes de perfil, mas nunca duas
-- linhas do mesmo tipo. Os índices também fecham a corrida entre dois POSTs.

create unique index if not exists produtoras_auth_user_unique
  on public.produtoras (auth_user_id);

create unique index if not exists equipes_auth_user_unique
  on public.equipes (auth_user_id)
  where auth_user_id is not null;

create unique index if not exists jogadores_auth_user_unique
  on public.jogadores (auth_user_id);

create unique index if not exists managers_auth_user_unique
  on public.managers (auth_user_id);

create unique index if not exists broadcasts_auth_user_unique
  on public.broadcasts (auth_user_id);

-- Broadcast foi adicionado depois da tabela de códigos; atualiza o check antigo.
alter table public.auth_verification_codes
  drop constraint if exists auth_verification_codes_profile_type_check;

alter table public.auth_verification_codes
  add constraint auth_verification_codes_profile_type_check
  check (profile_type in ('produtora', 'equipe', 'jogador', 'manager', 'broadcast'));

-- Verifica e consome o código sob lock, impedindo dois usos simultâneos.
create or replace function public.fn_verify_and_consume_auth_code(
  p_email text,
  p_purpose text,
  p_code_hash text,
  p_profile_type text default null,
  p_username text default null
)
returns table (status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.auth_verification_codes%rowtype;
begin
  select * into v_code
  from public.auth_verification_codes
  where email = lower(trim(p_email))
    and purpose = p_purpose
    and consumed_at is null
  order by created_at desc
  limit 1
  for update;

  if v_code.id is null or v_code.expires_at < now() then
    return query select 'expired'::text;
    return;
  end if;
  if v_code.attempts >= 5 then
    return query select 'too_many_attempts'::text;
    return;
  end if;
  if p_profile_type is not null and v_code.profile_type <> p_profile_type then
    return query select 'context_mismatch'::text;
    return;
  end if;
  if p_username is not null and coalesce(v_code.username, '') <> p_username then
    return query select 'context_mismatch'::text;
    return;
  end if;
  if v_code.code_hash <> p_code_hash then
    update public.auth_verification_codes
      set attempts = attempts + 1
      where id = v_code.id;
    return query select 'incorrect'::text;
    return;
  end if;

  update public.auth_verification_codes
    set consumed_at = now()
    where id = v_code.id and consumed_at is null;
  return query select 'ok'::text;
end;
$$;

revoke all on function public.fn_verify_and_consume_auth_code(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.fn_verify_and_consume_auth_code(text, text, text, text, text) to service_role;
