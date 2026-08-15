import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 27 — criação de jogos e pastas fechadas por padrão', () => {
  test('fases de Jogos por fase começam fechadas', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')

    expect(panel).toContain('const phaseOpen = openGamePhases[phase.id] === true')
    expect(panel).not.toContain('const phaseOpen = openGamePhases[phase.id] !== false')
  })

  test('fases e grupos da estrutura começam fechados', () => {
    const structure = source('web/features/campeonatos/fases/components/CampeonatoEstruturaTab.tsx')

    expect(structure).toContain('const phaseOpen = phaseHidden || openPhases[phase.id] === true')
    expect(structure).toContain('const groupOpen = openGroups[group.id] === true')
    expect(structure).not.toContain('openGroups[group.id] !== false')
  })

  test('fase oculta do Diário continua aberta internamente para mostrar horários', () => {
    const structure = source('web/features/campeonatos/fases/components/CampeonatoEstruturaTab.tsx')

    expect(structure).toContain('const phaseHidden = Boolean')
    expect(structure).toContain('const phaseOpen = phaseHidden || openPhases[phase.id] === true')
  })

  test('editor de jogos deixa de usar blocos claros antigos', () => {
    const css = source('web/app/globals.css')

    expect(css).toContain('.game-editor-panel{ border: 1px solid var(--ui-line')
    expect(css).toContain('.game-form-section{ display: grid; gap: 12px; padding: 14px 0')
    expect(css).toContain('background: transparent; border-radius: 0')
    expect(css).toContain('.game-form-section-header{ display: flex; align-items: flex-end')
  })

  test('mapas usam controles escuros e grid responsivo', () => {
    const css = source('web/app/globals.css')

    expect(css).toContain('.map-drop-grid{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr))')
    expect(css).toContain('background: var(--ui-surface-raised, #1a1b1f)')
    expect(css).toContain('.map-drop-placeholder{ width: 46px; height: 46px')
    expect(css).toContain('@media (max-width: 1100px)')
  })

  test('grupos participantes ficam compactos e sem cards brancos', () => {
    const css = source('web/app/globals.css')

    expect(css).toContain('.group-check-grid{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr))')
    expect(css).toContain('.group-check-card.selected{ border-color: var(--ui-accent, #c9b766); background: rgba(201,183,102,.13)')
  })
})
