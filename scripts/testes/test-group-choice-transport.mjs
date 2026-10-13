import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {fixtureLoader} from './ts-fixture-loader.mjs'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
let calls=[],fault=null,auth=true,manage=true,commits=0;const receipts=new Map()
const result=args=>({ok:true,campeonato_id:args.p_campeonato_id,action:args.p_action,choice_action:args.p_action,scope:args.p_scope,
  participation_id:args.p_participation_id,source_slot_id:args.p_expected_source_slot_id,history_id:args.p_history_id,
  target_slot_id:args.p_action==='cancel'?null:args.p_slot_id||id(6),private:'secret debug',
  participacoes:[{id:args.p_participation_id,equipe_id:id(7),line_id:id(8),grupo_id:args.p_action==='cancel'?null:args.p_group_id||id(5),
    slot_id:args.p_action==='cancel'?null:args.p_slot_id||id(6),slot_numero:args.p_action==='cancel'?null:2,updated_at:'2026-10-11T13:00:00Z',private:'secret debug'}]})
const admin=createClient('https://choice-fixture.supabase.co','fixture-key',{auth:{persistSession:false},global:{fetch:async(input,options)=>{
  assert.equal(new URL(input).pathname,'/rest/v1/rpc/fn_escolher_grupo_atomico','No legacy table reads/writes allowed')
  const args=JSON.parse(options.body);calls.push(args)
  if(fault&&fault!=='lost')return Response.json(fault.success||fault,{status:fault.success?200:400})
  const key=args.p_actor_id+':'+args.p_request_id,saved=receipts.get(key),identity=JSON.stringify(args)
  if(saved)return saved.identity===identity?Response.json({...saved.data,repetida:true}):Response.json({code:'23505',message:'Chave de repetição vinculada a outra escolha.'},{status:400})
  const data=result(args);receipts.set(key,{identity,data});commits++
  if(fault==='lost'){fault=null;throw new Error('PRIVATE SQL lost response')}
  return Response.json(data)
}}})
const load=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:admin},
  '@backend/auth/server-auth':{getBearerUser:async()=>{if(!auth)throw new Error('Sessao invalida.');return{id:id(1)}}},
  '@backend/campeonatos/campeonato-permissions':{getCampeonatoPermission:async()=>({canView:true,canManage:manage,role:'owner'})},
  '@backend/campeonatos/estatisticas/estatisticas.service':{}})
const api=load('backend/src/campeonatos/group-choice-transport.ts'),team=load('web/app/api/campeonatos/[id]/escolha-grupo/route.ts'),staff=load('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')
const reset=()=>{calls=[];fault=null;auth=true;manage=true;commits=0;receipts.clear()}
const intent=action=>({campeonato_equipe_id:id(3),source_slot_id:action==='cancel'?id(4):null,grupo_id:id(5),group_id:id(5),slot_id:id(6),history_id:action==='restore'?id(9):null})
async function request(scope,action,body=intent(action),key=id(99)){
  const method=scope==='admin'?'POST':action==='assign'?'POST':action==='cancel'?'DELETE':'PUT'
  return (scope==='admin'?staff:team)[method](new Request('https://fixture.invalid/api',{method,headers:{Authorization:'Bearer fixture','Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},
    body:JSON.stringify({...body,...(scope==='admin'?{action:{assign:'assign_group_manual',cancel:'cancel_group_choice_admin',restore:'restore_group_choice_admin'}[action]}:{})})}),{params:Promise.resolve({id:id(20)})})
}
const before=process.env.SLOT_MOVEMENT_MODE;let cases=0
try{
  delete process.env.SLOT_MOVEMENT_MODE;assert.equal(await api.tryAtomicGroupChoice(id(1),id(20),'team','assign',null,null),null);cases++
  process.env.SLOT_MOVEMENT_MODE='bad';await assert.rejects(()=>api.tryAtomicGroupChoice(id(1),id(20),'team','assign',{},null),e=>e.status===503);cases++
  process.env.SLOT_MOVEMENT_MODE='atomic'
  for(const scope of ['team','admin'])for(const action of ['assign','cancel','restore']){
    reset();const response=await request(scope,action,{...intent(action),actor_id:id(999),request_id:id(999),permission:'owner'})
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const data=await response.json()
    assert.equal(data.operation_confirmed,true);assert.ok(!JSON.stringify(data).includes('secret'));assert.equal(calls.length,1)
    assert.equal(calls[0].p_actor_id,id(1));assert.equal(calls[0].p_scope,scope);assert.equal(calls[0].p_action,action);cases++
    assert.equal((await request(scope,action)).status,200);assert.equal(commits,1);cases++
    reset();fault='lost';const lost=await request(scope,action);assert.equal(lost.status,503);assert.equal((await lost.json()).resultado_incerto,true)
    const replay=await request(scope,action);assert.equal(replay.status,200);assert.equal((await replay.json()).repetida,true);assert.equal(commits,1);cases++
  }
  for(const [action,data] of [['assign',{}],['assign',{...intent('assign'),source_slot_id:undefined}],['assign',{...intent('assign'),source_slot_id:{}}],
    ['assign',{...intent('assign'),slot_id:'bad'}],['cancel',{...intent('cancel'),source_slot_id:null}],['restore',{...intent('restore'),source_slot_id:id(4)}],
    ['restore',{...intent('restore'),history_id:null}],['assign',{...intent('assign'),note:'x'.repeat(501)}]]){
    reset();assert.equal((await request('team',action,data)).status,400);assert.equal(calls.length,0);cases++
  }
  for(const key of [null,'bad',id(99)+','+id(98)]){reset();assert.equal((await request('team','assign',intent('assign'),key)).status,400);assert.equal(calls.length,0);cases++}
  for(const code of ['40P01','55P03','23505']){reset();fault={code,message:'SECRET SQL',details:'SECRET'};const response=await request('team','assign');assert.equal(response.status,409);assert.ok(!JSON.stringify(await response.json()).includes('SECRET'));cases++}
  for(const code of ['42883','PGRST202','XX000']){reset();fault={code,message:'SECRET SQL'};const response=await request('team','assign');assert.equal(response.status,503);assert.ok(!JSON.stringify(await response.json()).includes('SECRET'));assert.equal(calls.length,1);cases++}
  for(const message of ['Esta participação não pertence à sua equipe.','A escolha de grupos não está aberta para esta fase.','O grupo ou slot está bloqueado pela administração.']){
    reset();fault={code:'42501',message};assert.equal((await request('team','assign')).status,403);cases++
  }
  for(const mutate of [v=>v.participacoes[0].id=id(998),v=>v.scope='admin',v=>v.source_slot_id=id(998),v=>v.target_slot_id=id(998),
    v=>v.participacoes[0].updated_at='invalid',v=>v.participacoes.push(v.participacoes[0]),v=>v.history_id=id(998)]){
    reset();const bad=result({p_campeonato_id:id(20),p_action:'assign',p_scope:'team',p_participation_id:id(3),p_expected_source_slot_id:null,p_history_id:null,p_slot_id:id(6),p_group_id:id(5)})
    mutate(bad);fault={success:bad};const response=await request('team','assign');assert.equal(response.status,503);assert.equal((await response.json()).resultado_incerto,true);cases++
  }
  reset();auth=false;for(const [scope,action] of [['team','assign'],['team','cancel'],['team','restore'],['admin','assign']]){const response=await request(scope,action);assert.equal(response.status,401);assert.equal(calls.length,0);cases++}
  reset();manage=false;assert.equal((await request('admin','assign')).status,403);assert.equal(calls.length,0);cases++
  console.log(`Group choice transport passed: ${cases} fixtures; six routes/actions, trusted actor, one RPC, no fallback, receipt replay and private errors/DTO.`)
}finally{if(before===undefined)delete process.env.SLOT_MOVEMENT_MODE;else process.env.SLOT_MOVEMENT_MODE=before}
