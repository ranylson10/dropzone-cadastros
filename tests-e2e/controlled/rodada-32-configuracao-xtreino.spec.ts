import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 32 — configuração do Xtreino', () => {
  test('Xtreino usa fluxo próprio com configuração e pontuação compartilhada', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain("value.tipo === 'xtreino'")
    expect(form).toContain("{ id: 'format' as const, label: 'Configuração' }")
    expect(form).toContain("{ id: 'scoring', label: 'Pontuação' }")
  })

  test('configuração define equipes, quedas, call fixa e safes', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('Equipes por sala')
    expect(form).toContain('Quedas por jogo')
    expect(form).toContain('Call fixa')
    expect(form).toContain('Registrar 1ª safe')
    expect(form).toContain('Registrar 2ª safe')
    expect(form).toContain('updateXtreinoTeams')
  })

  test('não assume somente um mapa e usa o catálogo já conhecido pelo sistema', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    for (const map of ['Bermuda', 'Purgatório', 'Kalahari', 'Alpine', 'Nexterra', 'Solara']) {
      expect(form).toContain(map)
    }
    expect(form).toContain('toggleXtreinoMap')
  })

  test('pontuação continua no motor compartilhado em vez de duplicar regra do Xtreino', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('sistema_pontuacao_tipo')
    expect(form).toContain('pontos_colocacao')
    expect(form).toContain('pontos_por_abate')
    expect(form).not.toContain('xtreino_pontos_colocacao')
    expect(form).not.toContain('xtreino_pontos_por_abate')
  })

  test('API persiste somente o contexto específico do treino', () => {
    const api = source('web/app/api/dropzone/route.ts')
    expect(api).toContain('xtreino_call_fixa: Boolean(data.xtreino_call_fixa)')
    expect(api).toContain('xtreino_registra_primeira_safe: data.xtreino_registra_primeira_safe !== false')
    expect(api).toContain('xtreino_registra_segunda_safe: data.xtreino_registra_segunda_safe !== false')
    expect(api).toContain('xtreino_mapas: Array.isArray(data.xtreino_mapas)')
    expect(api).toContain('partidas_por_jogo: Math.max(1')
  })

  test('edição recarrega a configuração salva', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    expect(panel).toContain('xtreino_call_fixa: champ.data?.xtreino_call_fixa === true')
    expect(panel).toContain('xtreino_registra_primeira_safe: champ.data?.xtreino_registra_primeira_safe !== false')
    expect(panel).toContain('xtreino_registra_segunda_safe: champ.data?.xtreino_registra_segunda_safe !== false')
    expect(panel).toContain('xtreino_mapas: Array.isArray(champ.data?.xtreino_mapas)')
  })

  test('migration adiciona apenas campos de contexto de análise', () => {
    const sql = source('supabase/migrations/20260815114500_xtreino_configuracao_analise.sql')
    expect(sql).toContain('xtreino_call_fixa boolean')
    expect(sql).toContain('xtreino_registra_primeira_safe boolean')
    expect(sql).toContain('xtreino_registra_segunda_safe boolean')
    expect(sql).toContain('xtreino_mapas text[]')
    expect(sql).toContain('partidas_por_jogo integer')
  })
})
