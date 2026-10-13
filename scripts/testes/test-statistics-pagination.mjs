import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {fixtureLoader} from './ts-fixture-loader.mjs'
import {match,split} from './lib/postgrest-fixture.mjs'

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const championship=id(90000),foreign=id(90001),recent=id(305),unfinished=id(306),withoutDate=id(307)
const published=Array.from({length:301},(_,n)=>id(n+1))
const calls=[],cache=new Map();let failure=null
const tables={
  campeonatos:[{id:championship,nome:'Public championship',status:'ativo',aprovacao_status:'aprovado',deleted_at:null}],
  campeonato_configuracoes:[{id:id(80000),campeonato_id:championship,estatisticas_delay_segundos:300}],
  campeonato_partidas:[...published.map(partidaId=>({id:partidaId,campeonato_id:championship,status:'finalizada',finalizada_em:'2020-01-01T00:00:00.000Z'})),{id:recent,campeonato_id:championship,status:'finalizada',finalizada_em:new Date().toISOString()},{id:unfinished,campeonato_id:championship,status:'em_andamento',finalizada_em:'2020-01-01T00:00:00.000Z'},{id:withoutDate,campeonato_id:championship,status:'finalizada',finalizada_em:null},{id:id(308),campeonato_id:foreign,status:'finalizada',finalizada_em:'2020-01-01T00:00:00.000Z'}],
  equipe_lines:Array.from({length:301},(_,n)=>({id:id(n+4000),public_id:5001+n})),
}
const details=Array.from({length:1203},(_,n)=>({resultado_id:id(10000+n),campeonato_id:championship,partida_id:published[Math.floor(n/301)],fase_id:id(7100),rodada_id:id(7200),jogo_id:id(7300),mapa_codigo:'BERMUDA',grupo_id:id(7400),campeonato_equipe_id:id(n%301+2000),equipe_id:id(n%301+3000),line_id:id(n%301+4000),nome_exibicao:`Team ${n%301+1}`,posicao:2,abates:n%301+1,pontos_posicao:10,pontos_abates:n%301+1,pontos_total:11+n%301,booyah:false}))
tables.campeonato_estatisticas_equipes_detalhe=[...details,{...details[0],resultado_id:id(19000),partida_id:recent,nome_exibicao:'UNPUBLISHED',pontos_total:999999,abates:99999},{...details[0],resultado_id:id(19001),campeonato_id:foreign,nome_exibicao:'FOREIGN',pontos_total:999999}]
const mvp=details.map((row,n)=>({...row,campeonato_jogador_id:id(n%301+5000),jogador_id:id(n%301+6000),campeonato_equipe_id:row.campeonato_equipe_id,nick:`Player ${n%301+1}`,id_jogo:String(900000+n%301),tipo_jogador:'oficial',dano:100,assistencias:2,revives:1}))
tables.campeonato_estatisticas_mvp_detalhe=[...mvp,{...mvp[0],resultado_id:id(19002),partida_id:recent,nick:'UNPUBLISHED',abates:999999},{...mvp[0],resultado_id:id(19003),campeonato_id:foreign,nick:'FOREIGN',abates:999999}]
tables.garena_matchstats_importacoes=published.map((partida_id,n)=>({id:id(20000+n),campeonato_id:championship,partida_id,jogo_id:id(7300),status:'concluida',consolidacao_oficial:true}))
tables.garena_matchstats_importacoes.push({id:id(20900),campeonato_id:championship,partida_id:recent,jogo_id:id(7300),status:'concluida',consolidacao_oficial:true},{id:id(20901),campeonato_id:foreign,partida_id:published[0],status:'concluida',consolidacao_oficial:true},{id:id(20902),campeonato_id:championship,partida_id:published[0],status:'pendente',consolidacao_oficial:false})
tables.garena_matchstats_jogadores=mvp.map((row,n)=>({id:id(30000+n),importacao_id:id(20000+n%301),campeonato_jogador_id:row.campeonato_jogador_id,jogador_id:row.jogador_id,campeonato_equipe_id:row.campeonato_equipe_id,nick_snapshot:row.nick,player_id:row.id_jogo,abates:row.abates,dano:row.dano,assistencias:row.assistencias,revives:row.revives}))
tables.garena_matchstats_jogadores.push({...tables.garena_matchstats_jogadores[0],id:id(31900),importacao_id:id(20900),nick_snapshot:'UNPUBLISHED',abates:999999},{...tables.garena_matchstats_jogadores[0],id:id(31901),importacao_id:id(20901),nick_snapshot:'FOREIGN',abates:999999})
tables.garena_matchstats_jogadores.push({...tables.garena_matchstats_jogadores[0],id:id(31902),importacao_id:id(20902),nick_snapshot:'PENDING_IMPORT',abates:999999},{...tables.garena_matchstats_jogadores[0],id:id(31903),campeonato_jogador_id:null,nick_snapshot:'UNREGISTERED',abates:999999})
const admin=createClient('https://fixture.supabase.co','fixture-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async (input,options)=>{
  assert.ok(['GET','HEAD'].includes(options?.method||'GET'))
  const url=new URL(input),table=url.pathname.split('/').at(-1),params=url.searchParams
  calls.push({table,params:Object.fromEntries(params)})
  if(failure?.table===table&&Number(params.get('offset')||0)>=failure.offset)return new Response(JSON.stringify({code:'42703',message:'Fixture read failure'}),{status:400,headers:{'Content-Type':'application/json'}})
  const filters=[...params].filter(([key])=>!['select','order','offset','limit'].includes(key))
  const key=JSON.stringify([table,filters,params.get('order')])
  let rows=cache.get(key)
  if(!rows){
    rows=[...(tables[table]||[])]
    for(const [column,filter]of filters)rows=rows.filter(row=>match(row,column==='or'?filter:`${column}.${filter}`))
    const orders=(params.get('order')||'').split(',').filter(Boolean).map(order=>order.split('.'))
    rows.sort((a,b)=>{for(const [column,direction]of orders){const diff=String(a[column]??'').localeCompare(String(b[column]??''));if(diff)return direction==='desc'?-diff:diff}return 0})
    cache.set(key,rows)
  }
  const offset=Number(params.get('offset')||0),limit=Math.min(7,Number(params.get('limit')||1000))
  const columns=split(params.get('select')||'*')
  rows=rows.slice(offset,offset+limit).map(row=>columns.includes('*')?row:Object.fromEntries(columns.filter(column=>column in row).map(column=>[column,row[column]])))
  return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}})
}}})
const load=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:admin}})
const stats=load('backend/src/campeonatos/estatisticas/estatisticas.service.ts')
const publication=load('backend/src/campeonatos/estatisticas/publicacao.service.ts')
const sum=(rows,column)=>rows.reduce((total,row)=>total+Number(row[column]||0),0)

const teams=await stats.listarEstatisticasEquipes(championship,{})
assert.equal(teams.length,301,'all participants must survive the Data API cap')
assert.equal(sum(teams,'pontos_total'),sum(tables.campeonato_estatisticas_equipes_detalhe.filter(row=>row.campeonato_id===championship),'pontos_total'))
assert.equal(teams.find(row=>row.line_id===id(4300)).line_public_id,5301,'the final line ID must survive batched enrichment')
const players=await stats.listarEstatisticasMvp(championship,{})
assert.equal(players.length,301)
assert.equal(sum(players,'abates'),sum(tables.campeonato_estatisticas_mvp_detalhe.filter(row=>row.campeonato_id===championship),'abates'))
const publishedState=await publication.carregarPublicacaoEstatisticas(championship)
assert.deepEqual(publishedState.partidas_publicadas,published)
assert.equal(publishedState.delay_segundos,300)
for(const patch of [{status:'suspenso'},{status:'banido'},{deleted_at:'2026-10-01'},{aprovacao_status:'pendente'}]){
  const original={...tables.campeonatos[0]};Object.assign(tables.campeonatos[0],patch);cache.clear()
  for(const read of [()=>stats.listarEstatisticasPublicadas(championship,{}),()=>stats.carregarResumoCampeaoPublicado(championship)]){
    const before=calls.length
    await assert.rejects(read,/Campeonato não disponível para leitura pública/)
    assert.equal(calls.length-before,1,'hidden championships must stop before related reads')
  }
  tables.campeonatos[0]=original;cache.clear()
}
for(const delay of [null,undefined,'',true,false,{},[]]){
  tables.campeonato_configuracoes[0].estatisticas_delay_segundos=delay;cache.clear()
  const safeDefault=await publication.carregarPublicacaoEstatisticas(championship)
  assert.equal(safeDefault.delay_segundos,300,'missing/invalid delay must not publish instantly')
  assert.ok(!safeDefault.partidas_publicadas.includes(recent))
}
tables.campeonato_configuracoes[0].estatisticas_delay_segundos=0;cache.clear()
const immediate=await publication.carregarPublicacaoEstatisticas(championship)
assert.equal(immediate.delay_segundos,0);assert.ok(immediate.partidas_publicadas.includes(recent))
tables.campeonato_configuracoes[0].estatisticas_delay_segundos=99999;cache.clear()
assert.equal((await publication.carregarPublicacaoEstatisticas(championship)).delay_segundos,7200)
tables.campeonato_configuracoes[0].estatisticas_delay_segundos=300;cache.clear()
const publicPayload=await stats.listarEstatisticasPublicadas(championship,{})
assert.equal(publicPayload.equipes.length,301);assert.equal(publicPayload.jogadores.length,301)
assert.equal(sum(publicPayload.equipes,'pontos_total'),sum(details,'pontos_total'))
assert.equal(sum(publicPayload.jogadores,'abates'),sum(mvp,'abates'))
assert.ok(!JSON.stringify(publicPayload).includes('UNPUBLISHED'));assert.ok(!JSON.stringify(publicPayload).includes('FOREIGN'))
const scoped={faseId:id(7100),rodadaId:id(7200),jogoId:id(7300),mapaCodigo:'BERMUDA',grupoId:id(7400),partidaId:published[0]}
assert.equal(sum(await stats.listarEstatisticasEquipes(championship,scoped),'pontos_total'),sum(details.filter(row=>row.partida_id===published[0]),'pontos_total'))
assert.equal((await stats.listarEstatisticasEquipesPublicadas(championship,{partidaId:recent})).equipes.length,0)
assert.equal((await stats.listarEstatisticasMvpPublicadas(championship,{partidaId:unfinished})).jogadores.length,0)
const narrowed=await stats.listarEstatisticasPublicadas(championship,{partidaIds:[published[0],recent]})
assert.equal(sum(narrowed.equipes,'pontos_total'),sum(details.filter(row=>row.partida_id===published[0]),'pontos_total'))
let before=calls.length
assert.deepEqual(await stats.listarEstatisticasEquipes(championship,{partidaIds:[]}),[])
assert.deepEqual(await stats.listarEstatisticasMvp(championship,{partidaIds:[]}),[])
assert.equal(calls.length,before,'an empty explicit scope must not read all results')

const view=tables.campeonato_estatisticas_mvp_detalhe
tables.campeonato_estatisticas_mvp_detalhe=[];cache.clear()
const fallback=await stats.listarEstatisticasPublicadas(championship,{})
assert.equal(fallback.jogadores.length,301)
assert.equal(sum(fallback.jogadores,'abates'),sum(mvp,'abates'))
assert.equal(sum(fallback.jogadores,'quedas'),1203)
assert.ok(!JSON.stringify(fallback).includes('UNPUBLISHED'));assert.ok(!JSON.stringify(fallback).includes('FOREIGN'))
assert.ok(!JSON.stringify(fallback).includes('PENDING_IMPORT'));assert.ok(!JSON.stringify(fallback).includes('UNREGISTERED'))
for(const table of ['garena_matchstats_importacoes','garena_matchstats_jogadores']){
  failure={table,offset:7}
  await assert.rejects(()=>stats.listarEstatisticasMvp(championship,{}),error=>error.message==='Fixture read failure')
}
failure=null
tables.campeonato_estatisticas_mvp_detalhe=view;cache.clear()
for(const table of ['campeonato_estatisticas_equipes_detalhe','campeonato_estatisticas_mvp_detalhe','equipe_lines']){
  failure={table,offset:7}
  await assert.rejects(()=>table==='campeonato_estatisticas_mvp_detalhe'?stats.listarEstatisticasMvp(championship,{}):stats.listarEstatisticasEquipes(championship,{}),error=>error.message==='Fixture read failure')
}
failure={table:'campeonato_partidas',offset:7}
await assert.rejects(()=>stats.listarEstatisticasPublicadas(championship,{}),error=>error.message==='Fixture read failure')
failure=null
tables.campeonato_fases=[{id:id(7100),campeonato_id:championship,nome:'Final',tipo:'grande_final'}]
tables.campeonato_jogos=[{id:id(7300),campeonato_id:championship,fase_id:id(7100),nome:'Final game',dia_final:1,status:'finalizado'}]
tables.campeonato_fases_configuracoes=[{id:id(7500),campeonato_id:championship,fase_id:id(7100),modo_decisao:'pontuacao_normal',modo_acumulacao:'acumulado'}]
const allFalls=tables.campeonato_partidas
tables.campeonato_partidas=allFalls.filter(row=>published.includes(row.id)||row.id===recent).map((row,index)=>({...row,fase_id:id(7100),jogo_id:id(7300),numero_partida:index+1}))
cache.clear()
const withheld=await stats.carregarResumoCampeaoPublicado(championship)
assert.equal(withheld.final_concluida,false,'a finished fall beyond the first cap must keep the champion hidden until publication')
assert.equal(withheld.campeao,null);assert.equal(withheld.mvp_final,null);assert.deepEqual(withheld.jogadores,[])
tables.campeonato_partidas.at(-1).status='em_andamento';cache.clear()
assert.equal((await stats.carregarResumoCampeao(championship)).final_concluida,false,'an unfinished last fall must prevent declaring a champion')
const originalTeamDetails=tables.campeonato_estatisticas_equipes_detalhe,originalPlayerDetails=tables.campeonato_estatisticas_mvp_detalhe
tables.campeonato_partidas=tables.campeonato_partidas.slice(0,301)
tables.campeonato_estatisticas_mvp_detalhe=[]
tables.campeonato_estatisticas_equipes_detalhe=published.map((partidaId,index)=>({...details[0],resultado_id:id(40000+index),partida_id:partidaId,pontos_total:10,booyah:index===300}))
tables.campeonato_fases_configuracoes[0].modo_decisao='booyah_ouro'
tables.campeonato_fases_configuracoes[0].booyah_ouro_pontos_limite=1000;cache.clear()
const golden=await stats.carregarResumoCampeao(championship)
assert.equal(golden.champion_point.atingido,true)
assert.equal(golden.champion_point.partida_id,published[300]);assert.equal(golden.champion_point.queda_global,301)
tables.campeonato_fases_configuracoes[0].modo_decisao='pontuacao_normal'
tables.campeonato_fases_configuracoes[0].modo_acumulacao='bonus_por_ranking'
tables.campeonato_fases_configuracoes[0].jogo_decisivo_id=id(7300)
tables.campeonato_estatisticas_equipes_detalhe=details.slice(0,301).map(row=>({...row,pontos_total:1}))
tables.campeonato_fases_bonus_equipes=details.slice(0,301).map((row,index)=>({campeonato_id:championship,fase_id:id(7100),campeonato_equipe_id:row.campeonato_equipe_id,pontos_bonus:index===300?10000:0}))
cache.clear()
const rush=await stats.carregarResumoCampeao(championship)
assert.equal(rush.campeao.campeonato_equipe_id,id(2300));assert.equal(rush.campeao.pontos_bonus_final,10000)
tables.campeonato_fases_configuracoes[0].modo_acumulacao='acumulado'
tables.campeonato_estatisticas_equipes_detalhe=originalTeamDetails;tables.campeonato_estatisticas_mvp_detalhe=originalPlayerDetails
tables.campeonato_partidas=allFalls;cache.clear()

tables.campeonatos=[{id:championship,nome:'Public championship',status:'ativo',aprovacao_status:'aprovado',deleted_at:null}]
tables.campeonato_equipes=Array.from({length:301},(_,n)=>({id:id(8000+n),campeonato_id:championship,status:'ativo'}))
tables.campeonato_jogadores=Array.from({length:301},(_,n)=>({id:id(9000+n),campeonato_id:championship,status:'ativo'}))
tables.campeonato_partidas_com_mapa=published.map(partidaId=>({id:partidaId,campeonato_id:championship,numero_partida:1}))
const sheet=await stats.carregarSumula(championship)
assert.equal(sheet.partidas.length,301);assert.equal(sheet.equipes.length,301);assert.equal(sheet.jogadores.length,301)
const fullLoad=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:admin},'next/cache':{unstable_cache:fn=>fn},'@/features/ranking/server':{getCachedRankingEntityRows:async()=>[]}})
const {getDirectoryProfile}=fullLoad('web/features/directory/server.ts')
const profile=await getDirectoryProfile('campeonatos',championship)
const initialTeams=profile.sections.find(row=>row.title==='Tabela').items
const initialPlayers=profile.sections.find(row=>row.title==='MVP').items
assert.equal(initialTeams.length,301,'the initial public table must not be cut to 100')
assert.equal(initialPlayers.length,301)
assert.equal(sum(initialTeams.map(row=>row.stats),'pontos_total'),sum(details,'pontos_total'))
assert.equal(sum(initialPlayers.map(row=>row.stats),'abates'),sum(mvp,'abates'))
before=calls.length
await stats.listarEstatisticasPublicadas(championship,{})
assert.equal(calls.slice(before).filter(call=>call.table==='campeonato_configuracoes').length,1,'the combined read must load publication config only once')
failure={table:'campeonato_partidas',offset:7}
await assert.rejects(()=>getDirectoryProfile('campeonatos',championship),error=>error.message==='Fixture read failure')
failure=null
for(const call of calls){
  if(['campeonato_estatisticas_equipes_detalhe','campeonato_estatisticas_mvp_detalhe','campeonato_partidas','garena_matchstats_importacoes'].includes(call.table))assert.equal(call.params.campeonato_id,`eq.${championship}`)
  for(const [column,filter]of Object.entries(call.params))if(filter.startsWith('in.('))assert.ok(split(filter.slice(4,-1)).length<=150,`${column} must be batched`)
  if(call.params.limit)assert.ok(call.params.order,'every ranged query needs stable order')
}
console.log('Statistics passed: 1203 detail rows, 301 participants/lines/published falls, cap 7, scoped filters, IN batches 150, official Garena fallback, publication cutoff, full initial profiles, summaries/sheets, Golden Booyah/Point Rush, empty scopes and late-page failures.')
