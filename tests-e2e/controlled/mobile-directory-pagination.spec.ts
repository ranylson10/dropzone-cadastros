import { expect, test } from '@playwright/test'
import { mountMobileHarness, renderMobileHarness } from '../helpers/mobile-directory-harness'

test.beforeEach(async ({page})=>{
  await page.route('**/api/**',route=>route.request().method()==='GET'?route.fulfill({json:{items:[],announcements:[],equipes:[]}}):route.abort())
})

test('app: paginação preserva resultados, repete página com falha e rejeita duplicação',async ({page})=>{
  let failures=0; const queries: URL[]=[]
  await page.route('**/api/equipes/busca-publica?**',route=>{
    const url=new URL(route.request().url());queries.push(url)
    if(url.searchParams.has('cursor') && failures++===0)return route.fulfill({status:503,json:{error:'Falha temporária'}})
    return route.fulfill({json:url.searchParams.has('cursor')?{items:[{id:'a',nome:'Equipe A'},{id:'b',nome:'Equipe B'}],nextCursor:null}:{items:[{id:'a',nome:'Equipe A'}],nextCursor:'page2'}})
  })
  await mountMobileHarness(page,{screen:'hook',endpoint:'/api/equipes/busca-publica',query:'Equipe',options:{limit:20}})
  await expect(page.getByText('Equipe A',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Carregar mais',exact:true}).click()
  await expect(page.getByText('Falha temporária')).toBeVisible()
  await expect(page.getByText('Equipe A',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Tentar novamente'}).click()
  await expect(page.getByText('Equipe B',{exact:true})).toBeVisible()
  await expect(page.getByText('Equipe A',{exact:true})).toHaveCount(1)
  expect(queries.every(url=>url.searchParams.get('limit')==='20')).toBeTruthy()
  expect(queries.filter(url=>url.searchParams.get('cursor')==='page2')).toHaveLength(2)
})

test('app: busca desativada cancela resposta atrasada e não ressuscita resultados',async ({page})=>{
  let release: (()=>Promise<void>) | undefined
  await page.route('**/api/equipes/busca-publica?**',route=>new Promise<void>(resolve=>{release=async()=>{await route.fulfill({json:{items:[{id:'old',nome:'Resposta antiga'}]}}).catch(()=>{});resolve()}}))
  await mountMobileHarness(page,{screen:'hook',endpoint:'/api/equipes/busca-publica',query:'Old',options:{enabled:false}})
  await expect.poll(()=>Boolean(release)).toBeFalsy()
  await renderMobileHarness(page,{options:{enabled:true}})
  await expect.poll(()=>Boolean(release)).toBeTruthy()
  await renderMobileHarness(page,{query:'',options:{enabled:false}})
  await expect.poll(()=>page.evaluate(()=>(window as any).harnessAborts)).toBeGreaterThan(0)
  await release!()
  await expect(page.getByText('Resposta antiga')).toHaveCount(0)
  expect(await page.evaluate(()=>(window as any).harnessPage.items.length)).toBe(0)
})

test('app: troca de campeonato e sessão reinicia cursor e requer autenticação',async ({page})=>{
  const calls:{path:string;cursor:string|null;auth:string|undefined}[]=[]
  await page.route('**/api/campeonatos/**',route=>{const url=new URL(route.request().url());calls.push({path:url.pathname,cursor:url.searchParams.get('cursor'),auth:route.request().headers().authorization});return route.fulfill({json:{equipes:[{id:url.pathname,nome:url.pathname.includes('/first/')?'Primeiro':'Segundo'}],nextCursor:'page2'}})})
  await mountMobileHarness(page,{screen:'hook',endpoint:'/api/campeonatos/first/equipes/busca',query:'EQ',options:{authenticated:true,itemsKey:'equipes',accessToken:null}})
  expect(calls).toHaveLength(0)
  await renderMobileHarness(page,{options:{authenticated:true,itemsKey:'equipes',accessToken:'first-token'}})
  await expect(page.getByText('Primeiro',{exact:true})).toBeVisible()
  await renderMobileHarness(page,{endpoint:'/api/campeonatos/second/equipes/busca',options:{authenticated:true,itemsKey:'equipes',accessToken:'second-token'}})
  await expect(page.getByText('Segundo',{exact:true})).toBeVisible()
  await expect(page.getByText('Primeiro',{exact:true})).toHaveCount(0)
  expect(calls.map(call=>call.cursor)).toEqual([null,null])
  expect(calls.map(call=>call.auth)).toEqual(['Bearer first-token','Bearer second-token'])
})

test('app: busca global usa páginas por categoria e mantém outras listas após falha',async ({page})=>{
  const calls:URL[]=[]
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url());calls.push(url);expect(route.request().method()).toBe('GET');expect(route.request().headers().authorization).toBeUndefined()
    if(url.pathname.includes('/jogadores/'))return route.fulfill({status:503,json:{error:'Jogadores indisponíveis'}})
    if(url.pathname==='/api/vagas')return route.fulfill({json:{announcements:[{id:'champ',nome:'Copa pesquisada'}],nextCursor:null}})
    return route.fulfill({json:url.searchParams.has('cursor')?{items:[{id:'t2',nome:'Equipe segunda página'}]}:{items:[{id:'t1',nome:'Equipe pesquisada'}],nextCursor:'team-next'}})
  })
  await mountMobileHarness(page,{screen:'GlobalSearchScreen'})
  expect(calls).toHaveLength(0)
  await page.getByPlaceholder('Digite nome, nick, tag, ID...').fill('Equipe')
  await expect(page.getByText('Equipe pesquisada',{exact:true})).toBeVisible()
  await expect(page.getByText('Copa pesquisada',{exact:true})).toBeVisible()
  await expect(page.getByText('Jogadores indisponíveis')).toBeVisible()
  await page.getByRole('button',{name:'Carregar mais',exact:true}).click()
  await expect(page.getByText('Equipe segunda página',{exact:true})).toBeVisible()
  expect(calls.every(url=>url.searchParams.get('limit')==='20')).toBeTruthy()
  const before=calls.length
  await page.getByRole('button',{name:/^equipes /}).click()
  await expect(page.getByText('Copa pesquisada',{exact:true})).toHaveCount(0)
  expect(calls).toHaveLength(before)
  await page.getByPlaceholder('Digite nome, nick, tag, ID...').fill('Equipe nova')
  await expect.poll(()=>calls.length).toBe(before+1)
  expect(calls.at(-1)?.pathname).toBe('/api/equipes/busca-publica')
  await page.getByPlaceholder('Digite nome, nick, tag, ID...').fill('')
  await expect(page.getByText('Equipe pesquisada',{exact:true})).toHaveCount(0)
})

test('app: destinos de transferência carregam somente na edição e permitem mais páginas',async ({page})=>{
  const reads:URL[]=[]
  await page.route('**/api/equipes/**',route=>{
    const url=new URL(route.request().url());reads.push(url)
    if(!url.pathname.includes('busca-publica'))return route.fulfill({json:{line:{id:'line',nome:'Line autorizada'},permissions:{pode_editar:true},transfer:{allowed:true},members:[],roster:[],events:[],team_lines:[]}})
    return route.fulfill({json:url.searchParams.has('cursor')?{items:[{id:'next',nome:'Destino distante'}]}:{items:[{id:'own',nome:'Equipe atual'},{id:'dest',nome:'Destino inicial'}],nextCursor:'next'}})
  })
  await mountMobileHarness(page,{screen:'LineManagementScreen',selectedTeamId:'own',selectedLineId:'line'})
  await expect(page.getByText('Line autorizada',{exact:true})).toBeVisible()
  expect(reads.filter(url=>url.pathname.includes('busca-publica'))).toHaveLength(0)
  await page.getByRole('button',{name:'Editar',exact:true}).click()
  await expect(page.getByText('Destino inicial',{exact:true})).toBeVisible()
  await expect(page.getByText('Equipe atual',{exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'Carregar mais',exact:true}).click()
  await expect(page.getByText('Destino distante',{exact:true})).toBeVisible()
  await page.getByPlaceholder('Buscar equipe de destino').fill('EQ 999')
  await expect.poll(()=>reads.at(-1)?.searchParams.get('q')).toBe('EQ 999')
  expect(reads.filter(url=>url.pathname.includes('busca-publica')).every(url=>url.searchParams.get('limit')==='30')).toBeTruthy()
  expect(await page.evaluate(()=>(window as any).harnessAlerts||0)).toBe(0)
})

test('app: seletor de inscrição continua lista e descarta seleção ao trocar campeonato',async ({page})=>{
  const reads:URL[]=[]
  await page.route('**/api/campeonatos/**',route=>{
    const url=new URL(route.request().url());reads.push(url)
    if(!url.pathname.endsWith('/busca'))return route.fulfill({json:{vagas:[{id:'slot',grupo_id:'group',slot_numero:1,grupo:{nome:'Grupo'}}],solicitacoes:[]}})
    return route.fulfill({json:url.searchParams.has('cursor')?{equipes:[{id:'next',nome:'Equipe adicional',lines:[]}]}:{equipes:[{id:'first',nome:'Equipe inicial',lines:[]}],nextCursor:'next'}})
  })
  await mountMobileHarness(page,{screen:'ChampionshipTeamsPanel',championshipId:'first',token:'fixture-token'})
  await page.getByRole('button',{name:'Adicionar',exact:true}).click()
  await page.getByPlaceholder('Nome ou tag da equipe').fill('Equipe')
  await expect(page.getByText('Equipe inicial',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Carregar mais',exact:true}).click()
  await expect(page.getByText('Equipe adicional',{exact:true})).toBeVisible()
  await renderMobileHarness(page,{championshipId:'second'})
  await expect(page.getByPlaceholder('Nome ou tag da equipe')).toHaveCount(0)
  await expect(page.getByText('Equipe adicional',{exact:true})).toHaveCount(0)
  expect(reads.filter(url=>url.pathname.endsWith('/busca')).every(url=>url.searchParams.get('limit')==='30')).toBeTruthy()
})

test('app: resposta privada atrasada não substitui a line atual',async ({page})=>{
  let release: (()=>Promise<void>) | undefined
  const result=(nome:string)=>({line:{nome},permissions:{pode_editar:false},transfer:{allowed:false},members:[],roster:[],events:[],team_lines:[]})
  await page.route('**/api/equipes/**',route=>{
    if(route.request().url().includes('/first'))return new Promise<void>(resolve=>{release=async()=>{await route.fulfill({json:result('Line antiga')}).catch(()=>{});resolve()}})
    return route.fulfill({json:result('Line atual')})
  })
  await mountMobileHarness(page,{screen:'LineManagementScreen',selectedTeamId:'team',selectedLineId:'first'})
  await expect.poll(()=>Boolean(release)).toBeTruthy()
  await renderMobileHarness(page,{selectedLineId:'second'})
  await expect(page.getByText('Line atual',{exact:true})).toBeVisible()
  await release!()
  await expect(page.getByText('Line antiga',{exact:true})).toHaveCount(0)
  await expect(page.getByText('Line atual',{exact:true})).toBeVisible()
})
