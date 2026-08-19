import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const loginPage = fs.readFileSync(path.join(root, 'web/app/login/page.tsx'), 'utf8')
const styles = fs.readFileSync(path.join(root, 'web/app/globals.css'), 'utf8')
const smoke = fs.readFileSync(path.join(root, 'scripts/testes/test-auth-email-delivery.mjs'), 'utf8')
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

test('103 - login por e-mail e senha aparece antes do Google', async () => {
  const formIndex = loginPage.indexOf('<form className="login-email-form"')
  const socialIndex = loginPage.indexOf('<div className="login-social-secondary">')
  expect(formIndex).toBeGreaterThan(-1)
  expect(socialIndex).toBeGreaterThan(formIndex)
  expect(loginPage).toContain('o acesso com Google continua disponível como alternativa')
})

test('103 - entrar com e-mail é a ação primária visual', async () => {
  expect(styles).toContain('.login-email-primary{ min-height: 56px;')
  expect(styles).toContain('background: var(--dz-accent, #ff5468);')
  expect(loginPage).toContain("'Entrar com e-mail'")
})

test('103 - criar conta e recuperar senha ficam visíveis como ações próprias', async () => {
  expect(loginPage).toContain('className="login-account-action recovery"')
  expect(loginPage).toContain('Esqueci minha senha')
  expect(loginPage).toContain('className="login-create-account"')
  expect(loginPage).toContain('Criar conta')
  expect(styles).toContain('.login-email-actions{')
})

test('103 - Google fica visualmente secundário abaixo do divisor', async () => {
  expect(loginPage).toContain('login-auth-divider login-auth-divider-secondary')
  expect(loginPage).toContain('<span>ou</span>')
  expect(loginPage).toContain('login-social-secondary')
  expect(styles).toContain('.login-social-secondary{')
  expect(styles).toContain('background: transparent; color: #3f4853;')
})

test('103 - ações auxiliares continuam compactas no mobile', async () => {
  expect(styles).toContain('.login-email-actions{ grid-template-columns: 1fr;')
})

test('103 - smoke test real verifica Supabase, Resend e evento de entrega sem gravar segredo', async () => {
  expect(packageJson.scripts['test:auth-email']).toBe('node scripts/testes/test-auth-email-delivery.mjs')
  expect(smoke).toContain("fetch(`${supabaseUrl}/auth/v1/recover`")
  expect(smoke).toContain("fetch('https://api.resend.com/emails'")
  expect(smoke).toContain("new Set(['delivered', 'opened', 'clicked'])")
  expect(smoke).toContain('DROPZONE_EMAIL_SMOKE_ADDRESS')
  expect(smoke).toContain('RESEND_AUDIT_API_KEY')
  expect(smoke).not.toMatch(/re_[A-Za-z0-9_-]{16,}/)
})
