import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

test.describe('Rodada 86C — prazos e alertas por jogo e equipe', () => {
  test('central calcula prazo específico de escalação por jogo', async () => {
    const source = await readFile(path.join(process.cwd(), 'web/app/api/central-campeonato/route.ts'), 'utf8')
    expect(source).toContain('limite_escalacao_minutos')
    expect(source).toContain('escalacao-jogo:')
    expect(source).toContain('O prazo de escalação deste jogo já venceu.')
  })

  test('central identifica jogo sem grupos, mapas ou resultados', async () => {
    const source = await readFile(path.join(process.cwd(), 'web/app/api/central-campeonato/route.ts'), 'utf8')
    expect(source).toContain('jogo-sem-grupos:')
    expect(source).toContain('jogo-mapas-incompletos:')
    expect(source).toContain('resultados-jogo:')
  })

  test('central identifica equipe sem grupo ou slot e mostra entidade', async () => {
    const api = await readFile(path.join(process.cwd(), 'web/app/api/central-campeonato/route.ts'), 'utf8')
    const component = await readFile(path.join(process.cwd(), 'web/components/campeonatos/ChampionshipCentral.tsx'), 'utf8')
    expect(api).toContain('equipe-sem-grupo-slot:')
    expect(api).toContain('entity_label')
    expect(component).toContain('alert.entity_label')
  })

  test('não adiciona distribuição automática', async () => {
    const source = await readFile(path.join(process.cwd(), 'web/app/api/central-campeonato/route.ts'), 'utf8')
    expect(source).not.toContain('auto_assign_group')
    expect(source).not.toContain('distribuir_automaticamente')
  })
})
