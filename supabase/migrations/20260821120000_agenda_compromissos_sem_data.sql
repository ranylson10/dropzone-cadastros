-- Jogos ainda sem data também são compromissos da produtora. Eles não entram
-- na grade mensal, mas ficam disponíveis na lista "Para agendar".
alter table public.agenda_compromissos alter column data_evento drop not null;

create or replace function public.sync_agenda_compromissos_jogo(p_jogo_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_jogo public.campeonato_jogos%rowtype;
  v_campeonato record;
  v_fim time;
begin
  select * into v_jogo from public.campeonato_jogos where id = p_jogo_id;
  delete from public.agenda_compromissos where jogo_id = p_jogo_id;
  if not found then return; end if;
  select id, nome, criado_por into v_campeonato from public.campeonatos where id = v_jogo.campeonato_id;
  if not found then return; end if;
  v_fim := case when v_jogo.horario is null then null else v_jogo.horario + make_interval(mins => greatest(25, coalesce(v_jogo.numero_partidas, 1) * 25)) end;

  insert into public.agenda_compromissos (jogo_id, campeonato_id, destino_tipo, destino_id, titulo, campeonato_nome, data_evento, horario_inicio, horario_fim, status, owner_auth_user_id)
  values (v_jogo.id, v_jogo.campeonato_id, 'usuario', v_campeonato.criado_por, coalesce(nullif(v_jogo.nome, ''), 'Jogo'), v_campeonato.nome, v_jogo.data_jogo, v_jogo.horario, v_fim, coalesce(v_jogo.status, 'agendado'), v_campeonato.criado_por)
  on conflict (jogo_id, destino_tipo, destino_id) do update set titulo=excluded.titulo, campeonato_nome=excluded.campeonato_nome, data_evento=excluded.data_evento, horario_inicio=excluded.horario_inicio, horario_fim=excluded.horario_fim, status=excluded.status, owner_auth_user_id=excluded.owner_auth_user_id, updated_at=now();

  insert into public.agenda_compromissos (jogo_id, campeonato_id, destino_tipo, destino_id, titulo, campeonato_nome, data_evento, horario_inicio, horario_fim, status, owner_auth_user_id)
  select v_jogo.id, v_jogo.campeonato_id, 'equipe', ce.equipe_id, coalesce(nullif(v_jogo.nome, ''), 'Jogo'), v_campeonato.nome, v_jogo.data_jogo, v_jogo.horario, v_fim, coalesce(v_jogo.status, 'agendado'), v_campeonato.criado_por
  from public.campeonato_equipes ce where ce.campeonato_id=v_jogo.campeonato_id and coalesce(ce.status,'ativo')='ativo' and (coalesce(array_length(v_jogo.grupos_ids,1),0)=0 or ce.grupo_id=any(v_jogo.grupos_ids))
  on conflict (jogo_id, destino_tipo, destino_id) do update set titulo=excluded.titulo, campeonato_nome=excluded.campeonato_nome, data_evento=excluded.data_evento, horario_inicio=excluded.horario_inicio, horario_fim=excluded.horario_fim, status=excluded.status, owner_auth_user_id=excluded.owner_auth_user_id, updated_at=now();

  insert into public.agenda_compromissos (jogo_id, campeonato_id, destino_tipo, destino_id, titulo, campeonato_nome, data_evento, horario_inicio, horario_fim, status, owner_auth_user_id)
  select distinct v_jogo.id, v_jogo.campeonato_id, 'usuario', j.auth_user_id, coalesce(nullif(v_jogo.nome, ''), 'Jogo'), v_campeonato.nome, v_jogo.data_jogo, v_jogo.horario, v_fim, coalesce(v_jogo.status, 'agendado'), v_campeonato.criado_por
  from public.campeonato_jogadores cj join public.jogadores j on j.id=cj.jogador_id
  where cj.campeonato_id=v_jogo.campeonato_id and coalesce(cj.status,'ativo')<>'deletado'
  on conflict (jogo_id, destino_tipo, destino_id) do update set titulo=excluded.titulo, campeonato_nome=excluded.campeonato_nome, data_evento=excluded.data_evento, horario_inicio=excluded.horario_inicio, horario_fim=excluded.horario_fim, status=excluded.status, owner_auth_user_id=excluded.owner_auth_user_id, updated_at=now();
end;
$$;

select public.sync_agenda_compromissos_jogo(id) from public.campeonato_jogos;
