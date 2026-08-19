drop function if exists public.dropzone_perfis_por_auth(uuid);

create or replace function public.dropzone_perfis_por_auth(
    p_auth_user_id uuid
)
returns table (
    id uuid,
    profile_type text,
    auth_user_id uuid,
    username text,
    nome text,
    status text,
    data jsonb
)
language sql
stable
security definer
set search_path = public
as $$
    select
        p.id,
        'produtora'::text,
        p.auth_user_id,
        p.username,
        p.nome,
        p.status,
        to_jsonb(p)
    from public.produtoras p
    where p.auth_user_id = p_auth_user_id

    union all

    select
        e.id,
        'equipe'::text,
        e.auth_user_id,
        e.username,
        e.nome,
        e.status,
        to_jsonb(e)
    from public.equipes e
    where e.auth_user_id = p_auth_user_id

    union all

    select
        j.id,
        'jogador'::text,
        j.auth_user_id,
        j.username,
        j.nome,
        j.status,
        to_jsonb(j)
    from public.jogadores j
    where j.auth_user_id = p_auth_user_id

    union all

    select
        m.id,
        'manager'::text,
        m.auth_user_id,
        m.username,
        m.nome,
        m.status,
        to_jsonb(m)
    from public.managers m
    where m.auth_user_id = p_auth_user_id

    union all

    select
        b.id,
        'broadcast'::text,
        b.auth_user_id,
        b.username,
        b.nome,
        b.status,
        to_jsonb(b)
    from public.broadcasts b
    where b.auth_user_id = p_auth_user_id;
$$;

revoke all on function public.dropzone_perfis_por_auth(uuid) from public;
grant execute on function public.dropzone_perfis_por_auth(uuid) to service_role;
