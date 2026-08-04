import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 87J2 — imagem ajustada e variação colorida', () => {
  test('imagem de fundo usa conter como padrão e mantém esticar disponível', () => {
    const panel = source('web/features/campeonatos/stream/components/editor/StylePanels.tsx')
    expect(panel).toContain("fit: v.fit || 'contain'")
    expect(panel).toContain('<option value="stretch">Esticar</option>')
  })

  test('overlay colore subida, queda e manutenção da posição', () => {
    const canvas = source('web/features/campeonatos/stream/components/StreamTableCanvas.tsx')
    expect(canvas).toContain("className={deltaStyle ? `col-delta ${deltaStyle.className}`")
    expect(canvas).toContain("color: '#28c76f'")
    expect(canvas).toContain("color: '#ea5455'")
    expect(canvas).toContain("color: '#d8a600'")
  })

  test('tabela do campeonato e MVP exibem coluna de variação', () => {
    const stats = source('web/features/campeonatos/estatisticas/components/CampeonatoEstatisticasTab.tsx')
    expect(stats).toContain('VariationCell')
    expect(stats).toContain('previousTeamPositions')
    expect(stats).toContain('previousMvpPositions')
    expect(stats.match(/Variação da posição/g)?.length || 0).toBeGreaterThanOrEqual(2)
  })
})
