import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {fixtureLoader} from './ts-fixture-loader.mjs'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const champ=id(2),actor=id(1),version='2026-10-11T13:00:00.123456+00:00'
const parts=[0,1,2].map(n=>({id:id(8+n),campeonato_id:champ,equipe_id:id(5),line_id:id(6+n),slot_id:n===0?id(7):null,
 grupo_id:n===0?id(9):null,slot_numero:n===0?1:null,status:n===0?'ativo':n===1?'pendente':'rejeitado',updated_at:version}))
let permission={role:'owner',canView:true,canManage:true,canRemove:true},auth=true,view=true,mismatch=false,fault=false,hidden=false,newerRequest=false,emptyMirror=false,staleVersion=false
let calls=[]
const admin=createClient('https://snapshots-fixture.invalid','fixture',{auth:{persistSession:false},global:{fetch:async(input,options)=>{
 const url=new URL(input),name=url.pathname.split('/').at(-1);calls.push({name,method:options.method||'GET',params:url.searchParams})
 if(name==='campeonatos')return Response.json({id:champ,nome:'Fixture',tipo:'comum',logo_url:null,status:'ativo',aprovacao_status:hidden?'pendente':'aprovado'})
 if(name==='campeonato_equipes'){
  if(fault)return Response.json({code:'XX000',message:'PRIVATE SNAPSHOT QUERY',details:'PRIVATE'},{status:500})
  const status=url.searchParams.get('status')
  const matching=status==='in.(ativo,pendente,rejeitado)'?parts.map(p=>staleVersion?{...p,updated_at:'invalid'}:newerRequest&&p.id===id(9)?{...p,status:'rejeitado',updated_at:'2026-10-11T13:01:00.123456+00:00'}:p):status==='eq.ativo'?[parts[0]]:parts.slice(1)
  // Deliberately cap every Data API page at one row; the snapshot loader must continue.
  const paged=url.searchParams.has('offset'),offset=Number(url.searchParams.get('offset')||0)
  return Response.json(paged?matching.slice(offset,offset+1):matching)
 }
 if(name==='campeonato_slots'){const slots=[{id:id(7),campeonato_id:champ,grupo_id:id(9),slot_numero:1,equipe_id:emptyMirror?null:id(5),line_id:emptyMirror?null:mismatch?id(999):id(6),status:'ocupado'}];const offset=Number(url.searchParams.get('offset')||0);return Response.json(url.searchParams.has('offset')?slots.slice(offset,offset+1):slots)}
 if(name==='equipes')return Response.json([{id:id(5),nome:'Equipe'}])
 if(name==='equipe_lines')return Response.json(parts.map(p=>({id:p.line_id,nome:'Line'})))
 return Response.json([])
}}})
const overrides={'@backend/shared/supabase-admin':{supabaseAdmin:admin},
 '@backend/auth/server-auth':{getBearerUser:async()=>{if(!auth)throw Error('Anonymous');return {id:actor}}},
 '@backend/campeonatos/campeonato-permissions':{getCampeonatoPermission:async()=>permission,permissionPublicPayload:p=>({...p})},
 '@backend/campeonatos/capacidade':{getCampeonatoCapacidade:async()=>null},
 '@backend/campeonatos/participacao-sync':{listSlotsLinesView:async()=>view?{source:'view',rows:[{slot_id:id(7),grupo_id:id(9),slot_numero:1,equipe_id:id(5),line_id:mismatch?id(999):id(6),participacao_id:id(8)}]}:{source:'fallback',rows:[]}},
 '@/features/lili/tools':{listUserRegistrations:async()=>[]},
}
const load=fixtureLoader(overrides),routes=load('web/app/api/campeonatos/[id]/equipes/route.ts'),structure=load('web/app/api/campeonatos/[id]/estrutura/route.ts')
const before=process.env.PARTICIPATION_WRITE_MODE,beforeMovement=process.env.SLOT_MOVEMENT_MODE,request=new Request('https://fixture.invalid/api');request.nextUrl=new URL(request.url)
const get=route=>route.GET(request,{params:Promise.resolve({id:champ})})
let cases=0
try{
 process.env.PARTICIPATION_WRITE_MODE='atomic'
 process.env.SLOT_MOVEMENT_MODE='legacy'
 const read=await load('backend/src/campeonatos/participation-snapshot.ts').loadParticipationSnapshots(champ)
 assert.equal(read.length,3);assert.equal(calls.length,4);assert.ok(calls.every(c=>c.method==='GET'&&c.params.get('campeonato_id')==='eq.'+champ));cases++
 for(const useView of [true,false]){
  calls=[];view=useView;const response=await get(routes);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store')
  const dto=await response.json();assert.equal(dto.participation_write_mode,'atomic');assert.equal(dto.participation_actor_id,actor)
  assert.deepEqual(dto.vagas[0].participation_expected,{equipe_id:id(5),line_id:id(6),slot_id:id(7),status:'ativo',updated_at:version})
  assert.equal(dto.solicitacoes[0].participation_expected.slot_id,null);assert.equal(dto.solicitacoes[0].participation_expected.updated_at,version)
  assert.ok(calls.every(c=>c.method==='GET'));cases++
  mismatch=true;const stale=await get(routes);assert.equal((await stale.json()).vagas[0].participation_expected,null);mismatch=false;cases++
 }
 view=true
 newerRequest=true
 const reviewing=await get(routes),displayed=(await reviewing.json()).solicitacoes[0]
 assert.equal(displayed.status,'pendente');assert.equal(displayed.participation_expected.status,'pendente');assert.equal(displayed.participation_expected.updated_at,version);newerRequest=false;cases++
 for(const authorized of [false,true]){
  auth=authorized;permission={role:authorized?'viewer':'none',canView:true,canManage:false,canRemove:false};calls=[]
  const response=await get(routes),dto=await response.json();assert.equal(response.status,200);assert.equal(dto.participation_actor_id,authorized?actor:null)
  assert.equal('participation_expected' in dto.vagas[0],false);assert.equal(calls.some(c=>c.name==='campeonato_equipes'),false);cases++
 }
 auth=false;hidden=true;calls=[];assert.equal((await get(routes)).status,400);assert.deepEqual(calls.map(c=>c.name),['campeonatos']);hidden=false;cases++
 auth=true;permission={role:'owner',canView:true,canManage:true,canRemove:true};fault=true
 for(const route of [routes,structure]){const response=await get(route);assert.equal(response.status,400);assert.ok(!JSON.stringify(await response.json()).includes('PRIVATE'));assert.equal(response.headers.get('cache-control'),'no-store');cases++}
 fault=false
 const adminView=await get(structure),dto=await adminView.json();assert.equal(adminView.status,200);assert.equal(dto.slots[0].participation_expected.updated_at,version);assert.equal(dto.participation_actor_id,actor);cases++
 auth=false;const publicView=await get(structure);assert.equal(publicView.status,200);assert.equal('participation_expected' in (await publicView.json()).slots[0],false);cases++
 process.env.PARTICIPATION_WRITE_MODE='legacy';auth=true;calls=[];const legacy=await get(routes);assert.equal(legacy.status,200);assert.equal('participation_expected' in (await legacy.json()).vagas[0],false)
 assert.equal(calls.filter(c=>c.params.get('status')==='in.(ativo,pendente,rejeitado)').length,0);cases++
 process.env.PARTICIPATION_WRITE_MODE='typo';assert.equal((await get(routes)).status,503);assert.equal((await get(structure)).status,503);cases++
 for(const mode of ['legacy','atomic']){
  process.env.PARTICIPATION_WRITE_MODE=mode;process.env.SLOT_MOVEMENT_MODE='atomic';calls=[]
  const response=await get(structure),dto=await response.json();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(dto.slot_movement_mode,'atomic');assert.equal(dto.slot_movement_actor_id,actor)
  assert.deepEqual(dto.slots[0].slot_movement_expected,{id:id(8),slot_id:id(7),equipe_id:id(5),line_id:id(6),updated_at:version});assert.equal('snapshotSlots' in dto,false)
  assert.equal(calls.filter(c=>c.params.get('status')==='in.(ativo,pendente,rejeitado)').length,4);assert.ok(calls.filter(c=>c.params.get('status')==='in.(ativo,pendente,rejeitado)').every(c=>c.params.get('campeonato_id')==='eq.'+champ));cases++
 }
 for(const failure of ['mismatch','emptyMirror','staleVersion']){
  mismatch=failure==='mismatch';emptyMirror=failure==='emptyMirror';staleVersion=failure==='staleVersion'
  const dto=await (await get(structure)).json();assert.equal(dto.slots[0].slot_movement_expected,null);cases++
 }
 mismatch=false;emptyMirror=false;staleVersion=false
 for(const authorized of [false,true]){
  auth=authorized;permission={role:authorized?'viewer':'none',canView:true,canManage:false,canRemove:false};calls=[]
  const dto=await (await get(structure)).json();assert.equal(dto.slot_movement_actor_id,authorized?actor:null);assert.equal('slot_movement_expected' in dto.slots[0],false);assert.equal(calls.filter(c=>c.params.get('status')==='in.(ativo,pendente,rejeitado)').length,0);cases++
 }
 auth=true;permission={role:'owner',canView:true,canManage:true,canRemove:true};process.env.PARTICIPATION_WRITE_MODE='legacy';process.env.SLOT_MOVEMENT_MODE='legacy';calls=[]
 const dtoLegacy=await (await get(structure)).json();assert.equal(dtoLegacy.slot_movement_mode,'legacy');assert.equal('slot_movement_expected' in dtoLegacy.slots[0],false);assert.equal(calls.filter(c=>c.params.get('status')==='in.(ativo,pendente,rejeitado)').length,0);cases++
 process.env.SLOT_MOVEMENT_MODE='typo';const invalid=await get(structure);assert.equal(invalid.status,503);assert.equal(invalid.headers.get('cache-control'),'no-store');cases++
 assert.equal((await get(routes)).status,503);cases++
 process.env.SLOT_MOVEMENT_MODE='atomic'
 for(const useView of [true,false])for(const mode of ['legacy','atomic']){
  view=useView;process.env.PARTICIPATION_WRITE_MODE=mode;calls=[]
  const response=await get(routes),dto=await response.json();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(dto.slot_movement_mode,'atomic');assert.equal(dto.slot_movement_actor_id,actor)
  assert.deepEqual(dto.vagas[0].slot_movement_expected,{id:id(8),slot_id:id(7),equipe_id:id(5),line_id:id(6),updated_at:version});assert.equal(calls.filter(c=>c.params.get('status')==='in.(ativo,pendente,rejeitado)').length,4);cases++
  for(const failure of ['mismatch','staleVersion']){mismatch=failure==='mismatch';staleVersion=failure==='staleVersion';const stale=await(await get(routes)).json();assert.equal(stale.vagas[0].slot_movement_expected,null);cases++}
  mismatch=false;staleVersion=false
 }
 for(const useView of [true,false]){view=useView;emptyMirror=true;const empty=await(await get(routes)).json();assert.equal(empty.vagas[0].slot_movement_expected,null);emptyMirror=false;cases++}
 for(const authorized of [false,true]){auth=authorized;permission={role:authorized?'viewer':'none',canView:true,canManage:false,canRemove:false};calls=[];const dto=await(await get(routes)).json();assert.equal('slot_movement_expected' in dto.vagas[0],false);assert.equal(dto.slot_movement_actor_id,authorized?actor:null);assert.equal(calls.filter(c=>c.params.get('status')==='in.(ativo,pendente,rejeitado)').length,0);cases++}
 assert.ok(calls.every(c=>c.method==='GET'));cases++
 console.log(`Participation snapshots passed: ${cases} fixtures; actual scoped HTTP reads, cap-one pagination, view/fallback parity, tuple mismatch, private versions, no writes and private errors.`)
}finally{if(before===undefined)delete process.env.PARTICIPATION_WRITE_MODE;else process.env.PARTICIPATION_WRITE_MODE=before;if(beforeMovement===undefined)delete process.env.SLOT_MOVEMENT_MODE;else process.env.SLOT_MOVEMENT_MODE=beforeMovement}
