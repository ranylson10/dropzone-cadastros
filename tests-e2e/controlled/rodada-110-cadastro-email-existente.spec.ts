import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('cadastro consulta o backend antes de chamar signUp', () => {
  const source = read('web/app/login/page.tsx')
  const statusCheck = source.indexOf("fetch('/api/auth/email-status'")
  const signUp = source.indexOf('supabase.auth.signUp({')

  expect(statusCheck).toBeGreaterThan(-1)
  expect(signUp).toBeGreaterThan(statusCheck)
  expect(source).toContain("if (emailStatus?.exists)")
})

test('e-mail existente não avança falsamente para o OTP', () => {
  const source = read('web/app/login/page.tsx')

  expect(source).toContain('Este e-mail já possui uma conta no DropZone. Entre com sua senha ou recupere o acesso.')
  expect(source).toContain('setExistingEmailDetected(true)')
  expect(source).toContain('Entrar com este e-mail')
  expect(source).toContain('Recuperar senha')
})

test('verificação do e-mail acontece somente no servidor com supabaseAdmin', () => {
  const route = read('web/app/api/auth/email-status/route.ts')

  expect(route).toContain("import { supabaseAdmin } from '@backend/shared/supabase-admin'")
  expect(route).toContain('supabaseAdmin.auth.admin.listUsers')
  expect(route).toContain("email?.trim().toLowerCase() === email")
  expect(route).toContain("'Cache-Control': 'no-store'")
})

test('tela mantém ações responsivas para conta existente', () => {
  const css = read('web/app/globals.css')

  expect(css).toContain('.login-existing-account-actions{')
  expect(css).toContain('grid-template-columns:repeat(2,minmax(0,1fr))')
  expect(css).toContain('@media(max-width:700px){.login-existing-account-actions{grid-template-columns:1fr}}')
})
