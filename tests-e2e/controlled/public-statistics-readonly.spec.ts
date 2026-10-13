import fs from 'node:fs'
import {expect,test} from '@playwright/test'

const samplesFile=process.env.E2E_PUBLIC_STATISTICS_SAMPLES
const screenshotsDirectory=process.env.E2E_PUBLIC_STATISTICS_OUTPUT_DIR||'relatorios-testes/estatisticas-2026-10-11'
const sample=samplesFile?JSON.parse(fs.readFileSync(samplesFile,'utf8')).results.find((row:{teams:number;players:number})=>row.teams>0&&row.players>0):null

test.describe('estatísticas públicas · somente leitura',()=>{
  test.skip(!sample,'Informe E2E_PUBLIC_STATISTICS_SAMPLES com uma amostra real conferida por leitura.')
  test('tabela e MVP iniciais coincidem com as estatísticas publicadas',async({page},testInfo)=>{
    const errors:string[]=[],statisticsRequests:string[]=[],observations=[]
    page.on('pageerror',error=>errors.push(error.message))
    page.on('request',request=>{if(/\/estatisticas\/(equipes|mvp)/.test(request.url()))statisticsRequests.push(request.url())})
    await page.route('**/*',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort())
    const response=await page.goto(`/campeonatos/${sample.id}`)
    expect(response?.status()).toBe(200)
    await page.getByRole('tab',{name:/Estatísticas/}).click()
    await page.getByRole('button',{name:'Tabela',exact:true}).click()
    await expect(page.locator('.champ-stats-team-table tbody tr')).toHaveCount(sample.teams)
    for(const view of ['Tabela','MVP']){
      await page.getByRole('button',{name:view,exact:true}).click()
      await expect(page.locator(view==='Tabela'?'.champ-stats-team-table tbody tr':'.champ-stats-mvp-table tbody tr')).toHaveCount(view==='Tabela'?sample.teams:sample.players)
      for(const width of [1440,390,320]){
        await page.setViewportSize({width,height:900})
        await page.evaluate(()=>document.fonts.ready)
        const measurement=await page.evaluate(()=>{
          const luminance=(color:string)=>(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number).map(channel=>channel/255).map(channel=>channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4).reduce((sum,channel,index)=>sum+channel*[.2126,.7152,.0722][index],0)
          const filterContrast=[...document.querySelectorAll('.champ-stats-filters label > span,.champ-stats-filters-mobile label > span')].filter(element=>element.getBoundingClientRect().width>0).map(element=>{
            let background:Element|null=element
            while(background&&!/^rgb\(/.test(getComputedStyle(background).backgroundColor))background=background.parentElement
            const text=luminance(getComputedStyle(element).color),surface=luminance(background?getComputedStyle(background).backgroundColor:'rgb(255,255,255)')
            return (Math.max(text,surface)+.05)/(Math.min(text,surface)+.05)
          })
          return {
          width:innerWidth,
          overflow:document.documentElement.scrollWidth>innerWidth+1,
          nestedMain:Boolean(document.querySelector('main main')),
          tiny:[...document.querySelectorAll('main *')].filter(element=>{
            const rect=element.getBoundingClientRect(),style=getComputedStyle(element)
            return rect.width>0&&rect.height>0&&style.visibility!=='hidden'&&element.childElementCount===0&&Boolean(element.textContent?.trim())&&parseFloat(style.fontSize)<12
          }).length,
          filterContrast,
          }
        })
        observations.push({view,...measurement})
        expect(measurement.overflow).toBeFalsy();expect(measurement.nestedMain).toBeFalsy()
        expect(measurement.tiny).toBe(0)
        expect(measurement.filterContrast.length).toBeGreaterThan(0)
        for(const contrast of measurement.filterContrast)expect(contrast).toBeGreaterThanOrEqual(4.5)
      }
      await page.screenshot({path:`${screenshotsDirectory}/${view}-${testInfo.project.name}-320.png`,fullPage:true})
      await page.locator('.champ-stats-tabs').scrollIntoViewIfNeeded()
      await page.screenshot({path:`${screenshotsDirectory}/${view}-${testInfo.project.name}-320-viewport.png`})
    }
    expect(statisticsRequests).toEqual([])
    expect(errors).toEqual([])
    await testInfo.attach('published-statistics-observations',{body:JSON.stringify({sample,observations,errors,statisticsRequests}),contentType:'application/json'})
  })
  test('APIs anônimas preservam a publicação e recorte sem resultados retorna vazio',async({request})=>{
    for(const [kind,key,count]of [['equipes','equipes',sample.teams],['mvp','jogadores',sample.players]]as const){
      const response=await request.get(`/api/campeonatos/${sample.id}/estatisticas/${kind}`)
      expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toBe('no-store')
      const data=await response.json()
      expect(data[key]).toHaveLength(count)
      expect(data.publicacao.delay_segundos).toBe(sample.delaySeconds)
      expect(data.publicacao.partidas_publicadas).toHaveLength(sample.publishedFalls)
      const empty=await request.get(`/api/campeonatos/${sample.id}/estatisticas/${kind}?partida_id=ffffffff-ffff-4fff-8fff-ffffffffffff`)
      expect(empty.status()).toBe(200);expect((await empty.json())[key]).toEqual([])
      const unavailable=await request.get(`/api/campeonatos/ffffffff-ffff-4fff-8fff-ffffffffffff/estatisticas/${kind}`)
      expect(unavailable.status()).toBe(400)
      expect((await unavailable.json()).error).toBe('Campeonato não disponível para leitura pública.')
    }
  })
})
