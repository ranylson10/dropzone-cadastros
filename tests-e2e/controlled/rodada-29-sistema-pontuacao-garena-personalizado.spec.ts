import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 29 — sistema de pontuação compartilhado', () => {
  test('preset Oficial Garena usa tabela oficial e 1 ponto por abate', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    const api = source('web/app/api/dropzone/route.ts')

    expect(form).toContain('OFFICIAL_GARENA_SCORING = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0]')
    expect(form).toContain("sistema_pontuacao_nome: 'Oficial Garena'")
    expect(form).toContain("pontos_por_abate: '1'")
    expect(api).toContain('OFFICIAL_GARENA_SCORING = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0]')
    expect(api).toContain('pontos_por_abate: 1')
  })

  test('Copa Diário e Liga ganham etapa Pontuação no assistente', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form.match(/\{ id: 'scoring', label: 'Pontuação' \}/g)?.length).toBeGreaterThanOrEqual(4)
    expect(form).toContain("'operation' | 'scoring' | 'review'")
  })

  test('personalizado permite nome, até 15 equipes, posições automáticas e valor por abate', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('Personalizada')
    expect(form).toContain('Nome do sistema')
    expect(form).toContain('Equipes por partida')
    expect(form).toContain('max="15"')
    expect(form).toContain('Pontos por abate')
    expect(form).toContain('updateScoringTeamCount')
    expect(form).toContain('updatePlacementPoint')
  })

  test('posição vazia pode persistir como zero sem exigir preenchimento completo', () => {
    const api = source('web/app/api/dropzone/route.ts')
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(api).toContain('const point = Number(rawPoints[index] ?? 0)')
    expect(api).toContain('return Math.max(0, Math.trunc(point))')
    expect(form).toContain('Posição sem valor preenchido conta como 0 ponto.')
  })

  test('API grava pontos_colocacao e pontos_por_abate que já alimentam o cálculo oficial', () => {
    const api = source('web/app/api/dropzone/route.ts')
    expect(api).toContain('pontos_colocacao: scoring.pontos_colocacao')
    expect(api).toContain('pontos_por_abate: scoring.pontos_por_abate')
    expect(api).toContain('sistema_pontuacao_tipo: scoring.sistema_pontuacao_tipo')
    expect(api).toContain('sistema_pontuacao_nome: scoring.sistema_pontuacao_nome')
  })

  test('campeonato antigo com pontuação diferente da Garena é inferido como personalizado', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(panel).toContain('matchesOfficialGarena')
    expect(panel).toContain("'garena' : 'personalizado'")
    expect(form).toContain('const matchesOfficial = copiedPoints.length === OFFICIAL_GARENA_SCORING.length')
  })

  test('migration preserva sistemas antigos personalizados e adiciona nome/tipo', () => {
    const migration = source('supabase/migrations/20260815093000_sistema_pontuacao_campeonatos.sql')
    expect(migration).toContain('add column if not exists sistema_pontuacao_tipo')
    expect(migration).toContain('add column if not exists sistema_pontuacao_nome')
    expect(migration).toContain("sistema_pontuacao_tipo = 'personalizado'")
    expect(migration).toContain('pontos_colocacao is distinct from array[12,9,8,7,6,5,4,3,2,1,0,0]')
  })

  test('layout de pontuação segue o dark sem card dentro de card', () => {
    const css = source('web/app/globals.css')
    expect(css).toContain('.championship-scoring-mode-choice')
    expect(css).toContain('.championship-scoring-table{')
    expect(css).toContain('border-bottom:1px solid var(--ui-line)')
    expect(css).toContain('@media(max-width:760px)')
  })
})
