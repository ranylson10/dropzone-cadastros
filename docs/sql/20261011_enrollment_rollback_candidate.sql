-- REVIEWED ROLLBACK CANDIDATE. Not applied to production.
-- Disable/reroute the new RPC consumer first. This restores the previous mirror
-- behavior (including DBR01). Prefer fixing forward if rejoin history now exists.
-- Receipt rows/table are retained for reconciliation; no rows are deleted.
begin;
set local lock_timeout='5s';
lock table public.campeonato_equipes in share row exclusive mode;
do $guard$
begin
  if to_regprocedure('public.fn_sync_slot_mirror_from_participacao()') is null or md5(pg_get_functiondef(to_regprocedure('public.fn_sync_slot_mirror_from_participacao()'))) is distinct from 'ebe6dea89819bba11cb3b068dd81374f' then
    raise exception 'Definição diferente do candidato validado: fn_sync_slot_mirror_from_participacao()';
  end if;
  if to_regprocedure('public.fn_inscrever_por_convite_atomico(uuid,uuid,text,text,uuid,uuid,text,uuid,integer,text)') is null or md5(pg_get_functiondef(to_regprocedure('public.fn_inscrever_por_convite_atomico(uuid,uuid,text,text,uuid,uuid,text,uuid,integer,text)'))) is distinct from '069d8134966ad0b2b4f99f463fcf0e48' then
    raise exception 'Definição diferente do candidato validado: fn_inscrever_por_convite_atomico(uuid,uuid,text,text,uuid,uuid,text,uuid,integer,text)';
  end if;
  if to_regprocedure('public.dz_inscricao_link_meta(jsonb,text)') is null or md5(pg_get_functiondef(to_regprocedure('public.dz_inscricao_link_meta(jsonb,text)'))) is distinct from '721074e1faf8bf269329b3cd043ea15f' then
    raise exception 'Definição diferente do candidato validado: dz_inscricao_link_meta(jsonb,text)';
  end if;
  if to_regprocedure('public.dz_inscricao_nome_key(text)') is null or md5(pg_get_functiondef(to_regprocedure('public.dz_inscricao_nome_key(text)'))) is distinct from '0a8943e79e2bb9be32bce8c9c2159690' then
    raise exception 'Definição diferente do candidato validado: dz_inscricao_nome_key(text)';
  end if;
  if exists(select 1 from public.campeonato_equipes where line_id is not null group by campeonato_id,line_id having count(*)>1) then
    raise exception 'Histórico de reinscrição já existe: restaurar índice global exige conciliação, sem apagar registros.';
  end if;
  if to_regclass('public.campeonato_equipes_campeonato_line_unique') is not null then
    raise exception 'Índice global já existe: revisar estado antes do rollback.';
  end if;
end;
$guard$;
drop function public.fn_inscrever_por_convite_atomico(uuid,uuid,text,text,uuid,uuid,text,uuid,integer,text);
drop function public.dz_inscricao_link_meta(jsonb,text);
drop function public.dz_inscricao_nome_key(text);
create unique index campeonato_equipes_campeonato_line_unique on public.campeonato_equipes(campeonato_id,line_id) where line_id is not null;
CREATE OR REPLACE FUNCTION public.fn_sync_slot_mirror_from_participacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    if new.status = 'ativo' and new.slot_id is not null and new.line_id is not null then
      update public.campeonato_slots
         set equipe_id = new.equipe_id,
             line_id = new.line_id,
             status = 'ocupado',
             updated_at = now()
       where id = new.slot_id;
    end if;

    if tg_op = 'UPDATE'
       and old.status = 'ativo'
       and new.status is distinct from 'ativo' then
      update public.campeonato_slots
         set equipe_id = null,
             line_id = null,
             status = 'livre',
             updated_at = now()
       where id = coalesce(old.slot_id, new.slot_id)
         and (
           (old.line_id is not null and line_id is not distinct from old.line_id)
           or (old.line_id is null and equipe_id is not distinct from old.equipe_id)
           or status = 'ocupado'
         );
    end if;
  end if;

  return coalesce(new, old);
end;
$function$
;
revoke all on public.inscricao_recibos from public,anon,authenticated;
commit;
