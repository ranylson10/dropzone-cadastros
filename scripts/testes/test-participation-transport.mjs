import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {fixtureLoader} from './ts-fixture-loader.mjs'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const expected={equipe_id:id(5),line_id:id(6),slot_id:null,status:'pendente',updated_at:'2026-10-11T13:00:00.123456+00:00'}
const forms=[['POST',{equipe_id:id(5),line_id:id(6),slot_id:id(7)},'add'],['POST',{mode:'request',equipe_id:id(5),line_id:id(6)},'request'],
 ['PATCH',{mode:'review_request',action:'approve',participacao_id:id(8),slot_id:id(7),expected},'approve'],
 ['PATCH',{mode:'review_request',action:'reject',participacao_id:id(8),motivo:'Revisar elenco',expected},'reject'],
 ['DELETE',{expected:{...expected,status:'ativo',slot_id:id(7)}},'remove']]
let calls=[],fault=null,auth=true,commits=0,legacy=false,permission={role:'seller',canManage:false,canRemove:true},rawRemove={remover_proprias_equipes:true},creator=id(3),removed=0,configReads=0,configMode='open',accountsRead=0
const receipts=new Map()
const result=args=>({ok:true,campeonato_id:args.p_campeonato_id,action:args.p_action,
  participacao:{id:args.p_args.participacao_id||id(8),campeonato_id:args.p_campeonato_id,equipe_id:args.p_args.equipe_id||args.p_args.expected.equipe_id,
    line_id:args.p_args.line_id||args.p_args.expected?.line_id||id(6),status:args.p_action==='request'?'pendente':args.p_action==='reject'?'rejeitado':args.p_action==='remove'?'removido':'ativo',
    slot_id:['add','approve'].includes(args.p_action)?args.p_args.slot_id:null,grupo_id:['add','approve'].includes(args.p_action)?id(9):null,
    slot_numero:['add','approve'].includes(args.p_action)?1:null,updated_at:expected.updated_at,motivo_rejeicao:args.p_args.motivo||null},
  line:['add','request','approve'].includes(args.p_action)?{id:args.p_args.line_id||args.p_args.expected?.line_id||id(6),nome:'Fixture line',criada_agora:false}:null})
const admin=createClient('https://participation-fixture.supabase.co','fixture',{auth:{persistSession:false},global:{fetch:async(input,options)=>{
  const url=new URL(input);calls.push({url:url.pathname,method:options.method||'GET',args:options.body?JSON.parse(options.body):null,params:url.searchParams})
  if(legacy){const name=url.pathname.split('/').at(-1)
    if(name==='campeonatos')return Response.json({id:id(2),nome:'Public fixture',tipo:'comum',aprovacao_status:configMode==='hidden'?'pendente':'aprovado',status:configMode==='banned'?'banido':'ativo'})
    if(name==='tokens')return Response.json([{id:id(99),status:'ativo',usado:false,slot_id:id(7),expira_em:'2020-01-01'}])
    if(name==='campeonato_vendedores')return Response.json({id:id(90),permissoes:rawRemove})
    if(name==='campeonato_configuracoes'){configReads++;if(configMode==='error')return Response.json({code:'XX000',message:'PRIVATE config failure'},{status:500})
      return Response.json({aceita_novas_inscricoes_equipes:!(configMode==='closed'||(configMode==='late-close'&&configReads===2)),data_limite_inscricao:configMode==='invalid'?'invalid':configMode==='past'?'2020-01-01':null})}
    if(name==='equipe_lines')return Response.json({id:id(6),equipe_id:id(5),nome:'Line',status:'ativo'})
    if(name==='campeonato_equipes'&&url.searchParams.has('status'))return Response.json(null)
    if(name==='campeonato_equipes')return Response.json({id:id(8),campeonato_id:id(2),equipe_id:id(5),line_id:id(6),slot_id:id(7),grupo_id:id(9),slot_numero:1,criado_por:creator,origem_entrada:'vendedor'})
    throw Error('Unexpected legacy request '+url)
  }
  assert.equal(url.pathname,'/rest/v1/rpc/fn_gravar_participacao_atomica','No legacy pre-read/writes in atomic')
  const args=JSON.parse(options.body)
  if(fault&&fault!=='lost')return Response.json(fault.success||fault,{status:fault.success?200:400})
  const key=args.p_actor_id+':'+args.p_request_id,identity=JSON.stringify(args),saved=receipts.get(key)
  if(saved)return saved.identity===identity?Response.json({...saved.data,repetida:true}):Response.json({code:'23505',message:'Chave de repetição vinculada a outra participação.',details:'PRIVATE'},{status:400})
  const data=result(args);receipts.set(key,{identity,data});commits++
  if(fault==='lost'){fault=null;throw Error('PRIVATE lost response after commit')}
  return Response.json(data)
}}})
const load=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:admin},
 '@backend/auth/server-auth':{getBearerUser:async()=>{if(!auth)throw Error('Sessão inválida');return {id:id(1)}},getAccountsForUser:async()=>{accountsRead++;return [{id:id(5),profile_type:'equipe'}]}},
 '@backend/campeonatos/campeonato-permissions':{getCampeonatoPermission:async()=>{if(!legacy)throw Error('Must defer to locked RPC permission');return permission},permissionPublicPayload:p=>p},
 '@backend/campeonatos/participacao-sync':{softRemoveParticipacao:async()=>{removed++},listSlotsLinesView:async()=>({source:'view',rows:[{slot_id:id(7),grupo_id:id(9),slot_numero:1,slot_status:'reservado'}]})},
 '@backend/campeonatos/capacidade':{getCampeonatoCapacidade:async()=>({})}})
const routes=load('web/app/api/campeonatos/[id]/equipes/route.ts'),api=load('backend/src/campeonatos/participation-transport.ts')
const before=process.env.PARTICIPATION_WRITE_MODE,slotBefore=process.env.SLOT_MOVEMENT_MODE
const reset=()=>{calls=[];fault=null;auth=true;commits=0;legacy=false;removed=0;configReads=0;configMode='open';accountsRead=0;receipts.clear()}
const request=(method,body,key=id(98))=>{const req=new Request('https://fixture.invalid/api?participacao_id='+id(8),{method,headers:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify(body)});req.nextUrl=new URL(req.url);return routes[method](req,{params:Promise.resolve({id:id(2)})})}
let cases=0
try {
  delete process.env.PARTICIPATION_WRITE_MODE;assert.equal(await api.tryAtomicParticipation(id(1),id(2),'POST',{},null),null);assert.equal(calls.length,0);cases++
  process.env.PARTICIPATION_WRITE_MODE='typo';await assert.rejects(()=>api.tryAtomicParticipation(id(1),id(2),'POST',{},id(98)),e=>e.status===503);cases++
  process.env.PARTICIPATION_WRITE_MODE='atomic';process.env.SLOT_MOVEMENT_MODE='legacy'
  for(const [method,body,action] of forms){reset();const out=await request(method,{...body,actor_id:id(999),permission:'owner',p_action:'remove',request_key:id(999)})
    assert.equal(out.status,200);assert.equal(out.headers.get('cache-control'),'no-store');assert.equal((await out.json()).operation_confirmed,true)
    assert.equal(calls.length,1);assert.equal(calls[0].args.p_actor_id,id(1));assert.equal(calls[0].args.p_request_id,id(98));assert.equal(calls[0].args.p_action,action);assert.equal(Object.keys(calls[0].args).length,5);cases++
    const again=await request(method,body);assert.equal((await again.json()).repetida,true);assert.equal(commits,1);cases++
    reset();fault='lost';const lost=await request(method,body);assert.equal(lost.status,503);assert.equal((await lost.json()).resultado_incerto,true);assert.equal(commits,1)
    const replay=await request(method,body);assert.equal(replay.status,200);assert.equal((await replay.json()).repetida,true);assert.equal(commits,1);cases++
  }
  const [method,valid]=forms[2]
  for(const invalid of [null,[],{}, {...valid,action:'other'},{...valid,expected:null},{...valid,expected:{}},
    ...[{...expected,slot_id:undefined},{...expected,status:'ativo'},{...expected,status:'other'},
      {...expected,equipe_id:null},{...expected,line_id:[]},{...expected,updated_at:'invalid'},{...expected,updated_at:'2026-10-11T13:00:00.1234567Z'}].map(expected=>({...valid,expected})),
    {...valid,slot_id:null},{...valid,participacao_id:{}}]){
    reset();const out=await request(method,invalid);assert.ok(out.status>=400);assert.equal(calls.length,0);cases++
  }
  for(const data of [{equipe_id:id(5),slot_id:id(7)},{equipe_id:id(5),slot_id:id(7),nome_line:99},{equipe_id:id(5),slot_id:id(7),nome_line:'x'.repeat(121)},
    {mode:'request',equipe_id:id(5),line_id:null},{mode:'unexpected'}, {mode:'apply_league_season_suggestions'}]){reset();assert.ok((await request('POST',data)).status>=400);assert.equal(calls.length,0);cases++}
  for(const key of [null,'invalid',id(98)+','+id(99)]){reset();assert.equal((await request('POST',forms[0][1],key)).status,400);assert.equal(calls.length,0);cases++}
  for(const error of [{code:'42501',message:'O vendedor só pode remover equipes que ele adicionou.',status:403},{code:'40001',message:'A participação mudou. Atualize o acompanhamento.',status:409},
    {code:'23505',message:'Limite de vagas do vendedor atingido.',status:409},{code:'42501',message:'Sem permissão para alterar inscrições.',status:403},
    {code:'40P01',message:'PRIVATE deadlock',status:409},{code:'55P03',message:'PRIVATE timeout',status:409},{code:'PGRST202',message:'PRIVATE missing function',status:503},
    {code:'XX000',message:'PRIVATE arbitrary',status:503},{code:'42501',message:'PRIVATE arbitrary',status:503}]){
    reset();fault=error;const out=await request('POST',forms[0][1]);assert.equal(out.status,error.status);assert.equal(out.headers.get('cache-control'),'no-store');assert.ok(!JSON.stringify(await out.json()).includes('PRIVATE'));assert.equal(calls.length,1);cases++
  }
  const good=result({p_campeonato_id:id(2),p_action:'approve',p_args:{participacao_id:id(8),slot_id:id(7),expected}})
  for(const bad of [data=>({...data,action:'remove'}),data=>({...data,campeonato_id:id(99)}),
    ...['id','campeonato_id','equipe_id','line_id','status','slot_id','grupo_id','slot_numero','updated_at'].map(field=>data=>({...data,participacao:{...data.participacao,[field]:field==='status'?'removido':field==='slot_numero'?0:field==='updated_at'||field==='grupo_id'?'invalid':id(99)}})),
    data=>({...data,line:{id:id(99),nome:'Line',criada_agora:false}}),data=>({...data,line:null})]){
    reset();fault={success:bad(structuredClone(good))};const out=await request('PATCH',forms[2][1]);assert.equal(out.status,503);assert.equal((await out.json()).resultado_incerto,true);cases++
  }
  reset();fault={success:{...good,private_note:'PRIVATE',participacao:{...good.participacao,private_note:'PRIVATE',criado_por:id(999)}}};const clean=await request('PATCH',forms[2][1]);assert.equal(clean.status,200);assert.ok(!JSON.stringify(await clean.json()).includes('PRIVATE'));cases++
  for(const method of ['POST','PATCH','DELETE']){reset();auth=false;let parsed=false;const req={headers:new Headers(),json:async()=>{parsed=true;return {}}};assert.equal((await routes[method](req,{params:Promise.resolve({id:id(2)})})).status,400);assert.equal(parsed,false);assert.equal(calls.length,0);cases++}
  process.env.PARTICIPATION_WRITE_MODE='legacy'
  reset();legacy=true;auth=false;const req=new Request('https://fixture.invalid/api');req.nextUrl=new URL(req.url)
  const publicGet=await routes.GET(req,{params:Promise.resolve({id:id(2)})});assert.equal(publicGet.status,200,JSON.stringify(await publicGet.json()));assert.equal(publicGet.headers.get('cache-control'),'no-store');assert.ok(calls.every(row=>row.method==='GET'));assert.ok(calls.some(row=>row.url.endsWith('/tokens')));cases++
  for(const mode of ['hidden','banned']){reset();legacy=true;auth=false;configMode=mode;assert.equal((await routes.GET(req,{params:Promise.resolve({id:id(2)})})).status,400);assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('/campeonatos'));cases++}
  // Baseline's absent full-removal flag incorrectly enlarged the own-only permission.
  assert.equal(rawRemove.remover_equipes===true||rawRemove.remover_equipes===undefined,true);cases++
  for(const own of [false,true]){reset();legacy=true;creator=own?id(1):id(3);rawRemove={remover_proprias_equipes:true};permission={role:'seller',canManage:false,canRemove:true,sellerRowId:id(90)};const out=await request('DELETE',{});assert.equal(out.status,own?200:400);assert.equal(removed,own?1:0);cases++}
  const sellerQuery=calls.find(row=>row.url.endsWith('/campeonato_vendedores'));assert.equal(sellerQuery.params.get('id'),'eq.'+id(90));assert.equal(sellerQuery.params.get('manager.auth_user_id'),'eq.'+id(1));assert.equal(sellerQuery.params.get('manager.status'),'eq.ativo');cases++
  reset();legacy=true;permission={role:'seller',canManage:false,canRemove:true,sellerRowId:null};assert.equal((await request('DELETE',{})).status,400);assert.equal(removed,0);assert.ok(!calls.some(row=>row.url.endsWith('/campeonato_vendedores')));cases++
  reset();legacy=true;creator=id(3);permission={role:'workspace',canManage:true,canRemove:true};assert.equal((await request('DELETE',{})).status,200);assert.equal(removed,1);cases++
  for(const mode of ['error','invalid','past','closed','late-close','hidden','banned']){reset();legacy=true;configMode=mode;const out=await request('POST',forms[1][1]);assert.equal(out.status,400);assert.ok(!JSON.stringify(await out.json()).includes('PRIVATE'));assert.ok(calls.every(row=>row.method==='GET'));assert.equal(accountsRead,mode==='late-close'?1:0);if(mode==='late-close')assert.equal(configReads,2);cases++}
  console.log(`Participation transport passed: ${cases}`)
}finally{if(before===undefined)delete process.env.PARTICIPATION_WRITE_MODE;else process.env.PARTICIPATION_WRITE_MODE=before;if(slotBefore===undefined)delete process.env.SLOT_MOVEMENT_MODE;else process.env.SLOT_MOVEMENT_MODE=slotBefore}
