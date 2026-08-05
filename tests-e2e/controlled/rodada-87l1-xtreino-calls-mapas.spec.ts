import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 87L1 — calls por mapa no Xtreino', () => {
  test('aba aparece somente no tipo Xtreino', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    expect(panel).toContain("item.id !== 'calls'")
    expect(panel).toContain("=== 'xtreino'")
    expect(panel).toContain('CampeonatoCallsTab')
  })

  test('CRUD completo de call e vínculo manual', () => {
    const route = source('web/app/api/campeonatos/[id]/calls/route.ts')
    expect(route).toContain("action === 'create_call'")
    expect(route).toContain("action === 'assign'")
    expect(route).toContain('export async function PATCH')
    expect(route).toContain('export async function DELETE')
    expect(route).toContain('requireCampeonatoStructureWrite')
  })

  test('banco protege uma call principal por equipe em cada mapa', () => {
    const sql = source('database/migrations/20260805_xtreino_calls_mapas.sql')
    expect(sql).toContain('xtreino_mapa_calls')
    expect(sql).toContain('xtreino_mapa_call_equipes')
    expect(sql).toContain('(campeonato_id, mapa_codigo, campeonato_equipe_id)')
    expect(sql).toContain("where tipo = 'principal'")
  })
})
