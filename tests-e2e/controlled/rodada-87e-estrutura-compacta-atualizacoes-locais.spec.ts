import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const structureFile = path.join(root, 'web/features/campeonatos/fases/components/CampeonatoEstruturaTab.tsx')
const cssFile = path.join(root, 'web/app/globals.css')

test.describe('Rodada 87E — estrutura compacta e atualizações locais', () => {
  test('remove edição individual de letra e mantém sequência na configuração do grupo', () => {
    const source = fs.readFileSync(structureFile, 'utf8')
    expect(source).not.toContain('Editar letra deste slot')
    expect(source).not.toContain('slot-letter-edit-button')
    expect(source).toContain('Iniciar sequência dos slots em')
    expect(source).toContain("load({ silent: true })")
  })

  test('aplica padrão cinza, ouro e grafite sem destaque verde nos slots', () => {
    const css = fs.readFileSync(cssFile, 'utf8')
    expect(css).toContain('RODADA 87E — ESTRUTURA COMPACTA E ATUALIZAÇÕES LOCAIS')
    expect(css).toContain('.producer-layout-ref .group-folder .championship-vaga-row.status-ocupada')
    expect(css).toContain('border-left-color: var(--producer-gold)')
    expect(css).toContain('.producer-layout-ref .game-card')
  })
})
