import {test,expect,type Page} from '@playwright/test'
import {mountProgression} from '../helpers/progression-harness'
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const actor=id(1),champ=id(2),rule=id(3),execution=id(4),source=id(5),destination=id(6),phase=id(7),participant=id(8)
const fence={rule:{id:rule},source:{id:source},destination:{id:destination},phase:{id:phase},ranking:[],source_links:[],destination_links:[],participants:[]}
const preview={rule:{id:rule},phase:{id:phase},fence,candidates:[{campeonato_equipe_id:participant,colocacao:1,nome:'Equipe fixture'}],summary:{selected:1,newCount:1,conflictCount:0,canApply:true}}
const board=(mode='atomic',owner=actor)=>({ok:true,progression_write_mode:mode,progression_actor_id:owner,permission:{canManage:true},edition:{id:id(9)},franchise:{nome:'Fixture'},
 divisions:[],stages:[{id:source,nome:'Origem'},{id:destination,nome:'Destino'}],sources:[],progressions:[{id:rule,etapa_origem_id:source,etapa_destino_id:destination,posicao_inicio:1,posicao_fim:1}],
 prizes:[],dailyHours:[],teams:[],stageTeams:[],phases:[],groups:[],slots:[],groupChoiceConfigs:[],groupChoiceBlocks:[],groupChoiceHistory:[],progressionExecutions:[],progressionExecutionItems:[]})
const ack=(body:any,key:string,owner=actor,camp=champ)=>({ok:true,actor_id:owner,campeonato_id:camp,progression_action:body.action==='apply_progression'?'apply':'reverse',operation_confirmed:true,request_id:key,execution_id:body.execution_id||execution,...(body.action==='apply_progression'?{applied:1,preview}:{reversed:1})})
async function selectPreview(page:Page){await page.getByRole('combobox',{name:'Regra',exact:true}).selectOption(rule);await page.getByRole('button',{name:'Gerar prévia',exact:true}).click();await expect(page.getByText('1º · Equipe fixture',{exact:true})).toBeVisible()}
test.beforeEach(async({page})=>{await page.route('**/*',route=>route.abort('blockedbyclient'))})
test('lost response survives remount; disabled mode retains original and retry stays dedicated',async({page})=>{
 const writes:any[]=[],receipts=new Map<string,any>();let commits=0,enabled=true,mode='atomic'
 await page.route(/\/api\/campeonatos\/[^/]+\/estrutura-avancada(?:\/progressao-atomica)?$/,async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:board(mode)})
  const body=route.request().postDataJSON(),key=route.request().headers()['idempotency-key']
  if(body.action==='preview_progression')return route.fulfill({json:{ok:true,actor_id:actor,campeonato_id:champ,progression_action:'preview',preview}})
  writes.push({url:route.request().url(),body,key});expect(route.request().url()).toContain('/progressao-atomica')
  if(!enabled)return route.fulfill({status:503,json:{error:'Progressão temporariamente indisponível.'}})
  if(receipts.has(key))return route.fulfill({json:{...receipts.get(key),repetida:true}})
  commits++;receipts.set(key,ack(body,key));return route.abort('failed')
 })
 await mountProgression(page,{campeonatoId:champ,championshipType:'liga'});await selectPreview(page)
 await page.getByRole('button',{name:'Aplicar progressão',exact:true}).click();await expect(page.getByRole('button',{name:'Repetir tentativa original da progressão'})).toBeVisible()
 mode='legacy';enabled=false;await page.evaluate(()=>(window as any).remountProgression())
 await page.getByRole('button',{name:'Repetir tentativa original da progressão'}).click();await expect(page.getByRole('alert')).toContainText('temporariamente indisponível')
 enabled=true;await page.getByRole('button',{name:'Repetir tentativa original da progressão'}).click();await expect(page.getByText('1 equipe(s) promovida(s).',{exact:true})).toBeVisible()
 expect(commits).toBe(1);expect(writes).toHaveLength(3);expect(new Set(writes.map(row=>row.key)).size).toBe(1);expect(writes.every(row=>JSON.stringify(row.body)===JSON.stringify(writes[0].body))).toBeTruthy()
 await expect(page.getByRole('button',{name:'Repetir tentativa original da progressão'})).toHaveCount(0)
})
test('confirmed mutation with failed reload stays confirmed and does not create a pending retry',async({page})=>{
 let writes=0,failed=false
 await page.route(/\/api\/campeonatos\/[^/]+\/estrutura-avancada(?:\/progressao-atomica)?$/,route=>{
  if(route.request().method()==='GET')return failed?route.fulfill({status:503,json:{error:'Fixture reload failure'}}):route.fulfill({json:board()})
  const body=route.request().postDataJSON(),key=route.request().headers()['idempotency-key']
  if(body.action==='preview_progression')return route.fulfill({json:{ok:true,actor_id:actor,campeonato_id:champ,progression_action:'preview',preview}})
  writes++;failed=true;return route.fulfill({json:ack(body,key)})
 })
 await mountProgression(page,{campeonatoId:champ,championshipType:'liga'});await selectPreview(page);await page.getByRole('button',{name:'Aplicar progressão',exact:true}).click()
 await expect(page.getByText(/O resultado foi confirmado; atualize para recarregar/)).toBeVisible();await expect(page.getByRole('button',{name:'Repetir tentativa original da progressão'})).toHaveCount(0);expect(writes).toBe(1)
})
test('stale preview remains pending; explicit discard does not reverse on server',async({page})=>{
 let writes=0
 await page.route(/\/api\/campeonatos\/[^/]+\/estrutura-avancada(?:\/progressao-atomica)?$/,route=>{
  if(route.request().method()==='GET')return route.fulfill({json:board()})
  if(route.request().postDataJSON().action==='preview_progression')return route.fulfill({json:{ok:true,actor_id:actor,campeonato_id:champ,progression_action:'preview',preview}})
  writes++;return route.fulfill({status:409,json:{error:'A classificação mudou. Gere nova prévia.'}})
 })
 await mountProgression(page,{campeonatoId:champ,championshipType:'liga'});await selectPreview(page);await page.getByRole('button',{name:'Aplicar progressão',exact:true}).click()
 await expect(page.getByRole('button',{name:'Repetir tentativa original da progressão'})).toBeVisible();await expect(page.getByRole('button',{name:'Aplicar progressão',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'Encerrar tentativa após conferir',exact:true}).click();await expect(page.getByRole('button',{name:'Repetir tentativa original da progressão'})).toBeVisible()
 await page.evaluate(()=>{(window as any).fixtureConfirm=true});await page.getByRole('button',{name:'Encerrar tentativa após conferir',exact:true}).click()
 await expect(page.getByRole('button',{name:'Repetir tentativa original da progressão'})).toHaveCount(0);expect(writes).toBe(1)
})
test('account A-B-A ignores old response and restores only the original pending attempt',async({page})=>{
 let release:()=>void=()=>{},commits=0
 const held=new Promise<void>(resolve=>{release=resolve})
 await page.route(/\/api\/campeonatos\/[^/]+\/estrutura-avancada(?:\/progressao-atomica)?$/,async route=>{
  const owner=await page.evaluate(()=>(window as any).fixtureSession?.user.id)
  if(route.request().method()==='GET')return route.fulfill({json:board('atomic',owner)})
  const body=route.request().postDataJSON(),key=route.request().headers()['idempotency-key']
  if(body.action==='preview_progression')return route.fulfill({json:{ok:true,actor_id:actor,campeonato_id:champ,progression_action:'preview',preview}})
  commits++;await held;return route.fulfill({json:ack(body,key)})
 })
 await mountProgression(page,{campeonatoId:champ,championshipType:'liga'});await selectPreview(page);await page.getByRole('button',{name:'Aplicar progressão',exact:true}).click();await expect.poll(()=>commits).toBe(1)
 await page.evaluate(()=>(window as any).changeProgressionActor('00000000-0000-4000-8000-000000000099'))
 await expect(page.getByRole('button',{name:'Repetir tentativa original da progressão'})).toHaveCount(0)
 await page.evaluate(()=>(window as any).changeProgressionActor('00000000-0000-4000-8000-000000000001'))
 await expect(page.getByRole('button',{name:'Repetir tentativa original da progressão'})).toBeVisible();release()
 await expect(page.getByText('1 equipe(s) promovida(s).',{exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Repetir tentativa original da progressão'})).toHaveCount(0);expect(commits).toBe(1)
})
for(const scenario of ['lost-reversal','historical-refusal'])test('reversal UI preserves the original intent: '+scenario,async({page})=>{
 const writes:any[]=[],receipts=new Map<string,any>();let commits=0
 await page.route(/\/api\/campeonatos\/[^/]+\/estrutura-avancada(?:\/progressao-atomica)?$/,route=>{
  if(route.request().method()==='GET'){const data:any=board();data.progressionExecutions=[{id:execution,regra_id:rule,status:'aplicada',created_at:'2026-10-12T00:00:00Z'}];return route.fulfill({json:data})}
  const body=route.request().postDataJSON(),key=route.request().headers()['idempotency-key'];writes.push({body,key});expect(body.action).toBe('reverse_progression');expect(body.reason).toBe('Fixture reversal')
  if(scenario==='historical-refusal')return route.fulfill({status:409,json:{error:'Execução anterior sem acompanhamento transacional. Revise antes de reverter.'}})
  if(receipts.has(key))return route.fulfill({json:{...receipts.get(key),repetida:true}})
  commits++;receipts.set(key,ack(body,key));return route.abort('failed')
 })
 await mountProgression(page,{campeonatoId:champ,championshipType:'liga'});await page.getByRole('button',{name:'Reverter',exact:true}).click()
 await expect(page.getByRole('button',{name:'Repetir tentativa original da progressão'})).toBeVisible()
 if(scenario==='historical-refusal'){await expect(page.getByRole('alert')).toContainText('sem acompanhamento transacional');expect(commits).toBe(0);expect(writes).toHaveLength(1)}
 else{await page.getByRole('button',{name:'Repetir tentativa original da progressão'}).click();await expect(page.getByText('1 vínculo(s) revertido(s).',{exact:true})).toBeVisible();expect(commits).toBe(1);expect(writes).toHaveLength(2);expect(writes[0]).toEqual(writes[1])}
})
