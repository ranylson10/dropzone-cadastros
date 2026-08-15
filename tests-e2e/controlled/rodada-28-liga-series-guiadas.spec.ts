import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 28 — Liga guiada por organização', () => {
  test('Liga usa fluxo curto Início, Organização e Revisão', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain("value.tipo === 'liga'")
    expect(form).toContain("{ id: 'format' as const, label: 'Organização' }")
    expect(form).toContain("{ id: 'review', label: 'Revisão' }")
  })

  test('usuário escolhe liga simples ou com agrupamentos', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('Como a Liga será organizada?')
    expect(form).toContain('Liga simples')
    expect(form).toContain('Liga com agrupamentos')
    expect(form).toContain('setLeagueModel')
  })

  test('cada agrupamento começa somente com quatro dados essenciais', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('Nome da série')
    expect(form).toContain('Equipes')
    expect(form).toContain('Inscrição por equipe')
    expect(form).toContain('Premiação')
    expect(form).toContain('Adicionar item')
  })

  test('modelo com séries nasce com A, B e C', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain("leagueSeriesLabel(index)")
    expect(form).toContain('[0, 1, 2].map')
  })

  test('API persiste equipes inscrição e premiação em liga_divisoes', () => {
    const api = source('web/app/api/dropzone/route.ts')
    expect(api).toContain('equipes: String(Math.max(2')
    expect(api).toContain('valor_inscricao: String(Math.max(0')
    expect(api).toContain('premiacao: String(Math.max(0')
  })

  test('edição recarrega os novos dados das séries', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    expect(panel).toContain("equipes: String(division?.equipes || '12')")
    expect(panel).toContain("valor_inscricao: String(division?.valor_inscricao || '')")
    expect(panel).toContain("premiacao: String(division?.premiacao || '')")
  })

  test('Liga não cria Fase 1 genérica antes da formação das séries', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    expect(panel).toContain("if (form.tipo === 'liga')")
    expect(panel).toContain('Não criar uma "Fase 1" genérica aqui.')
  })

  test('layout mantém séries em linhas sem cards aninhados', () => {
    const css = source('web/app/globals.css')
    expect(css).toContain('.championship-league-series-list{display:grid;border-top:1px solid var(--ui-line)')
    expect(css).toContain('.championship-league-series-row{')
    expect(css).toContain('border-bottom:1px solid var(--ui-line)')
  })
})
