import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 49 — fluxo integrado de XTreino', () => {
  test('configuração do XTreino nasce no formulário, persiste na API e recarrega na edição', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    const api = source('web/app/api/dropzone/route.ts')
    const produtora = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')

    expect(form).toContain("value.tipo === 'xtreino'")
    expect(form).toContain('Quedas por jogo')
    expect(form).toContain('Call fixa')
    expect(form).toContain('Registrar 1ª safe')
    expect(form).toContain('Registrar 2ª safe')
    expect(form).toContain('toggleXtreinoMap')

    expect(api).toContain('xtreino_call_fixa: Boolean(data.xtreino_call_fixa)')
    expect(api).toContain('xtreino_mapas: Array.isArray(data.xtreino_mapas)')
    expect(api).toContain('partidas_por_jogo: Math.max(1')

    expect(produtora).toContain('xtreino_call_fixa: champ.data?.xtreino_call_fixa === true')
    expect(produtora).toContain('xtreino_mapas: Array.isArray(champ.data?.xtreino_mapas)')
  })

  test('pontuação do XTreino continua no motor oficial compartilhado', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('sistema_pontuacao_tipo')
    expect(form).toContain('pontos_colocacao')
    expect(form).toContain('pontos_por_abate')
    expect(form).not.toContain('xtreino_pontos_colocacao')
    expect(form).not.toContain('xtreino_pontos_por_abate')
  })

  test('API privada limita leitura e telemetria às equipes controladas pelo usuário', () => {
    const api = source('web/app/api/equipe/treinos/route.ts')

    expect(api).toContain('const user = await getBearerUser(req)')
    expect(api).toContain('const teamIds = await managedTeamIds(user.id)')
    expect(api).toContain(".in('equipe_id', teamIds)")
    expect(api).toContain("String(item.tipo || '').toLowerCase() === 'xtreino'")
    expect(api).toContain(".in('campeonato_equipe_id', participacaoIds)")
    expect(api).toContain(".from('garena_matchstats_jogadores')")
  })

  test('resultado oficial segue separado da telemetria Garena no mesmo modelo de queda', () => {
    const api = source('web/app/api/equipe/treinos/route.ts')

    expect(api).toContain(".from('campeonato_estatisticas_equipes_detalhe')")
    expect(api).toContain('posicao: Number(row.posicao || 0) || null')
    expect(api).toContain('abates: Number(row.abates || 0)')
    expect(api).toContain('pontos_total: Number(row.pontos_total || 0)')

    expect(api).toContain('telemetria_garena: garenaPlayers.length > 0')
    expect(api).toContain('jogadores_detalhados: garenaPlayers.map')
    expect(api).not.toContain('pontos_total: Number(player.')
  })

  test('anotações privadas pertencem à equipe + queda e respeitam a configuração do treino', () => {
    const api = source('web/app/api/equipe/treinos/route.ts')
    const migration = source('supabase/migrations/20260815122000_xtreino_anotacoes_privadas_queda.sql')

    expect(api).toContain(".eq('id', campeonatoEquipeId)")
    expect(api).toContain(".eq('id', partidaId).eq('campeonato_id', participacao.campeonato_id)")
    expect(api).toContain('call_nome: config?.xtreino_call_fixa ? compactText(body?.call_nome) : null')
    expect(api).toContain('primeira_safe: config?.xtreino_registra_primeira_safe ? compactText(body?.primeira_safe) : null')
    expect(api).toContain('segunda_safe: config?.xtreino_registra_segunda_safe ? compactText(body?.segunda_safe) : null')
    expect(api).toContain("onConflict: 'campeonato_equipe_id,partida_id'")

    expect(migration).toContain('unique (campeonato_equipe_id, partida_id)')
    expect(migration).toContain('enable row level security')
    expect(migration).toContain('não compõe classificação pública')
  })

  test('painel cruza período, resumo, metas, line e contexto tático sem duplicar fonte de dados', () => {
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')

    expect(panel).toContain('team-training-period-actions')
    expect(panel).toContain('buildTrainingObjectiveReading(analyzedTraining)')
    expect(panel).toContain('buildSquadSynergy(analyzedTraining)')
    expect(panel).toContain('buildTacticalCompositionContexts(analyzedTraining)')
    expect(panel).toContain('buildObjectivePerformanceGoals(analyzedTraining.quedas_detalhe.map')
    expect(panel).toContain('Resumo técnico')
    expect(panel).toContain('Análises avançadas')
    expect(panel).not.toContain('<details open className="team-training-analytics team-training-advanced">')
  })

  test('metas históricas usam bloco real de 5 sem percentual arbitrário', () => {
    const goals = source('web/features/dropzone/performance-goals.ts')

    expect(goals).toContain('buildObjectivePerformanceGoals')
    expect(goals).toContain('blockSize = 5')
    expect(goals).not.toContain('1.05')
    expect(goals).not.toContain('1.10')
    expect(goals).toContain("status: 'atingida'")
    expect(goals).toContain("'proxima'")
  })

  test('hotfix de data e revisão mobile permanecem consolidados no fechamento', () => {
    const api = source('web/app/api/equipe/treinos/route.ts')
    const css = source('web/app/globals.css')

    expect(api).toContain(".select('id,nome,tipo,logo_url,status,created_at')")
    expect(api).toContain('created_at: campeonato?.created_at || null')
    expect(api).toContain('String(b.created_at || b.nome)')
    expect(api).not.toContain(".select('id,nome,tipo,logo_url,status,data_inicio,data_fim')")

    expect(css).toContain('.team-training-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}')
    expect(css).toContain('.team-training-advanced:not([open])>*:not(summary){display:none}')
    expect(css).not.toContain('\\nbody .team-training-telemetry')
    expect(css).not.toContain('/* Rodada 48')
  })
})
