import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const css = readFileSync(path.join(process.cwd(), 'web/styles/dropzone-identity.css'), 'utf8')
const fixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
<style>* {box-sizing:border-box} body#dropzone-app {margin:0;padding:20px} .producer-console {width:100%;max-width:1300px;margin:auto}
.producer-management-split {width:100%} .producer-editor-nav-card, .producer-editor-content-card {min-height:60px}
.dz-workspace-nav {display:flex;white-space:nowrap;overflow-x:auto} .dz-workspace-nav button {flex:0 0 auto;min-width:135px;height:40px}
</style><style>${css}</style></head><body id="dropzone-app"><main class="producer-console">
<header class="producer-console-identity"><h1>6B PRODUÇÕES</h1></header>
<div class="producer-management-split"><aside class="producer-championship-sidebar">Campeonatos</aside>
<section class="championship-detail-card panel"><section class="producer-editor-summary-card"><h2>RW KINGS</h2></section>
<div class="producer-editor-layout"><aside class="producer-editor-navigation"><section class="producer-editor-nav-card">
<div class="producer-tools-horizontal"><nav class="dz-workspace-nav"><button>Organização</button><button>Fases e grupos</button><button>Equipes</button><button>Elencos</button><button>Jogos e quedas</button><button>Inscrições</button></nav></div>
</section><div class="producer-editor-action-card"><button>Abrir pontuador</button><button>Receber inscrições</button></div></aside>
<section class="producer-editor-content-card"><h2>Inscrições e convites</h2></section></div></section></div></main></body></html>`

test('navegação fica horizontal, larga e antes do conteúdo', async ({page}) => {
  // DOM parsing is sufficient: do not block on the full load event.
  await page.setContent(fixture, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  const detail = await page.locator('.championship-detail-card').boundingBox()
  const nav = await page.locator('.producer-editor-nav-card').boundingBox()
  const content = await page.locator('.producer-editor-content-card').boundingBox()
  const identity = await page.locator('.producer-console-identity').boundingBox()
  expect(detail).not.toBeNull()
  expect(nav).not.toBeNull()
  expect(content).not.toBeNull()
  expect(identity).not.toBeNull()
  expect(nav!.width).toBeGreaterThan(detail!.width * .94)
  expect(nav!.y + nav!.height).toBeLessThanOrEqual(content!.y)
  expect(identity!.width).toBeGreaterThanOrEqual(detail!.width - 1)
  expect(detail!.x + detail!.width).toBeLessThanOrEqual((await page.evaluate(() => innerWidth)) + 1)
  expect(await page.locator('.producer-editor-layout').evaluate((el) => getComputedStyle(el).flexDirection)).toBe('column')
})
