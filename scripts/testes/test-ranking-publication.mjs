import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {fixtureLoader} from './ts-fixture-loader.mjs'
import {match,split} from './lib/postgrest-fixture.mjs'

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const calls=[],queryCache=new Map();let cap=7,failure=null
const championships=Array.from({length:301},(_,n)=>({id:id(1000+n),nome:`Championship ${n}`,status:'ativo',aprovacao_status:'aprovado',deleted_at:null,premiacao:100+n}))
const teams=championships.map((champ,n)=>({id:id(2000+n),campeonato_id:champ.id,equipe_id:id(3000+n),nome_exibicao:`Team ${n}`,status:'ativo'}))
const roster=teams.map((team,n)=>({id:id(4000+n),campeonato_id:team.campeonato_id,campeonato_equipe_id:team.id,jogador_id:id(5000+n),id_jogo:String(6000+n),nick:`Player ${n}`,funcao:'Suporte',status:'ativo'}))
const falls=Array.from({length:1204},(_,n)=>({id:id(10000+n),campeonato_id:championships[n%301].id,status:'finalizada',finalizada_em:'2020-01-01T00:00:00.000Z'}))
const details=falls.slice(0,1203).map((fall,n)=>({resultado_id:id(20000+n),campeonato_id:fall.campeonato_id,partida_id:fall.id,campeonato_equipe_id:teams[n%301].id,equipe_id:teams[n%301].equipe_id,nome_exibicao:teams[n%301].nome_exibicao,pontos_total:10+n%301,abates:n%5,booyah:n%11===0}))
const players=details.map((row,n)=>({...row,jogador_id:roster[n%301].jogador_id,id_jogo:roster[n%301].id_jogo,nick:roster[n%301].nick,dano:0,assistencias:0,revives:0}))
const imports=falls.map((fall,n)=>({id:id(30000+n),campeonato_id:fall.campeonato_id,partida_id:fall.id,status:'concluida',consolidacao_oficial:true,concluida_em:new Date(Date.UTC(2020,0,1,0,n)).toISOString()}))
const raw=players.map((row,n)=>({id:id(40000+n),importacao_id:imports[n].id,campeonato_equipe_id:row.campeonato_equipe_id,jogador_id:row.jogador_id,abates:row.abates,dano:100+n%301,assistencias:1,revives:1,gel_usado:2,headshots:1,garena_matchstats_armas:[{arma:'MP40',abates:row.abates,dano:100}],garena_matchstats_habilidades:[{tipo:'ativa',habilidade:'Escudo',personagem:'Chrono',usos:1}]}))
const tables={campeonatos:championships,campeonato_equipes:teams,campeonato_jogadores:roster,campeonato_partidas:falls,campeonato_estatisticas_equipes_detalhe:details,campeonato_estatisticas_mvp_detalhe:players,garena_matchstats_importacoes:imports,garena_matchstats_jogadores:raw,
  campeonato_configuracoes:championships.map((champ,n)=>({campeonato_id:champ.id,estatisticas_delay_segundos:n===1?0:n===2?600:300,numero_vagas:12,tem_live:true,tem_trofeu:false,premiacao:100+n})),equipes:teams.map(team=>({id:team.equipe_id,nome:team.nome_exibicao,tag:'DZ'}))}
function hydrate(table,row){
  if(table==='campeonatos')return {...row,campeonato_configuracoes:tables.campeonato_configuracoes.find(config=>config.campeonato_id===row.id)}
  if(table==='campeonato_equipes')return {...row,equipes:tables.equipes.find(team=>team.id===row.equipe_id)}
  if(table==='garena_matchstats_jogadores')return {...row,campeonato_equipes:tables.campeonato_equipes.find(team=>team.id===row.campeonato_equipe_id)}
  return row
}
const admin=createClient('https://fixture.supabase.co','fixture-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,options)=>{
  assert.ok(['GET','HEAD'].includes(options?.method||'GET'))
  const url=new URL(input),params=url.searchParams,table=url.pathname.split('/').at(-1),offset=Number(params.get('offset')||0)
  calls.push({table,params:Object.fromEntries(params)})
  if(failure?.table===table&&offset>=failure.offset)return new Response(JSON.stringify({code:failure.code||'XX001',message:'Fixture read failure'}),{status:400,headers:{'Content-Type':'application/json'}})
  const filters=[...params].filter(([column])=>!['select','order','offset','limit'].includes(column))
  const signature=JSON.stringify([table,filters,params.get('order'),Object.values(tables).map(rows=>rows.length),tables.campeonato_configuracoes.slice(0,3).map(row=>row.estatisticas_delay_segundos)])
  let rows=queryCache.get(signature)
  if(!rows){
    rows=(tables[table]||[]).map(row=>hydrate(table,row))
    for(const[column,filter]of filters){
      if(column.includes('.')){const[relation,field]=column.split('.');rows=rows.filter(row=>row[relation]&&match(row[relation],`${field}.${filter}`))}
      else rows=rows.filter(row=>match(row,`${column}.${filter}`))
    }
    const orders=(params.get('order')||'').split(',').filter(Boolean).map(order=>order.split('.'))
    rows.sort((a,b)=>{for(const[column,direction]of orders){const difference=String(a[column]??'').localeCompare(String(b[column]??''));if(difference)return direction==='desc'?-difference:difference}return 0})
    queryCache.set(signature,rows)
  }
  const columns=split(params.get('select')||'*').map(column=>column.split('(')[0].split('!')[0].split(':')[0])
  rows=rows.slice(offset,offset+Math.min(cap,Number(params.get('limit')||1000))).map(row=>columns.includes('*')?row:Object.fromEntries(columns.filter(column=>column in row).map(column=>[column,row[column]])))
  return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}})
}}})
const load=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:admin},'next/cache':{unstable_cache:fn=>fn}})
const rankingService=load('backend/src/ranking/tier-ranking.service.ts')
const history=load('backend/src/ranking/public-performance-read.service.ts')
const profiles=load('backend/src/ranking/competitive-profile.service.ts')
const cache=load('web/features/ranking/server.ts')
const publication=load('backend/src/campeonatos/estatisticas/publicacao.service.ts')
const withoutDate=ranking=>({...ranking,updated_at:'CLOCK'})
const sum=(rows,field)=>rows.reduce((total,row)=>total+Number(row[field]||0),0)
const full=await rankingService.carregarRankingCompleto()
assert.equal(full.teams.length,301)
assert.equal(full.players.length,301)
assert.equal(full.championships.length,301)
assert.equal(sum(full.teams,'pontos'),sum(details,'pontos_total'))
assert.equal(sum(full.players,'abates'),sum(players,'abates'))
assert.equal(sum(full.players,'dano'),sum(raw,'dano'))
assert.equal(full.players.find(row=>row.jogador_id===id(5300)).quedas,3)
cap=10000
assert.deepEqual(withoutDate(await rankingService.carregarRankingCompleto()),withoutDate(full),'server caps must not affect any score, tier, identity or total')
cap=7
const publicRank=await cache.getCachedRankingTiers()
for(const key of ['teams','players','championships'])assert.deepEqual(publicRank[key],full[key].slice(0,100))
const player=full.players.at(-1),team=full.teams.at(-1)
assert.ok(player.rank>100&&team.rank>100)
const playerRows=await cache.getCachedRankingEntityRows('jogadores',player.jogador_id)
const teamRows=await cache.getCachedRankingEntityRows('equipes',team.equipe_id)
assert.deepEqual(playerRows,[player]);assert.deepEqual(teamRows,[team])
const playerProfile=await profiles.buildCompetitiveProfile('jogadores',player.jogador_id,playerRows)
const teamProfile=await profiles.buildCompetitiveProfile('equipes',team.equipe_id,teamRows)
assert.equal(playerProfile.tier,player.tier)
assert.equal(teamProfile.metrics.find(row=>row.label==='Pontos').value,String(team.pontos))

// Every blocked case carries conspicuously large results and a secret loadout.
function addResult(championship,fall,options={}){
  const n=60000+tables.campeonato_estatisticas_equipes_detalhe.length
  const teamRow={...details[0],resultado_id:id(n),campeonato_id:championship,partida_id:fall,pontos_total:999999,abates:999999,nome_exibicao:'SECRET'}
  tables.campeonato_estatisticas_equipes_detalhe.push(teamRow)
  tables.campeonato_estatisticas_mvp_detalhe.push({...players[0],...teamRow})
  tables.garena_matchstats_importacoes.push({id:id(n+10000),campeonato_id:championship,partida_id:fall,status:options.status||'concluida',consolidacao_oficial:options.official!==false,concluida_em:'2099-01-01T00:00:00.000Z'})
  tables.garena_matchstats_jogadores.push({...raw[0],id:id(n+20000),importacao_id:id(n+10000),dano:999999,garena_matchstats_armas:[{arma:'SECRET',abates:999999,dano:999999}]})
}
const dirtyStart=[details.length,players.length,raw.length]
for(const[status,approval,deleted]of [['suspenso','aprovado',null],['banido','aprovado',null],['ativo','pendente',null],['ativo','aprovado','2020-01-01']]){
  const champ=id(90000+tables.campeonatos.length),fall=id(90000+tables.campeonato_partidas.length)
  tables.campeonatos.push({id:champ,status,aprovacao_status:approval,deleted_at:deleted})
  tables.campeonato_partidas.push({id:fall,campeonato_id:champ,status:'finalizada',finalizada_em:'2020-01-01T00:00:00.000Z'})
  addResult(champ,fall)
}
for(const[status,date]of [['finalizada',new Date(Date.now()-60000).toISOString()],['em_andamento','2020-01-01T00:00:00.000Z'],['finalizada',null]]){
  const fall=id(95000+tables.campeonato_partidas.length)
  tables.campeonato_partidas.push({id:fall,campeonato_id:championships[0].id,status,finalizada_em:date});addResult(championships[0].id,fall)
}
// Mismatched championship on an otherwise published fall must not authorize an import/result.
addResult(id(99999),falls[0].id)
// Pending/unofficial imports may never enrich tiers or loadouts.
for(const options of [{status:'pendente'},{official:false}]){
  const n=tables.garena_matchstats_importacoes.length,importId=id(99000+n)
  tables.garena_matchstats_importacoes.push({id:importId,campeonato_id:championships[0].id,partida_id:falls[0].id,status:options.status||'concluida',consolidacao_oficial:options.official!==false})
  tables.garena_matchstats_jogadores.push({...raw[0],id:id(120000+n),importacao_id:importId,dano:999999,garena_matchstats_armas:[{arma:'SECRET',abates:999999}]})
}
assert.deepEqual(withoutDate(await rankingService.carregarRankingCompleto()),withoutDate(full),'hidden/recent/unfinished/undated/foreign/pending/unofficial data must not change the public graph')
const historyStart=calls.length
const safeHistory=await history.readPublicCompetitiveHistory('jogadores',roster[0].jogador_id)
assert.equal(safeHistory.length,4)
assert.equal(sum(safeHistory,'dano'),sum(raw.slice(0,dirtyStart[2]).filter(row=>row.jogador_id===roster[0].jogador_id),'dano'))
assert.ok(!JSON.stringify(safeHistory).includes('SECRET'))
for(const call of calls.slice(historyStart).filter(call=>call.table==='garena_matchstats_jogadores'))assert.equal(call.params.jogador_id,`eq.${roster[0].jogador_id}`)
// A team with >150 registrations uses a relation filter, with no oversized IN or history from other teams.
for(let n=1;n<301;n++)tables.campeonato_equipes.push({id:id(140000+n),campeonato_id:championships[n].id,equipe_id:teams[0].equipe_id,status:'ativo'})
const teamStart=calls.length
const safeTeamHistory=await history.readPublicCompetitiveHistory('equipes',teams[0].equipe_id)
assert.equal(safeTeamHistory.length,4)
for(const call of calls.slice(teamStart).filter(call=>call.table==='garena_matchstats_jogadores'))assert.equal(call.params['campeonato_equipes.equipe_id'],`eq.${teams[0].equipe_id}`)
for(const call of calls){
  assert.ok(call.params.order,`Stable order required: ${call.table}`)
  for(const filter of Object.values(call.params))if(filter.startsWith('in.('))assert.ok(split(filter.slice(4,-1)).length<=150)
}
// Per-championship delays share one clock cut; explicit zero is the only immediate setting.
const recent=id(180000),slower=id(180001)
tables.campeonato_partidas.push({id:recent,campeonato_id:championships[1].id,status:'finalizada',finalizada_em:new Date(Date.now()-1000).toISOString()},{id:slower,campeonato_id:championships[2].id,status:'finalizada',finalizada_em:new Date(Date.now()-400000).toISOString()})
const cuts=await publication.carregarPublicacoesEstatisticas(championships.slice(0,3).map(row=>row.id))
assert.ok(cuts.get(championships[1].id).partidas_publicadas.includes(recent))
assert.ok(!cuts.get(championships[2].id).partidas_publicadas.includes(slower))
for(const invalid of [null,'','bad',-1,true,[],{}]){
  tables.campeonato_configuracoes[1].estatisticas_delay_segundos=invalid
  const state=await publication.carregarPublicacoesEstatisticas([championships[1].id])
  assert.equal(state.get(championships[1].id).delay_segundos,300)
  assert.ok(!state.get(championships[1].id).partidas_publicadas.includes(recent))
}
for(const value of [.1,'0.4',1.4]){
  tables.campeonato_configuracoes[1].estatisticas_delay_segundos=value
  const state=await publication.carregarPublicacoesEstatisticas([championships[1].id])
  assert.equal(state.get(championships[1].id).delay_segundos,1,'a positive fractional delay must not become immediate')
}
failure={table:'campeonato_configuracoes',offset:0,code:'42703'}
assert.equal((await publication.carregarPublicacoesEstatisticas([championships[1].id])).get(championships[1].id).delay_segundos,300)
failure={table:'campeonato_estatisticas_mvp_detalhe',offset:7}
await assert.rejects(rankingService.carregarRankingCompleto(),error=>error.message==='Fixture read failure')
failure={table:'garena_matchstats_jogadores',offset:0}
await assert.rejects(()=>profiles.buildCompetitiveProfile('jogadores',roster[0].jogador_id,[]),error=>error.message==='Fixture read failure')
failure=null
// Promise.all rejects before its other read-only branches finish; drain the mock queue.
await new Promise(resolve=>setImmediate(resolve))
const before=calls.length
assert.deepEqual(await history.readPublicCompetitiveHistory('jogadores',id(199999)),[])
assert.equal(calls.length-before,1,'a nonexistent entity does not trigger global or unrelated history reads')
const failedRoute=fixtureLoader({'@/features/ranking/server':{getCachedRankingTiers:async()=>{throw new Error('PRIVATE_SCHEMA_DETAIL')}}})('web/app/api/rank/route.ts')
const failedResponse=await failedRoute.GET()
assert.equal(failedResponse.status,400)
assert.equal(failedResponse.headers.get('cache-control'),'no-store')
assert.deepEqual(await failedResponse.json(),{error:'Não foi possível carregar o ranking.'})
console.log(JSON.stringify({publicChampionships:301,publishedFalls:1204,scoredDetails:1203,players:full.players.length,teams:full.teams.length,serverCap:7,profilesBeyondTop100:true,blockedResults:true,entityScope:true,teamRegistrations:301,maxIn:150,lateFailures:true,realWrites:0}))
