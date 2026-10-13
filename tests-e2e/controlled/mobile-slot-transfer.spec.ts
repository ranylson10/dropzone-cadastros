import {expect,test,type Page} from '@playwright/test'
import {mountMobileHarness,renderMobileHarness} from '../helpers/mobile-directory-harness'
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const actor=id(1),championship=id(20),group=id(8)
const intent={mode:'move',source_slot_id:id(2),target_slot_id:id(3),source_participation_id:id(4),target_participation_id:null}
const props={screen:'ChampionshipTeamsPanel',championshipId:championship,actorId:actor,token:'fixture-session'}
const version='2026-10-12T03:10:00.123456+00:00'
const board=(moved=false)=>({slot_movement_mode:'atomic',slot_movement_actor_id:actor,vagas:[
  {id:id(2),grupo_id:group,grupo:{id:group,nome:'Grupo fixture'},slot_letra:'A',...(moved?{}:{line_id:id(7),equipe_id:id(6),line_nome:'Line original',equipe_nome:'Equipe fixture',campeonato_equipe:{id:id(4)},slot_movement_expected:{id:id(4),slot_id:id(2),equipe_id:id(6),line_id:id(7),updated_at:version}})},
  {id:id(3),grupo_id:group,grupo:{id:group,nome:'Grupo fixture'},slot_letra:'B',...(moved?{line_id:id(7),equipe_id:id(6),line_nome:'Line original',equipe_nome:'Equipe fixture',campeonato_equipe:{id:id(4)},slot_movement_expected:{id:id(4),slot_id:id(3),equipe_id:id(6),line_id:id(7),updated_at:version}}:{})},
],solicitacoes:[]})
const success=(mensagem:string)=>({ok:true,mensagem,campeonato_id:championship,action:'move',...intent,participacoes:[{id:id(4),equipe_id:id(6),line_id:id(7),slot_id:id(3),grupo_id:group,slot_numero:2,updated_at:version}]})
async function confirmAlert(page:Page,text='Mover'){
  await expect.poll(()=>page.evaluate(()=>Boolean((window as any).harnessLastAlert))).toBeTruthy()
  await page.evaluate(value=>{const item=(window as any).harnessLastAlert.buttons.find((b:any)=>b.text===value);if(!item)throw new Error('Alert action not found');item.onPress()},text)
}
async function startMove(page:Page){
  await page.getByRole('button',{name:/^A\s*Line original/}).click()
  await page.getByRole('button',{name:/^B\s*Slot livre/}).click()
  await confirmAlert(page)
}
test.beforeEach(async({page})=>{
  await page.route('**/api/**',route=>route.request().method()==='GET'?route.fulfill({json:{items:[],vagas:[],solicitacoes:[]}}):route.abort())
})
test('app: resposta perdida mantém intenção e chave; recarga com origem vazia recupera o recibo',async({page})=>{
  let moved=false,patches=0;const keys:string[]=[],bodies:any[]=[]
  await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,async route=>{
    if(route.request().method()==='GET')return route.fulfill({json:board(moved)})
    patches++;keys.push(route.request().headers()['idempotency-key']);bodies.push(route.request().postDataJSON())
    if(patches===1){moved=true;return route.abort('failed')}
    return route.fulfill({json:{...success('Line movida.'),repetida:true}})
  })
  await mountMobileHarness(page,props);await startMove(page)
  await expect(page.getByRole('button',{name:'Confirmar resultado da movimentação anterior'})).toBeVisible()
  expect(patches).toBe(1);expect(bodies[0]).toEqual(intent)
  await mountMobileHarness(page,props)
  await expect(page.getByRole('button',{name:'Confirmar resultado da movimentação anterior'})).toBeVisible()
  await page.getByRole('button',{name:'Confirmar resultado da movimentação anterior'}).click()
  await expect(page.getByText('Line movida.',{exact:true})).toBeVisible()
  expect(keys[0]).toBe(keys[1]);expect(bodies[1]).toEqual(intent);expect(patches).toBe(2)
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('dz.slot_transfer')).length)).toBe(0)
})
test('app: armazenamento indisponível impede PATCH e expõe erro',async({page})=>{
  let patches=0
  await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,route=>{if(route.request().method()==='PATCH'){patches++;return route.abort()}return route.fulfill({json:board()})})
  await mountMobileHarness(page,props);await page.evaluate(()=>{(window as any).slotStorageBlocked=true})
  await startMove(page);await expect(page.getByText(/Não foi possível ler a inscrição pendente/)).toBeVisible();expect(patches).toBe(0)
})
test('app: pendência de uma conta não aparece para outra',async({page})=>{
  let patches=0
  await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,route=>{if(route.request().method()==='PATCH'){patches++;return route.abort('failed')}return route.fulfill({json:board()})})
  await mountMobileHarness(page,props);await startMove(page)
  await expect(page.getByRole('button',{name:'Confirmar resultado da movimentação anterior'})).toBeVisible()
  await renderMobileHarness(page,{actorId:id(12),token:'other-session'})
  await expect(page.getByRole('button',{name:'Confirmar resultado da movimentação anterior'})).toHaveCount(0)
  await renderMobileHarness(page,props)
  await expect(page.getByRole('button',{name:'Confirmar resultado da movimentação anterior'})).toBeVisible();expect(patches).toBe(1)
})
test('app: cliques consecutivos na confirmação enviam uma única tentativa',async({page})=>{
  let patches=0,release:(()=>Promise<void>)|undefined
  await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,route=>{
    if(route.request().method()==='GET')return route.fulfill({json:board()})
    patches++;if(patches===1)return route.abort('failed')
    return new Promise<void>(resolve=>{release=async()=>{await route.fulfill({json:success('Confirmada.')});resolve()}})
  })
  await mountMobileHarness(page,props);await startMove(page)
  const retry=page.getByRole('button',{name:'Confirmar resultado da movimentação anterior'})
  await expect(retry).toBeVisible()
  await retry.evaluate(element=>{element.dispatchEvent(new MouseEvent('click',{bubbles:true}));element.dispatchEvent(new MouseEvent('click',{bubbles:true}))})
  await expect.poll(()=>Boolean(release)).toBeTruthy();expect(patches).toBe(2)
  await release!();await expect(page.getByText('Confirmada.',{exact:true})).toBeVisible()
})
test('app: descarte explícito encerra só a tentativa local, sem PATCH adicional',async({page})=>{
  let patches=0
  await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,route=>{if(route.request().method()==='PATCH'){patches++;return route.abort('failed')}return route.fulfill({json:board(true)})})
  await mountMobileHarness(page,props)
  // Persist an uncertain original operation before mounting again over the changed board.
  await page.evaluate(async({actor,championship,intent})=>{
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([1,actor,championship])))
    const hash=Array.from(new Uint8Array(bytes)).map(v=>v.toString(16).padStart(2,'0')).join('')
    localStorage.setItem('dz.slot_transfer.v1.'+hash,JSON.stringify({requestId:crypto.randomUUID(),body:intent}))
  },{actor,championship,intent})
  await mountMobileHarness(page,props)
  await page.getByRole('button',{name:'Encerrar tentativa após conferir os slots'}).click()
  await confirmAlert(page,'Já conferi os slots')
  await expect(page.getByRole('button',{name:'Confirmar resultado da movimentação anterior'})).toHaveCount(0)
  expect(patches).toBe(0);await expect(page.getByText('Line original',{exact:true})).toBeVisible()
})
