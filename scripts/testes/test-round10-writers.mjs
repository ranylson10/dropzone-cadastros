// R10 checks are LOCAL mocks and SQL contract checks, NOT PostgreSQL concurrency tests.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { fixtureLoader } from './ts-fixture-loader.mjs'
const read=p=>fs.readFileSync(p,'utf8')
let checks=0
const ok=(condition,message)=>{assert.ok(condition,message);checks++}
const lili=read('docs/sql/20261026_round10_lili_writer_candidate.sql')
const blocks=read('docs/sql/20261026_round10_block_writer_candidate.sql')
const admin=read('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')
const client=read('web/features/campeonatos/estrutura-avancada/AdvancedStructureTab.tsx')
const reserve=read('backend/src/billing/lili-slot-reservation.ts')
for(const [name,sql] of [['lili',lili],['block',blocks]]){
 ok(/begin;/i.test(sql)&&/commit;/i.test(sql),name+' candidate is transactional')
 ok(/set search_path\s*=\s*pg_catalog/i.test(sql),name+' safe search path')
 ok(/fn_is_service_role\(\)/.test(sql),name+' service role gate')
 ok(/revoke all on function[\s\S]+from public,anon,authenticated/i.test(sql),name+' no client EXECUTE')
 ok(/for update;/.test(sql),name+' locks parent')
}
ok(lili.indexOf('from public.campeonato_grupos')<lili.indexOf('from public.campeonato_slots\n'), 'Lili group before slot')
ok(lili.includes('campeonato_grupo_escolha_bloqueios'), 'Lili checks admin blocks')
ok(lili.includes("v_slot.status='reservado' and not found and v_expired_count=0"), 'Lili accepts own just-expired reservation but rejects other reserved slots')
ok(lili.includes('get diagnostics v_expired_count = row_count'), 'Lili records scoped expiry before reserved check')
ok(lili.includes("t.tipo in ('team_invite','convite_equipe_campeonato')"), 'Lili checks invitation')
ok(!lili.includes("where status='ativa' and expira_em <= now()"), 'Lili no global expired reservation UPDATE')
ok(blocks.indexOf('from public.campeonato_grupos')<blocks.indexOf('from public.campeonato_slots\n     where id=v_slot_id'), 'admin blocks lock group first')
ok(blocks.includes('campeonato_bloqueio_recibos'), 'idempotency receipt persisted')
ok(blocks.includes('dz_assert_slot_permission'), 'authorization DB check')
ok(blocks.includes('p_request_id uuid'), 'stable request id')
ok(admin.includes('tryAtomicGroupBlock('), 'route dispatches to RPC mode')
ok(client.includes("'Idempotency-Key': requestId"), 'client forwards stable key')
ok(client.includes('pendingBlockKeys.current.get(operationKey)'), 'client reuses request key')
ok(client.indexOf("next=isBlock&&(result as Row).operation_confirmed ? await request('GET') : result") < client.indexOf("pendingBlockKeys.current.delete(JSON.stringify([resource,body]))"), 'block key released only after reloading successfully')
ok(reserve.includes(".eq('status', 'ativa')")&&reserve.includes(".gt('expira_em', now)"), 'reservation confirmations conditional')
const files=[
 'backend/src/campeonatos/group-block-transport.ts',
 'backend/src/billing/lili-slot-reservation.ts',
 'web/app/api/campeonatos/[id]/estrutura-avancada/route.ts',
 'web/features/campeonatos/estrutura-avancada/AdvancedStructureTab.tsx',
]
for(const file of files){ const kind=file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS;const src=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,kind)
 ok(src.parseDiagnostics.length===0,`Parsing ${file}: ${src.parseDiagnostics.map(x=>x.messageText).join(',')}`)}
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333',d='44444444-4444-4444-8444-444444444444'
const originalMode=process.env.DROPZONE_GROUP_BLOCK_WRITE_MODE
function harness(reply){const state={calls:[]};const transport=fixtureLoader({
 '@backend/shared/supabase-admin':{supabaseAdmin:{rpc:async(name,args)=>{state.calls.push({name,args});return reply(args)}}},
 '@backend/campeonatos/slot-transfer':{SlotTransferError:class SlotTransferError extends Error{constructor(message,status=400,uncertain=false){super(message);this.status=status;this.uncertain=uncertain}}},
})('backend/src/campeonatos/group-block-transport.ts');return{state,transport}}
try{
 process.env.DROPZONE_GROUP_BLOCK_WRITE_MODE='legacy'
 {const {state,transport}=harness(()=>{throw Error('should not call')});assert.equal(await transport.tryAtomicGroupBlock(a,b,{action:'set_group_choice_block'},c),null);ok(!state.calls.length,'legacy does not issue RPC')}
 process.env.DROPZONE_GROUP_BLOCK_WRITE_MODE='atomic'
 const argsBlock={action:'set_group_choice_block',phase_id:c,group_id:d,reason:'X'}
 {const {state,transport}=harness(async args=>({data:{ok:true,campeonato_id:b,action:'block',block_id:d,ativo:true},error:null}));const result=await transport.tryAtomicGroupBlock(a,b,argsBlock,c)
  ok(result.operation_confirmed===true,'block confirmed');ok(state.calls.length===1,'one RPC');ok(state.calls[0].args.p_request_id===c,'preserves idempotency');ok(state.calls[0].args.p_slot_id===null,'no slot passed for group')}
 {const {state,transport}=harness(async args=>({data:{ok:true,campeonato_id:b,action:'unblock',block_id:d,ativo:false,repetida:true},error:null}));const result=await transport.tryAtomicGroupBlock(a,b,{action:'remove_group_choice_block',block_id:d},c);ok(result.repetida,'retry result');ok(state.calls.length===1,'single unblock RPC')}
 for(const [label,body,key] of [
  ['missing key',argsBlock,null],['invalid phase',{action:'set_group_choice_block',phase_id:'bad',group_id:d},c],
  ['both selectors',{action:'set_group_choice_block',phase_id:c,group_id:d,slot_id:d},c],
  ['neither selector',{action:'set_group_choice_block',phase_id:c},c],
  ['unblock bad ID',{action:'remove_group_choice_block',block_id:'bad'},c],
 ]){const {state,transport}=harness(async()=>({data:null}));await assert.rejects(()=>transport.tryAtomicGroupBlock(a,b,body,key),undefined,label);ok(state.calls.length===0,label+' rejects before RPC')}
 for(const [label,error,status] of [
  ['missing RPC',{code:'PGRST202'},503],['conflict',{code:'23505'},409],['permission',{code:'42501'},403],
  ['uncertain',{code:'ZZ999'},503]]){const {transport}=harness(async()=>({error}));await assert.rejects(()=>transport.tryAtomicGroupBlock(a,b,argsBlock,c),e=>e.status===status,label);checks++}
 {const {transport}=harness(async()=>({data:{ok:true,campeonato_id:b,action:'block',block_id:d,ativo:false}}));await assert.rejects(()=>transport.tryAtomicGroupBlock(a,b,argsBlock,c),e=>e.status===503);checks++}
}finally{if(originalMode===undefined)delete process.env.DROPZONE_GROUP_BLOCK_WRITE_MODE;else process.env.DROPZONE_GROUP_BLOCK_WRITE_MODE=originalMode}
// Test payment confirmation under mocked PostgreSQL conditional UPDATE.
for(const [scenario,updateMatch,previousStatus,expectedError] of [
  ['fresh confirmation',true,null,false],
  ['replayed webhook',false,'confirmada',false],
  ['expired reservation',false,'expirada',true],
  ['cancelled reservation',false,'cancelada',true],
  ['missing reservation',false,null,true],
]){
  const operations=[]
  const reserveService=fixtureLoader({
    '@backend/shared/supabase-admin':{supabaseAdmin:{from(table){
      ok(table==='lili_reservas_slot',scenario+' table')
      let mode='lookup'
      const chain={
        update(patch){operations.push(['update',patch]);mode='update';return chain},
        select(cols){operations.push(['select',cols]);return chain},
        eq(col,val){operations.push(['eq',col,val]);return chain},
        gt(col,val){operations.push(['gt',col,val]);return chain},
        async maybeSingle(){return {data:mode==='update'?(updateMatch?{id:d}:null)
          :previousStatus?{status:previousStatus}:null,error:null}},
      }
      return chain
    }}},
  })('backend/src/billing/lili-slot-reservation.ts')
  if(expectedError)await assert.rejects(()=>reserveService.confirmLiliReservation(d),/Reserva expirada/)
  else await reserveService.confirmLiliReservation(d)
  ok(operations.some(x=>x[0]==='eq'&&x[1]==='status'&&x[2]==='ativa'),scenario+' conditional status')
  ok(operations.some(x=>x[0]==='gt'&&x[1]==='expira_em'),scenario+' conditional time')
  ok(operations.filter(x=>x[0]==='update').length===1,scenario+' no duplicate update')
}

// Lili transport never calls legacy global cleanup in atomic mode.
for(const [mode,expectedCalls] of [
  ['atomic',['fn_lili_reservar_slot_r10']],
  ['legacy',['fn_lili_liberar_reservas_expiradas','fn_lili_reservar_slot']],
]){
  const before=process.env.DROPZONE_LILI_RESERVATION_MODE
  process.env.DROPZONE_LILI_RESERVATION_MODE=mode
  try{
    const calls=[]
    const svc=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:{
      rpc:async(name)=>{calls.push(name);return {data:{ok:true},error:null}},
    }}})('backend/src/billing/lili-slot-reservation.ts')
    await svc.reserveSlotForLili({campeonatoId:b,grupoId:c,slotId:d,authUserId:a,equipeId:a,metodo:'pix'})
    ok(JSON.stringify(calls)===JSON.stringify(expectedCalls),'Lili '+mode+' routing')
  }finally{if(before===undefined)delete process.env.DROPZONE_LILI_RESERVATION_MODE;else process.env.DROPZONE_LILI_RESERVATION_MODE=before}
}
{
 const before=process.env.DROPZONE_LILI_RESERVATION_MODE
 process.env.DROPZONE_LILI_RESERVATION_MODE='atomic'
 try{
  const calls=[]
  const svc=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:{rpc:async(name)=>{
   calls.push(name);return {data:null,error:{code:'PGRST202',message:'not found'}}
  }}}})('backend/src/billing/lili-slot-reservation.ts')
  await assert.rejects(()=>svc.reserveSlotForLili({campeonatoId:b,grupoId:c,slotId:d,authUserId:a,equipeId:a,metodo:'pix'}))
  ok(JSON.stringify(calls)===JSON.stringify(['fn_lili_reservar_slot_r10']),'Missing Lili RPC must not fall back to legacy')
 }finally{if(before===undefined)delete process.env.DROPZONE_LILI_RESERVATION_MODE;else process.env.DROPZONE_LILI_RESERVATION_MODE=before}
}
// HTTP fixture: opt-in without SQL MUST fail with 503, no legacy table writes.
{
  const dbState={writes:0}
  const {SlotTransferError}=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:{}}})('backend/src/campeonatos/slot-transfer.ts')
  const routes=fixtureLoader({
    '@backend/shared/supabase-admin':{supabaseAdmin:{from(){dbState.writes++;throw new Error('unexpected legacy DB access')}}},
    '@backend/auth/server-auth':{getBearerUser:async()=>({id:a})},
    '@backend/campeonatos/campeonato-permissions':{getCampeonatoPermission:async()=>({canManage:true,canView:true,role:'owner'}),permissionPublicPayload:()=>({})},
    '@backend/campeonatos/lifecycle-safety':{assertLifecycleActionSafe:()=>{}},
    '@backend/campeonatos/lifecycle-transport':{tryAtomicLifecycle:async()=>null,lifecycleMode:()=> 'legacy'},
    '@backend/campeonatos/edition-transport':{tryAtomicEdition:async()=>null,editionWriteMode:()=> 'legacy'},
    '@backend/campeonatos/daily-group-transport':{tryAtomicDailyGroup:async()=>null,dailyGroupWriteMode:()=> 'legacy'},
    '@backend/campeonatos/progression-transport':{tryAtomicProgression:async()=>null,progressionWriteMode:()=> 'legacy'},
    '@backend/campeonatos/group-choice-transport':{tryAtomicGroupChoice:async()=>null},
    '@backend/campeonatos/group-block-transport':{tryAtomicGroupBlock:async()=>{throw new SlotTransferError('Bloqueios temporariamente indisponíveis.',503)}},
    '@backend/campeonatos/slot-transfer':{SlotTransferError,slotTransferErrorResponse:e=>e instanceof SlotTransferError?{status:e.status,body:{error:e.message}}:null},
    '@backend/campeonatos/structure-scope':{assertStructureActionScope:async()=>{}},
    '@backend/campeonatos/structure-delete':{deleteScopedStructureRow:async()=>{}},
    '@backend/campeonatos/advanced-structure-read':{loadAdvancedStructure:async()=>({})},
    '@backend/campeonatos/progression-preview':{buildProgressionPreview:async()=>({})},
    'next/server':{NextResponse:{json:(body,options)=>new Response(JSON.stringify(body),options)}},
  })('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')
  for(const action of ['set_group_choice_block','remove_group_choice_block']){
    const request=new Request('https://fixture.invalid/advanced',{method:'POST',headers:{Authorization:'Bearer mock','Content-Type':'application/json','Idempotency-Key':c},body:JSON.stringify({action,phase_id:c,group_id:d,block_id:d})})
    const resp=await routes.POST(request,{params:Promise.resolve({id:b})})
    ok(resp.status===503,action+' no dangerous fallback')
    ok(resp.headers.get('Cache-Control')==='no-store',action+' no cache')
  }
  ok(dbState.writes===0,'no database mutations when SQL RPC missing')
}
console.log(`R10: ${checks} local structural/transport checks passed; real PostgreSQL concurrency NOT tested.`)
