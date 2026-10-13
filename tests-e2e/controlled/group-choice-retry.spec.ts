import {expect,test,type Page} from '@playwright/test'
import {mountGroupChoice} from '../helpers/group-choice-harness'
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const camp=id(20),part=id(3),group=id(5),slot=id(6),phase=id(7)
const choice=(assigned=false)=>({ok:true,participations:[{id:part,nome_exibicao:'Line fixture',grupo_id:assigned?group:null,slot_id:assigned?slot:null}],
  configs:[{fase_id:phase,aberta:true}],groups:[{id:group,nome:'Grupo fixture',fase_id:phase}],slots:[{id:slot,grupo_id:group,fase_id:phase,slot_numero:2,status:assigned?'ocupado':'livre'}],blocks:[],history:[]})
async function central(page:Page){await page.route('**/api/central-campeonato',r=>r.fulfill({json:{ok:true,participant_items:[{id:camp,nome:'Campeonato fixture'}],items:[]}}))}
async function selectChoice(page:Page){
  await page.getByRole('combobox',{name:'Grupo',exact:true}).selectOption(group)
  await page.getByRole('combobox',{name:'Slot',exact:true}).selectOption(slot)
}
test('central: resposta perdida, recarga e origem já ocupada repetem a intenção/chave',async({page})=>{
  await central(page);let assigned=false;const keys:string[]=[],bodies:any[]=[]
  await page.route('**/api/campeonatos/**/escolha-grupo',r=>{if(r.request().method()==='GET')return r.fulfill({json:choice(assigned)})
    keys.push(r.request().headers()['idempotency-key']);bodies.push(r.request().postDataJSON());if(keys.length===1){assigned=true;return r.abort('failed')}
    return r.fulfill({json:{ok:true,operation_confirmed:true,choice_action:'assign',repetida:true}})})
  await mountGroupChoice(page,{screen:'central'});await selectChoice(page);await page.getByRole('button',{name:'Confirmar grupo e slot',exact:true}).click()
  await expect(page.getByRole('button',{name:'Confirmar resultado da escolha anterior'})).toBeVisible()
  await mountGroupChoice(page,{screen:'central'});await page.getByRole('button',{name:'Confirmar resultado da escolha anterior'}).click()
  await expect(page.getByText('Resultado da escolha confirmado.',{exact:true})).toBeVisible();expect(keys.length).toBe(2);expect(keys[0]).toBe(keys[1]);expect(bodies[0]).toEqual(bodies[1]);expect(bodies[1].source_slot_id).toBeNull()
})
test('central: armazenamento indisponível impede a gravação',async({page})=>{
  await central(page);let writes=0;await page.route('**/api/campeonatos/**/escolha-grupo',r=>{if(r.request().method()==='GET')return r.fulfill({json:choice()});writes++;return r.abort()})
  await mountGroupChoice(page,{screen:'central'});await selectChoice(page);await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('blocked')}})
  await page.getByRole('button',{name:'Confirmar grupo e slot',exact:true}).click();await expect(page.getByRole('alert')).toContainText('guardar esta escolha');expect(writes).toBe(0)
})
test('central: clique duplo envia uma tentativa; conta nova não recebe pendência',async({page})=>{
  await central(page);let writes=0;await page.route('**/api/campeonatos/**/escolha-grupo',async r=>{if(r.request().method()==='GET')return r.fulfill({json:choice()});writes++;return r.abort('failed')})
  await mountGroupChoice(page,{screen:'central'});await selectChoice(page)
  await page.getByRole('button',{name:'Confirmar grupo e slot',exact:true}).evaluate(e=>{e.dispatchEvent(new MouseEvent('click',{bubbles:true}));e.dispatchEvent(new MouseEvent('click',{bubbles:true}))})
  await expect(page.getByRole('button',{name:'Confirmar resultado da escolha anterior'})).toBeVisible();expect(writes).toBe(1)
  await page.evaluate(value=>(window as any).changeChoiceActor(value),id(12));await expect(page.getByRole('button',{name:'Confirmar resultado da escolha anterior'})).toHaveCount(0)
  await page.evaluate(value=>(window as any).changeChoiceActor(value),id(1));await expect(page.getByRole('button',{name:'Confirmar resultado da escolha anterior'})).toBeVisible()
})
test('central: descarte local confirmado não envia outra gravação',async({page})=>{
  await central(page);let writes=0;await page.route('**/api/campeonatos/**/escolha-grupo',r=>{if(r.request().method()==='GET')return r.fulfill({json:choice()});writes++;return r.abort('failed')})
  await mountGroupChoice(page,{screen:'central'});await selectChoice(page);await page.getByRole('button',{name:'Confirmar grupo e slot',exact:true}).click()
  await page.getByRole('button',{name:'Encerrar tentativa após conferir os slots'}).click();await expect(page.getByRole('button',{name:'Confirmar resultado da escolha anterior'})).toHaveCount(0);expect(writes).toBe(1)
  expect(await page.evaluate(()=>(window as any).choiceConfirmations)).toBe(1)
})
const structure=(assigned=true)=>({permission:{canManage:true},edition:null,franchise:null,divisions:[],stages:[],sources:[],progressions:[],prizes:[],dailyHours:[],stageTeams:[],
  teams:[{id:part,nome_exibicao:'Line fixture',grupo_id:assigned?group:null,slot_id:assigned?slot:null}],phases:[{id:phase,nome:'Fase fixture'}],groups:[{id:group,nome:'Grupo fixture',fase_id:phase}],
  slots:[{id:slot,grupo_id:group,fase_id:phase,slot_numero:2,status:assigned?'ocupado':'livre'}],groupChoiceConfigs:[],groupChoiceBlocks:[],groupChoiceHistory:[],progressionExecutions:[],progressionExecutionItems:[]})
test('estrutura: cancelamento pendente recupera recibo após recarga e mantém dados da tela',async({page})=>{
  let assigned=true;const keys:string[]=[],bodies:any[]=[]
  await page.route('**/api/campeonatos/**/estrutura-avancada',r=>{if(r.request().method()==='GET')return r.fulfill({json:structure(assigned)})
    keys.push(r.request().headers()['idempotency-key']);bodies.push(r.request().postDataJSON());if(keys.length===1){assigned=false;return r.abort('failed')}
    return r.fulfill({json:{ok:true,operation_confirmed:true,repetida:true}})})
  await mountGroupChoice(page,{screen:'admin',campeonatoId:camp,championshipType:'copa'})
  await page.getByRole('button',{name:'Cancelar',exact:true}).evaluate(element=>(element as HTMLButtonElement).click());await expect(page.getByRole('button',{name:'Confirmar resultado da escolha anterior'})).toBeVisible()
  await mountGroupChoice(page,{screen:'admin',campeonatoId:camp,championshipType:'copa'});await page.getByRole('button',{name:'Confirmar resultado da escolha anterior'}).click()
  await expect(page.getByText('Resultado da escolha confirmado.',{exact:true})).toBeVisible();expect(keys[0]).toBe(keys[1]);expect(bodies[1]).toEqual(bodies[0]);expect(bodies[1].source_slot_id).toBe(slot)
  await expect(page.locator('.advanced-choice-operations-list').getByText('Line fixture',{exact:true})).toBeVisible()
})
test('estrutura: resposta privada atrasada não reaparece depois da troca de conta',async({page})=>{
  let pause=false,held=false,release:(()=>Promise<void>)|undefined
  await page.route('**/api/campeonatos/**/estrutura-avancada',r=>{
    if(r.request().method()!=='GET')return r.abort()
    if(r.request().headers().authorization==='Bearer fixture-other')return r.fulfill({json:{...structure(),teams:[{id:part,nome_exibicao:'Nova conta',grupo_id:group,slot_id:slot}]}})
    if(pause){held=true;return new Promise<void>(resolve=>{release=async()=>{await r.fulfill({json:structure()});resolve()}})}
    return r.fulfill({json:structure()})
  })
  await mountGroupChoice(page,{screen:'admin',campeonatoId:camp,championshipType:'copa'})
  await expect(page.locator('.advanced-choice-operations-list').getByText('Line fixture',{exact:true})).toBeVisible()
  pause=true;await page.getByRole('button',{name:'Atualizar',exact:true}).evaluate(element=>(element as HTMLButtonElement).click())
  await expect.poll(()=>held).toBeTruthy();await page.evaluate(value=>(window as any).changeChoiceActor(value),id(12))
  await expect(page.locator('.advanced-choice-operations-list').getByText('Nova conta',{exact:true})).toBeVisible()
  await release!();await expect(page.locator('.advanced-choice-operations-list').getByText('Line fixture',{exact:true})).toHaveCount(0)
  await expect(page.locator('.advanced-choice-operations-list').getByText('Nova conta',{exact:true})).toBeVisible()
})
test('estrutura: resposta legada sem perfil conserva a permissão da mesma conta',async({page})=>{
  let writes=0
  await page.route('**/api/campeonatos/**/estrutura-avancada',r=>{
    if(r.request().method()==='GET')return r.fulfill({json:structure()})
    writes++;const body:any={ok:true,...structure(false)};delete body.permission;return r.fulfill({json:body})
  })
  await mountGroupChoice(page,{screen:'admin',campeonatoId:camp,championshipType:'copa'})
  await page.getByRole('button',{name:'Cancelar',exact:true}).evaluate(element=>(element as HTMLButtonElement).click())
  await expect(page.getByText('Alteração salva.',{exact:true})).toBeVisible();expect(writes).toBe(1)
  await expect(page.locator('.advanced-choice-operations-list').getByRole('button',{name:'Definir',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Confirmar resultado da escolha anterior'})).toHaveCount(0)
})
