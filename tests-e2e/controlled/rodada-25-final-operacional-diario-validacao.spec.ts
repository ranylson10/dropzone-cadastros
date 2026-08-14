import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 25 — Final operacional e validação do Diário', () => {
  test('Final aceita quedas diferentes em cada dia', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('final_dias_config?: Array<{ dia: number; quedas: string }>')
    expect(form).toContain('updateFinalDayFalls')
    expect(form).toContain('Quedas neste dia')
  })

  test('Champion Point pede pontuação e Point Rush existe', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('Pontos para ativar')
    expect(form).toContain('Point Rush + Champion Point')
    expect(form).toContain('Dias de Point Rush')
  })

  test('Point Rush possui bônus por colocação editável', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('championship-final-bonus-editor')
    expect(form).toContain('Adicionar posição')
    expect(form).toContain('updateFinalBonusPosition')
  })

  test('Diário mostra erro quando inscrição paga está zerada', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('A inscrição está marcada como paga. Informe um valor maior que R$ 0,00 ou selecione Gratuita.')
    expect(form).toContain('championship-wizard-error')
  })

  test('estrutura planejada persiste os metadados operacionais da Final', () => {
    const api = source('web/app/api/dropzone/route.ts')
    expect(api).toContain('final_dias_config')
    expect(api).toContain('final_champion_point_pontos')
    expect(api).toContain('final_point_rush_dias')
    expect(api).toContain('final_bonus_ranking')
  })

  test('última fase da Copa nasce como Grande Final', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    expect(panel).toContain("tipo: isGrandeFinal ? 'grande_final' : 'normal'")
    expect(panel).toContain('grande_final: isGrandeFinal')
    expect(panel).toContain('configuracao-jogos')
  })

  test('Point Rush pode ser planejado antes do jogo decisivo existir', () => {
    const service = source('backend/src/campeonatos/jogos/jogos.service.ts')
    expect(service).toContain("input.modo_acumulacao === 'bonus_por_ranking' && input.jogo_decisivo_id")
  })

  test('novo jogo da Final herda dia e quedas planejadas', () => {
    const games = source('web/features/campeonatos/jogos/components/CampeonatoJogosTab.tsx')
    expect(games).toContain('plannedFinalDays')
    expect(games).toContain('plannedFallsForFinalDay')
    expect(games).toContain('selectFinalDay')
    expect(games).toContain('Dia {day.dia} · {day.quedas} quedas')
  })
})
