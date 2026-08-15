import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 34 — anotações privadas por queda do XTreino', () => {
  test('anotações usam tabela privada separada da súmula', () => {
    const migration = source('supabase/migrations/20260815122000_xtreino_anotacoes_privadas_queda.sql')

    expect(migration).toContain('xtreino_anotacoes_equipes_quedas')
    expect(migration).toContain('unique (campeonato_equipe_id, partida_id)')
    expect(migration).toContain('enable row level security')
    expect(migration).not.toContain('alter table public.campeonato_resultados_equipes add column')
  })

  test('API privada só lê participações de equipes controladas pelo usuário', () => {
    const route = source('web/app/api/equipe/treinos/route.ts')

    expect(route).toContain('managedTeamIds(user.id)')
    expect(route).toContain(".in('equipe_id', teamIds)")
    expect(route).toContain("Você não tem permissão para editar a análise desta equipe.")
  })

  test('PATCH confirma que a queda pertence ao mesmo XTreino', () => {
    const route = source('web/app/api/equipe/treinos/route.ts')

    expect(route).toContain("String(campeonato.tipo || '').toLowerCase() !== 'xtreino'")
    expect(route).toContain(".eq('campeonato_id', participacao.campeonato_id)")
    expect(route).toContain('A queda não pertence a este XTreino.')
  })

  test('campos respeitam a configuração do XTreino', () => {
    const route = source('web/app/api/equipe/treinos/route.ts')

    expect(route).toContain('xtreino_call_fixa')
    expect(route).toContain('xtreino_registra_primeira_safe')
    expect(route).toContain('xtreino_registra_segunda_safe')
    expect(route).toContain('config?.xtreino_call_fixa ? compactText(body?.call_nome) : null')
  })

  test('detalhe da equipe cruza resultado e MatchStats por partida', () => {
    const route = source('web/app/api/equipe/treinos/route.ts')

    expect(route).toContain('playersByDrop')
    expect(route).toContain('row.partida_id')
    expect(route).toContain('quedas_detalhe')
    expect(route).toContain('dano: dropPlayers.reduce')
    expect(route).toContain('assistencias: dropPlayers.reduce')
    expect(route).toContain('revives: dropPlayers.reduce')
  })

  test('painel da equipe permite anotar cada queda sem expor para outras equipes', () => {
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')

    expect(panel).toContain('Análise por queda')
    expect(panel).toContain('Call e leitura de safe ficam privadas para sua equipe.')
    expect(panel).toContain('saveTrainingDrop')
    expect(panel).toContain("fetch('/api/equipe/treinos'")
    expect(panel).toContain("method: 'PATCH'")
  })

  test('painel aceita qualquer número de quedas processadas', () => {
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')

    expect(panel).toContain('training.quedas_detalhe.map')
    expect(panel).not.toContain('quedas_detalhe.length === 4')
  })
})
