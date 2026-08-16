import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const provisionalRoute = fs.readFileSync(path.join(root, 'web/app/api/produtora/equipes-provisorias/route.ts'), 'utf8')
const claimRoute = fs.readFileSync(path.join(root, 'web/app/api/equipes/reivindicacao/[token]/route.ts'), 'utf8')
const claimPage = fs.readFileSync(path.join(root, 'web/app/equipe/reivindicar/[token]/page.tsx'), 'utf8')

test('99 - central mantém email de contato no carregamento e na edição', async () => {
  expect(provisionalRoute).toContain('dono_auth_user_id,email_contato,localidade')
  expect(provisionalRoute).toContain('if (body.email_contato !== undefined)')
  expect(provisionalRoute).toContain('patch.email_contato')
})

test('99 - participações carregam a logo real do campeonato', async () => {
  expect(provisionalRoute).toContain('campeonato:campeonato_id(id,nome,logo_url)')
})

test('99 - reivindicação lista as lines preservadas e não ressuscita line inativa', async () => {
  expect(claimRoute).toContain(".neq('status', 'inativo')")
  expect(claimRoute).not.toContain(".neq('status', 'arquivado')")
  expect(claimPage).toContain('Lines:')
})

test('99 - incorporação comunica que todo o histórico da equipe é preservado', async () => {
  expect(claimPage).toContain('Incorporar histórico da equipe')
  expect(claimPage).toContain('suas lines, campeonatos, jogadores e estatísticas serão preservados')
  expect(claimPage).toContain('Histórico incorporado à sua equipe. Lines, campeonatos e estatísticas foram preservados.')
})

test('99 - fluxo de reivindicação continua autenticado e via rpc oficial', async () => {
  expect(claimRoute).toContain('getBearerUser(req)')
  expect(claimRoute).toContain("supabaseAdmin.rpc('fn_reivindicar_equipe_historica'")
})
