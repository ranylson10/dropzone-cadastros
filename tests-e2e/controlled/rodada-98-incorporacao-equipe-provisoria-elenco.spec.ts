import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const migration = fs.readFileSync(path.join(root, 'database/migrations/20260816_reivindicacao_equipe_historica_elenco.sql'), 'utf8')
const claimRoute = fs.readFileSync(path.join(root, 'web/app/api/equipes/reivindicacao/[token]/route.ts'), 'utf8')
const provisionalRoute = fs.readFileSync(path.join(root, 'web/app/api/produtora/equipes-provisorias/route.ts'), 'utf8')

test('98 - incorporação transfere elenco-base antes dos vínculos da line', async () => {
  const elenco = migration.indexOf('update public.equipe_jogadores')
  const lines = migration.indexOf('update public.equipe_lines')
  const vinculos = migration.indexOf('update public.equipe_line_jogadores')
  expect(elenco).toBeGreaterThan(-1)
  expect(lines).toBeGreaterThan(elenco)
  expect(vinculos).toBeGreaterThan(lines)
})

test('98 - jogador já existente no destino é mesclado em vez de duplicado', async () => {
  expect(migration).toContain("v_player_map jsonb := '{}'::jsonb")
  expect(migration).toContain('jogador_auth_user_id = v_player.jogador_auth_user_id')
  expect(migration).toContain('jogador_id = v_player.jogador_id')
  expect(migration).toContain('jogador_temporario_id = v_player.jogador_temporario_id')
  expect(migration).toContain('equipe_jogador_id = v_pair.value::uuid')
  expect(migration).toContain("set status = 'inativo'")
})

test('98 - estatísticas e participações continuam no mesmo histórico', async () => {
  expect(migration).toContain('update public.campeonato_equipes')
  expect(migration).toContain('update public.campeonato_jogadores')
  expect(migration).not.toContain('insert into public.campeonato_equipes')
  expect(migration).not.toContain('insert into public.campeonato_jogadores')
})

test('98 - reivindicação continua sendo executada somente pelo endpoint autenticado', async () => {
  expect(claimRoute).toContain("supabaseAdmin.rpc('fn_reivindicar_equipe_historica'")
  expect(claimRoute).toContain('getBearerUser(req)')
  expect(migration).toContain('grant execute on function public.fn_reivindicar_equipe_historica(text, uuid, text, uuid) to service_role')
})

test('98 - central continua escondendo equipe assim que ela ganha dono ou token deixa de estar ativo', async () => {
  expect(provisionalRoute).toContain(".eq('status', 'ativo')")
  expect(provisionalRoute).toContain(".eq('usado', false)")
  expect(provisionalRoute).toContain("!e.auth_user_id && !e.dono_auth_user_id")
})
