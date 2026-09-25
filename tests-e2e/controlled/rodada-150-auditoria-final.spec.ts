import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

const appShell = read('web/components/layout/AppShell.tsx')
const appHeader = read('web/components/layout/AppHeader.tsx')
const headerCss = read('web/app/header.css')
const liliRoute = read('web/app/api/lili/chat/route.ts')
const liliPage = read('web/app/lili/page.tsx')
const loginPage = read('web/app/login/page.tsx')
const authState = read('web/lib/auth-client-state.ts')
const producerPanel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
const nextConfig = read('web/next.config.ts')
const serviceRoleClassification = read('database/service-role-classification.json')
const crudAudit = read('scripts/testes/modulos/13-cobertura-crud.mjs')

test.describe('Rodada 150 — auditoria final de performance, mobile, segurança e consistência', () => {
  test('Lili não reabre criação pública de produtora', () => {
    expect(liliRoute).not.toContain("id: 'setup-producer'")
    expect(liliRoute).not.toContain('cadastro=produtora')
    expect(liliRoute).toContain('Workspaces de produtora são privados')
    expect(liliRoute).toContain('convite da administração')
  })

  test('shell global preserva o workspace exato e não apenas o tipo de perfil', () => {
    expect(appShell).toContain("localStorage.getItem('dropzone_active_profile_id')")
    expect(appShell).toContain("'X-Profile-Id': preferredId")
    expect(appShell).toContain('item.id === preferredId')
    expect(appShell).toContain("localStorage.setItem('dropzone_active_profile_id', webAccount.id)")
    expect(appShell).toContain("localStorage.setItem('dropzone_active_profile_id', next.id)")
  })

  test('Lili também mantém o workspace ativo exato', () => {
    expect(liliPage).toContain("localStorage.getItem('dropzone_active_profile_id')")
    expect(liliPage).toContain("'X-Profile-Id': preferredId")
    expect(liliPage).toContain('item.id === preferredId')
    expect(liliPage).toContain("localStorage.setItem('dropzone_active_profile_id', next.id)")
  })

  test('login prioriza perfil_id do retorno e persiste o id selecionado', () => {
    expect(loginPage).toContain("searchParams.get('perfil_id')")
    expect(loginPage).toContain('item.id === requestedId')
    expect(loginPage).toContain('item.id === storedId')
    expect(loginPage).toContain("localStorage.setItem('dropzone_active_profile_id', account.id)")
  })

  test('logout limpa o id do workspace ativo', () => {
    expect(authState).toContain("'dropzone_active_profile_id'")
  })

  test('atalhos rápidos levam para áreas privadas em vez do marketplace público', () => {
    expect(appHeader).toContain("href: '/?painel=1&section=campeonatos'")
    expect(appHeader).toContain("href: '/?painel=1&section=competicoes'")
    expect(appHeader).toContain("label: 'Minhas competições'")
  })

  test('workspace da produtora aceita deep link das cinco áreas principais', () => {
    expect(producerPanel).toContain("['visao', 'campeonatos', 'financeiro', 'equipe', 'configuracoes']")
    expect(producerPanel).toContain("setProducerSection(nextSection)")
    expect(producerPanel).toContain('hasSelectedChampionship && section')
    expect(producerPanel).toContain("setProducerSection('campeonatos')")
  })

  test('mensagens comuns não expõem chave Stream como conceito de produto', () => {
    expect(producerPanel).not.toContain('chave Stream bloqueados')
    expect(producerPanel).toContain('integrações técnicas permanecem bloqueadas')
  })

  test('Next envia cabeçalhos defensivos sem bloquear integrações por CSP rígida', () => {
    expect(nextConfig).toContain("X-Content-Type-Options")
    expect(nextConfig).toContain("Referrer-Policy")
    expect(nextConfig).toContain("X-Frame-Options")
    expect(nextConfig).toContain("Permissions-Policy")
    expect(nextConfig).not.toContain('Content-Security-Policy')
  })

  test('shell possui atalho de teclado para pular ao conteúdo', () => {
    expect(appShell).toContain('className="app-skip-link"')
    expect(appShell).toContain('Pular para o conteúdo')
    expect(appShell).toContain('tabIndex={-1}')
    expect(headerCss).toContain('.app-skip-link:focus')
  })

  test('auditoria documenta os dois usos legítimos de service role antes marcados como suspeitos', () => {
    expect(serviceRoleClassification).toContain('"api/account/username"')
    expect(serviceRoleClassification).toContain('"public-availability-check"')
    expect(serviceRoleClassification).toContain('"api/me/account"')
    expect(serviceRoleClassification).toContain('"self-scoped-account"')
  })

  test('convite de produtora por token não é tratado como CRUD incompleto', () => {
    expect(crudAudit).toContain('produtora\\/convites')
    expect(crudAudit).toContain('isTokenWorkflowRoute')
  })
})
