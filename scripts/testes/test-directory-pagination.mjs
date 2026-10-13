import { split, match } from './lib/postgrest-fixture.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { fixtureLoader } from './ts-fixture-loader.mjs'
import { backendServiceEvidence } from './lib/backend-service-evidence.mjs'

for (const file of ['web/app/api/equipes/busca-publica/route.ts', 'web/app/api/jogadores/busca-publica/route.ts', 'web/app/api/campeonatos/[id]/equipes/busca/route.ts']) {
 const evidence = backendServiceEvidence(fs.readFileSync(file, 'utf8'), path.resolve(file))
 assert.ok(evidence.files.includes('backend/src/directory/search-page.ts'), 'security scanners must follow the delegated privileged queries')
}

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const teams = Array.from({length: 1203}, (_, n) => ({id:id(n+1),nome:n < 70 ? 'Same name' : `Team ${String(n).padStart(4,'0')}`,status:n % 11 === 0 ? 'inativo':'ativo',public_id:n+1,tag:'TAG',username:`team${n}`,auth_user_id:'private',email:'private',pais:'Brasil'}))
teams[100].nome = 'Quote, "Team"\\%'
teams[101].nome = 'Quote, "Team"\\%'
teams[1201].nome = null
teams[1202].nome = null
const players = Array.from({length: 48}, (_,n) => ({id:id(n+2000),nome:`Player ${n}`,status:'ativo',id_jogo:String(n+10000),auth_user_id:'secret'}))
const lines = Array.from({length: 601}, (_,n) => ({id:id(n+4000),equipe_id:id(101),nome:`Line ${n}`,status:'ativo',public_id:n+1}))
const participations = lines.map((line,n) => ({id:id(n+5000),line_id:line.id,campeonato_id:n % 2 ? 'champ-other' : 'champ-own',status:'ativo',slot_id:id(n+6000),slot_numero:n+1}))
const slots = participations.map(p => ({id:p.slot_id,campeonato_id:p.campeonato_id,slot_numero:p.slot_numero,slot_letra:'A'}))
const tables = {equipes:teams,jogadores:players,equipe_lines:lines,campeonato_equipes:participations,campeonato_slots:slots}
let cap = 7, fail = false
const calls = []
const admin = createClient('https://fixture.supabase.co','fixture-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async input=>{
 const url=new URL(input); const table=url.pathname.split('/').at(-1); const params=url.searchParams
 calls.push({table,params:Object.fromEntries(params)})
 if (table === 'jogadores') assert.ok(!/\b(nick|foto_url|public_id|auth_user_id)\b/.test(params.get('select')), 'query only actual public database columns')
 if (fail) return new Response(JSON.stringify({message:'Database fixture failure'}),{status:400,headers:{'Content-Type':'application/json'}})
 let data=[...(tables[table]||[])]
 for (const [key,filter] of params) if (!['select','order','offset','limit'].includes(key)) data=data.filter(row=>match(row,key==='or'?filter:`${key}.${filter}`))
 const order=(params.get('order')||'').split(',')
 data.sort((a,b)=>{for(const field of order){const [column]=field.split('.');if(a[column]==null&&b[column]!=null)return 1;if(b[column]==null&&a[column]!=null)return -1;const delta=String(a[column]??'').localeCompare(String(b[column]??''));if(delta)return delta}return 0})
 const from=Number(params.get('offset')||0),limit=Number(params.get('limit')||1000)
 const columns=(params.get('select')||'').split(',')
 data=data.slice(from,from+Math.min(cap,limit)).map(row=>Object.fromEntries(columns.filter(column=>column in row).map(column=>[column,row[column]])))
 return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}})
}}})
let allowed = true
const load=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:admin},'@backend/auth/server-auth':{getBearerUser:async req=>{if(!req.headers?.get('authorization'))throw new Error('Sessão ausente');return {id:'user'}}},'@backend/campeonatos/campeonato-permissions':{requireCampeonatoTeamsWrite:async()=>{if(!allowed)throw new Error('Campeonato não autorizado')}}})
const {searchDirectory,filterLiteral}=load('backend/src/directory/search-page.ts')
const paged = async(kind,q='')=>{
 const results=[]; let cursor=null,pages=0
 do {const params=new URLSearchParams({q,limit:'30'});if(cursor)params.set('cursor',cursor);const page=await searchDirectory(kind,params);assert.ok(page.items.length<=30);assert.equal(page.hasMore,Boolean(page.nextCursor));results.push(...page.items);cursor=page.nextCursor;assert.ok(++pages<100)}while(cursor)
 return results
}
const all=await paged('team')
assert.equal(all.length,teams.filter(team=>team.status==='ativo').length)
assert.equal(new Set(all.map(team=>team.id)).size,all.length,'duplicate names/nulls must neither duplicate nor skip IDs')
assert.ok(all.every(item=>!('auth_user_id' in item)&&!('email' in item)))
assert.ok(calls.filter(call=>call.table==='equipes').every(call=>Number(call.params.limit)<=31),'read only one small page and one lookahead')
assert.equal((await paged('team','Quote, "Team"\\%')).length,2)
assert.equal((await paged('team','Brasil')).length,all.length)
assert.equal((await paged('player','10003'))[0].id,id(2003))
assert.equal((await paged('team','EQ 101'))[0].id,id(101))
assert.deepEqual(await paged('team','x),status.eq.inativo'),[],'text must not become filter grammar')
assert.equal(filterLiteral('a"b\\c'),'"a\\"b\\\\c"')
const first=await searchDirectory('team',new URLSearchParams({limit:'3'}))
for(const params of [new URLSearchParams({limit:'NaN'}),new URLSearchParams({limit:'101'}),new URLSearchParams({limit:'0'}),new URLSearchParams({q:'x'.repeat(121)}),new URLSearchParams({cursor:'invalid'}),new URLSearchParams({q:'other',cursor:first.nextCursor}),new URLSearchParams({cursor:Buffer.from(JSON.stringify({v:1,scope:'x',id:'bad',nome:null})).toString('base64url')})]) await assert.rejects(()=>searchDirectory('team',params))
await assert.rejects(()=>searchDirectory('player',new URLSearchParams({cursor:first.nextCursor})))
cap=1000
const legacy=await searchDirectory('team',new URLSearchParams())
assert.equal(legacy.items.length,1000);assert.ok(legacy.hasMore,'installed clients retain their first batch and get continuation metadata')
cap=7
const route=load('web/app/api/campeonatos/[id]/equipes/busca/route.ts')
const req=params=>({nextUrl:{searchParams:new URLSearchParams(params)},headers:new Headers({authorization:'Bearer fixture'})})
allowed=false;let before=calls.length
assert.equal((await route.GET(req({q:'Quote',limit:'3'}),{params:Promise.resolve({id:'champ-other'})})).status,400)
assert.equal(calls.length,before,'authorization must finish before any privileged query')
allowed=true
const result=await (await route.GET(req({q:'EQ 101',limit:'3'}),{params:Promise.resolve({id:'champ-own'})})).json()
assert.equal(result.equipes[0].lines.length,601,'related lines must not truncate at the Data API cap')
assert.equal(result.equipes[0].lines.filter(line=>line.ja_inscrita).length,301)
assert.ok(calls.filter(call=>call.table==='campeonato_equipes'||call.table==='campeonato_slots').every(call=>call.params.campeonato_id==='eq.champ-own'))
assert.ok(calls.filter(call=>call.params.line_id||call.params.equipe_id||call.params.id).every(call=>![call.params.line_id,call.params.equipe_id,call.params.id].filter(Boolean).some(filter=>filter.startsWith('in.')&&split(filter.slice(4,-1)).length>150)))
const line=await (await route.GET(req({q:'LN 1',limit:'3'}),{params:Promise.resolve({id:'champ-own'})})).json()
assert.equal(line.equipes[0].lines.length,1)
const invite=load('web/app/api/jogadores/busca/route.ts')
before=calls.length
assert.equal((await invite.GET({nextUrl:{searchParams:new URLSearchParams({q:'Player'})},headers:new Headers()})).status,400)
assert.equal(calls.length,before)
const invitation=await (await invite.GET(req({q:'Player',limit:'10'}))).json()
assert.equal(invitation.items.length,10);assert.ok(invitation.nextCursor);assert.ok(invitation.items.every(item=>!('auth_user_id' in item)))
fail=true
await assert.rejects(()=>searchDirectory('team',new URLSearchParams({limit:'30'})))
console.log(`Directory pagination passed: ${all.length} active teams across small pages, duplicate/null names, quoting, cursor validation, legacy contract, 601 lines, scoped memberships and auth gates.`)
