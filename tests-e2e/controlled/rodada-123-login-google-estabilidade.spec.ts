import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const loginPage = fs.readFileSync(path.join(root, 'web/app/login/page.tsx'), 'utf8')
const socialLogin = fs.readFileSync(path.join(root, 'web/features/auth/SocialLogin.tsx'), 'utf8')
const serverAuth = fs.readFileSync(path.join(root, 'backend/src/auth/server-auth.ts'), 'utf8')

test('123 - OAuth Google faz somente um redirecionamento controlado', async () => {
  expect(socialLogin).toContain('skipBrowserRedirect: true')
  expect(socialLogin).toContain('window.location.replace(data.url)')
  expect(socialLogin).not.toContain("access_type: 'offline'")
})

test('123 - callback OAuth não volta sozinho para tela de autenticação por timer global', async () => {
  expect(loginPage).not.toContain('const safetyTimer')
  expect(loginPage).not.toContain('}, 12000)')
  expect(loginPage).toContain('waitForOAuthSession')
  expect(loginPage).toContain('supabase.auth.onAuthStateChange')
  expect(loginPage).toContain('deadlineTimer = window.setTimeout(() => finish(null), 6500)')
})

test('123 - carregamento de perfis tem timeout e retry curto', async () => {
  expect(loginPage).toContain('new AbortController()')
  expect(loginPage).toContain("fetchBearerJson('/api/me', currentSession, 4_500)")
  expect(loginPage).toContain('attempt < 2')
  expect(loginPage).toContain('if (attempt === 0) await wait(350)')
})

test('123 - acesso admin não bloqueia mais a entrada nos perfis', async () => {
  const profilesIndex = loginPage.indexOf("setStage('profiles')")
  const adminIndex = loginPage.indexOf('void checkAdmin(currentSession).then')
  expect(profilesIndex).toBeGreaterThan(-1)
  expect(adminIndex).toBeGreaterThan(profilesIndex)
})

test('123 - perfis são carregados por uma única RPC no servidor', async () => {
  const accountsStart = serverAuth.indexOf('export async function getAccountsByUserId')
  const accountsEnd = serverAuth.indexOf('export async function getAccountsForUser', accountsStart)
  const accountsBlock = serverAuth.slice(accountsStart, accountsEnd)
  expect(accountsBlock).toContain('dropzone_perfis_por_auth')
  expect(accountsBlock).not.toContain('types.map(async (type) =>')

  const linkStart = serverAuth.indexOf('async function linkUnownedAccountsByVerifiedEmail')
  const linkEnd = serverAuth.indexOf('export async function getAccountsByUser(', linkStart)
  const linkBlock = serverAuth.slice(linkStart, linkEnd)
  expect(linkBlock).toContain('const candidates = await Promise.all(')
  expect(linkBlock).toContain('const linked = await Promise.all(')
})

test('123 - retorno OAuth é preservado até usuário abrir ou criar o perfil', async () => {
  expect(loginPage).toContain('function clearOAuthReturnState()')
  expect(loginPage).toContain('function openProfile(profile: DropZoneRow)')
  expect(loginPage).toContain('function createProfile(type: ProfileType)')
  expect(loginPage).not.toContain('if (complete) {\n        try {\n          sessionStorage.removeItem(OAUTH_RETURN_KEY)')
})
