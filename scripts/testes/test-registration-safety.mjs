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
  tables={campeonatos:[{id:champ,nome:'Fixture championship',logo_url:null,aprovacao_status:'aprovado',status:'ativo',deleted_at:null}],campeonato_grupos:[{id:group,campeonato_id:champ,nome:'Fixture group',fase_id:id(210)}],campeonato_configuracoes:[{campeonato_id:champ}],tokens:[{id:id(30000),token:'GROUP',tipo:'team_invite',status:'ativo',usado:false,expira_em:'2099-01-01T00:00:00.000Z',campeonato_id:champ,grupo_id:group,slot_id:null}],
    equipe_lines:Array.from({length:601},(_,n)=>({id:id(1000+n),equipe_id:team,nome:`Line ${n}`,tag:'DZ',logo_url:null,status:'ativo',created_at:'2020-01-01'})),
    campeonato_slots:Array.from({length:301},(_,n)=>({id:id(5000+n),campeonato_id:champ,grupo_id:group,slot_numero:n+1,slot_letra:String(n+1),equipe_id:n<300?team:null,line_id:n<300?id(1000+n):null,status:n<300?'ocupado':'livre'})),
    campeonato_equipes:Array.from({length:301},(_,n)=>({id:id(10000+n),campeonato_id:champ,grupo_id:n<300?group:id(201),slot_id:n<300?id(5000+n):null,slot_numero:n<300?n+1:null,equipe_id:team,line_id:id(1000+n),nome_exibicao:`Line ${n}`,status:'ativo'})),
    campeonato_jogadores:Array.from({length:1203},(_,n)=>({id:id(20000+n),campeonato_id:champ,campeonato_equipe_id:id(10000+n%300),nick:`Player ${n}`,id_jogo:String(n+50000),status:'ativo',slot_numero:n%4+1})),
    equipes:[{id:team,tag:'DZ',logo_url:null}],
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
  const accepts=row=>filters.every(([column,filter])=>match(row,column==='or'?filter:`${column}.${filter}`))
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
reset()
const publicView=await reads.readTeamInvite('GROUP',null)
assert.equal(publicView.vagas.length,301);assert.equal(publicView.resumo_grupo.livres,1)
assert.equal(publicView.vagas.reduce((sum,row)=>sum+row.quantidade_jogadores,0),1203)
assert.ok(!JSON.stringify(publicView).includes('PRIVATE'))
const loggedView=await reads.readTeamInvite('GROUP',actor)
assert.equal(loggedView.lines.length,300);assert.equal(loggedView.lines.at(-1).id,id(1600))
assert.equal(loggedView.equipe.pode_inscrever,true)
assert.equal((await sync.listSlotsLinesView(champ,{grupoId:group})).rows.length,301)
assert.ok(calls.filter(call=>call.table==='campeonato_jogadores').every(call=>call.params.campeonato_id===`eq.${champ}`))
for(const call of calls)for(const value of Object.values(call.params))if(value.startsWith('in.('))assert.ok(split(value.slice(4,-1)).length<=150)
failure={table:'vw_campeonato_slots_lines',offset:7}
await assert.rejects(()=>reads.readTeamInvite('GROUP',null),error=>error.message==='Fixture read/write failure')
failure={table:'vw_campeonato_slots_lines',offset:0,code:'42P01'}
const fallback=await reads.readTeamInvite('GROUP',null)
assert.equal(fallback.vagas.length,301);assert.equal(fallback.resumo_grupo.livres,1)
assert.equal(fallback.vagas.reduce((sum,row)=>sum+row.quantidade_jogadores,0),1203)

reset()
const usedLine=tables.equipe_lines[300].nome
await assert.rejects(()=>sync.resolveLineForInscricao({equipeId:team,campeonatoId:champ,nomeLine:usedLine}),/já está inscrita/)
assert.equal(writes().length,0,'a used line outside the first server page must not be recreated')
await assert.rejects(()=>sync.inserirParticipacaoNoSlot({campeonatoId:champ,slotId:id(5300),lineId:id(99990),equipeId:team,nomeExibicao:'Foreign',origem:'convite',criadoPor:user}),/nao pertence/)
assert.equal(writes().length,0)
for(const status of ['suspenso','banido','excluido']){tables.campeonatos[0].status=status;version++;await assert.rejects(()=>policy.assertCampeonatoNoAr(champ),/indisponível/);await assert.rejects(()=>reads.readTeamInvite('GROUP',null),/indisponível/)}

reset()
afterRequest=call=>{if(call.table==='campeonato_equipes'&&call.method==='PATCH'){Object.assign(tables.campeonato_slots[0],{line_id:id(88888),equipe_id:foreign,status:'ocupado'});afterRequest=null;version++}}
await sync.softRemoveParticipacao(id(10000))
assert.equal(tables.campeonato_slots[0].line_id,id(88888),'compensation must not release a slot reassigned after its trigger ran')
assert.equal(tables.campeonato_slots[0].equipe_id,foreign)
const noMoreWrites=writes().length;await sync.softRemoveParticipacao(id(10000));assert.equal(writes().length,noMoreWrites)

reset()
beforeRequest=call=>{if(call.table==='campeonato_equipes'&&call.method==='PATCH'){Object.assign(tables.campeonato_equipes[0],{line_id:id(88888)});beforeRequest=null;version++}}
await assert.rejects(()=>sync.softRemoveParticipacao(id(10000)),/mudou durante/)
assert.equal(tables.campeonato_equipes[0].status,'ativo')
assert.equal(calls.filter(call=>call.table==='campeonato_slots'&&call.method==='PATCH').length,0)

reset()
const staleSlot={...tables.campeonato_slots[0]}
tables.campeonato_equipes[0].status='removido';Object.assign(tables.campeonato_slots[0],{line_id:id(88888),equipe_id:foreign})
await assert.rejects(()=>permissions.freeSlotParticipation(staleSlot),/mudou durante/)
assert.equal(tables.campeonato_slots[0].line_id,id(88888))

reset()
const expectedParticipation={...tables.campeonato_equipes[0]}
Object.assign(tables.campeonato_equipes[0],{grupo_id:id(201),slot_id:id(5300),slot_numero:301});version++
await assert.rejects(()=>sync.softRemoveParticipacao(expectedParticipation.id,expectedParticipation),/mudou durante/)
assert.equal(writes().length,0,'a participation reassigned before compensation is read must be preserved')
reset()
afterRequest=call=>{if(call.table==='campeonato_equipes'&&call.method==='GET'){Object.assign(tables.campeonato_equipes[0],{grupo_id:id(201),slot_id:id(5300),slot_numero:301});version++;afterRequest=null}}
await assert.rejects(()=>permissions.freeSlotParticipation({...tables.campeonato_slots[0]}),/mudou durante/)
assert.equal(writes().length,0,'slot removal passes its original participation snapshot to the remover')
reset()
failure={table:'campeonato_slots',method:'PATCH',offset:0}
await assert.rejects(()=>sync.softRemoveParticipacao(id(10000)),error=>error.message==='Fixture read/write failure')
reset()
let bodyReads=0
const anonymous=await route.POST({headers:new Headers(),json:async()=>{bodyReads++;return {}}},ctx('GROUP'))
assert.equal(anonymous.status,400);assert.equal(bodyReads,0);assert.equal(calls.length,0)
controllable[0].papel='staff';controllable[0].permissoes.pode_editar=false;controllable[0].permissoes.pode_escalar=false
await assert.rejects(()=>accept.acceptTeamInvite(actor,'GROUP',{line_id:id(1600)}),/Sem permissão/)
assert.equal(calls.length,0,'read-only staff is rejected before token/line access')
const readonlyGroup=await groupRoute.POST({headers:new Headers({authorization:'Bearer fixture'}),json:async()=>({line_id:id(1600)})},ctx('GROUP'))
assert.equal(readonlyGroup.status,400);assert.match((await readonlyGroup.json()).error,/Sem permissão/);assert.equal(calls.length,0)
controllable[0].permissoes.pode_escalar=true
await assert.rejects(()=>accept.acceptTeamInvite(actor,'GROUP',{nome_line:'New line'}),/line existente/)
assert.equal(calls.length,0)
const selectedResponse=await reads.readTeamInvite('GROUP',actor)
assert.equal(selectedResponse.equipe.pode_criar_line,false)
const acceptStart=calls.length
const accepted=await accept.acceptTeamInvite(actor,'GROUP',{line_id:id(1600)})
assert.equal(accepted.slot.id,id(5300));assert.equal(accepted.line.criada_agora,false)
assert.equal(tables.tokens[0].usado,true)
assert.equal(tables.campeonato_slots[300].line_id,id(1600))
assert.ok(!calls.slice(acceptStart).some(call=>['vw_campeonato_slots_lines','campeonato_jogadores'].includes(call.table)),'accept does not fetch the public group board or roster')
await assert.rejects(()=>accept.acceptTeamInvite(actor,'GROUP',{line_id:id(1599)}),/expirou ou já foi utilizado/)

reset()
await assert.rejects(()=>accept.acceptTeamInvite(actor,'GROUP',{slot_id:id(99998),nome_line:'No orphan'}),/Nenhum slot livre/)
assert.equal(writes().length,0,'invalid explicit slots never silently choose another slot or create a line')
tables.tokens[0].slot_id=id(99998);version++
tables.campeonato_slots.push({id:id(99998),campeonato_id:foreign,grupo_id:group,status:'livre'})
await assert.rejects(()=>accept.acceptTeamInvite(actor,'GROUP',{nome_line:'No orphan'}),/neste campeonato/)
assert.equal(writes().length,0)

reset()
tables.campeonato_equipes.push({id:id(99980),campeonato_id:champ,line_id:id(1600),equipe_id:team,status:'removido',slot_id:null});version++
await assert.rejects(()=>accept.acceptTeamInvite(actor,'GROUP',{line_id:id(1600)}),/ocupado|Conflito|inscrita/)
assert.equal(tables.tokens[0].usado,false);assert.equal(tables.campeonato_slots[300].line_id,null)
const enrollmentPolicy=load('backend/src/campeonatos/invites/enrollment-policy.ts')
const at=Date.parse('2026-10-11T10:00:00Z')
assert.equal(enrollmentPolicy.enrollmentStatus({data_limite_inscricao:'2026-10-11T10:00:00Z'},at),'prazo_encerrado')
assert.equal(enrollmentPolicy.enrollmentStatus({data_limite_inscricao:'2026-10-11T10:00:01Z'},at),'aberto')
for(const config of [
  {aceita_novas_inscricoes_equipes:false},
  {data_limite_inscricao:'2020-01-01T00:00:00Z'},
  {data_limite_inscricao:'invalid-date'},
]){
  reset();Object.assign(tables.campeonato_configuracoes[0],config);version++
  const view=await reads.readTeamInvite('GROUP',actor)
  assert.equal(view.inscricao_aberta,false);assert.equal(view.modo,'acompanhamento');assert.ok(view.status_mensagem)
  await assert.rejects(()=>accept.acceptTeamInvite(actor,'GROUP',{line_id:id(1600)}),/fechadas|prazo/)
  assert.equal(writes().length,0,'closed/expired/invalid championship policy must be checked before writes')
}
reset();tables.campeonatos[0].aprovacao_status='pendente';version++
await assert.rejects(()=>reads.readTeamInvite('GROUP',actor),/aguardando aprovação/)
assert.ok(!calls.some(call=>['campeonato_grupos','equipe_lines','campeonato_jogadores'].includes(call.table)))
reset();failure={table:'campeonato_configuracoes',method:'GET',offset:0}
await assert.rejects(()=>accept.acceptTeamInvite(actor,'GROUP',{line_id:id(1600)}),error=>error.message==='Fixture read/write failure')
assert.equal(writes().length,0)
reset();afterRequest=call=>{if(call.table==='campeonato_equipes'&&call.method==='POST'){tables.campeonato_configuracoes[0].aceita_novas_inscricoes_equipes=false;version++;afterRequest=null}}
await assert.rejects(()=>accept.acceptTeamInvite(actor,'GROUP',{line_id:id(1600)}),/fechadas/)
assert.equal(tables.tokens[0].usado,false);assert.equal(tables.campeonato_slots[300].line_id,null)
assert.equal(tables.campeonato_configuracoes[0].aceita_novas_inscricoes_equipes,false)
console.log('Championship enrollment policy: closure/deadline/invalid date/read failure/late closure and approved parent enforced for team invites.')
for(const literal of ['literal%2F.*', 'literal%not-encoded']){
  reset();tables.tokens[0].token=literal;version++
  assert.equal((await reads.loadTeamInvite(literal,false)).convite.token,literal)
  assert.equal(calls.find(call=>call.table==='tokens').params.token,`eq.${literal}`)
  assert.equal(writes().length,0)
}
reset()
beforeRequest=call=>{if(call.table==='tokens'&&call.method==='PATCH'){tables.tokens[0].status='revogado';version++;beforeRequest=null}}
await assert.rejects(()=>accept.acceptTeamInvite(actor,'GROUP',{line_id:id(1600)}),/já foi utilizado/)
assert.equal(tables.tokens[0].usado,false)
assert.equal(tables.campeonato_slots[300].line_id,null)
assert.ok(!tables.campeonato_equipes.some(part=>part.line_id===id(1600)&&part.status==='ativo'))
reset()
beforeRequest=call=>{if(call.table==='tokens'&&call.method==='PATCH'){tables.tokens[0].expira_em='2020-01-01';version++;beforeRequest=null}}
await assert.rejects(()=>accept.acceptTeamInvite(actor,'GROUP',{line_id:id(1600)}),/já foi utilizado/)
assert.equal(tables.tokens[0].usado,false);assert.equal(tables.campeonato_slots[300].line_id,null)
console.log(JSON.stringify({serverCap:7,lines:601,slots:301,publicPlayers:1203,maxIn:150,scopeVerified:true,lateErrors:true,missingViewFallback:true,staleCompensationPreservesNewOwner:true,changedParticipationProtected:true,staffPermissionsEnforced:true,foreignLineAndSlotRejected:true,revokedAndExpiredTokenAtConsumptionRejected:true,bodyAfterAuthentication:true,acceptSkipsPublicBoard:true,legacyGlobalLineConstraintDetected:true,realWrites:0,concurrencyScope:'Scripted interleavings; not real parallel PostgreSQL transactions.'}))
