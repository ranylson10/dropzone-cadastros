import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {fixtureLoader} from './ts-fixture-loader.mjs'
import {match,split} from './lib/postgrest-fixture.mjs'

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const champ=id(100),group=id(200),team=id(300),user=id(400),foreign=id(90000)
let tables,calls,version=0,failure=null,beforeRequest=null,afterRequest=null,generated=100000,controllable=[]
const queryCache=new Map()
function reset(){
  calls=[];failure=null;beforeRequest=null;afterRequest=null;queryCache.clear();version++
  tables={campeonatos:[{id:champ,nome:'Fixture championship',logo_url:null,aprovacao_status:'aprovado',status:'ativo',deleted_at:null}],campeonato_grupos:[{id:group,campeonato_id:champ,nome:'Fixture group',slots:301,fase_id:id(210)}],campeonato_configuracoes:[{campeonato_id:champ}],tokens:[{id:id(30000),token:'GROUP',tipo:'team_invite',status:'ativo',usado:false,expira_em:'2099-01-01T00:00:00.000Z',campeonato_id:champ,grupo_id:group,slot_id:null}],
    equipe_lines:Array.from({length:601},(_,n)=>({id:id(1000+n),equipe_id:team,nome:`Line ${n}`,tag:'DZ',logo_url:null,status:'ativo',created_at:'2020-01-01'})),
    campeonato_slots:Array.from({length:301},(_,n)=>({id:id(5000+n),campeonato_id:champ,grupo_id:group,slot_numero:n+1,slot_letra:String(n+1),equipe_id:n<300?team:null,line_id:n<300?id(1000+n):null,status:n<300?'ocupado':'livre'})),
    campeonato_equipes:Array.from({length:301},(_,n)=>({id:id(10000+n),campeonato_id:champ,grupo_id:n<300?group:id(201),slot_id:n<300?id(5000+n):null,slot_numero:n<300?n+1:null,equipe_id:team,line_id:id(1000+n),nome_exibicao:`Line ${n}`,status:'ativo'})),
    campeonato_jogadores:Array.from({length:1203},(_,n)=>({id:id(20000+n),campeonato_id:champ,campeonato_equipe_id:id(10000+n%300),nick:`Player ${n}`,id_jogo:String(n+50000),status:'ativo',slot_numero:n%4+1})),
    equipes:[{id:team,nome:'Fixture team',tag:'DZ',logo_url:null}],
    campeonato_links:[{id:id(35000),token:'GROUP',tipo:'inscricao_equipes_grupo',titulo:'Fixture link',ativo:true,campeonato_id:champ,grupo_id:group,expira_em:'2099-01-01T00:00:00.000Z',metadata:{limite_vagas:3,usos:0,entradas:[],expected_teams:[]},descricao:'Fixture human description',updated_at:'2026-01-01T00:00:00.000Z',deleted_at:null}],
    campeonato_links_inscricao:[{id:id(36000),campeonato_id:champ,campeonato_equipe_id:id(10000),token:'PRIVATE-LINEUP',tipo:'escalacao_line',ativo:true,expira_em:'2099-01-01T00:00:00.000Z',limite_jogadores:6}],
  }
  tables.vw_campeonato_slots_lines=tables.campeonato_slots.map((slot,n)=>({...slot,slot_id:slot.id,participacao_id:n<300?id(10000+n):null,status_ui:n<300?'ocupada':'livre',line_nome:n<300?`Line ${n}`:null,equipe_nome:n<300?'Fixture team':null}))
  tables.campeonato_jogadores.push({id:id(29999),campeonato_id:foreign,campeonato_equipe_id:id(10000),nick:'PRIVATE',status:'ativo'})
  tables.equipe_lines.push({id:id(99990),equipe_id:foreign,nome:'PRIVATE',status:'ativo'})
  controllable=[{id:team,nome:'Fixture team',papel:'dono',permissoes:{pode_ver:true,pode_editar:true,pode_escalar:true,pode_gerar_token:true}}]
}
function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})}
function selected(rows,params){const columns=split(params.get('select')||'*');return rows.map(row=>columns.includes('*')?{...row}:Object.fromEntries(columns.filter(column=>column in row).map(column=>[column,row[column]])))}
const admin=createClient('https://fixture.supabase.co','fixture-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,options)=>{
  const url=new URL(input);assert.equal(url.hostname,'fixture.supabase.co')
  const params=url.searchParams,table=url.pathname.split('/').at(-1),method=options?.method||'GET',body=options?.body?JSON.parse(options.body):null
  const call={table,method,params:Object.fromEntries(params),body};calls.push(call)
  beforeRequest?.(call)
  if(failure?.table===table&&(!failure.method||method===failure.method)&&Number(params.get('offset')||0)>=failure.offset)return response({code:failure.code||'XX001',message:'Fixture read/write failure'},400)
  const filters=[...params].filter(([column])=>!['select','order','offset','limit'].includes(column))
  const accepts=row=>filters.every(([column,filter])=>column==='metadata'&&filter.startsWith('eq.') ? JSON.stringify(row.metadata)===filter.slice(3) : filter.startsWith('imatch.') ? row[column]!=null&&new RegExp(filter.slice(7),'i').test(String(row[column])) : match(row,column==='or'?filter:`${column}.${filter}`))
  let rows
  if(method==='GET'){
    const signature=JSON.stringify([version,table,filters,params.get('order')])
    rows=queryCache.get(signature)
    if(!rows){
      rows=(tables[table]||[]).filter(accepts)
      const order=(params.get('order')||'').split(',').filter(Boolean).map(value=>value.split('.'))
      rows=[...rows].sort((a,b)=>{for(const[column,direction]of order){const difference=typeof a[column]==='number'&&typeof b[column]==='number'?a[column]-b[column]:String(a[column]??'').localeCompare(String(b[column]??''));if(difference)return direction==='desc'?-difference:difference}return 0})
      queryCache.set(signature,rows)
    }
    rows=rows.slice(Number(params.get('offset')||0),Number(params.get('offset')||0)+Math.min(7,Number(params.get('limit')||1000)))
  }else if(method==='PATCH'){
    rows=(tables[table]||[]).filter(accepts)
    for(const row of rows){
      const prior={...row};Object.assign(row,body)
      // Deployed legacy trigger is modeled separately from the app mirror; native schema remains separately reviewed.
      if(table==='campeonato_equipes'&&prior.status==='ativo'&&row.status!=='ativo'){
        const slot=tables.campeonato_slots.find(slot=>slot.id===prior.slot_id)
        if(slot&&((prior.line_id!=null&&slot.line_id===prior.line_id)||(prior.line_id==null&&slot.equipe_id===prior.equipe_id)||slot.status==='ocupado'))Object.assign(slot,{line_id:null,equipe_id:null,status:'livre'})
      }
    }
    version++
  }else if(method==='POST'){
    const row={...body,id:id(generated++),created_at:'2026-10-11'}
    if(table==='campeonato_equipes'&&tables[table].some(part=>(part.status==='ativo'&&part.slot_id&&part.slot_id===row.slot_id)||(part.line_id&&part.campeonato_id===row.campeonato_id&&part.line_id===row.line_id)))return response({code:'23505',details:'slot_id',message:'unique fixture'},400)
    tables[table]||=[];tables[table].push(row);rows=[row]
    if(table==='campeonato_equipes'){
      const slot=tables.campeonato_slots.find(slot=>slot.id===row.slot_id)
      Object.assign(slot,{line_id:row.line_id,equipe_id:row.equipe_id,status:'ocupado'})
      const view=tables.vw_campeonato_slots_lines.find(item=>item.slot_id===row.slot_id)
      if(view)Object.assign(view,{line_id:row.line_id,equipe_id:row.equipe_id,participacao_id:row.id,status_ui:'ocupada'})
    }
    version++
  }else throw new Error(`Unexpected fixture method ${method}`)
  const projected=selected(rows,params),object=new Headers(options?.headers).get('accept')?.includes('application/vnd.pgrst.object+json')
  const result=response(object?(projected.length===1?projected[0]:null):projected)
  afterRequest?.(call);return result
}}})
const actor={user:{id:user},accounts:[{id:team,profile_type:'equipe',name:'Fixture team',data:{tag:'DZ'}}]}
const load=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:admin},'@backend/equipes/manager-team-access':{listControllableEquipes:async()=>controllable},'@backend/auth/server-auth':{getBearerUser:async req=>{if(!req.headers?.get('authorization'))throw new Error('Sessao ausente.');return actor.user},getAccountsForUser:async()=>actor.accounts}})
const sync=load('backend/src/campeonatos/participacao-sync.ts'),permissions=load('backend/src/dropzone/entities/permissions.ts')
const reads=load('backend/src/campeonatos/invites/team-invite-read.ts'),accept=load('backend/src/campeonatos/invites/team-invite-accept.ts')
const route=load('web/app/api/convites/equipe/[token]/route.ts')
const policy=load('backend/src/admin/aprovacao.ts')
const groupRoute=load('web/app/api/convites/grupo/[token]/route.ts')
const ctx=token=>({params:Promise.resolve({token})})
const writes=()=>calls.filter(call=>!['GET','HEAD'].includes(call.method))
const groupRead=load('backend/src/campeonatos/invites/group-invite-read.ts')
const groupAccept=load('backend/src/campeonatos/invites/group-invite-accept.ts')
const state=load('backend/src/campeonatos/invites/group-link-state.ts')
const link=()=>tables.campeonato_links[0]
const req=auth=>({headers:new Headers(auth?{authorization:'Bearer fixture'}:{}),nextUrl:new URL('https://fixture.test/api/convites/grupo/GROUP'),json:async()=>({})})
const entry=n=>({participacao_id:id(39000+n),equipe_id:team,equipe_nome:'Fixture team',line_id:id(1600),line_nome:'Fixture line',slot_id:id(5300),slot_letra:'301',slot_numero:301,entrou_em:'2026-10-11T00:00:00.000Z'})
reset()
for(const body of [null,[],true,'invalid'])await assert.rejects(()=>groupAccept.acceptGroupInvite(actor,'GROUP',body),/Dados de inscrição inválidos/)
assert.equal(calls.length,0,'invalid bodies must not reach database services')
tables.campeonato_equipes[0].nome_exibicao='LEGACY REFERENCE'
const snapshot=JSON.stringify(tables)
const anonymous=await groupRead.readGroupInvite('GROUP',null)
assert.equal(anonymous.vagas.length,301);assert.equal(anonymous.resumo_grupo.livres,1)
assert.equal(anonymous.vagas.reduce((sum,v)=>sum+v.quantidade_jogadores,0),1203)
assert.equal(anonymous.vagas[0].line_nome,'Line 0')
assert.equal(anonymous.autenticado,false);assert.ok(!JSON.stringify(anonymous).includes('PRIVATE'))
const logged=await groupRead.readGroupInvite('GROUP',actor)
assert.equal(logged.minhas_participacoes.length,300);assert.equal(logged.lines.length,300)
assert.equal(logged.minhas_participacoes[0].nome_exibicao,'Line 0')
assert.equal(logged.minhas_participacoes.reduce((sum,p)=>sum+p.quantidade_jogadores,0),1203)
assert.equal(logged.minhas_participacoes[0].link_escalacao.token,'PRIVATE-LINEUP')
assert.ok(!JSON.stringify(logged).includes('PRIVATE"'))
assert.equal(writes().length,0);assert.equal(JSON.stringify(tables),snapshot,'GET must not heal legacy data')
for(const call of calls){
  if(['campeonato_jogadores','campeonato_links_inscricao','campeonato_grupos'].includes(call.table))assert.equal(call.params.campeonato_id,`eq.${champ}`)
  for(const filter of Object.values(call.params))if(filter.startsWith('in.('))assert.ok(split(filter.slice(4,-1)).length<=150)
}

failure={table:'vw_campeonato_slots_lines',offset:7}
const lateFailure=await groupRoute.GET(req(false),ctx('GROUP'))
assert.equal(lateFailure.status,404);assert.equal(lateFailure.headers.get('cache-control'),'no-store')
assert.ok(!JSON.stringify(await lateFailure.json()).includes('Fixture read/write failure'))
failure={table:'vw_campeonato_slots_lines',offset:0,code:'42P01'}
const fallback=await groupRead.readGroupInvite('GROUP',null)
assert.equal(fallback.vagas.length,301);assert.equal(fallback.resumo_grupo.livres,1)
assert.equal(fallback.vagas.reduce((sum,v)=>sum+v.quantidade_jogadores,0),1203)
tables.campeonato_equipes[0].slot_numero=9999;version++
const canonicalFallback=await groupRead.readGroupInvite('GROUP',null)
assert.equal(canonicalFallback.vagas[0].campeonato_equipe_id,id(10000))
assert.equal(writes().length,0)

reset()
for(const token of ['%','*','_','GRO%','GRO*','GROUP_','.*','^GROUP$','GROUP|PRIVATE','(GROUP)','GROUP$'])await assert.rejects(()=>groupRead.readGroupInvite(token,null),/inválido/)
assert.equal((await groupRead.readGroupInvite('group',null)).link.token,'GROUP')
link().token='LITERAL_%*.[X](Y)|+$';version++
assert.equal((await groupRead.readGroupInvite('literal_%*.[x](y)|+$',null)).link.token,'LITERAL_%*.[X](Y)|+$')
assert.equal(writes().length,0)

for(const parentStatus of ['banido','suspenso','excluido']){
  reset();tables.campeonatos[0].status=parentStatus;version++
  await assert.rejects(()=>groupRead.readGroupInvite('GROUP',actor),/indisponível/)
  assert.ok(!calls.some(call=>['vw_campeonato_slots_lines','campeonato_jogadores','equipe_lines','campeonato_grupos'].includes(call.table)))
}
reset();tables.campeonato_grupos[0].campeonato_id=foreign;version++
await assert.rejects(()=>groupRead.readGroupInvite('GROUP',null),/não encontrado neste campeonato/)
reset();tables.vw_campeonato_slots_lines=[];version++
const empty=await groupRead.readGroupInvite('GROUP',null)
assert.equal(empty.inscricao_aberta,false);assert.equal(empty.status_link,'grupo_cheio');assert.equal(empty.vagas.length,0)
assert.ok(!calls.some(call=>call.table==='campeonato_slots'))

reset();failure={table:'campeonato_links_inscricao',offset:0}
const sessionFailure=await groupRoute.GET(req(true),ctx('GROUP'))
assert.equal(sessionFailure.status,404);assert.ok(!(await sessionFailure.json()).autenticado)
reset();controllable[0].permissoes.pode_editar=false;controllable[0].permissoes.pode_escalar=false
controllable[0].permissoes.pode_gerar_token=false
const readonly=await groupRead.readGroupInvite('GROUP',actor)
assert.equal(readonly.equipe.pode_inscrever,false);assert.equal(readonly.equipe.pode_criar_line,false)
assert.equal(readonly.minhas_participacoes[0].link_escalacao,null)
assert.ok(!JSON.stringify(readonly).includes('PRIVATE-LINEUP'))
await assert.rejects(()=>groupAccept.acceptGroupInvite(actor,'GROUP',{equipe_id:team,line_id:id(1600)}),/permissão/)
assert.equal(writes().length,0)
controllable[0].permissoes.pode_escalar=true
await assert.rejects(()=>groupAccept.acceptGroupInvite(actor,'GROUP',{equipe_id:team,nome_line:'New fixture'}),/line existente/)
assert.equal(writes().length,0)
await assert.rejects(()=>groupAccept.acceptGroupInvite(actor,'GROUP',{equipe_id:team,line_id:id(99990),slot_id:id(5300)}),/nao pertence/)
assert.equal(writes().length,0)

reset()
const initial=structuredClone(link())
const receipt=await state.consumirVagaDoLink(initial)
assert.equal(receipt.usos,1);assert.equal(link().metadata.usos,1)
assert.equal(await state.devolverVagaDoLink(receipt),true)
assert.equal(link().metadata.usos,0);assert.equal(link().ativo,true)
assert.notEqual(link().metadata._group_revision,receipt.after.metadata._group_revision)
const a=await state.consumirVagaDoLink(initial),b=await state.consumirVagaDoLink(initial)
assert.equal(await state.devolverVagaDoLink(a),false);assert.equal(link().metadata.usos,2)
await Promise.all([state.registrarEntradaNoLink(initial,entry(1)),state.registrarEntradaNoLink(initial,entry(2))])
assert.equal(link().metadata.entradas.length,2);assert.equal(link().metadata.usos,2)
assert.equal(await state.devolverVagaDoLink(b),false,'a later history append must survive compensation')

for(const change of [row=>{row.ativo=false;row.metadata.closed_reason='pausado'},row=>{row.expira_em='2020-01-01'},row=>{row.deleted_at='2026-10-11'},row=>{row.grupo_id=foreign}]){
  reset();const current=structuredClone(link()),consumed=await state.consumirVagaDoLink(current)
  change(link());version++
  const saved=JSON.stringify(link())
  assert.equal(await state.devolverVagaDoLink(consumed),false)
  assert.equal(JSON.stringify(link()),saved)
}
reset();link().metadata.limite_vagas=2;version++
const limited=structuredClone(link())
const concurrent=await Promise.allSettled(Array.from({length:6},()=>state.consumirVagaDoLink(limited)))
assert.equal(concurrent.filter(result=>result.status==='fulfilled').length,2)
assert.equal(link().metadata.usos,2);assert.equal(link().ativo,false)
reset();link().expira_em='invalid-date';version++
await assert.rejects(()=>state.consumirVagaDoLink(structuredClone(link())),/expirou/);assert.equal(writes().length,0)

reset();failure={table:'campeonato_equipes',method:'POST',offset:0}
await assert.rejects(()=>groupAccept.acceptGroupInvite(actor,'GROUP',{equipe_id:team,line_id:id(1600),slot_id:id(5300)}))
assert.equal(link().metadata.usos,0);assert.equal(link().ativo,true)
reset();failure={table:'campeonato_equipes',method:'POST',offset:0}
afterRequest=call=>{if(call.table==='campeonato_links'&&call.method==='PATCH'){link().ativo=false;link().metadata.closed_reason='pausado';link().metadata.usos=2;version++;afterRequest=null}}
await assert.rejects(()=>groupAccept.acceptGroupInvite(actor,'GROUP',{equipe_id:team,line_id:id(1600),slot_id:id(5300)}))
assert.equal(link().metadata.usos,2);assert.equal(link().ativo,false);assert.equal(link().metadata.closed_reason,'pausado')
reset()
const accepted=await groupAccept.acceptGroupInvite(actor,'GROUP',{equipe_id:team,line_id:id(1600),slot_id:id(5300)})
assert.equal(accepted.ok,true);assert.equal(accepted.slot_id,id(5300));assert.equal(accepted.link.usos,1)
assert.ok(!calls.some(call=>['campeonato_jogadores','campeonato_links_inscricao'].includes(call.table)),'POST must not load public or private rosters')
assert.equal(link().metadata.entradas.length,1);assert.equal(link().ativo,false);assert.equal(link().metadata.closed_reason,'grupo_cheio')

// The complete snapshot also works when the legacy schema only has descricao.
reset();delete link().metadata;delete link().deleted_at
link().descricao='__dz_meta__:'+JSON.stringify({limite_vagas:2,usos:0,entradas:[]});version++
const legacy=await state.consumirVagaDoLink(structuredClone(link()))
assert.equal(legacy.usos,1);assert.equal(await state.devolverVagaDoLink(legacy),true)
assert.equal(JSON.parse(link().descricao.split('__dz_meta__:')[1]).usos,0)
assert.equal('metadata' in link(),false)
for(const [config,status] of [
  [{aceita_novas_inscricoes_equipes:false},'inscricoes_fechadas'],
  [{data_limite_inscricao:'2020-01-01T00:00:00Z'},'prazo_encerrado'],
  [{data_limite_inscricao:'invalid-date'},'prazo_invalido'],
]){
  reset();Object.assign(tables.campeonato_configuracoes[0],config);version++
  const view=await groupRead.readGroupInvite('GROUP',actor)
  assert.equal(view.inscricao_aberta,false);assert.equal(view.modo,'acompanhamento');assert.equal(view.status_link,status)
  await assert.rejects(()=>groupAccept.acceptGroupInvite(actor,'GROUP',{equipe_id:team,line_id:id(1600),slot_id:id(5300)}),/fechadas|prazo/)
  await assert.rejects(()=>state.consumirVagaDoLink(structuredClone(link())),/fechadas|prazo/)
  assert.equal(writes().length,0,'closed championship cannot consume quota or create participation/line')
}
reset();failure={table:'campeonato_configuracoes',offset:0}
await assert.rejects(()=>groupRead.readGroupInvite('GROUP',actor),error=>error.message==='Fixture read/write failure')
await assert.rejects(()=>groupAccept.acceptGroupInvite(actor,'GROUP',{equipe_id:team,line_id:id(1600)}),error=>error.message==='Fixture read/write failure')
assert.equal(writes().length,0)
reset();afterRequest=call=>{if(call.table==='campeonato_equipes'&&call.method==='POST'){tables.campeonato_configuracoes[0].aceita_novas_inscricoes_equipes=false;version++;afterRequest=null}}
await assert.rejects(()=>groupAccept.acceptGroupInvite(actor,'GROUP',{equipe_id:team,line_id:id(1600),slot_id:id(5300)}),/fechadas/)
assert.equal(link().metadata.usos,0);assert.equal(tables.campeonato_slots[300].line_id,null)
assert.equal(tables.campeonato_configuracoes[0].aceita_novas_inscricoes_equipes,false)
console.log('Group invitation policy: closed/expired/invalid championship configuration, read failures and late closure preserve accompaniment and reject enrollment.')
console.log(JSON.stringify({serverCap:7,slots:301,lines:601,publicPlayers:1203,maxIn:150,getWrites:0,literalToken:true,publicParentGuard:true,sessionFailuresPropagate:true,staffPermissions:true,canonicalFallback:true,concurrentCounter:{requests:6,accepted:2,limit:2},safeCompensation:true,historyMerge:true,legacyDescricao:true,realWrites:0,scope:'Supabase JS client with HTTP fixtures and controlled interleavings; not parallel native PostgreSQL enrollment.'}))
