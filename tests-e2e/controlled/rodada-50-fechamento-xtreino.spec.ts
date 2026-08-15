import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 50 — fechamento do módulo de XTreino e desempenho', () => {
  test('telemetria Garena é enriquecimento opcional e não derruba o resultado oficial', () => {
    const api = source('web/app/api/equipe/treinos/route.ts')

    expect(api).toContain('falha da Garena nunca invalida MatchResult/estatísticas oficiais')
    expect(api).toContain('if (!garenaImportacoesResult.error)')
    expect(api).toContain('if (!garenaJogadoresResult.error)')
    expect(api).toContain('garenaArmas = armasResult.error ? [] : (armasResult.data || [])')
    expect(api).toContain('garenaHabilidades = habilidadesResult.error ? [] : (habilidadesResult.data || [])')

    expect(api).not.toContain('if (garenaImportacoesError) throw garenaImportacoesError')
    expect(api).not.toContain('if (armasResult.error) throw armasResult.error')
    expect(api).not.toContain('if (habilidadesResult.error) throw habilidadesResult.error')
  })

  test('MatchResult e estatísticas oficiais continuam sendo a fonte de posição kills e pontos', () => {
    const api = source('web/app/api/equipe/treinos/route.ts')

    expect(api).toContain(".from('campeonato_estatisticas_equipes_detalhe')")
    expect(api).toContain('posicao: Number(row.posicao || 0) || null')
    expect(api).toContain('abates: Number(row.abates || 0)')
    expect(api).toContain('pontos_total: Number(row.pontos_total || 0)')
    expect(api).toContain('telemetria_garena: garenaPlayers.length > 0')
    expect(api).not.toContain('pontos_total: Number(player.')
  })

  test('privacidade do treino continua limitada às equipes controladas pelo usuário', () => {
    const api = source('web/app/api/equipe/treinos/route.ts')

    expect(api).toContain('const user = await getBearerUser(req)')
    expect(api).toContain('const teamIds = await managedTeamIds(user.id)')
    expect(api).toContain(".in('equipe_id', teamIds)")
    expect(api).toContain(".in('campeonato_equipe_id', participacaoIds)")
    expect(api).toContain("String(item.tipo || '').toLowerCase() === 'xtreino'")
    expect(api).toContain("onConflict: 'campeonato_equipe_id,partida_id'")
  })

  test('contrato de data do painel está alinhado com a API após o hotfix', () => {
    const api = source('web/app/api/equipe/treinos/route.ts')
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')

    expect(api).toContain(".select('id,nome,tipo,logo_url,status,created_at')")
    expect(api).toContain('created_at: campeonato?.created_at || null')
    expect(panel).toContain('created_at?: string | null')
    expect(panel).not.toContain('data_inicio?: string | null')
    expect(panel).not.toContain('data_fim?: string | null')
  })

  test('filtro de período alimenta resumo metas evolução line e contexto tático', () => {
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')

    expect(panel).toContain('scopeTrainingPeriod(training, trainingPerformancePeriod)')
    expect(panel).toContain('buildTrainingObjectiveReading(analyzedTraining)')
    expect(panel).toContain('buildSquadSynergy(analyzedTraining)')
    expect(panel).toContain('buildTacticalCompositionContexts(analyzedTraining)')
    expect(panel).toContain('buildObjectivePerformanceGoals(analyzedTraining.quedas_detalhe.map')
    expect(panel).toContain('Resumo técnico')
    expect(panel).toContain('Análises avançadas')
  })

  test('fechamento preserva metas reais e limpeza visual consolidada', () => {
    const goals = source('web/features/dropzone/performance-goals.ts')
    const css = source('web/app/globals.css')

    expect(goals).toContain('blockSize = 5')
    expect(goals).not.toContain('1.05')
    expect(goals).not.toContain('1.10')

    expect(css).not.toContain('\\nbody .team-training-telemetry')
    expect(css).not.toContain('/* Rodada 48')
    expect(css).toContain('.team-training-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}')
    expect(css).toContain('.team-training-advanced:not([open])>*:not(summary){display:none}')
  })
})
