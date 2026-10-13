import fs from 'node:fs'
import assert from 'node:assert/strict'
import {sql,directory,runFile} from './docker-lab.mjs'
import {id,service} from './fixtures.mjs'
const rollback='docs/sql/20261011_enrollment_rollback_candidate.sql'
const before=await sql("select md5(pg_get_functiondef('public.fn_inscrever_por_convite_atomico(uuid,uuid,text,text,uuid,uuid,text,uuid,integer,text)'::regprocedure));")
let error
try{await runFile(rollback)}catch(cause){error=cause.message}
assert.match(error,/Histórico de reinscrição/)
assert.equal(await sql("select md5(pg_get_functiondef('public.fn_inscrever_por_convite_atomico(uuid,uuid,text,text,uuid,uuid,text,uuid,integer,text)'::regprocedure));"),before)
const preflight=(await runFile('docs/sql/20261011_enrollment_preflight_readonly.sql')).split('\n').filter(Boolean).map(JSON.parse)
fs.writeFileSync(directory+'/preflight-isolated.json',JSON.stringify(preflight,null,2))
const oldDatabase=process.env.DROPZONE_FIXTURE_DB
process.env.DROPZONE_FIXTURE_DB=process.argv[2]||'dropzone_validation_rollback'
await runFile('docs/sql/20261011_rejoin_index_candidate.sql')
const accepted=JSON.parse(await sql(`${service}select public.fn_inscrever_por_convite_atomico('${id(1)}','${id(60000)}','group','fixture-group-1000','${id(100)}','${id(200)}',null,'${id(1010)}',null,null);`))
await runFile(rollback)
const out=JSON.parse(await sql(`select jsonb_build_object(
 'rpcRemoved',to_regprocedure('public.fn_inscrever_por_convite_atomico(uuid,uuid,text,text,uuid,uuid,text,uuid,integer,text)') is null,
 'legacyIndexRestored',to_regclass('public.campeonato_equipes_campeonato_line_unique') is not null,
 'receiptRetained',(select count(*) from public.inscricao_recibos where request_id='${id(60000)}'),
 'participationRetained',(select count(*) from public.campeonato_equipes where id='${accepted.participacao.id}'),
 'mirrorPreviousBehaviorRestored',position('or status = ''ocupado''' in pg_get_functiondef('public.fn_sync_slot_mirror_from_participacao()'::regprocedure))>0);`))
assert.deepEqual(out,{rpcRemoved:true,legacyIndexRestored:true,receiptRetained:1,participationRetained:1,mirrorPreviousBehaviorRestored:true})
process.env.DROPZONE_FIXTURE_DB=oldDatabase
fs.writeFileSync(directory+'/rollback-validation.json',JSON.stringify({passed:true,guardRejectedWithRejoinHistory:true,rpcPreservedAfterRejectedRollback:true,readonlyPreflightCompiled:true,successfulRollback:out,productionWrites:0},null,2))
console.log('Rollback: rejoin history blocks unsafe reversal; clean fixture retains receipt/participation and restores prior schema. Preflight compiled.')
