import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {fixtureLoader} from './ts-fixture-loader.mjs'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const body={mode:'move',source_slot_id:id(2),target_slot_id:id(3),source_participation_id:id(4),target_participation_id:null}
let calls=[],fault=null,failAuth=false,allowed=true,commits=0
const receipts=new Map()
const result=args=>({ok:true,campeonato_id:args.p_campeonato_id,mode:args.p_mode,action:args.p_mode,
  source_slot_id:args.p_source_slot_id,target_slot_id:args.p_target_slot_id,source_participation_id:args.p_source_participation_id,
  target_participation_id:args.p_target_participation_id,mensagem:'Movida.',
  participacoes:[{id:args.p_source_participation_id,slot_id:args.p_target_slot_id,equipe_id:id(6),line_id:id(7),grupo_id:id(8),slot_numero:2,updated_at:'2026-10-11T13:00:00Z'},
    ...(args.p_target_participation_id?[{id:args.p_target_participation_id,slot_id:args.p_source_slot_id,equipe_id:id(9),line_id:id(10),grupo_id:id(8),slot_numero:1,updated_at:'2026-10-11T13:00:00Z'}]:[])]})
const admin=createClient('https://slot-fixture.supabase.co','fixture-key',{auth:{persistSession:false},global:{fetch:async(input,options)=>{
  const url=new URL(input);assert.equal(url.pathname,'/rest/v1/rpc/fn_transferir_slots_atomico','Atomic mode cannot read/write legacy tables')
  const args=JSON.parse(options.body);calls.push(args)
  if(fault&&fault!=='lost')return Response.json(fault.success??fault,{status:fault.success?200:400})
  const key=args.p_actor_id+':'+args.p_request_id,identity=JSON.stringify(args),saved=receipts.get(key)
  if(saved)return saved.identity===identity?Response.json({...saved.data,repetida:true})
    :Response.json({code:'23505',message:'Chave de repetição vinculada a outro movimento.',details:'PRIVATE SQL'},{status:400})
  const data=result(args);receipts.set(key,{identity,data});commits++
  if(fault==='lost'){fault=null;throw new Error('Response lost after commit PRIVATE SQL')}
  return Response.json(data)
}}})
const load=fixtureLoader({
  '@backend/shared/supabase-admin':{supabaseAdmin:admin},
  '@backend/auth/server-auth':{getBearerUser:async()=>{if(failAuth)throw new Error('Sessao invalida');return {id:id(1)}}},
  '@backend/campeonatos/campeonato-permissions':{getCampeonatoPermission:async()=>({canManage:allowed})},
})
const api=load('backend/src/campeonatos/slot-transfer.ts'),routes=load('web/app/api/campeonatos/[id]/equipes/route.ts')
const before=process.env.SLOT_MOVEMENT_MODE
const reset=()=>{calls=[];fault=null;failAuth=false;allowed=true;commits=0;receipts.clear()}
const request=(data=body,key=id(99))=>routes.PATCH(new Request('https://fixture.invalid/api',{method:'PATCH',headers:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify(data)}),{params:Promise.resolve({id:id(20)})})
let cases=0
try{
  delete process.env.SLOT_MOVEMENT_MODE
  assert.equal(await api.tryAtomicSlotTransfer(id(1),id(20),body,null),null);assert.equal(calls.length,0);cases++
  process.env.SLOT_MOVEMENT_MODE='misspelled';await assert.rejects(()=>api.tryAtomicSlotTransfer(id(1),id(20),body,id(99)),e=>e.status===503);assert.equal(calls.length,0);cases++
  process.env.SLOT_MOVEMENT_MODE='atomic'
  for(const mode of ['move','swap']){
    reset();const data={...body,mode,target_participation_id:mode==='swap'?id(5):null,actor_id:id(999),request_id:id(999),permission:'owner',plan:[{}]}
    const response=await request(data);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store')
    assert.equal(calls.length,1);assert.equal(calls[0].p_actor_id,id(1));assert.equal(calls[0].p_request_id,id(99));assert.equal(calls[0].p_campeonato_id,id(20));assert.equal(Object.keys(calls[0]).length,8);cases++
    assert.equal((await request(data)).status,200);assert.equal(commits,1);cases++
    reset();fault='lost';assert.equal((await request(data)).status,503);assert.equal(commits,1)
    const replay=await request(data);assert.equal(replay.status,200);assert.equal((await replay.json()).repetida,true);assert.equal(commits,1);cases++
  }
  for(const invalid of [null,[],{}, {...body,source_slot_id:body.target_slot_id},{...body,source_participation_id:null},
    {...body,target_participation_id:id(5)},{...body,mode:'swap',target_participation_id:null},{...body,source_slot_id:{}},
    {...body,mode:'swap',target_participation_id:body.source_participation_id}]){
    reset();assert.equal((await request(invalid)).status,400);assert.equal(calls.length,0);cases++
  }
  for(const mode of ['review_request','shuffle_group','distribute_phase','unexpected']){
    // Review belongs to the independent participation dispatcher; this body has no request ID/action.
    reset();assert.equal((await request({...body,mode})).status,mode==='unexpected'?503:400);assert.equal(calls.length,0);cases++
  }
  for(const key of [null,'bad',id(99)+','+id(98)]){reset();assert.equal((await request(body,key)).status,400);assert.equal(calls.length,0);cases++}
  for(const error of [
    {code:'PGRST202',message:'PRIVATE missing function',status:503},{code:'42883',message:'PRIVATE SQL',status:503},
    {code:'40P01',message:'PRIVATE deadlock',status:409},{code:'55P03',message:'PRIVATE lock',status:409},
    {code:'40001',message:'O ocupante mudou. Atualize o acompanhamento.',status:409},
    {code:'23505',message:'PRIVATE constraint',status:409},{code:'23514',message:'Espelho de origem exige reconciliação.',status:409},
    {code:'42501',message:'Sem permissão para movimentar slots.',status:403},{code:'23514',message:'Gatilho de slots incompatível com a movimentação.',status:503},
    {code:'57014',message:'PRIVATE timeout',status:503},{code:'22023',message:'PRIVATE SQL domain',status:503},
  ]){
    reset();fault={...error,details:'PRIVATE row',hint:'PRIVATE secret'}
    const response=await request();assert.equal(response.status,error.status);assert.ok(!JSON.stringify(await response.json()).includes('PRIVATE'));assert.equal(calls.length,1);cases++
  }
  for(const modify of [data=>{data.campeonato_id=id(999)},data=>{data.source_slot_id=id(999)},data=>{data.participacoes=[]},
    data=>{data.participacoes[0].slot_id=id(999)},data=>{data.participacoes[0].updated_at='bad'},data=>{data.participacoes[0].line_id='bad'}]){
    reset();const data=result({p_campeonato_id:id(20),p_source_slot_id:id(2),p_target_slot_id:id(3),p_source_participation_id:id(4),p_target_participation_id:null,p_mode:'move'});modify(data)
    fault={success:data};const response=await request();assert.equal(response.status,503);assert.equal((await response.json()).resultado_incerto,true);cases++
  }
  for(const auth of ['missing','readonly']){
    reset();failAuth=auth==='missing';allowed=auth!=='readonly'
    const response=await routes.PATCH({json:()=>{throw new Error('Body read before authorization')}},{params:Promise.resolve({id:id(20)})})
    assert.equal(response.status,400);assert.equal(calls.length,0);assert.ok(!(await response.json()).error.includes('Body read'));cases++
  }
  reset();const results=await Promise.all([request(),request()]);assert.ok(results.every(r=>r.status===200));assert.equal(commits,1);cases++
  reset();const extra=result({p_campeonato_id:id(20),p_source_slot_id:id(2),p_target_slot_id:id(3),p_source_participation_id:id(4),p_target_participation_id:null,p_mode:'move'})
  extra.debug='PRIVATE SQL';extra.participacoes[0].auth_user_id='PRIVATE';fault={success:extra}
  assert.ok(!JSON.stringify(await (await request()).json()).includes('PRIVATE'));cases++
  console.log(`Slot transfer transport passed: ${cases} fixtures; one RPC, no pre-read/fallback/retry/compensation; trusted actor, expected occupants, replay, DTO/error privacy and auth-before-body.`)
}finally{if(before==null)delete process.env.SLOT_MOVEMENT_MODE;else process.env.SLOT_MOVEMENT_MODE=before}
