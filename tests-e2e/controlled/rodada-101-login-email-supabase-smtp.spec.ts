import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const loginPage = fs.readFileSync(path.join(root, 'web/app/login/page.tsx'), 'utf8')
const resetPage = fs.readFileSync(path.join(root, 'web/app/atualizar-senha/page.tsx'), 'utf8')
const styles = fs.readFileSync(path.join(root, 'web/app/globals.css'), 'utf8')

test('101 - login central mantém Google e entrada por email e senha', async () => {
  expect(loginPage).toContain('<SocialLogin profileType={null} returnTo={params.returnTo} />')
  expect(loginPage).toContain('supabase.auth.signInWithPassword')
  expect(loginPage).toContain('Entrar com e-mail')
  expect(loginPage).toContain('Esqueci minha senha')
  expect(loginPage).toContain('Criar conta')
})

test('101 - cadastro continua usando Supabase Auth e confirmação obrigatória', async () => {
  expect(loginPage).toContain('supabase.auth.signUp')
  expect(loginPage).toContain('supabase.auth.verifyOtp')
  expect(loginPage).toContain("setEmailMode('confirmar-cadastro')")
  expect(loginPage).toContain('supabase.auth.resend')
  expect(loginPage).toContain('Crie seu primeiro perfil')
})

test('101 - recuperação continua usando Supabase e atualização segura de senha', async () => {
  expect(loginPage).toContain('supabase.auth.resetPasswordForEmail')
  expect(loginPage).toContain("type: 'recovery'")
  expect(loginPage).toContain('supabase.auth.updateUser({ password })')
  expect(resetPage).toContain("window.location.replace('/login?recovery=1')")
})

test('101 - senha segue a política configurada no Supabase', async () => {
  expect(loginPage).toContain('password.length < 8')
  expect(loginPage).toContain('/[a-z]/')
  expect(loginPage).toContain('/[A-Z]/')
  expect(loginPage).toContain('/\\d/')
})

test('101 - estilos permanecem no bloco original do login', async () => {
  expect(styles).toContain('.login-email-form{ display: grid; gap: 12px;')
  expect(styles).toContain('.login-otp-field{ display: grid; gap: 7px;')
  expect(fs.existsSync(path.join(root, 'web/app/atualizar-senha/atualizar-senha.css'))).toBe(false)
})
