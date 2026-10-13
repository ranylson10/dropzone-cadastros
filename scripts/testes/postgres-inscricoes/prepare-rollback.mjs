import fs from 'node:fs'
import assert from 'node:assert/strict'
import {sql,directory} from './docker-lab.mjs'
const signatures=['fn_sync_slot_mirror_from_participacao()','fn_inscrever_por_convite_atomico(uuid,uuid,text,text,uuid,uuid,text,uuid,integer,text)','dz_inscricao_link_meta(jsonb,text)','dz_inscricao_nome_key(text)']
const fingerprints=JSON.parse(await sql(`select jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid))) from pg_proc p where p.oid in (${signatures.map(s=>`'public.${s}'::regprocedure`).join(',')});`))
const catalog=JSON.parse(fs.readFileSync('relatorios-testes/banco-publicado.json','utf8'))
const previous=catalog.functions.find(f=>f.function_name==='fn_sync_slot_mirror_from_participacao').definition
assert.ok(previous)
let rollback=`-- REVIEWED ROLLBACK CANDIDATE. Not applied to production.
-- Disable/reroute the new RPC consumer first. This restores the previous mirror
-- behavior (including DBR01). Prefer fixing forward if rejoin history now exists.
-- Receipt rows/table are retained for reconciliation; no rows are deleted.
begin;
set local lock_timeout='5s';
lock table public.campeonato_equipes in share row exclusive mode;
do $guard$
begin
`
for(const signature of signatures){
 const key=Object.keys(fingerprints).find(k=>k===signature||k===`public.${signature}`)
 assert.ok(key)
 rollback+=`  if to_regprocedure('public.${signature}') is null or md5(pg_get_functiondef(to_regprocedure('public.${signature}'))) is distinct from '${fingerprints[key]}' then
    raise exception 'Definição diferente do candidato validado: ${signature}';
  end if;
`
}
rollback+=`  if exists(select 1 from public.campeonato_equipes where line_id is not null group by campeonato_id,line_id having count(*)>1) then
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
${previous};
revoke all on public.inscricao_recibos from public,anon,authenticated;
commit;
`
fs.writeFileSync('docs/sql/20261011_enrollment_rollback_candidate.sql',rollback)
fs.writeFileSync(directory+'/candidate-fingerprints.json',JSON.stringify(fingerprints,null,2))
console.log('Rollback generated with exact function fingerprints; receipt data retained.')
