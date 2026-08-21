import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const authReturn = fs.readFileSync(path.join(root, 'web/features/auth/auth-return.ts'), 'utf8')
const rosterInvite = fs.readFileSync(path.join(root, 'web/app/equipe/entrar/[token]/page.tsx'), 'utf8')
const wallet = fs.readFileSync(path.join(root, 'web/app/carteira/page.tsx'), 'utf8')
const central = fs.readFileSync(path.join(root, 'web/components/campeonatos/ChampionshipCentral.tsx'), 'utf8')
const admin = fs.readFileSync(path.join(root, 'web/app/admin/page.tsx'), 'utf8')
const agendaClient = fs.readFileSync(path.join(root, 'web/features/agenda/services/agenda-client.ts'), 'utf8')
const home = fs.readFileSync(path.join(root, 'web/features/dropzone/DropZoneHome.tsx'), 'utf8')

test('127 - bloqueios de autenticação usam um retorno interno único e seguro', () => {
  expect(authReturn).toContain('export function currentInternalPath()')
  expect(authReturn).toContain('export function redirectToLogin(')
  expect(authReturn).toContain('window.location.assign(buildLoginHref(profileType, returnTo))')
})

test('127 - convite legado de elenco abre o login e retorna ao mesmo token', () => {
  expect(rosterInvite).toContain("buildLoginHref('jogador', `/equipe/entrar/${encodeURIComponent(token)}`)")
  expect(rosterInvite).not.toContain('?perfil=jogador&returnTo=')
})

test('127 - áreas privadas e ações de agenda não deixam sessão expirada sem saída', () => {
  for (const source of [wallet, central, admin, agendaClient]) {
    expect(source).toContain('redirectToLogin(null, currentInternalPath())')
  }
})

test('127 - atalhos internos antigos da Lili continuam abrindo o perfil vinculado', () => {
  expect(home).toContain("const requestedActiveProfile = parseProfileType(String(params.get('perfil') || ''))")
  expect(home).toContain('const preferredType = requestedActiveProfile || storedType')
})

for (const route of ['/carteira', '/central-campeonato', '/admin']) {
  test(`127 - ${route} sem sessão abre login preservando o destino`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await page.waitForURL((url) => url.pathname === '/login' && url.searchParams.get('returnTo') === route)
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe(route)
  })
}
