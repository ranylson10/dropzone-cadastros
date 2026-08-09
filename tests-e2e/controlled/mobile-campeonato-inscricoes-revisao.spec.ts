import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Mobile campeonato — revisão de inscrições', () => {
  test('fila pendente usa status real e aprovação exige slot manual', async () => {
    const api = read('app/src/lib/api.ts')
    const panel = read('app/src/screens/ChampionshipTeamsPanel.tsx')
    const route = read('web/app/api/campeonatos/[id]/equipes/route.ts')
    const migration = read('database/migrations/20260809_campeonato_inscricoes_revisao.sql')

    expect(api).toContain('requestChampionshipEntry')
    expect(api).toContain('reviewChampionshipEntry')
    expect(panel).toContain('INSCRIÇÕES PARA ANÁLISE')
    expect(panel).toContain("action: 'approve'")
    expect(panel).toContain("action: 'reject'")
    expect(panel).toContain('Toque em um slot livre abaixo para aprovar')
    expect(route).toContain("body.mode === 'request'")
    expect(route).toContain("status: 'pendente'")
    expect(route).toContain("body.mode === 'review_request'")
    expect(route).toContain("status: 'rejeitado'")
    expect(route).toContain("status: 'ativo', slot_id: slot.id")
    expect(route).toContain('Escolha manualmente o slot antes de aprovar')
    expect(migration).toContain('revisado_por uuid references auth.users(id)')
    expect(migration).toContain("where line_id is not null and status = 'pendente'")
    expect(panel).not.toContain('distribute_phase')
  })
})
