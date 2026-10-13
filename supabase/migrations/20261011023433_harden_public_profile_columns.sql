-- RLS protects rows. Limit columns as well: contacts, Auth UUIDs and internal
-- approval fields are available only to the authenticated backend service.
-- Keep safe public profile fields for existing security-invoker views.
revoke select on public.equipes, public.jogadores, public.managers,
  public.produtoras, public.campeonato_links from public, anon, authenticated;

-- Remove any earlier column grants too, so the result is independent of history.
do $$
declare entry record;
begin
  for entry in
    select table_name, string_agg(quote_ident(column_name), ', ' order by ordinal_position) as columns
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('equipes', 'jogadores', 'managers', 'produtoras', 'campeonato_links')
    group by table_name
  loop
    execute format('revoke select (%s) on public.%I from public, anon, authenticated', entry.columns, entry.table_name);
  end loop;
end $$;

grant select (id, nome, tag, logo_url, status, created_at, updated_at,
  public_id, public_id_prefix, username, pais, estado, cidade, localidade, bio)
  on public.equipes to anon, authenticated;
grant select (id, username, nome, avatar_url, id_jogo, funcao, pais, estado,
  cidade, localidade, status, created_at, updated_at, bio, disponivel_recrutamento)
  on public.jogadores to anon, authenticated;
grant select (id, public_id, public_id_prefix, username, nome, avatar_url, pais,
  estado, cidade, localidade, status, created_at, updated_at, whatsapp_url,
  nome_publico_vendas, portfolio_anuncios, bio)
  on public.managers to anon, authenticated;
grant select (id, public_id, public_id_prefix, username, nome, logo_url, pais,
  estado, cidade, localidade, status, created_at, updated_at, bio)
  on public.produtoras to anon, authenticated;

-- Championship access tokens are resolved by server routes with authorization.
-- No client needs to enumerate them directly through the Data API.
notify pgrst, 'reload schema';
