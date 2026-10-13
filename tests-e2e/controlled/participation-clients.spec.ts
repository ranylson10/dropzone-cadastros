import {test,expect,type Page} from '@playwright/test'
import {mountMobileHarness,renderMobileHarness} from '../helpers/mobile-directory-harness'
import {mountParticipation} from '../helpers/participation-harness'
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const actor=id(1),champ=id(2),group=id(9),contract={participation_write_mode:'atomic',participation_actor_id:actor}
const expected={equipe_id:id(5),line_id:id(6),slot_id:null,status:'pendente',updated_at:'2026-10-11T13:00:00.123456+00:00'}
const props={screen:'ChampionshipTeamsPanel',championshipId:champ,actorId:actor,token:'fixture-session'}
const board=(finished=false)=>({...contract,permission:{canManage:true,canRemove:true},vagas:[
 {id:id(7),grupo_id:group,grupo:{id:group,nome:'Grupo fixture'},slot_letra:'A',line_id:id(6),equipe_id:id(5),line_nome:'Line ativa',equipe_nome:'Equipe fixture',campeonato_equipe:{id:id(8)},participation_expected:{...expected,status:'ativo',slot_id:id(7)}},
 {id:id(10),grupo_id:group,grupo:{id:group,nome:'Grupo fixture'},slot_letra:'B',status:'livre'},
],solicitacoes:finished?[]:[{id:id(11),status:'pendente',line:{nome:'Line pendente'},equipe:{nome:'Equipe pendente'},participation_expected:expected}]})
const success=(method:string,body:any,removal?:string|null)=>{
 const action=method==='DELETE'?'remove':method==='PATCH'?body.action:body.mode==='request'?'request':'add',located=['add','approve'].includes(action)
 return {ok:true,operation_confirmed:true,campeonato_id:champ,action,mensagem:'Confirmada.',participacao:{id:removal||body.participacao_id||id(12),campeonato_id:champ,
 equipe_id:body.expected?.equipe_id||body.equipe_id,line_id:body.expected?.line_id||body.line_id||id(6),status:action==='remove'?'removido':action==='reject'?'rejeitado':action==='request'?'pendente':'ativo',
 slot_id:located?body.slot_id:null,grupo_id:located?group:null,slot_numero:located?2:null,updated_at:expected.updated_at,...(action==='reject'?{motivo_rejeicao:body.motivo}:{})},
 ...(['add','approve','request'].includes(action)?{line:{id:body.expected?.line_id||body.line_id||id(6),nome:'Line',criada_agora:false}}:{})}
}
async function confirmAlert(page:Page,text:string){
 await expect.poll(()=>page.evaluate(()=>Boolean((window as any).harnessLastAlert))).toBeTruthy()
 await page.evaluate(t=>{const button=(window as any).harnessLastAlert.buttons.find((item:any)=>item.text===t);if(!button)throw Error('Alert button missing');button.onPress()},text)
}
test.beforeEach(async({page})=>{await page.route('**/api/**',r=>r.request().method()==='GET'?r.fulfill({json:{items:[]}}):r.abort())})
for(const action of ['approve','reject','remove'])test(`app: ${action} recupera a intenção original após resposta perdida e recarga`,async({page})=>{
 let writes=0;const keys:string[]=[],bodies:any[]=[]
 await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,route=>{
  const request=route.request();if(request.method()==='GET')return route.fulfill({json:board(writes>0)})
  writes++;keys.push(request.headers()['idempotency-key']);bodies.push(request.postDataJSON())
  if(writes===1)return route.abort('failed')
  return route.fulfill({json:{...success(request.method(),request.postDataJSON(),new URL(request.url()).searchParams.get('participacao_id')),repetida:true}})
 })
 await mountMobileHarness(page,props)
 if(action==='approve'){await page.getByRole('button',{name:'Aprovar',exact:true}).click();await page.getByRole('button',{name:/^B\s*Slot livre/}).click()}
 else if(action==='reject'){await page.getByPlaceholder('Motivo da rejeição (opcional)').fill('Revisar elenco com acentuação');await page.getByRole('button',{name:'Rejeitar',exact:true}).click()}
 else{await page.getByRole('button',{name:'Remover Line ativa',exact:true}).click();await confirmAlert(page,'Remover')}
 await expect(page.getByRole('button',{name:'Confirmar tentativa anterior',exact:true})).toBeVisible()
 expect(writes).toBe(1);expect(bodies[0].expected.updated_at).toBe(expected.updated_at)
 await mountMobileHarness(page,props)
 await page.getByRole('button',{name:'Confirmar tentativa anterior',exact:true}).click()
 await expect(page.getByText('Confirmada.',{exact:true})).toBeVisible()
 expect(keys[1]).toBe(keys[0]);expect(bodies[1]).toEqual(bodies[0]);expect(writes).toBe(2)
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('dz.participation')).length)).toBe(0)
})
test('app: reserva impede aprovação e origem da Liga é escolhida antes de enviar',async({page})=>{
 let writes=0,last:any
 const data=board();data.vagas[1].status='reservada'
 await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>r.request().method()==='GET'?r.fulfill({json:data}):(writes++,r.abort()))
 await mountMobileHarness(page,props);await page.getByRole('button',{name:'Aprovar',exact:true}).click()
 await page.getByRole('button',{name:/^B\s*Slot reservado/}).evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})))
 expect(writes).toBe(0)
 data.vagas[1].status='livre';(data as any).liga={divisoes:[{nome:'Grupo fixture',entradas:[{tipo:'convite_direto',quantidade:'2'}]}]}
 await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{if(r.request().method()==='GET')return r.fulfill({json:data});writes++;last=r.request().postDataJSON();return r.fulfill({json:success(r.request().method(),last)})})
 await mountMobileHarness(page,props);await page.getByRole('button',{name:'Aprovar',exact:true}).click()
 await page.getByRole('button',{name:/^B\s*Slot livre/}).click();await expect(page.getByText('Selecione a origem da vaga da Liga antes de aprovar.')).toBeVisible();expect(writes).toBe(0)
 await page.getByRole('button',{name:'Origem convite direto'}).click();await page.getByRole('button',{name:/^B\s*Slot livre/}).click()
 await expect(page.getByText('Confirmada.',{exact:true})).toBeVisible();expect(writes).toBe(1);expect(last.origem_entrada).toBe('convite_direto')
})
test('app: armazenamento bloqueado impede revisão e a pendência pertence à conta original',async({page})=>{
 let writes=0
 await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>r.request().method()==='GET'?r.fulfill({json:board()}):(writes++,r.abort('failed')))
 await mountMobileHarness(page,props);await page.evaluate(()=>{(window as any).slotStorageBlocked=true})
 await page.getByRole('button',{name:'Rejeitar',exact:true}).click();await expect(page.getByText(/Não foi possível ler a movimentação pendente/)).toBeVisible();expect(writes).toBe(0)
 await page.evaluate(()=>{(window as any).slotStorageBlocked=false});await page.getByRole('button',{name:'Rejeitar',exact:true}).click()
 await expect(page.getByRole('button',{name:'Confirmar tentativa anterior',exact:true})).toBeVisible()
 await renderMobileHarness(page,{actorId:id(99),token:'other-session'});await expect(page.getByRole('button',{name:'Confirmar tentativa anterior',exact:true})).toHaveCount(0)
 await renderMobileHarness(page,props);await expect(page.getByRole('button',{name:'Confirmar tentativa anterior',exact:true})).toBeVisible();expect(writes).toBe(1)
})
for(const action of ['approve','remove'])test(`web: recuperação de ${action} conserva versão e chave; clique duplo envia uma requisição`,async({page})=>{
 await mountParticipation(page,{championshipId:champ,contract})
 const body=action==='approve'?{mode:'review_request',action,participacao_id:id(11),slot_id:id(10),expected}:{expected:{...expected,status:'ativo',slot_id:id(7)}}
 let writes=0,release:(()=>Promise<void>)|undefined;const keys:string[]=[],bodies:any[]=[]
 await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{
  writes++;keys.push(r.request().headers()['idempotency-key']);bodies.push(r.request().postDataJSON())
  if(writes===1)return r.abort('failed')
  return new Promise<void>(resolve=>{release=async()=>{await r.fulfill({json:success(r.request().method(),r.request().postDataJSON(),new URL(r.request().url()).searchParams.get('participacao_id'))});resolve()}})
 })
 await page.evaluate(async({champ,contract,body,action})=>{try{await (window as any).participationApi.writeParticipation(champ,contract,action==='approve'?'PATCH':'DELETE',body,action==='remove'?'00000000-0000-4000-8000-000000000008':undefined)}catch{}},{champ,contract,body,action})
 await expect(page.getByRole('button',{name:'Confirmar tentativa anterior',exact:true})).toBeVisible()
 await mountParticipation(page,{championshipId:champ,contract})
 await page.getByRole('button',{name:'Confirmar tentativa anterior',exact:true}).evaluate(e=>{e.dispatchEvent(new MouseEvent('click',{bubbles:true}));e.dispatchEvent(new MouseEvent('click',{bubbles:true}))})
 await expect.poll(()=>Boolean(release)).toBeTruthy();expect(writes).toBe(2);await release!()
 await expect.poll(()=>page.evaluate(()=>(window as any).confirmed)).toBe(1)
 expect(keys[1]).toBe(keys[0]);expect(bodies[1]).toEqual(bodies[0]);expect(bodies[1].expected.updated_at).toBe(expected.updated_at)
})
test('web: troca de conta isola pendência e descarte explícito não faz gravação remota',async({page})=>{
 await mountParticipation(page,{championshipId:champ,contract});let writes=0
 await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{writes++;return r.abort('failed')})
 await page.evaluate(async({champ,contract})=>{try{await (window as any).participationApi.writeParticipation(champ,contract,'POST',{equipe_id:'00000000-0000-4000-8000-000000000005',line_id:'00000000-0000-4000-8000-000000000006',slot_id:'00000000-0000-4000-8000-000000000007'})}catch{}},{champ,contract})
 await expect(page.getByRole('button',{name:'Confirmar tentativa anterior',exact:true})).toBeVisible()
 await page.evaluate(id=>(window as any).changeParticipationActor(id),id(99));await expect(page.getByRole('button',{name:'Confirmar tentativa anterior',exact:true})).toHaveCount(0)
 await page.evaluate(id=>(window as any).changeParticipationActor(id),actor);await expect(page.getByRole('button',{name:'Confirmar tentativa anterior',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Encerrar tentativa após conferir',exact:true}).click();await expect(page.getByRole('button',{name:'Confirmar tentativa anterior',exact:true})).toHaveCount(0);expect(writes).toBe(1)
})
test('app: inclusão guarda a intenção original e recupera após recarga',async({page})=>{
 let writes=0;const keys:string[]=[],bodies:any[]=[]
 await page.route('**/api/campeonatos/**/equipes/busca*',r=>r.fulfill({json:{equipes:[{id:id(13),nome:'Equipe nova',lines:[{id:id(14),nome:'Line nova',ja_inscrita:false}]}],next_cursor:null}}))
 await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{
  if(r.request().method()==='GET')return r.fulfill({json:board(true)})
  writes++;keys.push(r.request().headers()['idempotency-key']);bodies.push(r.request().postDataJSON())
  return writes===1?r.abort('failed'):r.fulfill({json:success(r.request().method(),r.request().postDataJSON())})
 })
 await mountMobileHarness(page,props);await page.getByRole('button',{name:/^B\s*Slot livre/}).click()
 await page.getByPlaceholder('Nome ou tag da equipe').fill('Equipe nova');await page.getByRole('button',{name:'Usar',exact:true}).click()
 await expect(page.getByRole('button',{name:'Confirmar tentativa anterior',exact:true})).toBeVisible()
 await mountMobileHarness(page,props);await page.getByRole('button',{name:'Confirmar tentativa anterior',exact:true}).click()
 await expect(page.getByText('Confirmada.',{exact:true})).toBeVisible();expect(writes).toBe(2);expect(keys[1]).toBe(keys[0]);expect(bodies[1]).toEqual(bodies[0]);expect(bodies[0].line_id).toBe(id(14))
})
test('web: renovar a mesma sessão e falhar na limpeza preserva a recuperação',async({page})=>{
 await mountParticipation(page,{championshipId:champ,contract})
 await page.evaluate(async({actor,champ})=>{
  await (window as any).participationApi.participationAttempts.prepare(actor,champ,{method:'POST',participationId:null,body:{equipe_id:'00000000-0000-4000-8000-000000000005',line_id:'00000000-0000-4000-8000-000000000006',slot_id:'00000000-0000-4000-8000-000000000007'}})
  window.dispatchEvent(new CustomEvent('dz:participation-attempt'))
 },{actor,champ})
 let writes=0,release:(()=>Promise<void>)|undefined;const keys:string[]=[]
 await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{
  writes++;keys.push(r.request().headers()['idempotency-key'])
  if(writes===1)return new Promise<void>(resolve=>{release=async()=>{await r.fulfill({json:success(r.request().method(),r.request().postDataJSON())});resolve()}})
  return r.fulfill({json:{...success(r.request().method(),r.request().postDataJSON()),repetida:true}})
 })
 await page.getByRole('button',{name:'Confirmar tentativa anterior',exact:true}).click();await expect.poll(()=>Boolean(release)).toBeTruthy()
 await page.evaluate(actor=>{
  (window as any).changeParticipationActor(actor)
  ;(window as any).originalRemoveItem=Storage.prototype.removeItem;Storage.prototype.removeItem=()=>{}
 },actor)
 await release!();await expect.poll(()=>page.evaluate(()=>(window as any).confirmed)).toBe(1)
 await expect(page.getByRole('button',{name:'Confirmar tentativa anterior',exact:true})).toBeVisible()
 await page.evaluate(()=>{Storage.prototype.removeItem=(window as any).originalRemoveItem})
 await page.getByRole('button',{name:'Confirmar tentativa anterior',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).confirmed)).toBe(2)
 await expect(page.getByRole('button',{name:'Confirmar tentativa anterior',exact:true})).toHaveCount(0);expect(writes).toBe(2);expect(keys[0]).toBe(keys[1])
})
