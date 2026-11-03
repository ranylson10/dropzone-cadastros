// Local-only mocks and syntax/contract checks. DOES NOT certify PostgreSQL concurrency.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { fixtureLoader } from './ts-fixture-loader.mjs'
let n=0
const ok=(v,m)=>{assert.ok(v,m);n++}
const read=p=>fs.readFileSync(p,'utf8')
const sql=read('docs/sql/20261026_round11_invite_writer_candidate.sql')
const expiry=read('docs/sql/20261026_round11_scoped_expiry_candidate.sql')
const routes=[
 'web/app/api/campeonatos/[id]/convites-equipe/[tokenId]/route.ts',
 'web/app/api/campeonatos/[id]/convites-equipe/[tokenId]/renovar/route.ts',
]
for (const file of [
 'backend/src/dropzone/entities/tokens.ts',
 'backend/src/campeonatos/invites/team-invite-mutation-transport.ts',
 'backend/src/billing/lili-slot-reservation.ts',...routes,
]) {
 const parsed=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
 ok(parsed.parseDiagnostics.length===0,`Parse ${file}`)
}
for(const [name,script] of [['token',sql],['scoped cleanup',expiry]]) {
 ok(script.includes('begin;')&&script.includes('commit;'),`${name} candidate transaction`)
 ok(script.includes('security definer'),`${name} definer`)
 ok(script.includes('fn_is_service_role()'),`${name} service role gate`)
 ok(/revoke all on function[\s\S]+from public,anon,authenticated/.test(script),`${name} restrictive execute`)
 ok(script.indexOf('from public.campeonato_grupos')<script.indexOf('from public.campeonato_slots s\n      where s.id=v_target.slot_id and s.grupo_id=v_group_id for update') || (name==='token' && script.indexOf('select * into v_group from public.campeonato_grupos')<script.indexOf('select * into v_slot from public.campeonato_slots')),`${name} group lock before slot lock`)
}
ok(sql.includes('campeonato_convite_recibos'), 'replay receipts persisted')
ok(sql.includes('dz_assert_slot_permission'), 'DB ownership permission')
ok(sql.includes("'renew'"), 'renew action')
ok(sql.includes("'cancel'"), 'cancel action')
ok(sql.includes("extensions.gen_random_bytes(18)"), 'token generated within transaction')
ok(sql.includes('v_previous.resultado'), 'stable replay result')
ok(sql.includes('v_token.slot_id is distinct from v_before.slot_id'), 'revalidate token after locking')
ok(sql.includes('lili_reservas_slot r'), 'Lili reservation respected')
ok(expiry.includes('limit p_limit'), 'bounded batches')
ok(expiry.includes('status=\'expirada\''), 'expired reservation transition')
ok(expiry.includes('not exists(select 1 from public.tokens'), 'no active token release')
ok(expiry.includes('not exists(select 1 from public.lili_reservas_slot'), 'no active Lili release')
const old=process.env.DROPZONE_TEAM_INVITE_WRITE_MODE
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444']
const [actorId,campeonatoId,tokenId,requestId]=ids
function transportHarness(reply){
 const calls=[]
 const t=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:{rpc:async(name,args)=>{calls.push([name,args]);return reply(name,args)}}}})('backend/src/campeonatos/invites/team-invite-mutation-transport.ts')
 return {t,calls}
}
try{
 process.env.DROPZONE_TEAM_INVITE_WRITE_MODE='legacy'
 {const {t,calls}=transportHarness(()=>{throw Error('not called')});assert.equal(await t.tryAtomicTeamInviteMutation({actorId,campeonatoId,tokenId,requestId,action:'cancel'}),null);ok(calls.length===0,'legacy no RPC')}
 process.env.DROPZONE_TEAM_INVITE_WRITE_MODE='atomic'
 for(const action of ['renew','cancel']){
  const {t,calls}=transportHarness(async()=>({data:{ok:true,action,campeonato_id:campeonatoId,token_id:tokenId,...(action==='renew'?{convite:{token:'newToken'}}:{})},error:null}))
  const response=await t.tryAtomicTeamInviteMutation({actorId,campeonatoId,tokenId,requestId,action})
  ok(response.ok,action+' confirms')
  ok(calls.length===1&&calls[0][0]==='fn_alterar_convite_slot_r11',action+' single RPC')
  ok(calls[0][1].p_request_id===requestId,action+' stable idempotency key')
 }
 for(const [label,arg] of [
  ['missing key',{actorId,campeonatoId,tokenId,requestId:null,action:'cancel'}],
  ['bad actor',{actorId:'INVALID',campeonatoId,tokenId,requestId,action:'cancel'}],
 ]){
  const {t,calls}=transportHarness(async()=>{throw Error('should not send')})
  await assert.rejects(()=>t.tryAtomicTeamInviteMutation(arg),e=>[400,409].includes(e.status),label)
  ok(calls.length===0,label+' before write')
 }
 for(const [label,error,code] of [
  ['missing RPC',{code:'PGRST202'},503],['forbidden',{code:'42501'},403],['conflict',{code:'23505'},409],
 ]){
  const {t}=transportHarness(async()=>({data:null,error}))
  await assert.rejects(()=>t.tryAtomicTeamInviteMutation({actorId,campeonatoId,tokenId,requestId,action:'cancel'}),e=>e.status===code,label);n++
 }
 const {t}=transportHarness(async()=>({data:{ok:true,action:'cancel',token_id:'wrong',campeonato_id:campeonatoId},error:null}))
 await assert.rejects(()=>t.tryAtomicTeamInviteMutation({actorId,campeonatoId,tokenId,requestId,action:'cancel'}),e=>e.status===503);n++
}finally{if(old===undefined)delete process.env.DROPZONE_TEAM_INVITE_WRITE_MODE;else process.env.DROPZONE_TEAM_INVITE_WRITE_MODE=old}
// The generic helper must use exactly ONE conditional update and be case-sensitive.
for(const scenario of [
 {name:'valid',updated:true,status:'ativo',expired:false},
 {name:'used',updated:false,status:'usado',expired:false},
 {name:'expired',updated:false,status:'ativo',expired:true},
]){
 const calls=[]
 let selecting=false
 const chain={
  update(p){calls.push(['update',p]);return chain},
  eq(k,v){calls.push(['eq',k,v]);return chain},
  or(q){calls.push(['or',q]);return chain},
  in(k,v){calls.push(['in',k,v]);return chain},
  select(v){selecting=true;calls.push(['select',v]);return chain},
  async maybeSingle(){return {data:scenario.updated?{id:'t',token:'aBcDe',status:'usado'}:null,error:null}},
 }
 const helper=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:{from(table){ok(table==='tokens',scenario.name+' table');return chain}}}})('backend/src/dropzone/entities/tokens.ts')
 if(scenario.updated)assert.equal((await helper.consumeToken('aBcDe',['team_invite'])).token,'aBcDe')
 else await assert.rejects(()=>helper.consumeToken('aBcDe',['team_invite']),/Token inválido/)
 ok(calls.filter(x=>x[0]==='update').length===1,scenario.name+' one guarded write')
 ok(calls.some(x=>x[0]==='eq'&&x[1]==='token'&&x[2]==='aBcDe'),scenario.name+' case sensitive')
 ok(calls.some(x=>x[0]==='eq'&&x[1]==='status'&&x[2]==='ativo'),scenario.name+' status guard')
 ok(calls.some(x=>x[0]==='eq'&&x[1]==='usado'&&x[2]===false),scenario.name+' consumed guard')
 ok(calls.some(x=>x[0]==='or'&&x[1].includes('expira_em.gt.')),scenario.name+' expiry guard')
 ok(selecting,scenario.name+' returns claimed token')
}
for(const route of routes){
 const s=read(route)
 ok(s.includes('tryAtomicTeamInviteMutation'),route+' opts into atomic')
 ok(s.includes("req.headers.get('Idempotency-Key')"),route+' stable request key')
 ok(s.includes('TeamInviteMutationError'),route+' errors')
}
const cancel=read(routes[0]);const renew=read(routes[1])
ok(!cancel.includes(".update({ status: 'livre'"),'legacy cancel does not force free reserved slot')
ok(cancel.includes(".eq('status', 'ativo').eq('usado', false)"),'legacy cancel conditional')
ok(renew.indexOf(".insert(payload)")<renew.indexOf(".update({ status: 'cancelado' })"),'legacy renew creates before cancelling')
ok(renew.includes('compensationError'),'legacy renew admits uncertain compensations')
const prevCleanup=process.env.DROPZONE_LILI_CLEANUP_MODE
try {
 process.env.DROPZONE_LILI_CLEANUP_MODE='atomic'
 const calls=[]
 const mod=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:{rpc:async(name,args)=>{calls.push({name,args});return{data:0,error:null}}}}})('backend/src/billing/lili-slot-reservation.ts')
 await mod.releaseExpiredLiliReservations()
 ok(calls.length===1&&calls[0].name==='fn_lili_liberar_reservas_expiradas_r11','scoped cleanup RPC')
 ok(calls[0].args.p_limit===100,'bounded cleanup batch')
}finally {if(prevCleanup===undefined)delete process.env.DROPZONE_LILI_CLEANUP_MODE;else process.env.DROPZONE_LILI_CLEANUP_MODE=prevCleanup}
// HTTP route fixtures: the atomic path must not query the legacy REST tables.
for (const [route,method,action] of [
  [routes[0],'DELETE','cancel'],[routes[1],'POST','renew'],
]) {
  const requests=[]
  const fakeNext = { NextResponse: { json(payload, opts = {}) {
    return { payload, status: opts.status || 200 }
  } } }
  const overrides={
    'next/server':fakeNext,
    '@backend/auth/server-auth':{getBearerUser:async()=>({id:actorId})},
    '@backend/campeonatos/campeonato-permissions':{requireCampeonatoTokenPermission:async()=>{}},
    '@backend/shared/supabase-admin':{supabaseAdmin:{from(){throw new Error('legacy query forbidden in atomic mode')}}},
    '@backend/campeonatos/invites/team-invite-mutation-transport':{
      TeamInviteMutationError:class TeamInviteMutationError extends Error { constructor(message,status=503){super(message);this.status=status} },
      tryAtomicTeamInviteMutation:async input=>{
        requests.push(input)
        return {ok:true,action,campeonato_id:campeonatoId,token_id:tokenId,
          ...(action==='renew'?{convite:{token:'freshToken'}}:{})}
      },
    },
  }
  const handler=fixtureLoader(overrides)(route)
  const req={headers:{get:k=>k==='Idempotency-Key'?requestId:null},nextUrl:{origin:'https://dropzone.example'}}
  const res=await handler[method](req,{params:Promise.resolve({id:campeonatoId,tokenId})})
  ok(res.status===200,`${action} HTTP success`)
  ok(requests.length===1&&requests[0].action===action,`${action} one atomic dispatch`)
  ok(requests[0].requestId===requestId,`${action} stable key delivered`)
  if(action==='renew')ok(res.payload.link.endsWith('/freshToken'),'renew URL uses new token')
}
// Client generates a UUID once per (campeonato, token, action) and retries with SAME ID.
{
  const oldFetch=globalThis.fetch
  const calls=[]
  globalThis.fetch=async(url,opts)=>{
    calls.push({url,opts})
    return {ok:true,async json(){return {ok:true}}}
  }
  try{
    const ui=fixtureLoader({
      '@/lib/supabase-browser':{supabase:{auth:{getSession:async()=>({data:{session:{access_token:'mock'}}})}}},
      '@/lib/participation-write':{writeParticipation:async()=>({})},
    })('web/features/campeonatos/equipes/services/campeonato-equipes.service.ts')
    await ui.campeonatoEquipesService.cancelarConvite(campeonatoId,tokenId)
    await ui.campeonatoEquipesService.cancelarConvite(campeonatoId,tokenId)
    await ui.campeonatoEquipesService.renovarConvite(campeonatoId,tokenId)
    ok(calls.length===3,'client mutations dispatched')
    const keys=calls.map(c=>c.opts.headers['Idempotency-Key'])
    ok(keys[0]===keys[1],'retry cancellation preserves UUID')
    ok(keys[0]!==keys[2],'different actions use distinct UUIDs')
    ok(keys.every(k=>/^[0-9a-f-]{36}$/i.test(k)),'client UUID format')
  }finally{globalThis.fetch=oldFetch}
}
console.log('R11: '+n+' checks passed (local mocks/static; NOT a PostgreSQL concurrency certification).')
