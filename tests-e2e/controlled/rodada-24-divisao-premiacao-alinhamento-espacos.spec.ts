import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 24 — divisão da premiação', () => {
  test('nome preserva espaço durante digitação', () => {
    const lib = source('web/lib/premiacao-divisao.ts')

    expect(lib).toContain("nome: String(i.nome ?? '')")
    expect(lib).toContain(".filter((i) => i.nome.trim())")
    expect(lib).toContain('const nomeRaw = String(row.nome ?? row.name ?? row.label')
    expect(lib).not.toContain("nome: String(i.nome || '').trim()")
  })

  test('input continua aceitando texto livre', () => {
    const component = source('web/components/forms/campeonato/PremiacaoDivisaoEditor.tsx')

    expect(component).toContain('onChange={(e) => updateItem(item.id, { nome: e.target.value })}')
    expect(component).toContain('className="icon-action-button danger premiacao-divisao-remove"')
  })

  test('nome, valor e remover ficam alinhados no desktop', () => {
    const css = source('web/features/campeonatos/rulebook/rulebook.css')

    expect(css).toContain('grid-template-columns:minmax(240px,1.15fr) minmax(220px,.9fr) 42px')
    expect(css).toContain('align-items:start')
    expect(css).toContain('.premiacao-divisao-remove{width:42px;height:42px;margin-top:21px')
  })

  test('mobile continua compacto', () => {
    const css = source('web/features/campeonatos/rulebook/rulebook.css')

    expect(css).toContain('.premiacao-divisao-row{grid-template-columns:minmax(0,1fr) 42px')
    expect(css).toContain('.premiacao-divisao-field{grid-column:1/-1}')
  })
})
