import {test,expect,type Page} from '@playwright/test'
import {mountLiga} from '../helpers/liga-web-harness'
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const champ=id(2),actor=id(1),group=id(3),phase=id(4),slotA=id(5),slotB=id(6)
const plan={nome_agrupamento:'Séries',divisoes:[{id:id(20),nome:'Série A',codigo:'A',equipes:'2',entradas:[{id:id(21),tipo:'convite_direto',quantidade:'1',origem_agrupamento_id:''},{id:id(22),tipo:'mantida',quantidade:'1',origem_agrupamento_id:''}]}]}
const teams=[1,2].map(n=>({id:id(30+n),nome:'Equipe '+n,tag:'E'+n,lines:[{id:id(40+n),nome:'Line '+n,ja_inscrita:false}]}))
const board=()=>({campeonato:{id:champ,nome:'Liga fixture',tipo:'liga'},participation_write_mode:'atomic',participation_actor_id:actor,liga:structuredClone(plan),permission:{canManage:true,canRemove:true,canOrganizeGroups:true},fases:[{id:phase,nome:'Fase fixture',ordem:1}],grupos:[{id:group,nome:'Série A',fase_id:phase}],slots:[{id:slotA,grupo_id:group,fase_id:phase,slot_numero:1,slot_letra:'A',status:'livre'},{id:slotB,grupo_id:group,fase_id:phase,slot_numero:2,slot_letra:'B',status:'livre'}],jogos:[]})
const success=(body:any)=>({ok:true,operation_confirmed:true,action:'add',campeonato_id:champ,mensagem:'Equipe confirmada.',participacao:{id:id(50),campeonato_id:champ,equipe_id:body.equipe_id,line_id:body.line_id,status:'ativo',slot_id:body.slot_id,grupo_id:group,slot_numero:body.slot_id===slotA?1:2,updated_at:'2026-10-11T13:00:00.123456+00:00'},line:{id:body.line_id,nome:'Line',criada_agora:false}})
const structureProps={campeonatoId:champ},liliProps={screen:'lili',accessToken:'fixture-session',activeAccount:{id:actor,profile_type:'produtora'}}
async function reads(page:Page,data:any){
 await page.route('**/api/campeonatos/*/estrutura',r=>r.fulfill({json:data}))
 await page.route('**/api/campeonatos/*/equipes/busca?*',r=>r.fulfill({json:{equipes:teams,nextCursor:null}}))
 await page.route('**/api/lili/campeonatos',r=>r.fulfill({json:{items:[{id:champ,nome:'Liga fixture',tipo:'liga',relationship:'admin'}]}}))
}
async function batch(page:Page){await page.getByRole('button',{name:/^Adicionar equipes ·/}).click();await page.getByRole('textbox',{name:'Equipe 1',exact:true}).click();await page.getByRole('button',{name:/^Equipe 1/}).click();await page.getByRole('textbox',{name:'Equipe 2',exact:true}).click();await page.getByRole('button',{name:/^Equipe 2/}).click()}
async function lili(page:Page){await page.getByRole('button',{name:/^Liga fixture/}).click();await page.getByRole('button',{name:'Grupos',exact:true}).click();await page.getByRole('button',{name:/^Ver equipes/}).click();await page.getByRole('button',{name:'Organizar',exact:true}).click()}
async function searchLili(page:Page){await page.getByRole('textbox',{name:'Buscar equipe'}).fill('Equipe');await page.locator('.lili-slot-search-form button').click();await expect(page.getByRole('button',{name:/Line 1\s*Adicionar/})).toBeVisible()}
test('Estrutura: lote exige origem, reserva a cota no rascunho e envia cada seleção',async({page})=>{
 const data=board();let writes:any[]=[],rosterReads=0;await reads(page,data)
 await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{if(r.request().method()==='GET'){rosterReads++;return r.fulfill({json:{}})}writes.push(r.request().postDataJSON());return r.fulfill({json:success(writes.at(-1))})})
 await mountLiga(page,structureProps);await batch(page);await page.getByRole('button',{name:'Salvar 2 equipe(s)'}).click();await expect(page.getByText('Escolha a origem da equipe neste agrupamento da Liga.')).toBeVisible();expect(writes).toHaveLength(0)
 await page.getByLabel('Origem da equipe 1 na Liga').selectOption('convite_direto');await expect(page.getByLabel('Origem da equipe 2 na Liga').locator('option[value="convite_direto"]')).toBeDisabled();await page.getByLabel('Origem da equipe 2 na Liga').selectOption('mantida')
 await page.getByRole('button',{name:'Salvar 2 equipe(s)'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(writes.map(w=>w.origem_entrada)).toEqual(['convite_direto','mantida']);expect(rosterReads).toBe(0)
})
test('Estrutura: confirmação parcial conserva somente a linha incerta e recuperação usa origem/chave originais',async({page})=>{
 const data=board();let bodies:any[]=[],keys:string[]=[];await reads(page,data)
 await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{const b=r.request().postDataJSON();bodies.push(b);keys.push(r.request().headers()['idempotency-key']);if(bodies.length===2)return r.abort('failed');return r.fulfill({json:success(b)})})
 await mountLiga(page,structureProps);await batch(page);await page.getByLabel('Origem da equipe 1 na Liga').selectOption('convite_direto');await page.getByLabel('Origem da equipe 2 na Liga').selectOption('mantida');await page.getByRole('button',{name:'Salvar 2 equipe(s)'}).click()
 await expect(page.getByRole('button',{name:'Confirmar tentativa anterior'})).toBeVisible();await expect(page.getByRole('textbox',{name:'Equipe 2',exact:true})).toHaveCount(0);await expect(page.getByRole('textbox',{name:'Equipe 1',exact:true})).toHaveValue('Equipe 2 · E2')
 await page.getByRole('button',{name:'Confirmar tentativa anterior'}).click();await expect.poll(()=>bodies.length).toBe(3);expect(bodies[2]).toEqual(bodies[1]);expect(keys[2]).toBe(keys[1]);expect(keys[0]).not.toBe(keys[1])
})
test('Estrutura: plano inválido impede qualquer inclusão; campeonato comum dispensa origem',async({page})=>{
 const data=board();data.liga.divisoes[0].entradas[0].quantidade='1.5';let writes:any[]=[];await reads(page,data)
 await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{writes.push(r.request().postDataJSON());return r.fulfill({json:success(writes.at(-1))})})
 await mountLiga(page,structureProps);await batch(page);await expect(page.getByLabel('Origem da equipe 1 na Liga')).toBeDisabled();await page.getByRole('button',{name:'Salvar 2 equipe(s)'}).click();await expect(page.getByText(/O plano da Liga possui uma origem ou quantidade inválida/).first()).toBeVisible();expect(writes).toHaveLength(0)
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();(data as any).liga=null;data.campeonato.tipo='comum';await mountLiga(page,structureProps);await batch(page);await expect(page.getByLabel('Origem da equipe 1 na Liga')).toHaveCount(0);await page.getByRole('button',{name:'Salvar 2 equipe(s)'}).click();await expect.poll(()=>writes.length).toBe(2);expect(writes.every(w=>w.origem_entrada===null)).toBeTruthy()
})
test('Lili: reserva não selecionável, origem obrigatória e recuperação após recarga',async({page})=>{
 const data=board();data.slots[1].status='reservado';let bodies:any[]=[],keys:string[]=[];await reads(page,data)
 await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{bodies.push(r.request().postDataJSON());keys.push(r.request().headers()['idempotency-key']);if(bodies.length===1)return r.abort('failed');return r.fulfill({json:success(bodies.at(-1))})})
 await mountLiga(page,liliProps);await lili(page);await expect(page.getByRole('button',{name:/^B Slot indisponível/})).toBeDisabled();await page.getByRole('button',{name:/^A Slot disponível/}).click();await searchLili(page);await page.getByRole('button',{name:/Line 1\s*Adicionar/}).click();await expect(page.getByText('Escolha a origem da equipe neste agrupamento da Liga.')).toBeVisible();expect(bodies).toHaveLength(0)
 await page.getByLabel('Origem da equipe na Liga').selectOption('convite_direto');await page.getByRole('button',{name:/Line 1\s*Adicionar/}).click();await expect(page.getByRole('button',{name:'Confirmar tentativa anterior'})).toBeVisible()
 await mountLiga(page,liliProps);await page.getByRole('button',{name:/^Liga fixture/}).click();await page.getByRole('button',{name:'Confirmar tentativa anterior'}).click();await expect.poll(()=>bodies.length).toBe(2);expect(bodies[1]).toEqual(bodies[0]);expect(keys[1]).toBe(keys[0]);expect(bodies[1].origem_entrada).toBe('convite_direto')
})
test('Lili: mudar slot limpa a origem; mudar conta limpa o campeonato privado',async({page})=>{
 await reads(page,board());await mountLiga(page,liliProps);await lili(page);await page.getByRole('button',{name:/^A Slot disponível/}).click();await page.getByLabel('Origem da equipe na Liga').selectOption('mantida');await page.getByRole('button',{name:/^B Slot disponível/}).click();await expect(page.getByLabel('Origem da equipe na Liga')).toHaveValue('')
 await page.evaluate(p=>(window as any).renderLiga(p),{activeAccount:{id:id(99),profile_type:'produtora'}});await expect(page.getByRole('button',{name:'Grupos',exact:true})).toHaveCount(0);await expect(page.getByLabel('Origem da equipe na Liga')).toHaveCount(0)
})
test('Estrutura: inclusão individual exige a origem e troca de campeonato limpa o formulário',async({page})=>{
 const data=board();let writes:any[]=[];await reads(page,data)
 await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{writes.push(r.request().postDataJSON());return r.fulfill({json:success(writes.at(-1))})})
 await mountLiga(page,structureProps);await page.locator('.phase-folder-row .folder-toggle').click();await page.locator('.group-folder-row .folder-toggle').click();await page.getByRole('button',{name:/^A\s*Slot A/}).click()
 await page.getByRole('textbox',{name:'Buscar equipe'}).fill('Equipe');await page.getByRole('button',{name:'Buscar',exact:true}).click();await page.getByRole('button',{name:/^Equipe 1/}).click();await page.getByRole('combobox',{name:'Line existente (opcional)'}).selectOption(teams[0].lines[0].id)
 await page.getByRole('button',{name:'Adicionar ao slot'}).click();await expect(page.getByText('Escolha a origem da equipe neste agrupamento da Liga.')).toBeVisible();expect(writes).toHaveLength(0)
 await page.getByLabel('Origem da equipe na Liga').selectOption('mantida');await page.getByRole('button',{name:'Adicionar ao slot'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(writes[0].origem_entrada).toBe('mantida')
 await page.getByRole('button',{name:/^Adicionar equipes ·/}).click();await page.evaluate(p=>(window as any).renderLiga(p),{campeonatoId:id(99)});await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('Estrutura: remoção usa a versão da mesma leitura, sem buscar o roster novamente',async({page})=>{
 const data:any=board(),version='2026-10-11T13:00:00.123456+00:00',expected={equipe_id:teams[0].id,line_id:teams[0].lines[0].id,slot_id:slotA,status:'ativo',updated_at:version};data.slots[0]={...data.slots[0],equipe_id:expected.equipe_id,line_id:expected.line_id,participacao_id:id(51),line_nome:'Line ativa',participation_expected:expected,status:'ocupado'}
 let roster=0,removals:any[]=[];await reads(page,data);await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\/(?:participacao-atomica|movimentacao-atomica))?(?:\?.*)?$/,r=>{if(r.request().method()==='GET'){roster++;return r.fulfill({json:{}})}removals.push({method:r.request().method(),url:r.request().url(),body:r.request().postDataJSON()});return r.fulfill({json:{ok:true,operation_confirmed:true,action:'remove',campeonato_id:champ,participacao:{id:id(51),campeonato_id:champ,...expected,slot_id:null,grupo_id:null,slot_numero:null,status:'removido'}}})})
 await mountLiga(page,structureProps);await page.locator('.phase-folder-row .folder-toggle').click();await page.locator('.group-folder-row .folder-toggle').click();await page.getByRole('button',{name:/^A\s*Line ativa/}).click();await expect.poll(()=>removals.length).toBe(1);expect(removals[0].method).toBe('DELETE');expect(removals[0].body.expected).toEqual(expected);expect(new URL(removals[0].url).searchParams.get('participacao_id')).toBe(id(51));expect(roster).toBe(0)
})
