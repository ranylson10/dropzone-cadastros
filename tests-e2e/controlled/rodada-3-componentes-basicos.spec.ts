import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

test.describe('Rodada 3 — componentes básicos', () => {
  test('botões e campos autenticados usam a fundação visual sem bordas e sombras decorativas', () => {
    const css = source('web/app/globals.css')

    expect(css).toContain('.button{ min-height: 44px; border: 0; border-radius: var(--ui-radius-sm); background: var(--ui-accent)')
    expect(css).toContain('.page-authenticated input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]),')
    expect(css).toContain('.page-authenticated textarea{ border: 0; border-radius: var(--ui-radius-sm); background: rgba(16,24,32,.055)')
    expect(css).toContain('outline: 2px solid var(--ui-accent)')
  })

  test('tabs autenticadas deixam de ser caixas e usam hierarquia por sublinhado', () => {
    const css = source('web/app/globals.css')

    expect(css).toContain('.page-authenticated .tab{ min-height: 40px; border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: transparent')
    expect(css).toContain('.page-authenticated .tab.active{ border-color: var(--ui-accent); background: transparent; color: #101820; box-shadow: none')
  })

  test('modal principal não usa blur, borda, sombra ou legenda de marca repetida', () => {
    const css = source('web/app/globals.css')
    const modal = source('web/components/layout/SystemModal.tsx')

    expect(css).toContain('.system-modal{ display: flex; flex-direction: column; width: min(100%, 760px); max-height: calc(100vh - 48px); overflow: hidden; border: 0; border-radius: var(--ui-radius-lg); background: var(--surface); box-shadow: none')
    expect(css).toContain('.system-modal-header{ position: sticky; top: 0; z-index: 3; display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding: 20px 22px 14px; border: 0; background: var(--surface)')
    expect(css).not.toContain('background: rgba(10, 15, 25, .58); backdrop-filter: blur(9px)')
    expect(modal).not.toContain('<p className="eyebrow">DropZone</p>')
  })
})
