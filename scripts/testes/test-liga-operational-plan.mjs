import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {fixtureLoader} from './ts-fixture-loader.mjs'
import {ligaQuotaCases} from './liga-quota-cases.mjs'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const champ=id(2),group=id(3),actor=id(1)
const plan={nome_agrupamento:'Séries',divisoes:[{id:id(4),nome:'Série A',codigo:'A',equipes:'4',secret:'DO NOT EXPORT',entradas:[{id:id(5),tipo:'mantida',quantidade:'1',origem_agrupamento_id:'',secret:'DO NOT EXPORT'},{id:id(6),tipo:'convite_direto',quantidade:'2',origem_agrupamento_id:''}]}]}
const pure=fixtureLoader()('backend/src/campeonatos/liga-plan.ts')
const {ligaOriginChoices:choices,validateLigaOrigin:validate}=pure
const {normalizeLeagueDivisions}=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:{}}})('backend/src/dropzone/entities/championship-config.ts')
let cases=0
const pass=fn=>{fn();cases++}
const occupied=[{grupo_id:group,equipe_id:id(7),origem_entrada:'liga_mantida'}]
pass(()=>assert.deepEqual(choices(plan,' SÉRIE A ',group,occupied).map(o=>[o.tipo,o.quota,o.used,o.remaining]),[['mantida',1,1,0],['convite_direto',2,0,2]]))
pass(()=>assert.equal(validate(null,'','', 'unexpected',[]),undefined))
pass(()=>assert.equal(validate(plan,'Série A',group,'convite_direto',occupied),'convite_direto'))
for(const origin of ['', 'organizador','liga_convite_direto','mantida'])pass(()=>assert.throws(()=>validate(plan,'Série A',group,origin,occupied)))
pass(()=>assert.equal(choices(plan,'Série A',group,occupied,[{grupo_id:group,origem_entrada:'convite_direto'}])[1].remaining,1))
pass(()=>assert.throws(()=>validate(plan,'Série A',group,'convite_direto',occupied,Array(2).fill({grupo_id:group,origem_entrada:'convite_direto'}))))
pass(()=>assert.equal(choices(plan,'Série A',group,[{grupo_id:id(99),equipe_id:id(7),origem_entrada:'liga_mantida'},{grupo_id:group,origem_entrada:'liga_mantida'}])[0].used,0))
pass(()=>assert.throws(()=>choices(plan,'Missing',group,[])))
pass(()=>assert.throws(()=>choices({...plan,divisoes:[...plan.divisoes,...plan.divisoes]},'Série A',group,[])))
for(const quantity of ['', 'NaN','Infinity','-1','1.5','1e2','9007199254740992'])pass(()=>assert.throws(()=>choices({...plan,divisoes:[{...plan.divisoes[0],entradas:[{tipo:'mantida',quantidade:quantity}]}]},'Série A',group,[])))
pass(()=>assert.throws(()=>choices({...plan,divisoes:[{...plan.divisoes[0],entradas:[{tipo:'unknown',quantidade:'2'}]}]},'Série A',group,[])))
pass(()=>assert.equal(choices({...plan,divisoes:[{...plan.divisoes[0],entradas:[{tipo:'mantida',quantidade:'1'},{tipo:'mantida',quantidade:'2'}]}]},'Série A',group,occupied)[0].remaining,2))
for(const field of ['equipes','quantidade'])for(const value of ['1.5','NaN','Infinity','-2','9007199254740992',0,true,false,{},[]])pass(()=>assert.throws(()=>normalizeLeagueDivisions([{...plan.divisoes[0],...(field==='equipes'?{equipes:value}:{entradas:[{...plan.divisoes[0].entradas[0],quantidade:value}]})}])))
pass(()=>assert.equal(normalizeLeagueDivisions(plan.divisoes)[0].entradas[1].quantidade,'2'))
for(const item of ligaQuotaCases)pass(()=>{
 const variant={...plan,divisoes:[{...plan.divisoes[0],entradas:item.entries}]}
 if(item.valid)assert.equal(choices(variant,'Série A',group,[]).find(o=>o.tipo==='vaga_paga').quota,item.quota,item.name)
 else assert.throws(()=>choices(variant,'Série A',group,[]),undefined,item.name)
})
let type='liga',permission={role:'owner',canView:true,canManage:true,canRemove:true},auth=true,missing=false,fault=false,postFixture=false,quantity='NaN',calls=[]
const admin=createClient('https://liga-fixture.invalid','fixture',{auth:{persistSession:false},global:{fetch:async(input,options)=>{
 const url=new URL(input),name=url.pathname.split('/').at(-1);calls.push({name,method:options.method||'GET',params:url.searchParams})
 if(name==='campeonatos')return Response.json({id:champ,tipo:type,nome:'Fixture',status:'ativo',aprovacao_status:'aprovado'})
 if(name==='campeonato_configuracoes')return fault?Response.json({code:'42703',message:'PRIVATE CONFIG COLUMN',details:'PRIVATE'},{status:400}):Response.json(missing?null:{liga_nome_agrupamento:plan.nome_agrupamento,liga_divisoes:postFixture?[{...plan.divisoes[0],entradas:[{...plan.divisoes[0].entradas[0],quantidade:quantity}]}]:plan.divisoes,extra:'PRIVATE'})
 if(postFixture&&name==='campeonato_slots')return Response.json({id:id(30),grupo_id:group,slot_numero:1,status:'livre'})
 if(postFixture&&name==='equipes')return Response.json({id:id(31),nome:'Fixture'})
 if(postFixture&&name==='campeonato_grupos')return Response.json({id:group,nome:'Série A'})
 return Response.json([])
}}})
const load=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:admin},'@backend/auth/server-auth':{getBearerUser:async()=>{if(!auth)throw Error('Anonymous');return{id:actor}}},'@backend/campeonatos/campeonato-permissions':{getCampeonatoPermission:async()=>permission},'@/features/lili/tools':{listUserRegistrations:async()=>[]}})
const {loadLigaConfig}=load('backend/src/campeonatos/liga-config.ts'),route=load('web/app/api/campeonatos/[id]/estrutura/route.ts'),request=new Request('https://fixture.invalid/api')
const before=process.env.PARTICIPATION_WRITE_MODE
try{
 process.env.PARTICIPATION_WRITE_MODE='legacy'
 calls=[];assert.equal(await loadLigaConfig(champ,false),null);assert.equal(calls.length,0);cases++
 type='comum';calls=[];assert.equal(await loadLigaConfig(champ,true),null);assert.equal(calls.length,1);assert.equal(calls[0].name,'campeonatos');cases++
 type='liga';calls=[];const dto=await loadLigaConfig(champ,true,'liga');assert.equal(calls.length,1);assert.ok(!JSON.stringify(dto).includes('PRIVATE'));assert.ok(!JSON.stringify(dto).includes('DO NOT EXPORT'));assert.equal(dto.divisoes[0].entradas[1].tipo,'convite_direto');cases++
 for(const can of [true,false]){
  permission={role:can?'owner':'viewer',canView:true,canManage:can,canRemove:can};calls=[]
  const response=await route.GET(request,{params:Promise.resolve({id:champ})});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const data=await response.json();assert.equal(data.campeonato.tipo,'liga');assert.equal(Boolean(data.liga),can)
  const configs=calls.filter(c=>c.name==='campeonato_configuracoes');assert.equal(configs.length,can?1:0);assert.ok(calls.every(c=>c.method==='GET'));if(can)assert.equal(configs[0].params.get('campeonato_id'),'eq.'+champ);cases++
 }
 auth=false;calls=[];const response=await route.GET(request,{params:Promise.resolve({id:champ})});assert.equal((await response.json()).liga,null);assert.equal(calls.some(c=>c.name==='campeonato_configuracoes'),false);cases++
 auth=true;permission={role:'owner',canView:true,canManage:true,canRemove:true};missing=true;assert.equal((await route.GET(request,{params:Promise.resolve({id:champ})})).status,400);cases++
 missing=false;fault=true;const failure=await route.GET(request,{params:Promise.resolve({id:champ})});assert.equal(failure.status,400);assert.ok(!JSON.stringify(await failure.json()).includes('PRIVATE'));cases++
 fault=false;postFixture=true
 const teamsRoute=load('web/app/api/campeonatos/[id]/equipes/route.ts')
 for(const q of ['NaN','Infinity','1.5','-1',true,false,null,{},[],[2]]){
  quantity=q;calls=[];const response=await teamsRoute.POST(new Request('https://fixture.invalid/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slot_id:id(30),equipe_id:id(31),line_id:id(32),origem_entrada:'mantida'})}),{params:Promise.resolve({id:champ})})
  assert.equal(response.status,400);assert.match((await response.json()).error,/quantidade inválida/);assert.ok(calls.every(c=>c.method==='GET'));assert.ok(calls.some(c=>c.name==='campeonato_configuracoes'));cases++
 }
 console.log(`Liga operational plan passed: ${cases} fixtures; quotas, batch reservations, malformed plans, private scoped GET, common/no-schema reads and no writes.`)
}finally{if(before===undefined)delete process.env.PARTICIPATION_WRITE_MODE;else process.env.PARTICIPATION_WRITE_MODE=before}
