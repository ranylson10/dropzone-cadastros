import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const ruleBodies = (css: string, selector: string) => {
  const matcher = new RegExp(`${escaped(selector)}\\s*\\{([^}]*)\\}`, 'g')
  return [...css.matchAll(matcher)].map((match) => match[1].replace(/\s+/g, ' ').trim())
}
const expectRule = (css: string, selector: string, declarations: string[]) => {
  const bodies = ruleBodies(css, selector)
  expect(bodies.length, `regra ${selector} não encontrada`).toBeGreaterThan(0)
  expect(
    bodies.some((body) => declarations.every((declaration) => body.includes(declaration))),
    `nenhuma regra ${selector} contém: ${declarations.join(', ')}`,
  ).toBeTruthy()
}

test.describe('Rodada 3 — componentes básicos', () => {
  test('botões e campos autenticados usam a fundação visual sem bordas e sombras decorativas', () => {
    const css = source('web/app/globals.css')

    expectRule(css, '.button', [
      'min-height: 44px',
      'border: 0',
      'border-radius: var(--ui-radius-sm)',
      'background: var(--ui-accent)',
      'box-shadow: none',
    ])
    expect(css).toContain('.page-authenticated input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]),')
    expectRule(css, '.page-authenticated textarea', [
      'border: 0',
      'border-radius: var(--ui-radius-sm)',
      'background: var(--surface-muted)',
      'box-shadow: none',
    ])
    expectRule(css, '.page-authenticated textarea:focus', [
      'outline: 2px solid var(--ui-accent)',
      'box-shadow: none',
    ])
  })

  test('tabs autenticadas deixam de ser caixas e usam hierarquia por sublinhado', () => {
    const css = source('web/app/globals.css')

    expect(css).toContain('.page-authenticated .tab{ min-height: 40px; border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: transparent')
    expect(css).toContain('.page-authenticated .tab.active{ border-color: var(--ui-accent); background: transparent; color: #101820; box-shadow: none')
  })

  test('modal principal usa a superfície escura sem blur, borda, sombra ou legenda de marca repetida', () => {
    const css = source('web/app/globals.css')
    const modal = source('web/components/layout/SystemModal.tsx')

    expectRule(css, '.system-modal', [
      'display: flex',
      'flex-direction: column',
      'width: min(100%, 760px)',
      'max-height: calc(100vh - 48px)',
      'overflow: hidden',
      'border: 0',
      'border-radius: var(--ui-radius-lg)',
      'background: var(--ui-surface)',
      'color: var(--ui-text)',
      'box-shadow: none',
    ])
    expectRule(css, '.system-modal-header', [
      'position: sticky',
      'top: 0',
      'z-index: 3',
      'display: flex',
      'border: 0',
      'background: var(--ui-surface)',
    ])
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
  test('assistente inteiro do campeonato herda o modal escuro sem caixas claras ou ações redundantes', () => {
    const css = source('web/app/globals.css')
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(css).toContain('.system-modal{ --surface: var(--ui-surface); --surface-soft: var(--ui-surface-soft); --surface-muted: var(--ui-surface-raised);')
    expect(css).toContain('.form-section-card{ display: grid; gap: 14px; padding: 14px 0; border: 0; border-radius: 0; background: transparent;')
    expect(css).toContain('.championship-wizard-steps{ display: flex; align-items: center; gap: 22px; padding: 4px 0 12px; overflow-x: auto; border: 0; background: transparent;')
    expect(css).toContain('.championship-origin-option{ min-width: 0; min-height: 78px;')
    expect(css).toContain('border: 0; border-radius: var(--ui-radius-sm); background: transparent; color: var(--text);')
    expect(css).toContain('.championship-wizard-actions{ position: sticky; bottom: 0; z-index: 4; justify-content: flex-end; gap: 8px; padding: 12px 0; background: var(--surface); border: 0;')
    expect(css).toContain('.producer-layout-ref .form-section-card{ border: 0; background: transparent; box-shadow: none;')

    expect(form).toContain("· {currentPageIndex + 1} de {wizardPages.length}</strong>")
    expect(form).toContain("<span>{String(index + 1).padStart(2, '0')}</span>{page.label}")
    expect(form).toContain('<p className="eyebrow">Origem</p>')
    expect(form).toContain('<strong>Nova edição</strong>')
    expect(form).toContain('<Field label="Nome">')
    expect(form).not.toContain('<p className="eyebrow">Dados obrigatórios</p>')
    expect(form).not.toContain('Você preencherá apenas os campos necessários para o tipo escolhido.')
    expect(form).not.toContain('Assistente de criação · etapa')
    expect(form).toContain("onCancel && mode !== 'create'")
  })

})
