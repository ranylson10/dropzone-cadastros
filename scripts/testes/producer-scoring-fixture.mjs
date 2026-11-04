import fs from 'node:fs'

// Outputs a PostgreSQL fixture using only temporary tables and ROLLBACK.
const migration = fs.readFileSync(new URL('../../supabase/migrations/20261104000719_producer_scoring_consistency.sql', import.meta.url), 'utf8')
export const fixture = `
begin;
create temp table campeonato_partidas (id text primary key, campeonato_id text, fase_id text, jogo_id text, multiplicador_abates numeric, pontos_abate_unitario numeric);
create temp table campeonato_configuracoes (campeonato_id text primary key, pontos_colocacao integer[], pontos_por_abate numeric);
create temp table campeonato_partidas_equipes_presenca (partida_id text, campeonato_equipe_id text, status text);
create temp table campeonato_resultados_equipes (id text primary key, partida_id text, campeonato_id text, fase_id text, jogo_id text, campeonato_equipe_id text, posicao int, abates int, pontos_posicao numeric, pontos_abates numeric, pontos_total numeric, multiplicador_abates_aplicado numeric, pontos_abate_unitario_aplicado numeric, punicao_pontos numeric, booyah boolean, updated_at timestamptz);
${migration.replaceAll('public.', 'pg_temp.')}
insert into pg_temp.campeonato_configuracoes values ('champ', array[12,9], 1);
insert into pg_temp.campeonato_partidas values ('drop1','champ','phase','game',1,null), ('drop2','champ','phase','game',2,2);
insert into pg_temp.campeonato_resultados_equipes(id,partida_id,campeonato_id,fase_id,jogo_id,campeonato_equipe_id,posicao,abates,punicao_pontos)
values ('a','drop1','champ','phase','game','team-a',1,4,-3), ('b','drop2','champ','phase','game','team-b',2,4,-3);
do $$ begin
 if (select pontos_total from pg_temp.campeonato_resultados_equipes where id='a') <> 13 then raise exception 'Normal kills + penalty'; end if;
 if (select pontos_total from pg_temp.campeonato_resultados_equipes where id='b') <> 22 then raise exception 'Double kills + unit override + penalty'; end if;
end $$;
update pg_temp.campeonato_resultados_equipes set punicao_pontos = -2 where id='a';
do $$ begin
 if (select pontos_total from pg_temp.campeonato_resultados_equipes where id='a') <> 14 then raise exception 'Penalty only update'; end if;
end $$;
update pg_temp.campeonato_configuracoes set pontos_colocacao=array[20,10], pontos_por_abate=0 where campeonato_id='champ';
do $$ begin
 if (select pontos_total from pg_temp.campeonato_resultados_equipes where id='a') <> 18 then raise exception 'Explicit zero kill points + rule recalculation'; end if;
 if (select pontos_total from pg_temp.campeonato_resultados_equipes where id='b') <> 23 then raise exception 'Drop override must remain'; end if;
end $$;
insert into pg_temp.campeonato_partidas_equipes_presenca values ('drop1','team-a','falta');
update pg_temp.campeonato_configuracoes set pontos_colocacao=array[30,15] where campeonato_id='champ';
do $$ begin
 if (select pontos_total from pg_temp.campeonato_resultados_equipes where id='a') <> 18 then raise exception 'FALT must remain untouched'; end if;
 if (select pontos_total from pg_temp.campeonato_resultados_equipes where id='b') <> 28 then raise exception 'New placement table'; end if;
 begin
  insert into pg_temp.campeonato_resultados_equipes(id,partida_id,campeonato_id,fase_id,jogo_id,campeonato_equipe_id,posicao,abates) values ('bad','drop1','foreign','phase','game','bad',1,1);
  raise exception 'Scope guard did not reject';
 exception when raise_exception then
  if sqlerrm <> 'O resultado precisa usar o mesmo campeonato, fase e jogo da queda.' then raise; end if;
 end;
end $$;
rollback;
`
if (process.argv[1]?.endsWith('producer-scoring-fixture.mjs')) process.stdout.write(fixture)
