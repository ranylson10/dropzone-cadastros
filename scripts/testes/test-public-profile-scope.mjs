import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { fixtureLoader } from './ts-fixture-loader.mjs'
import { match, split } from './lib/postgrest-fixture.mjs'

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const kinds=['campeonatos','equipes','jogadores','managers','produtoras']
const target=id(1203), producerUser=id(7000)
const tables=Object.fromEntries(kinds.map(kind=>[kind,Array.from({length:1203},(_,n)=>({id:id(n+1),nome:`${kind} ${n+1}`,status:'ativo',aprovacao_status:kind==='campeonatos'?'aprovado':undefined,produtora_id:target,auth_user_id:producerUser,criado_por:producerUser,deleted_at:null,email:'PRIVATE',dono_senha:'PRIVATE',whatsapp:'PRIVATE',telefone:'PRIVATE',created_at:'2026-01-01'}))]))
tables.equipe_lines=Array.from({length:601},(_,n)=>({id:id(n+10000),equipe_id:target,nome:`Line ${n+1}`,status:'ativo'}))
tables.equipe_lines.push({id:id(19000),equipe_id:id(1),nome:'Foreign line',status:'ativo'})
tables.campeonato_equipes=Array.from({length:301},(_,n)=>({id:id(n+20000),equipe_id:target,campeonato_id:target,status:'ativo'}))
tables.campeonato_jogadores=[{id:id(24000),jogador_id:target,campeonato_id:target,equipe_id:target,status:'ativo'}]
tables.manager_equipe=[{id:id(25000),manager_id:target,equipe_id:target,status:'ativo'},{id:id(25001),manager_id:id(1),equipe_id:id(1),status:'ativo'}]
tables.manager_produtora=[{id:id(25002),manager_id:target,produtora_id:target,status:'ativo'}]
tables.manager_jogador=[{id:id(25003),manager_id:target,jogador_id:target,status:'ativo'}]
tables.campeonato_configuracoes=[{id:id(26000),campeonato_id:target,numero_vagas:10,valor_inscricao:30,contatos_whatsapp:[]}]
for(const table of ['campeonato_fases','campeonato_slots','campeonato_jogos','campeonato_grupos','campeonato_partidas_com_mapa','jogadores_temporarios','garena_matchstats_jogadores'])tables[table]=[]
const calls=[];let failTable=''
const admin=createClient('https://fixture.supabase.co','fixture-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async input=>{
  const url=new URL(input),table=url.pathname.split('/').at(-1),params=url.searchParams
  calls.push({table,params:Object.fromEntries(params)})
  if(table===failTable)return new Response(JSON.stringify({code:'42703',message:'Schema fixture failure'}),{status:400,headers:{'Content-Type':'application/json'}})
  let data=[...(tables[table]||[])]
  for(const [key,filter]of params)if(!['select','order','offset','limit'].includes(key))data=data.filter(row=>match(row,key==='or'?filter:`${key}.${filter}`))
  data.sort((a,b)=>String(a.id).localeCompare(String(b.id)))
  const from=Number(params.get('offset')||0),limit=Number(params.get('limit')||1000)
  const columns=split(params.get('select')||'')
  data=data.slice(from,from+Math.min(7,limit)).map(row=>params.get('select')==='*'?row:Object.fromEntries(columns.filter(column=>column in row).map(column=>[column,row[column]])))
  return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}})
}}})
const load=fixtureLoader({
  '@backend/shared/supabase-admin':{supabaseAdmin:admin},
  'next/cache':{unstable_cache:fn=>fn},
  '@/features/ranking/server':{getCachedRankingEntityRows:async()=>[]},
  '@backend/campeonatos/estatisticas/estatisticas.service':{listarEstatisticasPublicadas:async()=>({equipes:[],jogadores:[]})},
})
const {readPublicProfileBase}=load('backend/src/directory/public-profile-base.ts')
const {getPublicDirectoryBase}=load('web/features/directory/profile-base.ts')
const {getDirectoryProfile}=load('web/features/directory/server.ts')

for(const kind of kinds) {
  calls.length=0
  const profile=await getDirectoryProfile(kind,target)
  assert.ok(profile);assert.equal(profile.id,target);assert.equal(profile.kind,kind)
  assert.ok(!JSON.stringify(profile).includes('PRIVATE'),'private parent fields never enter the page DTO')
  assert.ok(!JSON.stringify(profile).includes(producerUser),'internal ownership IDs never enter the page DTO')
  const parent=calls[0];assert.equal(parent.table,kind);assert.equal(parent.params.id,`eq.${target}`)
  assert.notEqual(parent.params.select,'*')
  assert.ok(calls.filter(call=>call.table===kind).every(call=>call.params.id||call.params.or),'opening a profile must not enumerate its entire directory')
  for(const call of calls.filter(call=>call.table.startsWith('manager_')))assert.ok([`eq.${target}`,`in.(${target})`].includes(call.params.manager_id))
  if(kind==='equipes') {
    assert.equal(profile.meta.find(row=>row.label==='Lines').value,'601')
    assert.equal(profile.sections.find(row=>row.title==='Lines').items.length,601)
    assert.ok(!profile.sections.find(row=>row.title==='Lines').items.some(row=>row.title==='Foreign line'))
  }
  if(kind==='produtoras')assert.equal(profile.meta.find(row=>row.label==='Campeonatos').value,'1203')
  if(kind==='managers')assert.equal(profile.meta.find(row=>row.label==='Vínculos').value,'3')
}
for(const status of ['suspenso','banido','excluido','excluído',' SUSPENSO ']) {
  const row=tables.equipes.at(-1);row.status=status;calls.length=0
  assert.equal(await getDirectoryProfile('equipes',target),null);assert.equal(calls.length,1,'invisible parent must stop related reads')
}
tables.equipes.at(-1).status='inativo';assert.ok(await getPublicDirectoryBase('equipes',target),'inactive archival profiles preserve the existing visibility contract')
tables.equipes.at(-1).status='ativo';tables.campeonatos.at(-1).deleted_at='2026-10-01';calls.length=0
assert.equal(await getDirectoryProfile('campeonatos',target),null);assert.equal(calls.length,1)
tables.campeonatos.at(-1).deleted_at=null
tables.campeonatos.at(-1).aprovacao_status='pendente';calls.length=0
assert.equal(await getDirectoryProfile('campeonatos',target),null);assert.equal(calls.length,1)
tables.campeonatos.at(-1).aprovacao_status='aprovado'
calls.length=0;assert.equal(await readPublicProfileBase('equipes','invalid'),null);assert.equal(calls.length,0)
assert.equal(await readPublicProfileBase('wrong',target),null);assert.equal(calls.length,0)
calls.length=0;assert.equal(await getDirectoryProfile('equipes',id(999999)),null);assert.equal(calls.length,1)
const uppercaseId='abcdef01-abcd-4abc-8abc-abcdef012345'
tables.equipes.push({...tables.equipes.at(-1),id:uppercaseId,nome:'Canonical UUID'})
tables.equipe_lines.push({id:id(29000),equipe_id:uppercaseId,nome:'Canonical line',status:'ativo'})
const uppercase=await getDirectoryProfile('equipes',uppercaseId.toUpperCase())
assert.equal(uppercase.id,uppercaseId);assert.equal(uppercase.sections.find(row=>row.title==='Lines').items[0].title,'Canonical line')
failTable='equipes';await assert.rejects(()=>getDirectoryProfile('equipes',target),error=>error.message==='Schema fixture failure')
failTable='equipe_lines';await assert.rejects(()=>getDirectoryProfile('equipes',target),error=>error.message==='Schema fixture failure')
console.log('Public profiles passed: five kinds, 1203 parents each, direct ID lookup, invisible/missing gates, public DTOs, 601 lines, 1203 producer championships, scoped links, cap 7 and propagated schema failures.')
