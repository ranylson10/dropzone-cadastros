-- Agenda oficial: projeção de leitura dos jogos para cada destinatário.
-- A agenda nunca calcula inscrições na abertura da tela; os gatilhos abaixo a
-- mantêm sincronizada a cada alteração de jogo, equipe ou escalação.

create table if not exists public.agenda_compromissos (
  id uuid primary key default gen_random_uuid(),
  jogo_id uuid not null references public.campeonato_jogos(id) on delete cascade,
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  destino_tipo text not null check (destino_tipo in ('usuario', 'equipe')),
  destino_id uuid not null,
  titulo text not null,
  campeonato_nome text,
  data_evento date not null,
  horario_inicio time,
  horario_fim time,
  status text not null default 'agendado',
  owner_auth_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (jogo_id, destino_tipo, destino_id)
);

create index if not exists agenda_compromissos_destino_data_idx
  on public.agenda_compromissos (destino_tipo, destino_id, data_evento, horario_inicio);
create index if not exists agenda_compromissos_campeonato_data_idx
  on public.agenda_compromissos (campeonato_id, data_evento, horario_inicio);

create or replace function public.sync_agenda_compromissos_jogo(p_jogo_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_jogo public.campeonato_jogos%rowtype;
  v_campeonato record;
  v_fim time;
begin
  select * into v_jogo from public.campeonato_jogos where id = p_jogo_id;
  delete from public.agenda_compromissos where jogo_id = p_jogo_id;
  if not found or v_jogo.data_jogo is null then return; end if;

  select id, nome, criado_por into v_campeonato from public.campeonatos where id = v_jogo.campeonato_id;
  if not found then return; end if;
  v_fim := case when v_jogo.horario is null then null
    else v_jogo.horario + make_interval(mins => greatest(25, coalesce(v_jogo.numero_partidas, 1) * 25)) end;

  -- Criador/produtora sempre enxerga e pode organizar seus jogos.
  insert into public.agenda_compromissos (
    jogo_id, campeonato_id, destino_tipo, destino_id, titulo, campeonato_nome,
    data_evento, horario_inicio, horario_fim, status, owner_auth_user_id
  ) values (
    v_jogo.id, v_jogo.campeonato_id, 'usuario', v_campeonato.criado_por,
    coalesce(nullif(v_jogo.nome, ''), 'Jogo'), v_campeonato.nome,
    v_jogo.data_jogo, v_jogo.horario, v_fim, coalesce(v_jogo.status, 'agendado'), v_campeonato.criado_por
  ) on conflict (jogo_id, destino_tipo, destino_id) do update set
    titulo = excluded.titulo, campeonato_nome = excluded.campeonato_nome,
    data_evento = excluded.data_evento, horario_inicio = excluded.horario_inicio,
    horario_fim = excluded.horario_fim, status = excluded.status,
    owner_auth_user_id = excluded.owner_auth_user_id, updated_at = now();

  -- Equipes inscritas recebem apenas os jogos do próprio grupo; jogos sem
  -- grupo atendem todas as equipes do campeonato.
  insert into public.agenda_compromissos (
    jogo_id, campeonato_id, destino_tipo, destino_id, titulo, campeonato_nome,
    data_evento, horario_inicio, horario_fim, status, owner_auth_user_id
  )
  select v_jogo.id, v_jogo.campeonato_id, 'equipe', ce.equipe_id,
    coalesce(nullif(v_jogo.nome, ''), 'Jogo'), v_campeonato.nome,
    v_jogo.data_jogo, v_jogo.horario, v_fim, coalesce(v_jogo.status, 'agendado'), v_campeonato.criado_por
  from public.campeonato_equipes ce
  where ce.campeonato_id = v_jogo.campeonato_id
    and coalesce(ce.status, 'ativo') = 'ativo'
    and (coalesce(array_length(v_jogo.grupos_ids, 1), 0) = 0 or ce.grupo_id = any(v_jogo.grupos_ids))
  on conflict (jogo_id, destino_tipo, destino_id) do update set
    titulo = excluded.titulo, campeonato_nome = excluded.campeonato_nome,
    data_evento = excluded.data_evento, horario_inicio = excluded.horario_inicio,
    horario_fim = excluded.horario_fim, status = excluded.status,
    owner_auth_user_id = excluded.owner_auth_user_id, updated_at = now();

  -- Jogadores escalados/inscritos também recebem um item pessoal.
  insert into public.agenda_compromissos (
    jogo_id, campeonato_id, destino_tipo, destino_id, titulo, campeonato_nome,
    data_evento, horario_inicio, horario_fim, status, owner_auth_user_id
  )
  select distinct v_jogo.id, v_jogo.campeonato_id, 'usuario', j.auth_user_id,
    coalesce(nullif(v_jogo.nome, ''), 'Jogo'), v_campeonato.nome,
    v_jogo.data_jogo, v_jogo.horario, v_fim, coalesce(v_jogo.status, 'agendado'), v_campeonato.criado_por
  from public.campeonato_jogadores cj
  join public.jogadores j on j.id = cj.jogador_id
  where cj.campeonato_id = v_jogo.campeonato_id
    and coalesce(cj.status, 'ativo') <> 'deletado'
    and (coalesce(array_length(v_jogo.grupos_ids, 1), 0) = 0 or exists (
      select 1 from public.campeonato_equipes ce
      where ce.campeonato_id = cj.campeonato_id and ce.equipe_id = cj.equipe_id
        and ce.grupo_id = any(v_jogo.grupos_ids) and coalesce(ce.status, 'ativo') = 'ativo'
    ))
  on conflict (jogo_id, destino_tipo, destino_id) do update set
    titulo = excluded.titulo, campeonato_nome = excluded.campeonato_nome,
    data_evento = excluded.data_evento, horario_inicio = excluded.horario_inicio,
    horario_fim = excluded.horario_fim, status = excluded.status,
    owner_auth_user_id = excluded.owner_auth_user_id, updated_at = now();
end;
$$;

create or replace function public.trg_sync_agenda_jogo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.agenda_compromissos where jogo_id = old.id;
    return old;
  end if;
  perform public.sync_agenda_compromissos_jogo(new.id);
  return new;
end;
$$;

create or replace function public.trg_rebuild_agenda_campeonato()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_campeonato_id uuid;
begin
  v_campeonato_id := coalesce(new.campeonato_id, old.campeonato_id);
  perform public.sync_agenda_compromissos_jogo(id)
  from public.campeonato_jogos where campeonato_id = v_campeonato_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_agenda_compromissos_jogo on public.campeonato_jogos;
create trigger trg_agenda_compromissos_jogo
after insert or update of nome, data_jogo, horario, numero_partidas, grupos_ids, status or delete
on public.campeonato_jogos for each row execute function public.trg_sync_agenda_jogo();

drop trigger if exists trg_agenda_compromissos_equipes on public.campeonato_equipes;
create trigger trg_agenda_compromissos_equipes
after insert or update of equipe_id, grupo_id, status or delete
on public.campeonato_equipes for each row execute function public.trg_rebuild_agenda_campeonato();

drop trigger if exists trg_agenda_compromissos_jogadores on public.campeonato_jogadores;
create trigger trg_agenda_compromissos_jogadores
after insert or update of jogador_id, equipe_id, status or delete
on public.campeonato_jogadores for each row execute function public.trg_rebuild_agenda_campeonato();

select public.sync_agenda_compromissos_jogo(id) from public.campeonato_jogos;
