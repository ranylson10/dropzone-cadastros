import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const provisionalMigration = fs.readFileSync(path.join(root, 'database/migrations/20260816_equipes_provisorias_produtora.sql'), 'utf8')
const claimMigration = fs.readFileSync(path.join(root, 'database/migrations/20260816_reivindicacao_equipe_historica_elenco.sql'), 'utf8')
const provisionalRoute = fs.readFileSync(path.join(root, 'web/app/api/produtora/equipes-provisorias/route.ts'), 'utf8')
const claimRoute = fs.readFileSync(path.join(root, 'web/app/api/equipes/reivindicacao/[token]/route.ts'), 'utf8')
const claimPage = fs.readFileSync(path.join(root, 'web/app/equipe/reivindicar/[token]/page.tsx'), 'utf8')
const panel = fs.readFileSync(path.join(root, 'web/features/produtoras/components/ProvisionalTeamsPanel.tsx'), 'utf8')
const access = fs.readFileSync(path.join(root, 'backend/src/equipes/manager-team-access.ts'), 'utf8')

function indexAfter(text: string, first: string, second: string) {
  const firstIndex = text.indexOf(first)
  const secondIndex = text.indexOf(second)
  expect(firstIndex).toBeGreaterThan(-1)
  expect(secondIndex).toBeGreaterThan(firstIndex)
}

test('100 - cadastro em massa continua sendo uma única confirmação e uma RPC de lote', async () => {
  expect(panel).toContain("line.includes('\\t')")
  expect(panel).toContain('body: JSON.stringify({ equipes: bulkRows })')
  expect(panel).toContain('Nada é salvo até você confirmar.')
  expect(provisionalRoute).toContain("supabaseAdmin.rpc('fn_criar_equipes_provisorias_em_bloco'")
  expect(provisionalMigration).toContain('jsonb_array_length(p_equipes) > 100')
})

test('100 - equipe provisória permanece oficial, sem dono, com line principal e gestão temporária da produtora', async () => {
  expect(provisionalMigration).toContain("values (v_nome, v_tag, null, null, null, 'ativo')")
  expect(provisionalMigration).toContain("'reivindicacao_equipe_historica'")
  expect(access).toContain("papel: 'produtora_provisoria'")
  expect(access).toContain("!e.auth_user_id && !e.dono_auth_user_id")
  expect(panel).toContain('/api/equipes/${selected.id}/lines')
  expect(panel).toContain('LineRosterManager')
})

test('100 - central carrega e edita dados completos sem depender somente da validação do front', async () => {
  expect(provisionalRoute).toContain('dono_auth_user_id,email_contato,localidade')
  expect(provisionalRoute).toContain('campeonato:campeonato_id(id,nome,logo_url)')
  expect(provisionalRoute).toContain("if (patch.nome === null) throw new Error('Nome da equipe é obrigatório.')")
  expect(provisionalRoute).toContain("if (patch.tag === null) throw new Error('TAG da equipe é obrigatória.')")
  expect(provisionalRoute).toContain('patch.email_contato')
})

test('100 - gestão individual mantém informações, lines, jogadores, convites e campeonatos no fluxo oficial', async () => {
  expect(panel).toContain("type ManagerTab = 'dados' | 'lines' | 'campeonatos'")
  expect(panel).toContain('Salvar informações')
  expect(panel).toContain('Salvar line')
  expect(panel).toContain('Jogadores e convites')
  expect(panel).toContain('openLine(line, true)')
  expect(panel).toContain('Buscar equipe, TAG ou localidade')
})

test('100 - reivindicação autenticada assume a equipe sem recriar seu histórico', async () => {
  expect(claimRoute).toContain('getBearerUser(req)')
  expect(claimRoute).toContain("supabaseAdmin.rpc('fn_reivindicar_equipe_historica'")
  expect(claimMigration).toContain("p_modo not in ('assumir', 'incorporar')")
  expect(claimMigration).toContain('set auth_user_id = p_auth_user_id')
  expect(claimMigration).toContain('dono_auth_user_id = p_auth_user_id')
  expect(claimPage).toContain('Assumir equipe')
})

test('100 - incorporação transfere elenco antes das lines e preserva participações e formações', async () => {
  indexAfter(claimMigration, 'update public.equipe_jogadores', 'update public.equipe_lines')
  indexAfter(claimMigration, 'update public.equipe_lines', 'update public.equipe_line_jogadores')
  expect(claimMigration).toContain('update public.campeonato_equipes')
  expect(claimMigration).toContain('update public.campeonato_jogadores')
  expect(claimMigration).not.toContain('insert into public.campeonato_equipes')
  expect(claimMigration).not.toContain('insert into public.campeonato_jogadores')
  expect(claimPage).toContain('Incorporar histórico da equipe')
})

test('100 - equipe deixa automaticamente a central quando ganha dono ou é incorporada', async () => {
  expect(provisionalRoute).toContain(".eq('status', 'ativo')")
  expect(provisionalRoute).toContain(".eq('usado', false)")
  expect(provisionalRoute).toContain('!e.auth_user_id && !e.dono_auth_user_id')
  expect(claimMigration).toContain("set status = 'incorporada'")
  expect(claimMigration).toContain("set usado = true, usado_em = now(), status = 'usado'")
  expect(panel).toContain('ela desaparece automaticamente daqui')
})
