import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const authReturn = fs.readFileSync(path.join(root, 'web/features/auth/auth-return.ts'), 'utf8')
const login = fs.readFileSync(path.join(root, 'web/app/login/page.tsx'), 'utf8')
const claimPage = fs.readFileSync(path.join(root, 'web/app/equipe/reivindicar/[token]/page.tsx'), 'utf8')
const claimMigration = fs.readFileSync(path.join(root, 'database/migrations/20260816_reivindicacao_equipe_historica_elenco.sql'), 'utf8')

test('135 - login de reivindicação retorna direto ao convite sem resolver perfil operacional', () => {
  expect(authReturn).toContain("path.startsWith('/equipe/reivindicar/')")
  expect(login).toContain('isDirectAuthReturnPath(returnTo)')
  expect(login).toContain('finishAuthReturn(returnTo)')
  expect(login).toContain('Não carregamos perfis aqui')
})

test('135 - conta que já possui equipe decide a incorporação na mesma página', () => {
  expect(claimPage).toContain('Este login já possui uma equipe')
  expect(claimPage).toContain('Equipe vinculada a este login')
  expect(claimPage).toContain('Incorporar em {ownedTeam?.nome}')
  expect(claimPage).toContain('Entrar com outro login')
  expect(claimPage).toContain('Criar novo login')
})

test('135 - regra de uma equipe por login e fusão do histórico permanecem protegidas no banco', () => {
  expect(claimMigration).toContain('if v_tem_outra_equipe then')
  expect(claimMigration).toContain("raise exception 'Este login já possui uma equipe.")
  expect(claimMigration).toContain('update public.equipe_lines')
  expect(claimMigration).toContain('update public.campeonato_equipes')
  expect(claimMigration).toContain("set status = 'incorporada'")
})
