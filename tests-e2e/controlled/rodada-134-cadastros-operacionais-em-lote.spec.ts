import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const panel = fs.readFileSync(path.join(root, 'web/features/produtoras/components/ProvisionalTeamsPanel.tsx'), 'utf8')
const provisionalRoute = fs.readFileSync(path.join(root, 'web/app/api/produtora/equipes-provisorias/route.ts'), 'utf8')
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260910103342_equipes_provisorias_logos_em_bloco.sql'), 'utf8')
const structure = fs.readFileSync(path.join(root, 'web/features/campeonatos/fases/components/CampeonatoEstruturaTab.tsx'), 'utf8')
const structureCss = fs.readFileSync(path.join(root, 'web/features/campeonatos/fases/components/campeonato-estrutura-batch.css'), 'utf8')

test('134 - equipes provisórias usam tabela com nomes, tags e uma logo por linha', async () => {
  expect(panel).toContain('provisional-bulk-columns')
  expect(panel).toContain('Nomes das equipes')
  expect(panel).toContain('TAGs')
  expect(panel).toContain('provisional-bulk-logo')
  expect(panel).toContain('updateBulkLogo')
})

test('134 - logos sobem em paralelo e o cadastro permanece em uma RPC de lote', async () => {
  expect(panel).toContain('Promise.all(bulkRows.map')
  expect(panel).toContain("await uploadPublicFile(row.logoFile, 'equipe', { uploadIntent: 'create_profile' })")
  expect(panel).toContain('body: JSON.stringify({ equipes })')
  expect(provisionalRoute).toContain("raw?.logo_url")
  expect(provisionalRoute).toContain("supabaseAdmin.rpc('fn_criar_equipes_provisorias_em_bloco'")
  expect(migration).toContain("v_logo_url := nullif")
  expect(migration).toContain('values (v_nome, v_tag, v_logo_url, null, null')
})

test('134 - slots aceitam várias equipes e lines em uma única confirmação visual', async () => {
  expect(structure).toContain('BatchSlotAssignment')
  expect(structure).toContain('batchAssignments.map')
  expect(structure).toContain('Promise.all(valid.map')
  expect(structure).toContain('Preencha os slots desejados')
  expect(structure).toContain('Salvar ${batchSelectedCount} equipe(s)')
  expect(structureCss).toContain('.slot-batch-table')
})
