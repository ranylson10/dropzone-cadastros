import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 28 hotfix — fallback tipado das séries', () => {
  test('fallback antigo também usa o novo formato completo de liga_divisoes', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(form).toContain("nome: 'Série A'")
    expect(form).toContain("equipes: '12'")
    expect(form).toContain("valor_inscricao: ''")
    expect(form).toContain("premiacao: ''")
    expect(form).not.toContain("{ id: crypto.randomUUID(), nome: 'Divisão 1', codigo: '', ordem: 1 }")
  })
})
