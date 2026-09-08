import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('cadastro usa o fluxo nativo sem consultar a existência do e-mail', () => {
  const source = read('web/app/login/page.tsx')

  expect(source).toContain('supabase.auth.signUp({')
  expect(source).not.toContain('/api/auth/email-status')
  expect(source).not.toContain('emailStatus?.exists')
})

test('resposta de cadastro não revela se a conta já existe', () => {
  const source = read('web/app/login/page.tsx')

  expect(source).toContain('Se este e-mail puder ser cadastrado, enviaremos um código de 6 dígitos')
  expect(source).toContain('setShowEmailAccessHelp(true)')
  expect(source).toContain('Entrar com este e-mail')
  expect(source).toContain('Recuperar senha')
})

test('rota administrativa de enumeração de e-mail não faz parte da aplicação', () => {
  expect(fs.existsSync(path.join(root, 'web/app/api/auth/email-status/route.ts'))).toBe(false)
})

test('tela mantém ações responsivas de acesso após cadastro', () => {
  const css = read('web/app/globals.css')

  expect(css).toContain('.login-existing-account-actions{')
  expect(css).toContain('grid-template-columns:repeat(2,minmax(0,1fr))')
  expect(css).toMatch(/\.login-email-actions,\.login-existing-account-actions\{grid-template-columns:1fr\}/)
})
