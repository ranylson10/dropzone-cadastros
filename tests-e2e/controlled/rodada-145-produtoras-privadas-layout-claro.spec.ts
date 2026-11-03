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
const identity = read('web/styles/dropzone-identity.css')
const layout = read('web/app/layout.tsx')
const header = read('web/app/header.css')

test.describe('Rodada 145 — produtoras privadas e layout claro', () => {
  test('produtora deixa de ser opção de cadastro público', () => {
    expect(dropzone).toContain("if (preferredType === 'produtora')")
    expect(dropzone).toContain('Produtoras são criadas somente por convite da administração do DropZone.')
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

  test('identidade canônica fornece a paleta atual', () => {
    expect(layout).toContain("@/styles/dropzone-identity.css")
    expect(identity).toContain('--dz-paper: #f1efe7')
    expect(identity).toContain('--dz-white: #fffef9')
    expect(identity).toContain('--dz-rust: #ad3b22')
  })

  test('desktop autenticado mantém faixa superior e seletor de painel', () => {
    expect(header).toContain('.app-desktop-panel-switcher')
    expect(header).toContain('width: 100%; height: 70px')
    expect(header).toContain('margin-left: 0;')
    expect(header).not.toContain('width: 232px')
  })

  test('mobile mantém navegação própria e superfície clara', () => {
    expect(header).toContain('@media (max-width: 900px)')
    expect(header).toContain('background: rgba(255,255,255,.97)')
    expect(header).toContain('.app-mobile-quick-sheet')
    expect(header).toContain('background: #fff')
  })

  test('home ganha hierarquia editorial e cards menos arredondados', () => {
    expect(home).toContain('store-home-hero-copy')
    expect(home).toContain('<ChampionshipCard')
    expect(identity).toContain('.home-platform-v15 .store-home-products')
    expect(identity).toContain('grid-template-columns: repeat(3,minmax(0,1fr))')
  })

  test('mobile da home volta para uma coluna', () => {
    expect(identity).toContain('@media (max-width:600px)')
    expect(identity).toContain('.home-platform-v15 .store-home-products { grid-template-columns: 1fr;')
    expect(identity).toContain('.home-platform-v15 .store-home-mobile-heading { display: inline; }')
  })
})
