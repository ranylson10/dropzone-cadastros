-- Candidate prepared from the deployed function read on 2026-10-11.
-- NOT APPLIED. Validate fresh schema, owner/ACL and dependencies in staging.
-- Keeps the existing INSERT/UPDATE trigger bindings; DELETE is outside this patch.
create or replace function public.fn_sync_slot_mirror_from_participacao()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_previous_line uuid;
  v_previous_team uuid;
  v_same_slot boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_previous_line := old.line_id;
    v_previous_team := old.equipe_id;
    v_same_slot := old.status = 'ativo'
      and old.slot_id is not distinct from new.slot_id
      and old.campeonato_id is not distinct from new.campeonato_id;
  end if;

  -- Release only the mirror owned by the previous participation, including moves.
  if tg_op = 'UPDATE'
     and old.status = 'ativo'
     and (new.status is distinct from 'ativo'
       or new.slot_id is distinct from old.slot_id
       or new.campeonato_id is distinct from old.campeonato_id) then
    update public.campeonato_slots
       set equipe_id = null, line_id = null, status = 'livre', updated_at = now()
     where id = old.slot_id
       and campeonato_id = old.campeonato_id
       and line_id is not distinct from old.line_id
       and equipe_id is not distinct from old.equipe_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE')
     and new.status = 'ativo' and new.slot_id is not null and new.line_id is not null then
    if not exists (select 1 from public.equipe_lines l
      where l.id = new.line_id and l.equipe_id = new.equipe_id) then
      raise exception using errcode = '23514', message = 'A line não pertence à equipe da participação.';
    end if;
    update public.campeonato_slots
       set equipe_id = new.equipe_id, line_id = new.line_id,
           status = 'ocupado', updated_at = now()
     where id = new.slot_id
       and campeonato_id = new.campeonato_id
       and ((line_id is null and equipe_id is null)
         or (line_id is not distinct from new.line_id and equipe_id is not distinct from new.equipe_id)
         -- A transfer changes the team in place. Only the previous owner may be replaced.
         or (v_same_slot and line_id is not distinct from v_previous_line
           and equipe_id is not distinct from v_previous_team));
    if not found then
      raise exception using errcode = '23505', message = 'Conflito no slot_id: slot ocupado ou de outro campeonato.';
    end if;
  end if;
  return coalesce(new, old);
end;
$function$;
