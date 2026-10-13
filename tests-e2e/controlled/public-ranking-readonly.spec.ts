import fs from 'node:fs'
import {expect,test} from '@playwright/test'

const samplesFile=process.env.E2E_PUBLIC_RANKING_SAMPLES
const sample=samplesFile?JSON.parse(fs.readFileSync(samplesFile,'utf8')):null
const directory=process.env.E2E_PUBLIC_RANKING_OUTPUT_DIR||'relatorios-testes/ranking-2026-10-11'

test.describe('ranking e desempenho público · somente leitura',()=>{
  test.skip(!sample,'Informe E2E_PUBLIC_RANKING_SAMPLES com a amostra conferida por leitura.')
  test('três classificações, busca e diálogo acessível em desktop e celular',async({page},testInfo)=>{
    const errors:string[]=[],observations=[]
    page.on('pageerror',error=>errors.push(error.message))
    await page.route('**/*',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort())
    const responsePromise=page.waitForResponse(response=>response.url().endsWith('/api/rank'))
    await page.goto('/rank')
    const response=await responsePromise,payload=await response.json()
    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toContain('no-store')
    for(const[key,label]of [['teams','Equipes'],['players','Jogadores'],['championships','Campeonatos']]){
      expect(payload[key]).toHaveLength(Math.min(100,sample.ranking[key]))
      await page.getByRole('navigation',{name:'Tipo de ranking'}).getByRole('button',{name:label,exact:true}).click()
      await expect(page.locator('.dz-ranking-item')).toHaveCount(payload[key].length)
      for(const width of [1440,390,320]){
        await page.setViewportSize({width,height:900})
        await page.evaluate(()=>document.fonts.ready)
        const row=page.locator('.dz-ranking-item').first()
        await row.focus();await page.keyboard.press('Enter')
        const dialog=page.getByRole('dialog')
        await expect(dialog).toBeVisible()
        await expect(dialog.getByRole('button',{name:'Fechar detalhes'})).toBeFocused()
        await dialog.evaluate(element=>Promise.all(element.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{}))))
        const advanced=dialog.locator('summary').filter({hasText:'Mais estatísticas'})
        if(await advanced.count())await advanced.click()
        const observation=await page.evaluate(()=>{
          const dialog=document.querySelector('[role="dialog"]')!,heading=dialog.querySelector('h2')!,close=dialog.querySelector('button')!.getBoundingClientRect()
          const luminance=(color:string)=>(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number).map(channel=>channel/255).map(channel=>channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4).reduce((sum,channel,index)=>sum+channel*[.2126,.7152,.0722][index],0)
          const fg=luminance(getComputedStyle(heading).color),bg=luminance(getComputedStyle(heading.parentElement!.parentElement!).backgroundColor)
          const labelContrasts=[...dialog.querySelectorAll('.system-modal-header p,.directory-rank-detail-score small,.directory-rank-detail-advanced summary,.directory-rank-detail-metrics dt,.directory-rank-detail-advanced dt')].filter(element=>element.getBoundingClientRect().width>0).map(element=>{
            let surface:Element|null=element
            while(surface&&!/^rgb\(/.test(getComputedStyle(surface).backgroundColor))surface=surface.parentElement
            const text=luminance(getComputedStyle(element).color),background=luminance(getComputedStyle(surface||dialog).backgroundColor)
            return {label:element.textContent,contrast:(Math.max(text,background)+.05)/(Math.min(text,background)+.05)}
          })
          return {width:innerWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,dialogOverflow:dialog.scrollWidth>dialog.clientWidth+1,nestedMain:!!document.querySelector('main main'),tiny:[...document.querySelectorAll('main *,[role="dialog"] *')].filter(element=>{const rect=element.getBoundingClientRect(),style=getComputedStyle(element);return rect.width>0&&rect.height>0&&style.visibility!=='hidden'&&element.childElementCount===0&&!!element.textContent?.trim()&&parseFloat(style.fontSize)<12}).length,titleContrast:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05),labelContrasts,closeWidth:close.width,closeHeight:close.height,scrollLocked:document.body.style.overflow==='hidden'}
        })
        observations.push({mode:key,...observation})
        expect(observation.pageOverflow).toBeFalsy();expect(observation.dialogOverflow).toBeFalsy()
        expect(observation.nestedMain).toBeFalsy();expect(observation.tiny).toBe(0)
        expect(observation.titleContrast).toBeGreaterThanOrEqual(4.5)
        for(const label of observation.labelContrasts)expect(label.contrast,`${label.label}`).toBeGreaterThanOrEqual(4.5)
        expect(observation.closeWidth).toBeGreaterThanOrEqual(44);expect(observation.closeHeight).toBeGreaterThanOrEqual(44)
        expect(observation.scrollLocked).toBeTruthy()
        const link=dialog.getByRole('link',{name:/Abrir perfil completo/})
        if(await link.count()){
          const bounds=await link.boundingBox();expect(bounds?.height).toBeGreaterThanOrEqual(44)
          await dialog.getByRole('button',{name:'Fechar detalhes'}).focus()
          await page.keyboard.press('Shift+Tab');await expect(link).toBeFocused()
          await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'Fechar detalhes'})).toBeFocused()
        }
        if(width===320)await page.screenshot({path:`${directory}/ranking-${key}-${testInfo.project.name}-dialog-320.png`})
        await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(row).toBeFocused()
        expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden')
      }
      const search=page.getByRole('textbox',{name:/Buscar .* no ranking/})
      await search.fill('SEM_RESULTADO_09382745');await expect(page.locator('.dz-ranking-item')).toHaveCount(0)
      await expect(page.getByText('Nenhum resultado',{exact:true})).toBeVisible()
      await search.clear();await expect(page.locator('.dz-ranking-item')).toHaveCount(payload[key].length)
    }
    expect(errors).toEqual([])
    await testInfo.attach('ranking-readonly-observations',{body:JSON.stringify({observations,errors}),contentType:'application/json'})
    await page.screenshot({path:`${directory}/ranking-${testInfo.project.name}-320.png`,fullPage:true})
  })
  for(const profile of sample?.results||[]){
    test(`${profile.kind}: métricas do perfil coincidem com o serviço publicado`,async({page})=>{
      await page.route('**/*',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort())
      const response=await page.goto(`/${profile.kind}/${profile.id}`)
      expect(response?.status()).toBe(200)
      await expect(page.getByRole('heading',{name:'Desempenho competitivo'})).toBeVisible()
      const metrics=await page.locator('.competitive-kpi-grid article').evaluateAll(elements=>elements.map(element=>({label:element.querySelector('small')?.textContent,value:element.querySelector('strong')?.textContent})))
      expect(metrics).toEqual(profile.metrics)
      expect(await page.locator('.competitive-bar-item').count()).toBe(profile.trend.length)
      if(profile.tier)await expect(page.locator('.competitive-tier')).toContainText(profile.tier)
      else await expect(page.locator('.competitive-tier')).toHaveCount(0)
    })
  }
  test('falha de leitura oferece nova tentativa',async({page})=>{
    let requests=0
    await page.route('**/*',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort())
    await page.route('**/api/rank',route=>++requests===1?route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Não foi possível carregar o ranking.'})}):route.continue())
    await page.goto('/rank')
    await expect(page.getByText('Não foi possível carregar o ranking.',{exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Atualizar ranking'}).click()
    await expect(page.locator('.dz-ranking-item')).toHaveCount(Math.min(100,sample.ranking.teams))
    await expect(page.getByText('Não foi possível carregar o ranking.',{exact:true})).toHaveCount(0)
    expect(requests).toBe(2)
  })
})
