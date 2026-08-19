import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const serverAuth = fs.readFileSync(path.join(root, 'backend/src/auth/server-auth.ts'), 'utf8')
const migration = fs.readFileSync(path.join(root, 'database/migrations/20260819_dropzone_perfis_auth_rpc.sql'), 'utf8')

test('125 - login resolve todos os perfis com uma única RPC', async () => {
  const start = serverAuth.indexOf('export async function getAccountsByUserId')
  const end = serverAuth.indexOf('export async function getAccountsForUser', start)
  const block = serverAuth.slice(start, end)

  expect(block).toContain("supabaseAdmin.rpc('dropzone_perfis_por_auth'")
  expect(block).toContain('p_auth_user_id: userId')
  expect(block).not.toContain('Promise.all(')
  expect(block).not.toContain('.from(profileTable(type))')
})

test('125 - retorno da RPC preserva o formato DropZoneRow já usado pelo app', async () => {
  const start = serverAuth.indexOf('export async function getAccountsByUserId')
  const end = serverAuth.indexOf('export async function getAccountsForUser', start)
  const block = serverAuth.slice(start, end)

  expect(block).toContain('row.profile_type as ProfileType')
  expect(block).toContain("row.data && typeof row.data === 'object' ? row.data : row")
  expect(block).toContain('return mapProfile(source, type)')
})

test('125 - migration agrega os cinco tipos de perfil pelo mesmo auth_user_id', async () => {
  for (const table of ['produtoras', 'equipes', 'jogadores', 'managers', 'broadcasts']) {
    expect(migration).toContain(`from public.${table}`)
  }
  expect((migration.match(/where .*\.auth_user_id = p_auth_user_id/g) || []).length).toBe(5)
})

test('125 - RPC fica restrita ao service role', async () => {
  expect(migration).toContain('security definer')
  expect(migration).toContain('set search_path = public')
  expect(migration).toContain('revoke all on function public.dropzone_perfis_por_auth(uuid) from public;')
  expect(migration).toContain('grant execute on function public.dropzone_perfis_por_auth(uuid) to service_role;')
})
