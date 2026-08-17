import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const loginPage = fs.readFileSync(path.join(root, 'web/app/login/page.tsx'), 'utf8')
const resetPage = fs.readFileSync(path.join(root, 'web/app/atualizar-senha/page.tsx'), 'utf8')
const styles = fs.readFileSync(path.join(root, 'web/app/globals.css'), 'utf8')

test('102 - cadastro confirma conta com código OTP de 6 dígitos dentro do DropZone', async () => {
  expect(loginPage).toContain("setEmailMode('confirmar-cadastro')")
  expect(loginPage).toContain("type: 'email'")
  expect(loginPage).toContain("token: otpCode")
  expect(loginPage).toContain("/^\\d{6}$/.test(otpCode)")
  expect(loginPage).toContain('Código de 6 dígitos')
  expect(loginPage).toContain('Confirmar conta')
})

test('102 - cadastro não depende mais de link ou redirect de confirmação', async () => {
  expect(loginPage).not.toContain('emailRedirectTo:')
  expect(loginPage).not.toContain("confirmacao-enviada")
  expect(loginPage).not.toContain('Abra o e-mail para ativar sua conta')
})

test('102 - reenvio do cadastro usa resend nativo do Supabase', async () => {
  expect(loginPage).toContain("async function resendCode(kind: 'signup' | 'recovery')")
  expect(loginPage).toContain("type: 'signup'")
  expect(loginPage).toContain("void resendCode('signup')")
  expect(loginPage).toContain('Reenviar código')
})

test('102 - recuperação envia código e valida OTP recovery no próprio login', async () => {
  expect(loginPage).toContain('supabase.auth.resetPasswordForEmail(normalizedEmail)')
  expect(loginPage).toContain("setEmailMode('confirmar-recuperacao')")
  expect(loginPage).toContain("type: 'recovery'")
  expect(loginPage).toContain("void resendCode('recovery')")
  expect(loginPage).toContain('Enviar código de recuperação')
})

test('102 - nova senha só é liberada depois da validação do código', async () => {
  const verifyRecoveryIndex = loginPage.indexOf("type: 'recovery'")
  const newPasswordIndex = loginPage.indexOf("setEmailMode('nova-senha')")
  const updatePasswordIndex = loginPage.indexOf('supabase.auth.updateUser({ password })')
  expect(verifyRecoveryIndex).toBeGreaterThan(-1)
  expect(newPasswordIndex).toBeGreaterThan(verifyRecoveryIndex)
  expect(updatePasswordIndex).toBeGreaterThan(newPasswordIndex)
  expect(loginPage).toContain('Código confirmado. Agora defina sua nova senha.')
})

test('102 - rota antiga de atualizar senha redireciona para recuperação por código', async () => {
  expect(resetPage).toContain("window.location.replace('/login?recovery=1')")
  expect(resetPage).not.toContain("event === 'PASSWORD_RECOVERY'")
  expect(resetPage).not.toContain('supabase.auth.updateUser')
})

test('102 - campo OTP usa teclado numérico e estilo existente do login', async () => {
  expect(loginPage).toContain('inputMode="numeric"')
  expect(loginPage).toContain('autoComplete="one-time-code"')
  expect(loginPage).toContain('maxLength={6}')
  expect(styles).toContain('.login-otp-field input{')
  expect(styles).toContain('letter-spacing: .34em;')
  expect(styles).not.toContain('.password-reset-card{')
})
