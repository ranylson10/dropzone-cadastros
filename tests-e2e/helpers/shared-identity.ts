import { expect, type Page } from '@playwright/test'
import { inspectIdentity } from '../../scripts/design/inspect-identity.mjs'

export async function assertSharedIdentity(page: Page) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) if (animation.effect?.getTiming().iterations !== Infinity) animation.finish()
  })
  const result = await page.evaluate(inspectIdentity)
  expect(result.overflow, 'page must fit its viewport').toBe(false)
  expect(result.findings.filter((item: { semantic: boolean }) => !item.semantic), 'visible legacy blue/purple styles').toEqual([])
}
