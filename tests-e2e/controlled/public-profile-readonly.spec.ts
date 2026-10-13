import fs from 'node:fs'
import { expect, test } from '@playwright/test'

type Sample = { kind: string; id: string; found?: boolean }
const samplesFile = process.env.E2E_PUBLIC_PROFILE_SAMPLES
const screenshotsDirectory = process.env.E2E_PUBLIC_PROFILE_OUTPUT_DIR || 'relatorios-testes/perfis-2026-10-11'
const samples: Sample[] = samplesFile ? JSON.parse(fs.readFileSync(samplesFile, 'utf8')).results.filter((item: Sample) => item.found) : []
const allowed = new Set(['campeonatos', 'equipes', 'jogadores', 'managers', 'produtoras'])

test.describe('subpáginas públicas · somente leitura', () => {
  test.skip(!samplesFile, 'Informe E2E_PUBLIC_PROFILE_SAMPLES com IDs públicos confirmados no ambiente local.')
  for (const sample of samples) {
    test(`${sample.kind}: abre o perfil real sem erros ou overflow`, async ({ page }, testInfo) => {
      expect(allowed.has(sample.kind)).toBeTruthy()
      expect(sample.id).toMatch(/^[0-9a-f-]{36}$/i)
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort())
      const response = await page.goto(`/${sample.kind}/${sample.id}`)
      expect(response?.status()).toBe(200)
      await expect(page.locator('main h1').first()).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      const results = []
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 })
        await expect(page.locator('main h1').first()).toBeVisible()
        const observation = await page.evaluate(() => {
          const overlaps = (a: Element | null, b: Element | null) => {
            if (!a || !b) return false
            const first = a.getBoundingClientRect(), second = b.getBoundingClientRect()
            return first.width > 0 && second.width > 0 && first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top
          }
          const rgb = (value: string) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number)
          const luminance = (value: string) => rgb(value).map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0)
          const headerContrast = [...document.querySelectorAll('.competitive-loadout header strong,.competitive-trend header strong')].map(element => {
            let background: Element | null = element
            while (background && !/^rgb\(/.test(getComputedStyle(background).backgroundColor)) background = background.parentElement
            const text = luminance(getComputedStyle(element).color), surface = luminance(background ? getComputedStyle(background).backgroundColor : 'rgb(255,255,255)')
            return (Math.max(text, surface) + .05) / (Math.min(text, surface) + .05)
          })
          return {
          width: innerWidth,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          nestedMain: Boolean(document.querySelector('main main')),
          tiny: [...document.querySelectorAll('main *')].filter(element => {
            const rect = element.getBoundingClientRect(), style = getComputedStyle(element)
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && element.childElementCount === 0 && Boolean(element.textContent?.trim()) && parseFloat(style.fontSize) < 12
          }).length,
          averageCollisions: [...document.querySelectorAll('.competitive-average-grid > span')].filter(element => {
            const label = element.querySelector('small'), value = element.querySelector('b')
            return label && value && value.getBoundingClientRect().top - label.getBoundingClientRect().bottom < 3
          }).length,
          headerContrast,
          launcherObstructsEnroll: overlaps(document.querySelector('.lili-global-launcher'), document.querySelector('.champ-public-mobile-enroll')),
          }
        })
        results.push(observation)
        expect(observation.overflow).toBeFalsy()
        expect(observation.nestedMain).toBeFalsy()
        expect(observation.tiny).toBe(0)
        expect(observation.averageCollisions).toBe(0)
        expect(observation.launcherObstructsEnroll).toBeFalsy()
        for (const contrast of observation.headerContrast) expect(contrast).toBeGreaterThanOrEqual(4.5)
      }
      expect(errors).toEqual([])
      await testInfo.attach('profile-readonly-observations', { body: JSON.stringify({ sample, results, errors }), contentType: 'application/json' })
      await page.screenshot({ path: `${screenshotsDirectory}/${sample.kind}-${testInfo.project.name}-320.png`, fullPage: true })
    })
  }
  test('perfil inexistente mostra not-found e impede indexação', async ({ page }) => {
    await page.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort())
    const response = await page.goto('/equipes/ffffffff-ffff-4fff-8fff-ffffffffffff')
    // Next streams notFound responses with HTTP 200 after sending the headers.
    expect([200, 404]).toContain(response?.status())
    await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible()
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached()
  })
})
