// R18: offline transport and recipient guards. NOT a PostgreSQL concurrency test.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { fixtureLoader } from './ts-fixture-loader.mjs'
let checks=0
function eq(a,b,msg){assert.deepEqual(a,b,msg);checks++}
async function rejects(fn,pattern){await assert.rejects(fn,pattern);checks++}
const sourceNames=[
 'backend/src/campeonatos/invites/types.ts',
 'backend/src/campeonatos/invites/team-invite-read.ts',
 'backend/src/campeonatos/invites/team-invite-accept.ts',
]
for(const filename of sourceNames){
 const file=ts.createSourceFile(filename,fs.readFileSync(filename,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
 eq(file.parseDiagnostics.length,0,`Sintaxe TS: ${filename}`)
}
const t=fixtureLoader()('backend/src/campeonatos/invites/types.ts')
for(const [invite,team,line] of [
 [{},'a',null],
 [{equipe_destino_id:null,line_destino_id:null},'b','c'],
 [{equipe_destino_id:'a'},'a',null],
 [{equipe_id:'a'},'a',null],
 [{line_destino_id:'x'},'a','x'],
 [{equipe_destino_id:'a',line_destino_id:'x'},'a','x'],
]) {eq(t.assertTeamInviteRecipient(invite,team,line),undefined,'Open or correctly targeted invite allowed')}
for(const [invite,team,line] of [
 [{equipe_destino_id:'a'},'b',null],
 [{equipe_id:'a'},'b',null],
 [{equipe_destino_id:'a',line_destino_id:'x'},'b','x'],
 [{line_destino_id:'x'},'a','y'],
 [{line_destino_id:'x'},'a',null],
]) {assert.throws(()=>t.assertTeamInviteRecipient(invite,team,line),/outra equipe|outra line/);checks++}
const read=fs.readFileSync(sourceNames[1],'utf8')
eq(read.includes('equipe_id,equipe_destino_id,line_destino_id'),true,'Target team must be selected from DB')
const sqlLili=fs.readFileSync('docs/sql/20261026_round10_lili_writer_candidate.sql','utf8')
for(const clause of [
 't.equipe_destino_id is not null and t.equipe_destino_id is distinct from p_equipe_id',
 't.line_destino_id is not null and t.line_destino_id is distinct from p_line_id',
 't.equipe_destino_id is null or t.equipe_destino_id=p_equipe_id',
 't.line_destino_id is null or t.line_destino_id=p_line_id',
]) eq(sqlLili.includes(clause),true,`Lili destination contract: ${clause}`)
const sqlInvite=fs.readFileSync('docs/sql/20261026_round11_invite_writer_candidate.sql','utf8')
eq(/if p_action='renew' and exists\s*\(\s*select 1 from public\.campeonato_grupo_escolha_bloqueios/.test(sqlInvite),true,'Renewal rejects administrative blocks')
let writes=[];let filters=[];let targetTeam=null;let targetLine=null;let claimed=true
const userTeam={id:'team-A',nome:'A',papel:'dono',permissoes:{pode_editar:true,pode_escalar:true}}
const actor={user:{id:'user-A'},accounts:[]}
const patch={
 from(table){if(table!=='tokens')throw new Error('Unexpected table '+table)
  const chain={
   update(value){writes.push(['tokenUpdate',value]);return chain},
   eq(k,v){filters.push([k,'eq',v]);return chain},
   is(k,v){filters.push([k,'is',v]);return chain},
   or(){return chain},
   select(){return chain},
   async maybeSingle(){return {data:claimed?{id:'token-1'}:null,error:null}}
  };return chain
 }
}
const abs=(p)=>path.resolve(process.cwd(),'backend/src/campeonatos',p)
const accept=fixtureLoader({
 '@backend/shared/supabase-admin':{supabaseAdmin:patch},
 '@backend/equipes/manager-team-access':{listControllableEquipes:async()=>[userTeam]},
 [abs('participacao-sync.ts')]:{
  resolveLineForInscricao:async()=>({id:'line-A',nome:'A',criada_agora:false}),
  inserirParticipacaoNoSlot:async()=>{writes.push(['insertParticipation']);return {id:'participant-A'}},
  softRemoveParticipacao:async()=>{writes.push(['compensateParticipation'])},
 },
 [abs('invites/team-invite-read.ts')]:{
  loadTeamInvite:async()=>({convite:{id:'token-1',campeonato_id:'champ-A',
   equipe_id:null,equipe_destino_id:targetTeam,line_destino_id:targetLine},slot:{id:'slot-A',slot_numero:1,slot_letra:'A',equipe_id:null,line_id:null},grupo:null,modoGrupo:false}),
  teamInviteValid:()=>true,
 },
 [abs('invites/enrollment-policy.ts')]:{assertEnrollmentOpen:async()=>{}},
})('backend/src/campeonatos/invites/team-invite-accept.ts')
const run=(lineId='line-A')=>accept.acceptTeamInvite(actor,'token',{equipe_id:'team-A',line_id:lineId})
targetTeam='team-B';targetLine=null;writes=[];filters=[]
await rejects(()=>run(),/outra equipe/)
eq(writes.length,0,'No writes on team mismatch')
targetTeam='team-A';targetLine='line-B';writes=[]
await rejects(()=>run(),/outra line/)
eq(writes.length,0,'No writes on line mismatch')
targetTeam='team-A';targetLine='line-A';writes=[];filters=[];claimed=true
const success=await run()
eq(success.ok,true,'Correct targeted invitation accepted')
eq(filters.some(([key,op,value])=>key==='equipe_destino_id'&&op==='eq'&&value==='team-A'),true,'Claim ties target to original DB value')
eq(filters.some(([key,op,value])=>key==='equipe_id'&&op==='is'&&value===null),true,'Claim keeps original team ownership unchanged')
eq(filters.some(([key,op,value])=>key==='line_destino_id'&&op==='eq'&&value==='line-A'),true,'Claim ties line destination to original DB value')
targetTeam=null;targetLine=null;writes=[];filters=[]
await run()
eq(filters.some(([key,op,value])=>key==='equipe_destino_id'&&op==='is'&&value===null),true,'Open invite cannot be re-targeted during claim')
eq(filters.some(([key,op,value])=>key==='line_destino_id'&&op==='is'&&value===null),true,'Open invite line cannot be re-targeted during claim')
targetTeam='team-A';targetLine='line-A';writes=[];claimed=false
await rejects(()=>run(),/já foi utilizado/)
eq(writes.some(([type])=>type==='compensateParticipation'),true,'Failed guarded claim compensates created participation')
console.log(`R18: ${checks} verificacoes offline de destinatario, transporte e SQL candidato aprovadas (sem PostgreSQL real).`)
