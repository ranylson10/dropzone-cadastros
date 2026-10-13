import {test,expect,type Page} from '@playwright/test'
import {mountMobileHarness,renderMobileHarness} from '../helpers/mobile-directory-harness'
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const actor=id(1),champ=id(2),version='2026-10-12T03:10:00.123456+00:00'
const props={screen:'ChampionshipTeamsPanel',championshipId:champ,actorId:actor,token:'fixture-session'}
const move={mode:'move',source_slot_id:id(20),target_slot_id:id(22),source_participation_id:id(10),target_participation_id:null}
function board(mode='atomic'):any{return {slot_movement_mode:mode,slot_movement_actor_id:actor,participation_write_mode:'atomic',participation_actor_id:actor,permission:{canManage:true,canRemove:true},solicitacoes:[],vagas:[
 {id:id(20),grupo_id:id(50),grupo:{id:id(50),nome:'Grupo fixture'},slot_letra:'A',line_id:id(40),equipe_id:id(30),line_nome:'Line original',equipe_nome:'Equipe fixture',status:'ocupada',campeonato_equipe:{id:id(10)},
  slot_movement_expected:{id:id(10),slot_id:id(20),equipe_id:id(30),line_id:id(40),updated_at:version},participation_expected:{equipe_id:id(30),line_id:id(40),slot_id:id(20),status:'ativo',updated_at:version}},
 {id:id(22),grupo_id:id(50),grupo:{id:id(50),nome:'Grupo fixture'},slot_letra:'B',status:'livre'}]}}
const success=(body:any)=>({ok:true,campeonato_id:champ,action:body.mode,...body,mensagem:'Movimento confirmado.',participacoes:[{id:id(10),slot_id:id(22),equipe_id:id(30),line_id:id(40),grupo_id:id(50),slot_numero:2,updated_at:version}]})
async function reads(page:Page,data:any){
 await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>r.request().method()==='GET'?r.fulfill({json:data}):r.abort())
 await page.route('**/api/campeonatos/*/equipes/busca?*',r=>r.fulfill({json:{equipes:[{id:id(31),nome:'Outra equipe',lines:[{id:id(41),nome:'Outra line'}]}],nextCursor:null}}))
}
async function alertAction(page:Page,text:string){await expect.poll(()=>page.evaluate(()=>Boolean((window as any).harnessLastAlert))).toBeTruthy();await page.evaluate(t=>(window as any).harnessLastAlert.buttons.find((b:any)=>b.text===t).onPress(),text)}
async function startMove(page:Page,confirm=true){await page.getByRole('button',{name:/^A\s*Line original/}).click();await page.getByRole('button',{name:/^B\s*Slot livre/}).click();if(confirm)await alertAction(page,'Mover')}
async function seedParticipation(page:Page){await page.evaluate(async({actor,champ})=>{const api=(window as any).mobileOperations;const body={slot_id:'00000000-0000-4000-8000-000000000022',equipe_id:'00000000-0000-4000-8000-000000000031',line_id:'00000000-0000-4000-8000-000000000041'};
 await api.participation.participationAttempts.prepare(actor,champ,{method:'POST',participationId:null,body:{...body,line_id:body.line_id,nome_line:null,origem_entrada:null}})}, {actor,champ})}
test('app: movimentação pendente bloqueia inclusão e remoção sem novo HTTP',async({page})=>{
 const methods:string[]=[];await reads(page,board());await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{if(r.request().method()==='GET')return r.fulfill({json:board()});methods.push(r.request().method());return r.abort('failed')})
 await mountMobileHarness(page,props);await startMove(page);await expect(page.getByRole('button',{name:'Confirmar resultado da movimentação anterior'})).toBeVisible()
 // Remove and add use the real component/writer. Clear the source through the selected group.
 await page.getByRole('button',{name:'Remover Line original',exact:true}).click();await alertAction(page,'Remover');await expect(page.getByText(/Há uma movimentação aguardando confirmação\. Confira o acompanhamento/)).toBeVisible()
 await renderMobileHarness(page,{championshipId:id(99)});await renderMobileHarness(page,props);await expect(page.getByText('Line original',{exact:true})).toBeVisible();await page.getByRole('button',{name:/^B\s*Slot livre/}).click();await page.getByPlaceholder('Nome ou tag da equipe').fill('Outra');await page.getByRole('button',{name:'Usar',exact:true}).click();await expect(page.getByText(/Há uma movimentação aguardando confirmação\. Confira o acompanhamento/)).toBeVisible();expect(methods).toEqual(['PATCH'])
})
test('app: inscrição retida bloqueia movimento em atomic e legacy',async({page})=>{
 const data=board();let count=0;await reads(page,data);await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>r.request().method()==='GET'?r.fulfill({json:data}):(count++,r.abort()))
 await mountMobileHarness(page,props);await seedParticipation(page);await mountMobileHarness(page,props);await startMove(page);await expect(page.getByText('Há uma inscrição aguardando confirmação. Confira o acompanhamento antes de movimentar equipes.')).toBeVisible();expect(count).toBe(0)
 data.slot_movement_mode='legacy';await mountMobileHarness(page,props);await startMove(page);await expect(page.getByText('Há uma inscrição aguardando confirmação. Confira o acompanhamento antes de movimentar equipes.')).toBeVisible();expect(count).toBe(0)
})
test('app: resposta incompleta conserva tentativa e replay valida o DTO completo',async({page})=>{
 const keys:string[]=[],bodies:any[]=[];await reads(page,board());await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{if(r.request().method()==='GET')return r.fulfill({json:board()});bodies.push(r.request().postDataJSON());keys.push(r.request().headers()['idempotency-key']);return r.fulfill({json:bodies.length===1?{ok:true}:success(bodies.at(-1))})})
 await mountMobileHarness(page,props);await startMove(page);await expect(page.getByText(/Não foi possível confirmar a movimentação/)).toBeVisible();await page.getByRole('button',{name:'Confirmar resultado da movimentação anterior'}).click();await expect(page.getByText('Movimento confirmado.',{exact:true})).toBeVisible();expect(bodies[1]).toEqual(bodies[0]);expect(keys[1]).toBe(keys[0])
})
test('app: renovar token durante confirmação conserva seleção e usa a sessão atual',async({page})=>{
 const tokens:string[]=[];await reads(page,board());await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{if(r.request().method()==='GET')return r.fulfill({json:board()});tokens.push(r.request().headers().authorization);return r.fulfill({json:success(r.request().postDataJSON())})})
 await mountMobileHarness(page,props);await startMove(page,false);await renderMobileHarness(page,{token:'renewed-token'});await expect(page.getByText('ORIGEM SELECIONADA')).toBeVisible();await alertAction(page,'Mover');await expect(page.getByText('Movimento confirmado.',{exact:true})).toBeVisible();expect(tokens).toEqual(['Bearer renewed-token'])
})
test('app: confirmação de conta anterior fica inválida mesmo depois de voltar à conta',async({page})=>{
 let count=0;await reads(page,board());await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>r.request().method()==='GET'?r.fulfill({json:board()}):(count++,r.abort()))
 await mountMobileHarness(page,props);await startMove(page,false);await renderMobileHarness(page,{actorId:id(99),token:'other-token'});await expect(page.getByText('ORIGEM SELECIONADA')).toHaveCount(0);await renderMobileHarness(page,props);await expect(page.getByText('Line original',{exact:true})).toBeVisible();await alertAction(page,'Mover');expect(count).toBe(0)
})
test('app: confirmação após desmontar o painel não grava',async({page})=>{
 let count=0;await reads(page,board());await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>r.request().method()==='GET'?r.fulfill({json:board()}):(count++,r.abort()))
 await mountMobileHarness(page,props);await startMove(page,false);await page.evaluate(()=>(window as any).unmountHarness());await alertAction(page,'Mover');expect(count).toBe(0)
})
test('app: descarte antigo após trocar conta não remove a tentativa original',async({page})=>{
 await reads(page,board());await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>r.request().method()==='GET'?r.fulfill({json:board()}):r.abort('failed'))
 await mountMobileHarness(page,props);await startMove(page);await expect(page.getByRole('button',{name:'Confirmar resultado da movimentação anterior'})).toBeVisible();await page.getByRole('button',{name:'Encerrar tentativa após conferir os slots'}).click()
 await renderMobileHarness(page,{actorId:id(99),token:'other-token'});await expect(page.getByRole('button',{name:'Confirmar resultado da movimentação anterior'})).toHaveCount(0);await alertAction(page,'Já conferi os slots');await renderMobileHarness(page,props);await expect(page.getByRole('button',{name:'Confirmar resultado da movimentação anterior'})).toBeVisible()
})
test('app: falha silenciosa ao limpar storage preserva a recuperação e o descarte avisa',async({page})=>{
 await reads(page,board());await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>r.request().method()==='GET'?r.fulfill({json:board()}):r.fulfill({json:success(r.request().postDataJSON())}))
 await mountMobileHarness(page,props);await page.evaluate(()=>{Storage.prototype.removeItem=()=>{}});await startMove(page);await expect(page.getByRole('button',{name:'Confirmar resultado da movimentação anterior'})).toBeVisible();await page.getByRole('button',{name:'Encerrar tentativa após conferir os slots'}).click();await alertAction(page,'Já conferi os slots');await expect(page.getByText(/Não foi possível encerrar a movimentação/)).toBeVisible();await expect(page.getByRole('button',{name:'Confirmar resultado da movimentação anterior'})).toBeVisible()
})
test('app: legacy envia sem chave e não apaga uma tentativa atômica retida',async({page})=>{
 const data=board('legacy'),keys:(string|undefined)[]=[];await reads(page,data);await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{if(r.request().method()==='GET')return r.fulfill({json:data});keys.push(r.request().headers()['idempotency-key']);return r.fulfill({json:{ok:true}})})
 await mountMobileHarness(page,props);await startMove(page);await expect.poll(()=>keys.length).toBe(1);expect(keys[0]).toBeUndefined();expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('dz.slot_transfer.')))).toHaveLength(0)
 await page.evaluate(async({actor,champ,move})=>(window as any).mobileOperations.movement.prepareMobileSlotTransfer(actor,champ,move),{actor,champ,move});await mountMobileHarness(page,props);await expect(page.getByRole('button',{name:'Confirmar resultado da movimentação anterior'})).toHaveAttribute('disabled','');await startMove(page);await expect(page.getByText('Confira a movimentação pendente antes de iniciar outra.')).toBeVisible();expect(keys).toHaveLength(1)
})
test('app: snapshot do slot incompleto recusa atomic antes do diálogo e do HTTP',async({page})=>{
 const data=board();data.vagas[0].slot_movement_expected=null;let count=0;await reads(page,data);await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>r.request().method()==='GET'?r.fulfill({json:data}):(count++,r.abort()))
 await mountMobileHarness(page,props);await startMove(page,false);await expect(page.getByText(/Atualize o acompanhamento antes de movimentar/)).toBeVisible();expect(await page.evaluate(()=>(window as any).harnessAlerts||0)).toBe(0);expect(count).toBe(0)
})
