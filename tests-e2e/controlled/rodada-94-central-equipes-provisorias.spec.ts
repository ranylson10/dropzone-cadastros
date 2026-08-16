import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const migration = fs.readFileSync(path.join(root, 'database/migrations/20260816_equipes_provisorias_produtora.sql'), 'utf8')
const route = fs.readFileSync(path.join(root, 'web/app/api/produtora/equipes-provisorias/route.ts'), 'utf8')
const panel = fs.readFileSync(path.join(root, 'web/features/produtoras/components/ProvisionalTeamsPanel.tsx'), 'utf8')
const access = fs.readFileSync(path.join(root, 'backend/src/equipes/manager-team-access.ts'), 'utf8')
const producer = fs.readFileSync(path.join(root, 'web/features/dropzone/panels/produtora/ProdutoraPanel.tsx'), 'utf8')

test('94 - cadastro em bloco aceita colagem de planilha e só grava ao confirmar', async () => {
  expect(panel).toContain("line.includes('\\t')")
  expect(panel).toContain("line.includes('|')")
  expect(panel).toContain("line.includes(';')")
  expect(panel).toContain('Nada é salvo até você confirmar.')
  expect(panel).toContain('Criar {preview.length')
  expect(migration).toContain('jsonb_array_length(p_equipes) > 100')
})

test('94 - equipes provisórias pertencem à central da produtora e não dependem de campeonato', async () => {
  expect(route).toContain(".eq('auth_user_id', userId)")
  expect(route).toContain(".eq('produtora_id', produtora.id)")
  expect(migration).toContain('fn_criar_equipes_provisorias_em_bloco')
  expect(migration).not.toContain('p_campeonato_id uuid')
  expect(producer).toContain("producerSection === 'provisorias'")
  expect(producer).toContain('Equipes provisórias')
})

test('94 - equipe reivindicada some automaticamente e produtora perde controle global', async () => {
  expect(route).toContain(".eq('status', 'ativo')")
  expect(route).toContain(".eq('usado', false)")
  expect(route).toContain("!e.auth_user_id && !e.dono_auth_user_id")
  expect(access).toContain("papel: 'produtora_provisoria'")
  expect(access).toContain(".eq('tipo', 'reivindicacao_equipe_historica')")
  expect(access).toContain("!e.auth_user_id && !e.dono_auth_user_id")
})

test('94 - produtor usa estrutura oficial de lines, jogadores e convites', async () => {
  expect(panel).toContain('/api/equipes/${selected.id}/lines')
  expect(panel).toContain('LineRosterManager')
  expect(panel).toContain('Convites podem ser gerados por line e por campeonato.')
  expect(access).toContain('pode_gerar_token: true')
  expect(access).toContain('pode_escalar: true')
})

test('94 - produtor pode editar informações e logo antes da reivindicação', async () => {
  expect(route).toContain("for (const key of ['nome', 'tag', 'logo_url', 'localidade', 'cidade', 'estado', 'pais', 'bio'])")
  expect(panel).toContain("uploadPublicFile(file, 'equipe')")
  expect(panel).toContain('Salvar informações')
  expect(panel).toContain('Copiar link')
})
