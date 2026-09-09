import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const login = fs.readFileSync(path.join(root, 'web/app/login/page.tsx'), 'utf8')
const shell = fs.readFileSync(path.join(root, 'web/components/layout/AppShell.tsx'), 'utf8')
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260909123000_account_identities.sql'), 'utf8')

test('132 - criação da conta solicita identidade pública completa', () => {
  expect(login).toContain('Nome de exibição')
  expect(login).toContain('Usuário único')
  expect(login).toContain('label="Foto de perfil"')
  expect(login).toContain("account_username: username")
  expect(login).toContain("emailMode === 'completar-conta'")
})

test('132 - usuário da conta é único no banco', () => {
  expect(migration).toContain('create table if not exists public.account_identities')
  expect(migration).toContain('account_identities_username_unique')
  expect(migration).toContain('on public.account_identities (lower(username))')
  expect(migration).toContain('sync_account_identity_from_auth')
})

test('132 - cabeçalho prioriza foto nome e arroba da conta', () => {
  expect(shell).toContain("profileName={identity?.name || account?.name")
  expect(shell).toContain('identity?.username')
  expect(shell).toContain('profileImage={identity?.avatar_url || mediaFor(account) || undefined}')
  expect(shell).not.toContain(': identity?.email || undefined')
})
