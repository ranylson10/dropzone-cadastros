import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const migration = fs.readFileSync(path.join(root, 'database/migrations/20260816_equipes_historicas_reivindicacao.sql'), 'utf8')
const bulkRoute = fs.readFileSync(path.join(root, 'web/app/api/campeonatos/[id]/equipes/historicas/route.ts'), 'utf8')
const claimRoute = fs.readFileSync(path.join(root, 'web/app/api/equipes/reivindicacao/[token]/route.ts'), 'utf8')
const claimPage = fs.readFileSync(path.join(root, 'web/app/equipe/reivindicar/[token]/page.tsx'), 'utf8')
const teamsTab = fs.readFileSync(path.join(root, 'web/features/campeonatos/equipes/components/CampeonatoEquipesTab.tsx'), 'utf8')

test('93 - cadastro em bloco fica restrito ao dono da produtora', async () => {
  expect(bulkRoute).toContain("permission.role !== 'owner'")
  expect(migration).toContain('Somente o dono da produtora pode cadastrar equipes históricas em bloco.')
  expect(teamsTab).toContain("data.permission.role === 'owner'")
})

test('93 - equipe histórica nasce sem dono e reutiliza line principal oficial', async () => {
  expect(migration).toContain('auth_user_id, dono_auth_user_id, status')
  expect(migration).toContain("v_nome, v_tag, null, null, null, 'ativo'")
  expect(migration).toContain('trg_equipe_cria_line_principal')
  expect(migration).toContain("'reivindicacao_equipe_historica'")
})

test('93 - link pode assumir equipe ou incorporar histórico em equipe existente', async () => {
  expect(migration).toContain("p_modo not in ('assumir', 'incorporar')")
  expect(migration).toContain('update public.campeonato_equipes')
  expect(migration).toContain('update public.campeonato_jogadores')
  expect(migration).toContain("set status = 'incorporada'")
  expect(claimPage).toContain('Assumir equipe')
  expect(claimPage).toContain('Incorporar line histórica')
  expect(claimPage).toContain('Usar outra conta')
})

test('93 - token não é lido diretamente pelo cliente e reivindicação exige login para mutar', async () => {
  expect(claimRoute).toContain(".from('tokens')")
  expect(claimRoute).toContain('getBearerUser(req)')
  expect(claimPage).toContain('/api/equipes/reivindicacao/')
  expect(claimPage).not.toContain("supabase.from('tokens')")
})

test('93 - produtora consegue reabrir cadastro e recuperar links ainda pendentes', async () => {
  expect(bulkRoute).toContain('export async function GET')
  expect(bulkRoute).toContain(".eq('tipo', 'reivindicacao_equipe_historica')")
  expect(teamsTab).toContain('listarHistoricas')
  expect(teamsTab).toContain('Copiar link')
})
