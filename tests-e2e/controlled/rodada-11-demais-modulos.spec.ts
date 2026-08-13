import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 11 — demais módulos', () => {
  test('agenda abandona planilha branca e usa fundação escura', () => {
    const css = read('web/features/agenda/agenda.css')
    expect(css).toContain('background: var(--ui-surface, #141518)')
    expect(css).toContain('background: var(--ui-bg, #0c0d0f)')
    expect(css).not.toContain('background: #f7f8fa;')
    expect(css).not.toContain('background: #e5e7eb;')
    expect(css).not.toContain('box-shadow: var(--shadow);')
  })

  test('agenda mobile mantém leitura compacta', () => {
    const css = read('web/features/agenda/agenda.css')
    expect(css).toContain('@media (max-width: 640px)')
    expect(css).toContain('grid-template-columns: 70px minmax(0,1fr)')
  })

  test('carteira substitui mini cards genéricos por resumo operacional', () => {
    const source = read('web/features/billing/WalletPanel.tsx')
    expect(source).toContain('className="wallet-summary"')
    expect(source).toContain('className="wallet-withdraw"')
    expect(source).toContain('className="wallet-history"')
    expect(source).not.toContain('player-summary-grid')
    expect(source).not.toContain('style={{ marginBottom: 14 }}')
  })

  test('carteira possui CSS próprio e mobile simplificado', () => {
    const source = read('web/features/billing/WalletPanel.tsx')
    const css = read('web/features/billing/wallet-panel.css')
    expect(source).toContain("import './wallet-panel.css'")
    expect(css).toContain('@media(max-width:640px)')
    expect(css).not.toContain('box-shadow:')
    expect(css).not.toContain('backdrop-filter:')
  })
})
