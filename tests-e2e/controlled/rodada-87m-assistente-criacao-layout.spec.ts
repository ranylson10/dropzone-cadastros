import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 87M — assistente de criação', () => {
  test('origens usam cards separados e responsivos', () => {
    const css = source('web/app/globals.css')
    expect(css).toContain('.championship-origin-options')
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))')
    expect(css).toContain('.championship-origin-option.active')
  })

  test('logos dos modelos possuem limite fixo e não ampliam os cards', () => {
    const css = source('web/app/globals.css')
    expect(css).toContain('.championship-source-logo img')
    expect(css).toContain('max-width: 46px')
    expect(css).toContain('max-height: 46px')
    expect(css).toContain('object-fit: contain')
  })

  test('assistente abre somente o caminho escolhido', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain("const [originChoice, setOriginChoice]")
    expect(form).toContain("originChoice === 'novo' ? renderGuidedIdentity() : null")
    expect(form).toContain("originChoice === 'modelo' || originChoice === 'season'")
    expect(form).toContain('Como você quer criar este campeonato?')
  })

  test('lista de modelos tem rolagem própria e ação clara', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    const css = source('web/app/globals.css')
    expect(form).toContain('championship-source-action')
    expect(css).toMatch(/\.championship-source-results\{[^}]*max-height:[^;}]+/)
    expect(css).toMatch(/\.championship-source-results\{[^}]*overflow-y:\s*auto/)
  })
})
