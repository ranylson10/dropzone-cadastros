import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {fixtureLoader} from './ts-fixture-loader.mjs'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const expected=[1,2,3].map(n=>({id:id(20+n),slot_id:id(30+n),equipe_id:id(40+n),line_id:id(50+n),updated_at:'2026-10-11T13:00:00.123456+00:00'}))
const body={mode:'distribute_phase',phase_id:id(3),group_ids:[id(4),id(5)],strategy:'balanced',expected}
let calls=[],fault=null,auth=true,manage=true,commits=0
const receipts=new Map()
const result=args=>({ok:true,campeonato_id:args.p_campeonato_id,mode:args.p_mode,action:args.p_mode==='shuffle_group'?'shuffle':'distribute',
  phase_id:args.p_phase_id,strategy:args.p_strategy,group_ids:args.p_group_ids,expected_count:args.p_expected.length,
  participacoes:args.p_expected.map((row,i)=>({...row,slot_id:id(100+i),grupo_id:args.p_group_ids[i%args.p_group_ids.length],slot_numero:i+1})),
  distribuicao:args.p_group_ids.map((grupo_id,i)=>({grupo_id,equipes:args.p_expected.filter((_,n)=>n%args.p_group_ids.length===i).length}))})
const admin=createClient('https://slot-batch-fixture.supabase.co','fixture',{auth:{persistSession:false},global:{fetch:async(input,options)=>{
  assert.equal(new URL(input).pathname,'/rest/v1/rpc/fn_distribuir_slots_atomico','Must not pre-read or mutate legacy tables')
  const args=JSON.parse(options.body);calls.push(args)
  if(fault&&fault!=='lost')return Response.json(fault.success??fault,{status:fault.success?200:400})
  const key=args.p_actor_id+':'+args.p_request_id,identity=JSON.stringify(args),saved=receipts.get(key)
  if(saved)return saved.identity===identity?Response.json({...saved.data,repetida:true}):Response.json({code:'23505',message:'Chave de repetição vinculada a outra distribuição.',details:'PRIVATE'},{status:400})
  const data=result(args);receipts.set(key,{identity,data});commits++
  if(fault==='lost'){fault=null;throw new Error('PRIVATE response lost after commit')}
  return Response.json(data)
}}})
const load=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:admin},
  '@backend/auth/server-auth':{getBearerUser:async()=>{if(!auth)throw new Error('Sessão inválida');return {id:id(1)}}},
  '@backend/campeonatos/campeonato-permissions':{getCampeonatoPermission:async()=>({canManage:manage})}})
const api=load('backend/src/campeonatos/slot-batch.ts'),routes=load('web/app/api/campeonatos/[id]/equipes/route.ts')
const before=process.env.SLOT_MOVEMENT_MODE
const reset=()=>{calls=[];fault=null;auth=true;manage=true;commits=0;receipts.clear()}
const request=(data=body,key=id(99))=>routes.PATCH(new Request('https://fixture.invalid/api',{method:'PATCH',headers:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify(data)}),{params:Promise.resolve({id:id(2)})})
let cases=0
try{
  delete process.env.SLOT_MOVEMENT_MODE;assert.equal(await api.tryAtomicSlotBatch(id(1),id(2),body,null),null);assert.equal(calls.length,0);cases++
  process.env.SLOT_MOVEMENT_MODE='bad';await assert.rejects(()=>api.tryAtomicSlotBatch(id(1),id(2),body,id(99)),e=>e.status===503);assert.equal(calls.length,0);cases++
  process.env.SLOT_MOVEMENT_MODE='atomic'
  for(const data of [body,{...body,strategy:'random'},{mode:'shuffle_group',group_id:id(4),expected}]){
    reset();const response=await request({...data,actor_id:id(999),request_id:id(999),permission:'owner',plan:[{}]})
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).operation_confirmed,true)
    assert.equal(calls.length,1);assert.equal(calls[0].p_actor_id,id(1));assert.equal(calls[0].p_campeonato_id,id(2));assert.equal(calls[0].p_request_id,id(99));assert.equal(Object.keys(calls[0]).length,8)
    assert.equal(calls[0].p_expected[0].updated_at,expected[0].updated_at);cases++
    assert.equal((await request(data)).status,200);assert.equal(commits,1);cases++
    reset();fault='lost';const lost=await request(data);assert.equal(lost.status,503);assert.equal((await lost.json()).resultado_incerto,true);assert.equal(commits,1)
    const replay=await request(data);assert.equal(replay.status,200);assert.equal((await replay.json()).repetida,true);assert.equal(commits,1);cases++
  }
  for(const invalid of [{...body,phase_id:null},{...body,group_ids:[id(4)]},{...body,group_ids:[id(4),id(4)]},
    {...body,group_ids:Array.from({length:101},(_,i)=>id(i+100))},{...body,strategy:'typo'},{...body,expected:null},{...body,expected:[]},
    {...body,expected:[expected[0]]},{...body,expected:Array(1001).fill(expected[0])},{...body,expected:[expected[0],expected[0]]},
    {...body,expected:[expected[0],{...expected[1],slot_id:expected[0].slot_id}]},
    ...[null,{},[],{...expected[0],updated_at:'not-date'},{...expected[0],updated_at:'2026-10-11'},
      {...expected[0],updated_at:99},{...expected[0],updated_at:'2026-10-11T13:00:00.1234567Z'},
      {...expected[0],line_id:null},{...expected[0],id:{}},{...expected[0],equipe_id:'bad'}].map(row=>({...body,expected:[expected[1],row]})),
    {mode:'shuffle_group',group_id:null,expected}]){
    reset();assert.equal((await request(invalid)).status,400,JSON.stringify(invalid));assert.equal(calls.length,0);cases++
  }
  for(const key of [null,'bad',id(99)+','+id(98)]){reset();assert.equal((await request(body,key)).status,400);assert.equal(calls.length,0);cases++}
  reset();await request();const reversed=await request({...body,expected:[...expected].reverse()});assert.equal(reversed.status,200);assert.equal(commits,1);cases++
  reset();await request();const changed=await request({...body,strategy:'random'});assert.equal(changed.status,409);assert.equal(commits,1);cases++
  for(const error of [{code:'23505',message:'Chave de repetição vinculada a outra distribuição.',status:409},
    {code:'40001',message:'As equipes mudaram. Atualize o acompanhamento.',status:409},
    {code:'42501',message:'Sem permissão para movimentar slots.',status:403},
    {code:'23514',message:'Espelho de distribuição exige reconciliação.',status:409},
    {code:'40P01',message:'PRIVATE deadlock',status:409},{code:'55P03',message:'PRIVATE timeout',status:409},
    {code:'42883',message:'PRIVATE missing',status:503},{code:'PGRST202',message:'PRIVATE missing',status:503},
    {code:'42501',message:'PRIVATE arbitrary',status:503},{code:'XX000',message:'PRIVATE arbitrary',status:503}]){
    reset();fault=error;const response=await request();assert.equal(response.status,error.status);assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(!JSON.stringify(await response.json()).includes('PRIVATE'));assert.equal(calls.length,1);cases++
  }
  const args={p_campeonato_id:id(2),p_mode:body.mode,p_phase_id:body.phase_id,p_group_ids:body.group_ids,p_strategy:body.strategy,p_expected:expected}
  const good=result(args)
  for(const change of [data=>({...data,campeonato_id:id(999)}),data=>({...data,mode:'shuffle_group'}),data=>({...data,action:'swap'}),
    data=>({...data,phase_id:id(999)}),data=>({...data,strategy:'random'}),data=>({...data,expected_count:2}),
    data=>({...data,group_ids:[...data.group_ids].reverse()}),data=>({...data,participacoes:data.participacoes.slice(1)}),
    data=>({...data,participacoes:[data.participacoes[0],data.participacoes[0],data.participacoes[2]]}),
    ...['equipe_id','line_id','grupo_id','slot_id'].map(field=>data=>({...data,participacoes:data.participacoes.map((r,i)=>i? r:{...r,[field]:field==='slot_id'?'invalid':id(999)})})),
    data=>({...data,participacoes:data.participacoes.map((r,i)=>i?r:{...r,slot_id:data.participacoes[1].slot_id})}),
    data=>({...data,participacoes:data.participacoes.map((r,i)=>i?r:{...r,slot_numero:0})}),
    data=>({...data,participacoes:data.participacoes.map((r,i)=>i?r:{...r,updated_at:null})}),
    data=>({...data,distribuicao:[{grupo_id:id(4),equipes:99},data.distribuicao[1]]})]){
    const data=change(structuredClone(good))
    reset();fault={success:data};const response=await request();assert.equal(response.status,503);assert.equal((await response.json()).resultado_incerto,true);cases++
  }
  reset();fault={success:{...good,private_note:'PRIVATE',participacoes:good.participacoes.map(row=>({...row,private_note:'PRIVATE'}))}}
  const sanitized=await request();assert.equal(sanitized.status,200);assert.ok(!JSON.stringify(await sanitized.json()).includes('PRIVATE'));cases++
  for(const fail of ['auth','permission']){
    reset();auth=fail!=='auth';manage=fail!=='permission';let read=false
    const req={headers:new Headers({'Idempotency-Key':id(99)}),json:async()=>{read=true;return body}}
    assert.equal((await routes.PATCH(req,{params:Promise.resolve({id:id(2)})})).status,400);assert.equal(read,false);assert.equal(calls.length,0);cases++
  }
  console.log(`Slot batch transport passed: ${cases}`)
}finally{if(before===undefined)delete process.env.SLOT_MOVEMENT_MODE;else process.env.SLOT_MOVEMENT_MODE=before}
