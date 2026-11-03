-- DROPZONE R11 / CANDIDATA PARA STAGING (nao aplicada).
-- Limpeza limitada por lote; ordem de locks grupo -> slot -> reserva.
-- Evita a rotina global antiga, que atualizava reservas antes de obter os locks.
begin;
create function public.fn_lili_liberar_reservas_expiradas_r11(p_limit integer default 100)
returns integer language plpgsql security definer
set search_path=pg_catalog,public
as $r11$
declare
  v_target record;
  v_group_id uuid;
  v_changed integer:=0;
  v_total integer:=0;
  v_now timestamptz;
begin
  if not coalesce(public.fn_is_service_role(),false) then
    raise exception using errcode='42501',message='Operação exclusiva do backend.';
  end if;
  if p_limit is null or p_limit<1 or p_limit>200 then
    raise exception using errcode='22023',message='Limite de limpeza inválido.';
  end if;
  for v_target in
    select r.grupo_id,r.slot_id from public.lili_reservas_slot r
      where r.status='ativa' and r.expira_em<=clock_timestamp()
      group by r.grupo_id,r.slot_id order by r.grupo_id,r.slot_id limit p_limit
  loop
    -- Leitura preliminar apenas para obter a linha do grupo. Nenhum FOR UPDATE ainda.
    select s.grupo_id into v_group_id from public.campeonato_slots s
      where s.id=v_target.slot_id;
    if v_group_id is null or v_group_id is distinct from v_target.grupo_id then continue; end if;
    perform 1 from public.campeonato_grupos g where g.id=v_group_id for update;
    if not found then continue; end if;
    perform 1 from public.campeonato_slots s
      where s.id=v_target.slot_id and s.grupo_id=v_group_id for update;
    if not found then continue; end if;
    v_now:=clock_timestamp();
    update public.lili_reservas_slot r set status='expirada',updated_at=v_now
      where r.slot_id=v_target.slot_id and r.grupo_id=v_group_id
        and r.status='ativa' and r.expira_em<=v_now;
    get diagnostics v_changed=row_count;
    v_total:=v_total+v_changed;
    -- Nao liberar enquanto houver convite OU outra reserva de Lili ativa.
    update public.campeonato_slots s set status='livre',updated_at=v_now
      where s.id=v_target.slot_id and s.status='reservado'
      and s.equipe_id is null and s.line_id is null
      and not exists(select 1 from public.lili_reservas_slot r where r.slot_id=s.id
          and r.status='ativa' and r.expira_em>v_now)
      and not exists(select 1 from public.tokens t where t.slot_id=s.id
          and t.tipo in ('convite_equipe_campeonato','team_invite')
          and t.status='ativo' and coalesce(t.usado,false)=false
          and (t.expira_em is null or t.expira_em>v_now));
  end loop;
  return v_total;
end;
$r11$;
revoke all on function public.fn_lili_liberar_reservas_expiradas_r11(integer)
  from public,anon,authenticated;
grant execute on function public.fn_lili_liberar_reservas_expiradas_r11(integer)
  to service_role;
commit;
