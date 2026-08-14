import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 20 — inscrição e premiação guiadas', () => {
  test('Diário e Copa recebem operação guiada simples', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(form).toContain('Passo 4 · Inscrição e premiação')
    expect(form).toContain('A inscrição é gratuita ou paga?')
    expect(form).toContain('Vai ter premiação?')
    expect(form).toContain("mode === 'create' && (value.tipo === 'diario' || value.tipo === 'copa')")
  })

  test('inscrição gratuita e paga usam o campo existente de valor', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(form).toContain('function updateGuidedEntry')
    expect(form).toContain("valor_inscricao: isPaid ? (value.valor_inscricao || '0.00') : ''")
    expect(form).toContain('Valor da inscrição')
  })

  test('premiação guiada reutiliza premiação existente e editor de divisão', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(form).toContain("function updateGuidedPrize")
    expect(form).toContain('Dinheiro / PIX')
    expect(form).toContain('PremiacaoDivisaoEditor')
    expect(form).toContain('Qual é o brinde?')
  })

  test('controles técnicos ficam fora da criação guiada', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(form).toContain("hidden={!pageVisible('operation') || (mode === 'create' && (value.tipo === 'diario' || value.tipo === 'copa'))}")
    expect(form).toContain('Controle de inscrições')
    expect(form).toContain('Pagamento da vaga')
    expect(form).toContain('Venda de vagas')
  })

  test('revisão mostra inscrição e premiação em linguagem humana', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(form).toContain('<small>Inscrição</small>')
    expect(form).toContain("<strong>{Number(value.valor_inscricao) > 0 ? moneyDisplay(value.valor_inscricao) : 'Gratuita'}</strong>")
    expect(form).toContain('<small>Premiação</small>')
  })

  test('layout segue a base escura sem novos cards brancos', () => {
    const css = source('web/app/globals.css')

    const start = css.indexOf('.championship-guided-operation{')
    const end = css.indexOf('@media (max-width: 760px)', start)
    const guided = css.slice(start, end)

    expect(guided).toContain('background:var(--ui-surface-raised)')
    expect(guided).toContain('border-top:1px solid var(--ui-line)')
    expect(guided).not.toContain('background:#fff')
    expect(guided).not.toContain('box-shadow')
  })

  test('mobile empilha as escolhas', () => {
    const css = source('web/app/globals.css')

    expect(css).toContain('.championship-guided-choice-row.three{ grid-template-columns:1fr; max-width:none')
  })
})
