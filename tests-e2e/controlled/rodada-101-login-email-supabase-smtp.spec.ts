import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const loginPage = fs.readFileSync(path.join(root, 'web/app/login/page.tsx'), 'utf8')
const resetPage = fs.readFileSync(path.join(root, 'web/app/atualizar-senha/page.tsx'), 'utf8')
const styles = fs.readFileSync(path.join(root, 'web/app/globals.css'), 'utf8')

test('101 - login central mantém Google e adiciona entrada por email e senha', async () => {
  expect(loginPage).toContain('<SocialLogin profileType={null} returnTo={params.returnTo} />')
  expect(loginPage).toContain('supabase.auth.signInWithPassword')
  expect(loginPage).toContain('Entrar com e-mail')
  expect(loginPage).toContain('Ainda não tem conta?')
})

test('101 - cadastro usa confirmação nativa do Supabase e não recria perfil antes do email ser confirmado', async () => {
  expect(loginPage).toContain('supabase.auth.signUp')
  expect(loginPage).toContain('emailRedirectTo: `${window.location.origin}/login?complete=1`')
  expect(loginPage).toContain("setEmailMode('confirmacao-enviada')")
  expect(loginPage).toContain("supabase.auth.resend")
  expect(loginPage).toContain('Crie seu primeiro perfil')
})

test('101 - recuperação envia link para a rota oficial de atualização de senha', async () => {
  expect(loginPage).toContain('supabase.auth.resetPasswordForEmail')
  expect(loginPage).toContain('`${window.location.origin}/atualizar-senha`')
  expect(resetPage).toContain("event === 'PASSWORD_RECOVERY'")
  expect(resetPage).toContain('supabase.auth.updateUser({ password })')
  expect(resetPage).toContain("window.location.assign('/login?passwordUpdated=1')")
})

test('101 - senha segue a política configurada no Supabase', async () => {
  for (const source of [loginPage, resetPage]) {
    expect(source).toContain('password.length < 8')
    expect(source).toContain('/[a-z]/')
    expect(source).toContain('/[A-Z]/')
    expect(source).toContain('/\\d/')
  }
})

test('101 - estilos ficam no bloco original do login sem criar folha paralela', async () => {
  expect(styles).toContain('.login-email-form{ display: grid; gap: 12px;')
  expect(styles).toContain('.password-reset-card{ position: relative;')
  expect(fs.existsSync(path.join(root, 'web/app/atualizar-senha/atualizar-senha.css'))).toBe(false)
})
