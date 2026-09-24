import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
const dropzone = read('web/features/dropzone/DropZoneHome.tsx')
const registerApi = read('web/app/api/auth/register/route.ts')
const verificationApi = read('web/app/api/auth/verification/request/route.ts')
const admin = read('web/app/admin/page.tsx')
const system = read('web/app/system.css')
const header = read('web/app/header.css')
const homeStyles = read('web/features/home/authenticated-home.css')

test.describe('Rodada 145 — produtoras privadas e layout claro', () => {
  test('produtora deixa de ser opção de cadastro público', () => {
    expect(home).toContain('Produtoras são privadas')
    expect(home).toContain('Workspaces de organização são liberados somente pela administração')
    expect(home).not.toContain('Organizo campeonatos')
    expect(home).not.toContain("createProfileHref('produtora'")
  })

  test('autoatendimento fica restrito a jogador equipe e manager', () => {
    expect(dropzone).toContain("const SELF_SERVICE_PROFILE_TYPES: WebProfileType[] = ['jogador', 'equipe', 'manager']")
    expect(dropzone).toContain("useState<WebProfileType>('jogador')")
    expect(dropzone).toContain("if (preferredType === 'produtora')")
  })

  test('url de cadastro de produtora também é bloqueada na experiência web', () => {
    expect(dropzone).toContain("requestedRegisterType === 'produtora' ? null : requestedRegisterType")
    expect(dropzone).toContain('Produtoras são criadas somente por convite da administração do DropZone.')
    expect(dropzone).toContain("forcedProfileType === 'produtora' && !existing")
  })

  test('backend rejeita criação direta de produtora', () => {
    expect(registerApi).toContain("if (profileType === 'produtora')")
    expect(registerApi).toContain('Produtoras são criadas somente por convite da administração do DropZone.')
  })

  test('backend não envia verificação para cadastro público de produtora', () => {
    expect(verificationApi).toContain("purpose === 'register' && profileType === 'produtora'")
    expect(verificationApi).toContain('Produtoras são criadas somente por convite da administração do DropZone.')
  })

  test('central administrativa ganha área específica de produtoras privadas', () => {
    expect(admin).toContain("['produtoras', 'Produtoras']")
    expect(admin).toContain('Produtoras autorizadas')
    expect(admin).toContain('Somente por convite')
    expect(admin).toContain('e-mail já cadastrado')
  })

  test('admin passa a se apresentar como Central DropZone', () => {
    expect(admin).toContain('<h1>Central DropZone</h1>')
    expect(admin).toContain('Criação fechada pela administração')
    expect(admin).toContain('Workspace privado')
  })

  test('design system principal passa a ser claro com roxo DropZone', () => {
    expect(system).toContain('color-scheme: light')
    expect(system).toContain('--ui-bg: #f1efe9')
    expect(system).toContain('--ui-surface: #ffffff')
    expect(system).toContain('--ui-accent: #6f43ff')
  })

  test('desktop autenticado usa sidebar escura', () => {
    expect(header).toContain(".app-header:has(+ .app-shell-main.page-authenticated)")
    expect(header).toContain('width: 232px')
    expect(header).toContain('margin-left: 232px')
    expect(header).toContain('background: #0c0c0e')
  })

  test('mobile mantém navegação própria e superfície clara', () => {
    expect(header).toContain('@media (max-width: 900px)')
    expect(header).toContain('background: rgba(255,255,255,.97)')
    expect(header).toContain('.app-mobile-quick-sheet')
    expect(header).toContain('background: #fff')
  })

  test('home ganha hierarquia editorial e cards menos arredondados', () => {
    expect(homeStyles).toContain('border-left:7px solid var(--home-accent)')
    expect(homeStyles).toContain('text-transform:uppercase')
    expect(homeStyles).toContain('.authenticated-home-private-producer')
    expect(homeStyles).toContain('grid-template-columns:repeat(2,minmax(0,1fr))')
  })

  test('mobile da home volta para uma coluna', () => {
    expect(homeStyles).toContain('@media(max-width:620px)')
    expect(homeStyles).toContain('.authenticated-home-onboarding-grid{grid-template-columns:1fr}')
    expect(homeStyles).toContain('padding:12px 10px 92px')
  })
})
