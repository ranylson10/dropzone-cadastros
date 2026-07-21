-- Resgate atômico de código de overlay: contador, entitlement e cópia privada
-- acontecem na mesma transação. Em qualquer erro, tudo é revertido.

create or replace function public.fn_resgatar_stream_overlay_code(
  p_code text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code public.stream_overlay_purchase_codes%rowtype;
  v_model public.stream_overlay_catalog%rowtype;
  v_copy public.stream_overlay_catalog%rowtype;
begin
  if p_user_id is null then
    raise exception 'Usuário obrigatório.' using errcode = '22023';
  end if;

  select * into v_code
  from public.stream_overlay_purchase_codes
  where code = upper(trim(p_code))
    and ativo = true
  for update;

  if not found then
    raise exception 'Código inválido ou inativo.' using errcode = 'P0002';
  end if;

  if v_code.owner_user_id = p_user_id then
    raise exception 'Você já é o dono deste modelo.' using errcode = '22023';
  end if;

  if v_code.redemption_count >= v_code.max_redemptions then
    raise exception 'Este código já foi usado.' using errcode = '22023';
  end if;

  select * into v_model
  from public.stream_overlay_catalog
  where id = v_code.catalog_id
    and ativo = true
  for share;

  if not found then
    raise exception 'Modelo não encontrado.' using errcode = 'P0002';
  end if;

  if v_model.is_purchased_copy then
    raise exception 'Este modelo não pode ser revendido.' using errcode = '42501';
  end if;

  update public.stream_overlay_purchase_codes
  set redemption_count = redemption_count + 1,
      ativo = case when redemption_count + 1 >= max_redemptions then false else ativo end
  where id = v_code.id;

  insert into public.stream_overlay_entitlements (catalog_id, user_id, source, purchase_code_id)
  values (v_model.id, p_user_id, 'purchase', v_code.id)
  on conflict (catalog_id, user_id) do update
    set source = excluded.source,
        purchase_code_id = excluded.purchase_code_id;

  insert into public.stream_overlay_catalog (
    owner_user_id, nome, descricao, blocks, visibility,
    is_purchased_copy, source_catalog_id, price_label, updated_at
  ) values (
    p_user_id, v_model.nome || ' (comprado)', coalesce(v_model.descricao, ''),
    v_model.blocks, 'private', true, v_model.id, null, now()
  ) returning * into v_copy;

  insert into public.stream_overlay_entitlements (catalog_id, user_id, source, purchase_code_id)
  values (v_copy.id, p_user_id, 'purchase', v_code.id)
  on conflict (catalog_id, user_id) do update
    set source = excluded.source,
        purchase_code_id = excluded.purchase_code_id;

  return to_jsonb(v_copy);
end;
$$;

revoke all on function public.fn_resgatar_stream_overlay_code(text, uuid) from public, anon, authenticated;
grant execute on function public.fn_resgatar_stream_overlay_code(text, uuid) to service_role;
