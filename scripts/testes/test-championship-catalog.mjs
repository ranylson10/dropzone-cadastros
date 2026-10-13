import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { fixtureLoader } from './ts-fixture-loader.mjs'
import { split, match } from './lib/postgrest-fixture.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { backendServiceEvidence } from './lib/backend-service-evidence.mjs'

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const champs = Array.from({ length: 1203 }, (_, n) => ({ id: id(n+1), nome: n<80 ? 'Duplicate name' : `Champ ${String(n).padStart(4,'0')}`, tipo: 'Copa', status: n%11 ? 'ativo' : 'inativo', aprovacao_status: n%13 ? 'aprovado' : 'pendente', deleted_at: n%17 ? null : '2026-01-01', created_at: String(n).padStart(5,'0'), produtora_id: id(5000), auth_user_id: 'private' }))
champs[1201].nome = null; champs[1202].nome = null; champs[100].nome = 'Quoted, "Champ"\\%'
const configs = champs.map((champ,n) => ({ id:id(n+6000), campeonato_id:champ.id, numero_vagas:1000, plataforma:'Mobile', servidor:n%2 ? 'Brasil' : 'Outro', valor_inscricao:n%2 ? 0 : null, contatos_whatsapp:'private' }))
const participants = Array.from({ length: 601 }, (_, n) => ({ id:id(n+8000), campeonato_id:champs[100].id, status:n%2 ? 'inativo':'ativo' }))
const purchases = [
  { id:id(9000), campeonato_id:champs[100].id, status:'pago', expira_em:null },
  { id:id(9001), campeonato_id:champs[100].id, status:'pendente', expira_em:'2001-01-01' },
  { id:id(9002), campeonato_id:champs[100].id, status:'pendente', expira_em:'2099-01-01' },
  { id:id(9003), campeonato_id:champs[100].id, status:'cancelado', expira_em:null },
]
const games = [{ id:id(9100), campeonato_id:champs[100].id, status:'ativo', data_jogo:'2099-01-02', horario:'20:00' },{ id:id(9101), campeonato_id:champs[100].id, status:'ativo', data_jogo:'2099-01-01', horario:'20:00' },{ id:id(9102), campeonato_id:champs[100].id, status:'ativo', data_jogo:'2001-01-01', horario:'20:00' }]
const tables = { campeonatos:champs, campeonato_configuracoes:configs, campeonato_equipes:participants, sistema_compras_vaga:purchases, campeonato_jogos:games, produtoras:[{ id:id(5000), nome:'Public producer', email:'private' }] }
const calls = []; let fail = false
const admin = createClient('https://fixture.supabase.co','fixture-key',{ auth:{persistSession:false,autoRefreshToken:false}, global:{ fetch:async input => {
  const url = new URL(input), table = url.pathname.split('/').at(-1), params = url.searchParams
  calls.push({ table, params:Object.fromEntries(params) })
  assert.ok(!/\*|auth_user_id|email|contatos_whatsapp/.test(params.get('select')))
  if (fail && table === 'campeonato_jogos') return new Response(JSON.stringify({message:'Scoped relation failed'}),{status:400})
  let data = [...tables[table]]
  if (table === 'campeonatos' && params.has('matching_config.or')) data = data.map(row => ({ ...row, matching_config:configs.find(config => config.campeonato_id===row.id && match(config, params.get('matching_config.or'))) || null }))
  for (const [key, filter] of params) if (!['select','order','offset','limit','matching_config.or'].includes(key)) data = data.filter(row => match(row, key==='or' ? filter : `${key}.${filter}`))
  data.sort((a,b) => { for (const field of (params.get('order')||'').split(',')) { const [column,direction] = field.split('.'); if(a[column]==null&&b[column]!=null)return 1; if(b[column]==null&&a[column]!=null)return -1; const delta=String(a[column]??'').localeCompare(String(b[column]??'')); if(delta)return direction==='desc' ? -delta : delta } return 0 })
  const from=Number(params.get('offset')||0), limit=Number(params.get('limit')||1000), columns=split(params.get('select')||'')
  data=data.slice(from,from+Math.min(7,limit)).map(row => Object.fromEntries(columns.filter(column=>column in row).map(column=>[column,row[column]])))
  return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}})
} } })
const load = fixtureLoader({ '@backend/shared/supabase-admin':{ supabaseAdmin:admin }, '@backend/admin/admin-auth':{requireSystemAdmin:async()=>{throw new Error('Admin required')}} })
const { publicChampionshipCatalog } = load('backend/src/directory/championship-catalog.ts')
const routeFile='web/app/api/vagas/route.ts'
assert.ok(backendServiceEvidence(fs.readFileSync(routeFile,'utf8'),path.resolve(routeFile)).files.includes('backend/src/directory/championship-catalog.ts'))
const expected = champs.filter(row => row.status==='ativo' && row.aprovacao_status==='aprovado' && !row.deleted_at)
const all=[]; let cursor=null,pages=0
do { const params=new URLSearchParams({limit:'30'}); if(cursor)params.set('cursor',cursor); const page=await publicChampionshipCatalog(params); assert.ok(page.announcements.length<=30); all.push(...page.announcements); cursor=page.nextCursor; assert.ok(++pages<100) } while(cursor)
assert.equal(all.length,expected.length); assert.equal(new Set(all.map(row=>row.id)).size,expected.length)
assert.ok(all.every(row=>!('auth_user_id' in row)&&!('created_at' in row)&&!('matching_config' in row)))
const quoted=await publicChampionshipCatalog(new URLSearchParams({q:'Quoted, "Champ"\\%',limit:'30'}))
assert.equal(quoted.announcements.length,1)
assert.equal(quoted.announcements[0].vagas_livres,697,'all 301 active participants and two valid reservations count despite cap 7')
assert.equal(quoted.announcements[0].valor_inscricao,null,'unknown price remains unknown')
assert.equal(quoted.announcements[0].proxima_data,'2099-01-01')
const platform=await publicChampionshipCatalog(new URLSearchParams({q:'Mobile',limit:'30'}))
assert.equal(platform.announcements.length,30); assert.ok(platform.hasMore)
const region=await publicChampionshipCatalog(new URLSearchParams({q:'Brasil',limit:'100'}))
assert.ok(region.announcements.every(row=>row.servidor==='Brasil'))
const legacy=await publicChampionshipCatalog(new URLSearchParams())
assert.equal(legacy.announcements.length,500); assert.ok(!('nextCursor' in legacy)); assert.deepEqual(legacy.announcements.map(row=>row.id), expected.toSorted((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,500).map(row=>row.id))
for(const call of calls.filter(call=>['campeonato_configuracoes','campeonato_equipes','sistema_compras_vaga','campeonato_jogos','produtoras'].includes(call.table))) {
  const filter=call.params[call.table==='produtoras'?'id':'campeonato_id']; assert.ok(filter?.startsWith('in.')); assert.ok(split(filter.slice(4,-1)).length<=150)
}
for(const params of [new URLSearchParams({limit:'101'}),new URLSearchParams({q:'x'.repeat(121)}),new URLSearchParams({q:'Changed',limit:'30',cursor:platform.nextCursor})]) await assert.rejects(()=>publicChampionshipCatalog(params))
const injection=await publicChampionshipCatalog(new URLSearchParams({q:'x),status.eq.inativo',limit:'30'})); assert.equal(injection.announcements.length,0)
const route=load(routeFile), req=values=>({nextUrl:{searchParams:new URLSearchParams({diretorio:'1',...values})}})
const response=await route.GET(req({q:'Mobile',limit:'3'})); assert.equal(response.status,200); assert.equal((await response.json()).announcements.length,3)
assert.equal((await route.GET(req({limit:'101'}))).status,400)
fail=true; await assert.rejects(()=>publicChampionshipCatalog(new URLSearchParams({q:'Quoted',limit:'30'})))
console.log(`Championship catalog passed: ${all.length} public championships, ${pages} pages, legacy 500, config search, scoped relations, row-cap resilience and failure propagation.`)
