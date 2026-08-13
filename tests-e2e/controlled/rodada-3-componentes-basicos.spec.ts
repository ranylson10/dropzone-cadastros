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

  test('modal principal usa a superfície escura sem blur, borda, sombra ou legenda de marca repetida', () => {
    const css = source('web/app/globals.css')
    const modal = source('web/components/layout/SystemModal.tsx')

    expect(css).toContain('.system-modal{ display: flex; flex-direction: column; width: min(100%, 760px); max-height: calc(100vh - 48px); overflow: hidden; border: 0; border-radius: var(--ui-radius-lg); background: var(--ui-surface); color: var(--ui-text); box-shadow: none')
    expect(css).toContain('.system-modal-header{ position: sticky; top: 0; z-index: 3; display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding: 22px 24px 10px; border: 0; background: var(--ui-surface)')
    expect(css).not.toContain('background: rgba(10, 15, 25, .58); backdrop-filter: blur(9px)')
    expect(modal).not.toContain('<p className="eyebrow">DropZone</p>')
  })

  test('modal de campeonato usa hierarquia direta e lista sem cards', () => {
    const css = source('web/app/globals.css')
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    const producer = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')

    expect(css).toContain('.championship-type-card{ width: 100%; min-height: 76px;')
    expect(css).toContain('border: 0; border-radius: 0; background: transparent; color: var(--ui-text);')
    expect(css).toContain('.championship-type-card + .championship-type-card{ border-top: 1px solid rgba(245,243,237,.08);')
    expect(css).toContain('.championship-type-format{ max-width: 190px; padding: 0; border: 0; border-radius: 0; background: transparent;')

    expect(form).toContain('<span className="championship-step-index">1 de 2</span>')
    expect(form).toContain('<h3>Escolha o formato</h3>')
    expect(form).not.toContain('O tipo define o formato inicial e ajuda o sistema a preparar a estrutura correta.')
    expect(form).toContain('className="championship-type-actions"')
    expect(form).toContain('className="text-action-button" type="button" onClick={onCancel}>Cancelar</button>')

    expect(producer).not.toContain('description="Cadastre os dados básicos, informações e controles do campeonato."')
  })
})
