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
    expect(css).toContain('max-width: 72px')
    expect(css).toContain('max-height: 72px')
    expect(css).toContain('object-fit: contain')
  })

  test('lista de modelos tem rolagem própria e ação clara', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    const css = source('web/app/globals.css')
    expect(form).toContain('championship-source-action')
    expect(css).toContain('max-height: min(360px, 44vh)')
    expect(css).toContain('overflow-y: auto')
  })
})
