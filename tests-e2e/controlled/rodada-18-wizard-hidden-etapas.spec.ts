import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 18 — wizard respeita etapas ocultas', () => {
  test('hidden prevalece sobre display grid dos cards do formulário', () => {
    const css = source('web/app/globals.css')

    expect(css).toContain('.form-section-card{ display: grid')
    expect(css).toContain('.championship-form-stack > [hidden]{ display: none !important')
  })

  test('criação continua separando origem, estrutura, partidas e operação', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(form).toContain("hidden={!pageVisible('origin')}")
    expect(form).toContain("hidden={!pageVisible('format')}")
    expect(form).toContain("hidden={!pageVisible('matches')}")
    expect(form).toContain("hidden={!pageVisible('operation')}")
    expect(form).toContain("hidden={mode !== 'edit' || !pageVisible('identity')}")
  })

  test('cores continuam exclusivas da edição administrativa', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')

    const colors = form.indexOf('Cores do campeonato')
    const editOnly = form.lastIndexOf("hidden={mode !== 'edit' || !pageVisible('identity')}", colors)
    expect(colors).toBeGreaterThan(-1)
    expect(editOnly).toBeGreaterThan(-1)
  })
})
