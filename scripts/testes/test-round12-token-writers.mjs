// R12: deterministic mocks only. Does not prove two-session PostgreSQL serializability.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { fixtureLoader } from './ts-fixture-loader.mjs'
let checks = 0
const ok = (value, message) => { assert.ok(value, message); checks++ }
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++ }
const read = (path) => fs.readFileSync(path, 'utf8')
const helperFile = 'backend/src/campeonatos/invites/one-time-claims.ts'
const playerRoute = 'web/app/api/equipes/convites-elenco/[token]/route.ts'
const sellerRoute = 'web/app/api/vendedores/convite/[token]/route.ts'
const adminRoute = 'web/app/api/equipes/convites-elenco/route.ts'
const lili = 'backend/src/lili/tools/invites.ts'
for (const file of [helperFile, playerRoute, sellerRoute, adminRoute, lili]) {
 const parsed = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true)
 eq(parsed.parseDiagnostics.length, 0, `R12 syntax ${file}`)
}
const now = new Date().toISOString()
function inviteHarness({kind='player',write=true,prior=null,err=null}={}) {
 const calls=[]
 const state = { tokenRow: prior || null }
 const db={from(table) {
  eq(table,'tokens','only tokens table')
  let updating = false
  const q={
   update(fields){calls.push(['update',fields]);updating=true;return q},
   select(fields){calls.push(['select',fields]);return q},
   eq(key,value){calls.push(['eq',key,value]);return q},
   in(key,values){calls.push(['in',key,values]);return q},
   or(condition){calls.push(['or',condition]);return q},
   maybeSingle(){return Promise.resolve({data:updating?(write?{id:'token-1'}:null):state.tokenRow,error:err})},
  }
  return q
 }}
 const m = fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:db}})(helperFile)
 return {m,calls}
}
const player = {id:'token-1',tipo:'convite_jogador_equipe',status:'ativo',usado:false,expira_em:null}
const manager = {id:'token-1',tipo:'manager_invite',status:'ativo',usado:false,expira_em:null}
{
 const {m,calls}=inviteHarness();eq(await m.claimPlayerRosterInvite(player,'player-A'),{replay:false},'player claimed');
 ok(calls.some(c=>c[0]==='eq'&&c[1]==='usado'&&c[2]===false),'player one-time');
 ok(calls.some(c=>c[0]==='eq'&&c[1]==='tipo'&&c[2]==='convite_jogador_equipe'),'player kind guarded');
 ok(calls.some(c=>c[0]==='or'&&c[1].includes('expira_em.gt.')),'player expires guarded');
}
{
 const {m,calls}=inviteHarness({write:false,prior:{status:'usado',usado:true,jogador_id:'player-A',usado_em:now}})
 eq(await m.claimPlayerRosterInvite(player,'player-A'),{replay:true},'player recover after losing race to self')
 ok(calls.some(c=>c[0]==='select'&&c[1]==='status,usado,jogador_id,usado_em'),'replay reloads owner')
}
for(const [name,prior] of [
 ['other player',{status:'usado',usado:true,jogador_id:'player-B',usado_em:now}],
 ['cancelled',{status:'cancelado',usado:false}],
 ['no owner',{status:'usado',usado:true,jogador_id:null,usado_em:now}],
 ['stale',{status:'usado',usado:true,jogador_id:'player-A',usado_em:'2020-01-01T00:00:00.000Z'}],
]){
 const {m}=inviteHarness({write:false,prior})
 await assert.rejects(()=>m.claimPlayerRosterInvite(player,'player-A'),m.InvitationClaimError,name);checks++
}
for(const [name,invite] of [
 ['expired',{...player,expira_em:'2020-01-01T00:00:00.000Z'}],
 ['cancelled',{...player,status:'cancelado'}],
 ['used by another',{...player,status:'usado',usado:true,jogador_id:'player-B',usado_em:now}],
 ['stale replay',{...player,status:'usado',usado:true,jogador_id:'player-A',usado_em:'2020-01-01T00:00:00.000Z'}],
]){
 const {m,calls}=inviteHarness()
 await assert.rejects(()=>m.claimPlayerRosterInvite(invite,'player-A'),m.InvitationClaimError,name)
 ok(!calls.some(c=>c[0]==='update'),`${name}: zero writes`)
}
{
 const {m}=inviteHarness();eq(await m.claimSellerInvite(manager,'manager-A'),{replay:false},'seller claim')
}
{
 const {m}=inviteHarness({write:false,prior:{status:'ativo',usado:true,manager_id:'manager-A'}})
 eq(await m.claimSellerInvite(manager,'manager-A'),{replay:true},'seller resumes after racing with same owner')
}
for (const [name,prior] of [
 ['other manager',{status:'ativo',usado:true,manager_id:'manager-B'}],
 ['cancelled',{status:'cancelado',usado:false}],
]){
 const {m}=inviteHarness({write:false,prior})
 await assert.rejects(()=>m.claimSellerInvite(manager,'manager-A'),m.InvitationClaimError,name);checks++
}
for (const [name,invite] of [
 ['seller expired',{...manager,expira_em:'2020-01-01T00:00:00.000Z'}],
 ['seller another',{...manager,usado:true,manager_id:'manager-B'}],
 ['seller cancelled',{...manager,status:'cancelado'}],
]){
 const {m,calls}=inviteHarness()
 await assert.rejects(()=>m.claimSellerInvite(invite,'manager-A'),m.InvitationClaimError,name)
 ok(!calls.some(c=>c[0]==='update'),`${name} no writes`)
}
{
 const {m,calls}=inviteHarness()
 eq(await m.claimSellerInvite({...manager,usado:true,manager_id:'manager-A'},'manager-A'),{replay:true},'seller replay by owner')
 ok(calls.length===0,'seller owned replay no token mutation')
}
// Two callers simulating a single guarded PostgreSQL UPDATE: only one recipient
// may claim the row. (Still not a real database transaction/lock test.)
for (const kind of ['player','seller']) {
 const current={id:'token-1',status:'ativo',usado:false,manager_id:null,jogador_id:null,expira_em:null}
 const calls=[]
 const db={from(table){
  eq(table,'tokens','simulated contention target')
  let isWrite=false,fields={},constraints=[];
  const chain={
   update(payload){isWrite=true;fields=payload;return chain},
   select(){return chain},
   eq(k,v){constraints.push([k,v]);return chain},in(){return chain},or(){return chain},
   async maybeSingle(){
    if(isWrite){
     const allowed=constraints.every(([k,v])=>k==='id'||k==='tipo'||current[k]===v)
     if(!allowed)return {data:null,error:null}
     Object.assign(current,fields)
     calls.push({kind,fields});return {data:{id:current.id},error:null}
    }
    return {data:{...current},error:null}
   },
  };return chain;
 }}
 const m=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:db}})(helperFile)
 const invite=kind==='player'?player:manager
 const fn=kind==='player'?m.claimPlayerRosterInvite:m.claimSellerInvite
 const [winner,loser]=await Promise.allSettled([fn(invite,'recipient-A'),fn(invite,'recipient-B')])
 eq(winner.status,'fulfilled',`${kind} contender A wins`)
 eq(loser.status,'rejected',`${kind} contender B loses`)
 eq(calls.length,1,`${kind} only one UPDATE commits`)
}
function playerRouteHarness({alreadyUsed=false,owner='player-A',updated=true}={}){
 const calls=[]
 const stamp=new Date().toISOString()
 const item={id:'token-1',equipe_id:'team',line_id:null,campeonato_equipe_id:null,status:alreadyUsed?'usado':'ativo',usado:alreadyUsed,usado_em:stamp,jogador_id:alreadyUsed?owner:null,expira_em:null,equipes:{id:'team'},line:null,participacao:null}
 const db={from(table){
  let updating=false;let fields=null;
  const q={select(){return q},eq(){return q},or(){return q},update(v){updating=true;fields=v;calls.push('claim');return q},maybeSingle(){
   if(table==='jogadores')return Promise.resolve({data:{id:'player-A',nome:'Jogador A'},error:null})
   if(table==='tokens'&&updating)return Promise.resolve({data:updated?{id:'token-1'}:null,error:null})
   if(table==='tokens'&&fields===null){calls.push('read token');return Promise.resolve({data:item,error:null})}
   return Promise.resolve({data:null,error:null})
  }};return q;
 }}
 const route=fixtureLoader({
  '@backend/shared/supabase-admin':{supabaseAdmin:db},
  '@backend/auth/server-auth':{getBearerUser:async()=>({id:'user-A'})},
  '@backend/campeonatos/lineup-window':{assertLineupWindowOpen:async()=>{},assertPlayerNotInAnotherTeam:async()=>{}},
  '@backend/equipes/player-roster':{saveTeamPlayer:async()=>{calls.push('roster');return{id:'roster-1'}}},
  'next/server':{NextResponse:{json:(data,init={})=>new Response(JSON.stringify(data),{status:init.status||200})}},
 })(playerRoute)
 return {route,calls}
}
async function playerPOST(fixture){const out=await fixture.route.POST(new Request('https://example.invalid',{method:'POST'}),{params:Promise.resolve({token:'SomeToken'})});return {status:out.status,body:await out.json()}}
{
 const h=playerRouteHarness();let {status,body}=await playerPOST(h)
 eq(status,200,'player claims successfully');ok(body.success,'player returns success')
 ok(h.calls.indexOf('claim')<h.calls.indexOf('roster'),'token winner decided before side effects')
}
{
 const h=playerRouteHarness({alreadyUsed:true,owner:'player-B'});let {status}=await playerPOST(h)
 eq(status,409,'different user cannot replay');ok(!h.calls.includes('roster'),'no roster after conflict')
}
{
 const h=playerRouteHarness({alreadyUsed:true,owner:'player-A'});let {status,body}=await playerPOST(h)
 eq(status,200,'self replay accepted');ok(body.success,'self resumes downstream')
}
// A player whose first POST was interrupted must still be able to open the invitation
// from the UI; other users must never see a consumed invite.
for (const [name,fixture,expected,shouldResume] of [
 ['fresh invite', {alreadyUsed:false},200,false],
 ['recover own invite', {alreadyUsed:true,owner:'player-A'},200,true],
 ['different player forbidden', {alreadyUsed:true,owner:'player-B'},404,false],
]) {
 const h=playerRouteHarness(fixture)
 const result=await h.route.GET(new Request('https://example.invalid'),{params:Promise.resolve({token:'SomeToken'})})
 eq(result.status,expected,`${name} GET status`)
 if(result.ok){const payload=await result.json();eq(payload.retomada,shouldResume,`${name} GET resume`)}
}
for(const [name,invite,method] of [
 ['player malformed expiry',{...player,expira_em:'not-a-valid-date'},'claimPlayerRosterInvite'],
 ['seller malformed expiry',{...manager,expira_em:'not-a-valid-date'},'claimSellerInvite'],
]) {
 const {m,calls}=inviteHarness()
 await assert.rejects(()=>m[method](invite,'recipient'),m.InvitationClaimError,name)
 ok(!calls.some(c=>c[0]==='update'),`${name} no writes`)
}
for(const method of ['PATCH','DELETE']){
 const records=[]
 const db={from(table){ok(table==='tokens','token mutation table');let isWrite=false;const conditions=[];const chain={
  select(){return chain},eq(k,v){conditions.push([k,v]);return chain},
  update(){isWrite=true;records.push(conditions);return chain},
  maybeSingle(){return Promise.resolve({data:isWrite?{id:'token-1'}:{id:'token-1',status:'ativo',usado:false},error:null})},
 };return chain}}
 const mod=fixtureLoader({
 '@backend/auth/server-auth':{getBearerUser:async()=>({id:'owner'}),getAccountsForUser:async()=>[]},
 '@backend/equipes/manager-team-access':{requireEquipeAccess:async()=>({})},
 '@backend/shared/supabase-admin':{supabaseAdmin:db},
 'next/server':{NextResponse:{json:(data,init={})=>new Response(JSON.stringify(data),{status:init.status||200})}},
 })(adminRoute)
 const req=new Request('https://example.invalid',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({equipe_id:'team',token_id:'token-1'})})
 const out=await mod[method](req);eq(out.status,200,`${method} success`)
 const captured=records[0];ok(captured.some(x=>x[0]==='status'&&x[1]==='ativo'),`${method} checks still active`)
 ok(captured.some(x=>x[0]==='usado'&&x[1]===false),`${method} checks unused`)
 ok(captured.some(x=>x[0]==='equipe_id'&&x[1]==='team'),`${method} team ownership predicate`)
}
// If the admin read an active invitation just before another request claimed it,
// the stale PATCH/DELETE must fail rather than report a successful change.
for (const method of ['PATCH','DELETE']) {
 let updates = 0
 const db={from(){let writing=false;const q={select(){return q},eq(){return q},update(){writing=true;updates++;return q},maybeSingle(){return Promise.resolve({data:writing?null:{id:'token-1',status:'ativo',usado:false},error:null})}};return q}}
 const mod=fixtureLoader({
  '@backend/auth/server-auth':{getBearerUser:async()=>({id:'owner'}),getAccountsForUser:async()=>[]},
  '@backend/equipes/manager-team-access':{requireEquipeAccess:async()=>({})},
  '@backend/shared/supabase-admin':{supabaseAdmin:db},
  'next/server':{NextResponse:{json:(data,init={})=>new Response(JSON.stringify(data),{status:init.status||200})}},
 })(adminRoute)
 const req=new Request('https://example.invalid',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({equipe_id:'team',token_id:'token-1'})})
 const response=await mod[method](req)
 eq(response.status,400,`stale ${method} fails`)
 eq(updates,1,`stale ${method} only attempted once`)
}
const seller=read(sellerRoute)
ok(seller.includes('claimSellerInvite(convite, account.id)'), 'seller uses one-time claim before writes')
ok(seller.includes('repetida: claim.replay'),'seller exposes retry outcome')
ok(!seller.includes(".update({\n        manager_id:"),'seller no unsafe unconditional direct token update')
const playerSrc=read(playerRoute)
ok(playerSrc.indexOf('await claimPlayerRosterInvite')<playerSrc.indexOf('await saveTeamPlayer'),'player claim precedes roster write')
ok(!playerSrc.includes(".from('tokens').update({\n      usado:"),'player no unsafe post-roster claim')
const liliSrc=read(lili)
eq((liliSrc.match(/\.ilike\('token', token\)/g)||[]).length,0,'Lili has no case-insensitive token search')
eq((liliSrc.match(/\.eq\('token', token\)/g)||[]).length,5,'Lili uses 5 exact lookups')
console.log(`R12: ${checks} checks passed (fixture only; PostgreSQL concurrency not certified).`)
