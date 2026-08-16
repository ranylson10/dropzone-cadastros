import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 52 — entrada das equipes na Liga', () => {
  test('cada agrupamento aceita as seis origens operacionais', () => {
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    for (const label of ['Mantidas da temporada anterior', 'Promovidas', 'Rebaixadas', 'Classificatória aberta', 'Vaga paga', 'Convite direto']) {
      expect(form).toContain(label)
    }
    expect(form).toContain('Entrada das equipes')
    expect(form).toContain('Adicionar forma de entrada')
  })

  test('distribuição precisa fechar exatamente a lotação do agrupamento', () => {
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('leagueEntryTotal(division) !== Number(division.equipes || 0)')
    expect(form).toContain('precisa distribuir exatamente')
    expect(form).toContain('não pode usar o próprio agrupamento como origem')
  })

  test('promoção e rebaixamento exigem agrupamento de origem', () => {
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain("entry.tipo === 'promovida' || entry.tipo === 'rebaixada'")
    expect(form).toContain('Agrupamento de origem')
    expect(form).toContain("item.id !== division.id")
  })

  test('nova season limpa a formação anterior para não copiar movimentação velha', () => {
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain("if (copied.tipo === 'liga')")
    expect(form).toContain('copied.liga_divisoes = copied.liga_divisoes.map((division) => ({ ...division, entradas: [] }))')
  })

  test('API normaliza origens e impede estouro de vagas', () => {
    const api = read('web/app/api/dropzone/route.ts')
    expect(api).toContain("new Set(['mantida', 'promovida', 'rebaixada', 'classificatoria_aberta', 'vaga_paga', 'convite_direto'])")
    expect(api).toContain("if (entryTotal > equipes) throw new Error('As formas de entrada não podem ultrapassar o total de equipes do agrupamento.')")
    expect(api).toContain("Promoção e rebaixamento precisam informar o agrupamento de origem.")
  })

  test('edição recarrega a configuração de entrada salva no JSON da Liga', () => {
    const panel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    expect(panel).toContain('entradas: Array.isArray(division?.entradas)')
    expect(panel).toContain("origem_agrupamento_id: String(entry?.origem_agrupamento_id || '')")
  })

  test('mobile mantém configuração progressiva e compacta', () => {
    const css = read('web/app/globals.css')
    expect(css).toContain('.championship-league-entry-plan>summary')
    expect(css).toContain('.championship-league-entry-row{display:grid')
    expect(css).toContain('body .championship-league-entry-plan{grid-column:2/4}')
  })
})
