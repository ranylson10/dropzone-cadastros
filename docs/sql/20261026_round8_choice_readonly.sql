-- R08: diagnostic ONLY. Safe to run in Supabase SQL Editor; no DDL or DML.
-- Counts indicate candidates for investigation; do not auto-correct rows.
with problems as (
  select 'participacao_ativa_sem_slot' as issue, count(*)::bigint as total
  from public.campeonato_equipes ce
  where ce.status = 'ativo' and ce.grupo_id is not null and ce.slot_id is null
  union all
  select 'grupo_e_slot_fases_divergentes', count(*)
  from public.campeonato_slots s
  join public.campeonato_grupos g on g.id = s.grupo_id
  where s.campeonato_id is distinct from g.campeonato_id
    or s.fase_id is distinct from g.fase_id
  union all
  select 'participacao_ativa_espelho_invalido', count(*)
  from public.campeonato_equipes ce
  left join public.campeonato_slots s on s.id = ce.slot_id
  where ce.status = 'ativo' and ce.slot_id is not null
    and (s.id is null or s.campeonato_id is distinct from ce.campeonato_id
      or s.grupo_id is distinct from ce.grupo_id
      or s.slot_numero is distinct from ce.slot_numero
      or s.equipe_id is distinct from ce.equipe_id
      or s.line_id is distinct from ce.line_id
      or s.status is distinct from 'ocupado')
  union all
  select 'slot_ocupado_sem_participacao_ativa', count(*)
  from public.campeonato_slots s
  where s.status = 'ocupado' and not exists (
    select 1 from public.campeonato_equipes ce
    where ce.slot_id = s.id and ce.status = 'ativo')
  union all
  select 'slot_ocupado_e_bloqueado', count(*)
  from public.campeonato_slots s
  where s.status = 'ocupado' and exists (
    select 1 from public.campeonato_grupo_escolha_bloqueios b
    where b.ativo = true and b.campeonato_id = s.campeonato_id
      and b.fase_id = s.fase_id and (b.grupo_id = s.grupo_id or b.slot_id = s.id))
  union all
  select 'slot_ocupado_com_reserva_lili_ativa', count(*)
  from public.campeonato_slots s
  where s.status = 'ocupado' and exists (
    select 1 from public.lili_reservas_slot l
    where l.slot_id = s.id and l.campeonato_id = s.campeonato_id
      and l.status = 'ativa' and l.expira_em > now())
  union all
  select 'slot_ocupado_com_convite_ativo', count(*)
  from public.campeonato_slots s
  where s.status = 'ocupado' and exists (
    select 1 from public.tokens t
    where t.slot_id = s.id and t.campeonato_id = s.campeonato_id
      and t.status = 'ativo' and coalesce(t.usado, false) = false
      and t.tipo in ('convite_equipe_campeonato', 'team_invite')
      and (t.expira_em is null or t.expira_em > now()))
)
select issue, total from problems order by issue;
