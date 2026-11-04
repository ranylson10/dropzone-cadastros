-- One calculation owns placement, kills, drop overrides and penalties.
-- Installing this migration does not rewrite historical results.
create or replace function public.fn_calcular_resultado_equipe()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_partida record;
  v_config record;
begin
  select campeonato_id, fase_id, jogo_id, multiplicador_abates, pontos_abate_unitario
    into v_partida from public.campeonato_partidas where id = new.partida_id;
  if not found then raise exception 'Queda do resultado não encontrada.'; end if;
  if new.campeonato_id is distinct from v_partida.campeonato_id
    or new.fase_id is distinct from v_partida.fase_id
    or new.jogo_id is distinct from v_partida.jogo_id then
    raise exception 'O resultado precisa usar o mesmo campeonato, fase e jogo da queda.';
  end if;
  select pontos_colocacao, pontos_por_abate into v_config
    from public.campeonato_configuracoes where campeonato_id = new.campeonato_id;
  new.pontos_posicao := coalesce(v_config.pontos_colocacao[new.posicao], 0);
  new.multiplicador_abates_aplicado := coalesce(v_partida.multiplicador_abates, 1);
  new.pontos_abate_unitario_aplicado := coalesce(v_partida.pontos_abate_unitario, v_config.pontos_por_abate, 1);
  new.pontos_abates := coalesce(new.abates, 0) * new.multiplicador_abates_aplicado * new.pontos_abate_unitario_aplicado;
  new.punicao_pontos := least(coalesce(new.punicao_pontos, 0), 0);
  new.pontos_total := new.pontos_posicao + new.pontos_abates + new.punicao_pontos;
  new.booyah := new.posicao = 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_calcular_pontuacao_resultado_equipe on public.campeonato_resultados_equipes;
drop trigger if exists trg_calcular_resultado_equipe on public.campeonato_resultados_equipes;
create trigger trg_calcular_resultado_equipe
before insert or update of partida_id, campeonato_id, fase_id, jogo_id, posicao, abates, punicao_pontos
on public.campeonato_resultados_equipes
for each row execute function public.fn_calcular_resultado_equipe();

-- An explicit change to scoring rules recalculates the affected championship.
-- Recorded absences remain untouched.
create or replace function public.fn_recalcular_resultados_configuracao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.campeonato_resultados_equipes r set posicao = r.posicao
  where r.campeonato_id = new.campeonato_id
    and not exists (select 1 from public.campeonato_partidas_equipes_presenca p
      where p.partida_id = r.partida_id and p.campeonato_equipe_id = r.campeonato_equipe_id and p.status = 'falta');
  return new;
end;
$$;
revoke all on function public.fn_recalcular_resultados_configuracao() from public, anon, authenticated;
grant execute on function public.fn_recalcular_resultados_configuracao() to service_role;
drop trigger if exists trg_recalcular_resultados_configuracao on public.campeonato_configuracoes;
create trigger trg_recalcular_resultados_configuracao
after update of pontos_colocacao, pontos_por_abate on public.campeonato_configuracoes
for each row when (old.pontos_colocacao is distinct from new.pontos_colocacao or old.pontos_por_abate is distinct from new.pontos_por_abate)
execute function public.fn_recalcular_resultados_configuracao();
