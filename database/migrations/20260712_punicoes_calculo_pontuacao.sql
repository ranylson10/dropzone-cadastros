alter table public.campeonato_resultados_equipes
  add column if not exists punicao_pontos numeric(10,2) not null default 0,
  add column if not exists punicao_motivo text;

alter table public.campeonato_resultados_equipes
  drop constraint if exists campeonato_resultados_equipes_punicao_check;

alter table public.campeonato_resultados_equipes
  add constraint campeonato_resultados_equipes_punicao_check
  check (punicao_pontos <= 0);

create or replace function public.fn_calcular_pontuacao_resultado_equipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colocacoes integer[];
  v_por_abate numeric(10,2);
begin
  select configuracao.pontos_colocacao, configuracao.pontos_por_abate
    into v_colocacoes, v_por_abate
  from public.campeonato_configuracoes configuracao
  where configuracao.campeonato_id = new.campeonato_id
  limit 1;

  v_colocacoes := coalesce(v_colocacoes, array[12,9,8,7,6,5,4,3,2,1,0,0]);
  v_por_abate := coalesce(v_por_abate, 1);
  new.punicao_pontos := least(coalesce(new.punicao_pontos, 0), 0);
  new.pontos_posicao := coalesce(v_colocacoes[new.posicao], 0);
  new.pontos_abates := coalesce(new.abates, 0) * v_por_abate;
  new.pontos_total := new.pontos_posicao + new.pontos_abates + new.punicao_pontos;
  new.booyah := new.posicao = 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_calcular_pontuacao_resultado_equipe on public.campeonato_resultados_equipes;
create trigger trg_calcular_pontuacao_resultado_equipe
before insert or update of campeonato_id, posicao, abates, punicao_pontos
on public.campeonato_resultados_equipes
for each row execute function public.fn_calcular_pontuacao_resultado_equipe();

update public.campeonato_resultados_equipes
set posicao = posicao;

create or replace view public.campeonato_pontuador_equipes_matriz as
select
  slot.campeonato_id, slot.fase_id, slot.rodada_id, slot.jogo_id, slot.jogo_nome,
  slot.grupo_id, slot.grupo_nome, slot.total_slots_grupo, slot.slot_numero,
  slot.campeonato_equipe_id, slot.equipe_id, slot.line_id, slot.equipe_nome,
  slot.equipe_tag, slot.equipe_logo_url, slot.slot_vazio,
  partida.id as partida_id, partida.numero_partida, partida.mapa_codigo,
  mapa.nome as mapa_nome, mapa.imagem_url as mapa_imagem_url,
  partida.status as status_partida,
  coalesce(presenca.status, case when resultado.id is not null then 'presente' else 'pendente' end) as status_presenca,
  presenca.origem as origem_presenca, presenca.matchresult_nome_raw,
  presenca.observacoes as observacoes_presenca,
  resultado.id as resultado_id, resultado.posicao, resultado.abates,
  resultado.pontos_posicao, resultado.pontos_abates, resultado.pontos_total,
  resultado.booyah, resultado.punicao_pontos, resultado.punicao_motivo
from public.campeonato_pontuador_slots_jogo slot
join public.campeonato_partidas partida on partida.jogo_id = slot.jogo_id
left join public.dropzone_mapas mapa on mapa.codigo = partida.mapa_codigo
left join public.campeonato_partidas_equipes_presenca presenca
  on presenca.partida_id = partida.id and presenca.campeonato_equipe_id = slot.campeonato_equipe_id
left join public.campeonato_resultados_equipes resultado
  on resultado.partida_id = partida.id and resultado.campeonato_equipe_id = slot.campeonato_equipe_id;

create index if not exists campeonato_resultados_equipes_mapa_classificacao_idx
  on public.campeonato_resultados_equipes (campeonato_id, jogo_id, partida_id, campeonato_equipe_id);
