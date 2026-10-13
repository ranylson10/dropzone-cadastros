import {test,expect,type Page} from '@playwright/test'
import {mountLiga} from '../helpers/liga-web-harness'
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const actor=id(1),champ=id(2),group=id(50),phase=id(60),version='2026-10-11T13:00:00.123456+00:00'
const props={screen:'lili',accessToken:'fixture-session',activeAccount:{id:actor,profile_type:'produtora'}}
function board():any{
 const expected=[0,1].map(n=>({id:id(10+n),slot_id:id(20+n),equipe_id:id(30+n),line_id:id(40+n),updated_at:version}))
 return {campeonato:{id:champ,nome:'Movimentos fixture',tipo:'comum'},participation_write_mode:'atomic',participation_actor_id:actor,slot_movement_mode:'atomic',slot_movement_actor_id:actor,
  permission:{canManage:true,canRemove:true},fases:[{id:phase,nome:'Fase fixture',ordem:1}],grupos:[{id:group,nome:'Grupo A',fase_id:phase},{id:id(51),nome:'Grupo B',fase_id:phase}],jogos:[],
  slots:[...expected.map((p,n)=>({id:p.slot_id,equipe_id:p.equipe_id,line_id:p.line_id,participacao_id:p.id,line_nome:'Line '+(n+1),equipe_nome:'Equipe '+(n+1),grupo_id:group,fase_id:phase,slot_numero:n+1,status:'ocupado',slot_movement_expected:p,participation_expected:{...p,status:'ativo'}})),
   {id:id(22),grupo_id:group,fase_id:phase,slot_numero:3,status:'livre'},{id:id(23),grupo_id:group,fase_id:phase,slot_numero:4,status:'reservado'},
   {id:id(24),grupo_id:id(51),fase_id:phase,slot_numero:1,status:'livre'}]}
}
function success(body:any){
 if(['move','swap'].includes(body.mode))return {ok:true,campeonato_id:champ,action:body.mode,...body,participacoes:[{id:id(10),equipe_id:id(30),line_id:id(40),slot_id:body.target_slot_id,grupo_id:group,slot_numero:3,updated_at:version},...(body.mode==='swap'?[{id:id(11),equipe_id:id(31),line_id:id(41),slot_id:body.source_slot_id,grupo_id:group,slot_numero:1,updated_at:version}]:[])]}
 const groups=body.mode==='shuffle_group'?[body.group_id]:body.group_ids
 const participacoes=body.expected.map((p:any,n:number)=>({...p,slot_id:id(70+n),grupo_id:groups[n%groups.length],slot_numero:n+1}))
 return {ok:true,operation_confirmed:true,campeonato_id:champ,mode:body.mode,action:body.mode==='shuffle_group'?'shuffle':'distribute',phase_id:body.phase_id??null,group_ids:groups,strategy:body.strategy??null,participacoes,distribuicao:groups.map((grupo_id:string)=>({grupo_id,equipes:participacoes.filter((p:any)=>p.grupo_id===grupo_id).length}))}
}
async function reads(page:Page,data:any){
 await page.route('**/api/campeonatos/*/estrutura',r=>r.fulfill({json:data}))
 await page.route('**/api/lili/campeonatos',r=>r.fulfill({json:{items:[{id:champ,nome:'Movimentos fixture',relationship:'admin'}]}}))
 await page.route('**/api/campeonatos/*/equipes/busca?*',r=>r.fulfill({json:{equipes:[{id:id(80),nome:'Outra equipe',lines:[{id:id(81),nome:'Outra line'}]}]}}))
}
async function open(page:Page,manager=true){await page.getByRole('button',{name:/^Movimentos fixture/}).click();await page.getByRole('button',{name:'Grupos',exact:true}).click();if(manager){await page.getByRole('button',{name:/^Ver equipes/}).click();await page.getByRole('button',{name:'Organizar',exact:true}).click()}}
async function action(page:Page,mode:string){
 if(mode==='move'||mode==='swap'){await page.getByRole('button',{name:/^A Line 1/}).click();await page.getByRole('button',{name:mode==='move'?/^C Slot disponível/:/^B Line 2/}).click()}
 else if(mode==='shuffle_group')await page.getByRole('button',{name:'Sortear',exact:true}).click()
 else{await page.getByRole('button',{name:/Distribuir equipes entre grupos/}).click();await page.getByRole('combobox',{name:'Método',exact:true}).selectOption(mode);await page.getByRole('button',{name:'Executar distribuição',exact:true}).click()}
}
for(const mode of ['move','swap','shuffle_group','balanced','random'])test(`Lili ${mode}: recarga e confirmação preservam corpo/chave apesar de uma leitura nova`,async({page})=>{
 const data=board(),writes:any[]=[],keys:string[]=[],errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await reads(page,data)
 await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{const body=r.request().postDataJSON();writes.push(body);keys.push(r.request().headers()['idempotency-key']);return writes.length===1?r.abort('failed'):r.fulfill({json:{...success(body),repetida:true}})})
 await mountLiga(page,props);await open(page);await action(page,mode);await expect(page.getByRole('button',{name:'Confirmar movimentação anterior'})).toBeVisible();expect(writes).toHaveLength(1)
 expect(keys[0]).toMatch(/^[\da-f-]{36}$/);if(writes[0].expected){expect(writes[0].expected).toHaveLength(2);expect(writes[0].expected[0].updated_at).toBe(version);expect(writes[0].expected.some((p:any)=>p.slot_id===id(23))).toBeFalsy()}
 data.slots[0].slot_movement_expected.updated_at='2026-10-11T14:00:00.654321+00:00';await mountLiga(page,props);await page.getByRole('button',{name:/^Movimentos fixture/}).click();await page.getByRole('button',{name:'Confirmar movimentação anterior'}).click()
 await expect.poll(()=>writes.length).toBe(2);await expect(page.getByRole('button',{name:'Confirmar movimentação anterior'})).toHaveCount(0);expect(writes[1]).toEqual(writes[0]);expect(keys[1]).toBe(keys[0]);expect(errors).toEqual([])
})
test('Lili: acompanhamento incompleto impede sorteio e distribuição; reserva não aceita seleção',async({page})=>{
 const data=board();data.slots[1].slot_movement_expected=null;let count=0;await reads(page,data);await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{count++;return r.fulfill({json:{ok:true}})})
 await mountLiga(page,props);await open(page);await expect(page.getByRole('button',{name:/^D Slot indisponível/})).toBeDisabled();await action(page,'shuffle_group');await expect(page.getByText(/Atualize o acompanhamento antes de movimentar/)).toBeVisible()
 await action(page,'balanced');await expect(page.getByText(/Atualize o acompanhamento antes de movimentar/)).toBeVisible();await expect(page.getByText('posições utilizáveis')).toBeVisible();expect(count).toBe(0)
})
test('Lili: confirmação de distribuição trava escolhas e retorno ao catálogo cancela a intenção não enviada',async({page})=>{
 let count=0;await reads(page,board());await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{count++;return r.fulfill({json:{ok:true}})})
 await mountLiga(page,props);await open(page);await page.evaluate(()=>{(window as any).fixtureConfirm=()=>new Promise(resolve=>(window as any).releaseConfirm=resolve)})
 await action(page,'balanced');await expect(page.getByRole('combobox',{name:'Fase',exact:true})).toBeDisabled();await expect(page.getByRole('combobox',{name:'Método',exact:true})).toBeDisabled();await expect(page.locator('.lili-phase-groups-select button').first()).toBeDisabled();await expect(page.getByRole('button',{name:'Distribuindo…',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'Voltar',exact:true}).click();await page.evaluate(()=>(window as any).releaseConfirm(true));await expect(page.getByRole('button',{name:/^Movimentos fixture/})).toBeVisible();expect(count).toBe(0)
})
test('Lili: mudar perfil durante confirmação de troca impede a gravação antiga',async({page})=>{
 let count=0;await reads(page,board());await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{count++;return r.fulfill({json:{ok:true}})})
 await mountLiga(page,props);await open(page);await page.evaluate(()=>{(window as any).fixtureConfirm=()=>new Promise(resolve=>(window as any).releaseConfirm=resolve)});await action(page,'swap')
 await page.evaluate(p=>(window as any).renderLiga(p),{activeAccount:{id:id(99),profile_type:'produtora'}});await expect(page.getByRole('button',{name:'Grupos',exact:true})).toHaveCount(0);await page.evaluate(()=>(window as any).releaseConfirm(true));expect(count).toBe(0)
})
test('Lili: resposta incompleta mantém tentativa; encerramento após conferência só limpa o navegador',async({page})=>{
 let count=0;await reads(page,board());await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{count++;return r.fulfill({json:{ok:true}})})
 await mountLiga(page,props);await open(page);await action(page,'move');await expect(page.getByRole('button',{name:'Confirmar movimentação anterior'})).toBeVisible();await page.getByRole('button',{name:'Encerrar movimentação após conferir'}).click();await expect(page.getByRole('button',{name:'Confirmar movimentação anterior'})).toHaveCount(0);expect(count).toBe(1)
 expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('dz.slot_movement.')))).toHaveLength(0)
})
test('Lili: troca de sessão isola tentativa e renovação da mesma conta permite recuperar',async({page})=>{
 const writes:any[]=[],keys:string[]=[];await reads(page,board());await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{writes.push(r.request().postDataJSON());keys.push(r.request().headers()['idempotency-key']);return writes.length===1?r.abort('failed'):r.fulfill({json:success(writes.at(-1))})})
 await mountLiga(page,props);await open(page);await action(page,'move');await expect(page.getByRole('button',{name:'Confirmar movimentação anterior'})).toBeVisible()
 await page.evaluate(a=>(window as any).changeLigaActor(a),id(99));await expect(page.getByRole('button',{name:'Confirmar movimentação anterior'})).toHaveCount(0)
 await page.getByRole('button',{name:'Cancelar seleção',exact:true}).click();await action(page,'move');await expect(page.getByText(/A conta mudou/).first()).toBeVisible();expect(writes).toHaveLength(1)
 await page.evaluate(a=>(window as any).changeLigaActor(a),actor);await expect(page.getByRole('button',{name:'Confirmar movimentação anterior'})).toBeVisible();await page.getByRole('button',{name:'Confirmar movimentação anterior'}).click();await expect.poll(()=>writes.length).toBe(2);expect(keys[1]).toBe(keys[0]);expect(writes[1]).toEqual(writes[0])
})
test('Lili: legacy envia sem chave; uma tentativa atômica retida impede nova movimentação legacy',async({page})=>{
 const data=board(),keys:(string|undefined)[]=[];data.slot_movement_mode='legacy';await reads(page,data);await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{keys.push(r.request().headers()['idempotency-key']);return r.fulfill({json:{ok:true}})})
 await mountLiga(page,props);await open(page);await action(page,'move');await expect.poll(()=>keys.length).toBe(1);expect(keys[0]).toBeUndefined()
 await page.evaluate(async args=>{const api=(window as any).movementApi;await api.slotMovementAttempts.prepare(args.actor,args.champ,{mode:'move',source_slot_id:args.source,target_slot_id:args.target,source_participation_id:args.part,target_participation_id:null});api.notifySlotMovementAttempt()}, {actor,champ,source:id(20),target:id(22),part:id(10)})
 await page.getByRole('button',{name:'Grupos',exact:true}).click();await page.getByRole('button',{name:/^Ver equipes/}).click();await page.getByRole('button',{name:'Organizar',exact:true}).click();await action(page,'move');await expect(page.getByText('Confira a movimentação pendente antes de iniciar outra.')).toBeVisible();expect(keys).toHaveLength(1)
})
test('Lili: armazenamento indisponível recusa a ação antes do HTTP',async({page})=>{
 let count=0;await reads(page,board());await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{count++;return r.fulfill({json:{ok:true}})})
 await mountLiga(page,props);await open(page);await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('blocked')}});await action(page,'move');await expect(page.getByText(/Não foi possível guardar a movimentação/)).toBeVisible();expect(count).toBe(0)
})
test('Lili: sorteio legacy com reserva recusa antes do HTTP e distribuição aguarda ativação',async({page})=>{
 const data=board();data.slot_movement_mode='legacy';let count=0;await reads(page,data);await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{count++;return r.fulfill({json:{ok:true}})})
 await mountLiga(page,props);await open(page);await action(page,'shuffle_group');await expect(page.getByText('O sorteio está indisponível neste grupo porque há slots reservados ou bloqueados.')).toBeVisible();await expect(page.getByRole('button',{name:/Distribuir equipes entre grupos/})).toHaveCount(0);expect(count).toBe(0)
})
test('Lili: movimentação pendente bloqueia inclusão e remoção até confirmação',async({page})=>{
 const methods:string[]=[];await reads(page,board());await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{if(r.request().method()==='GET')return r.fallback();methods.push(r.request().method());return r.abort('failed')})
 await mountLiga(page,props);await open(page);await action(page,'move');await expect(page.getByRole('button',{name:'Confirmar movimentação anterior'})).toBeVisible()
 await page.getByRole('button',{name:'Cancelar seleção',exact:true}).click();await page.getByRole('button',{name:/^C Slot disponível/}).click();await page.getByRole('textbox',{name:'Buscar equipe'}).fill('Outra');await page.locator('.lili-slot-search-form button').click();await page.getByRole('button',{name:/Outra line\s*Adicionar/}).click();await expect(page.getByText('Há uma movimentação aguardando confirmação. Confira o acompanhamento antes de alterar inscrições.')).toBeVisible()
 await page.getByTitle('Liberar slot').first().click();await expect(page.getByText('Há uma movimentação aguardando confirmação. Confira o acompanhamento antes de alterar inscrições.')).toBeVisible();expect(methods).toEqual(['PATCH'])
})
