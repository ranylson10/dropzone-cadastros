import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 51 — Liga com agrupamentos personalizados', () => {
  test('criação da Liga não fica presa ao conceito de séries', async () => {
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(form).toContain("const LEAGUE_GROUPING_OPTIONS = ['Séries', 'Divisões', 'Categorias', 'Níveis', 'Conferências', 'Circuitos']")
    expect(form).toContain('Nome do agrupamento')
    expect(form).toContain('Nome personalizado')
    expect(form).toContain('Liga com agrupamentos')
    expect(form).toContain("label: 'Organização'")
    expect(form).not.toContain("label: 'Séries' },")
  })

  test('trocar o nome do agrupamento preserva nomes já personalizados', async () => {
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(form).toContain('function updateLeagueGrouping(nextGrouping: string)')
    expect(form).toContain('const previousSuggested = leagueGroupingItemLabel(previousGrouping, index)')
    expect(form).toContain('const shouldRename = !division.nome.trim() || division.nome.trim() === previousSuggested')
    expect(form).toContain('shouldRename ? { ...division, nome: leagueGroupingItemLabel(nextGrouping, index) } : division')
  })

  test('API mantém o nome do agrupamento e normaliza fallback coerente', async () => {
    const api = read('web/app/api/dropzone/route.ts')

    expect(api).toContain("liga_nome_agrupamento: String(data.liga_nome_agrupamento || 'Divisões')")
    expect(api).toContain("normalizeLeagueDivisions(data.liga_divisoes, String(data.liga_nome_agrupamento || 'Divisões'))")
    expect(api).toContain("const labels: Record<string, string> = { Séries: 'Série', Divisões: 'Divisão', Categorias: 'Categoria', Níveis: 'Nível', Conferências: 'Conferência', Circuitos: 'Circuito' }")
    expect(api).toContain("A liga aceita no máximo 12 agrupamentos.")
  })

  test('código morto do seletor antigo de Liga foi removido', async () => {
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(form).not.toContain('<Field label="Modelo da liga">')
    expect(form).not.toContain('Liga híbrida por divisões')
    expect(form).not.toContain("Defina as fases e as séries. Promoção")
  })
})
