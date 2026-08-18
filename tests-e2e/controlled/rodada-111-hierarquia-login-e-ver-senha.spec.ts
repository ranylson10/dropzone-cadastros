import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('campo de senha possui controle acessível para mostrar e ocultar', () => {
  const source = read('web/app/login/page.tsx')

  expect(source).toContain("Eye, EyeOff")
  expect(source).toContain("type={showPassword ? 'text' : 'password'}")
  expect(source).toContain("aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}")
  expect(source).toContain("onClick={() => setShowPassword((value) => !value)}")
  expect(source).toContain("type={showConfirmPassword ? 'text' : 'password'}")
})

test('entrada por email continua sendo a ação principal', () => {
  const source = read('web/app/login/page.tsx')

  expect(source).toContain('className="login-email-primary"')
  expect(source).toContain("'Entrar com e-mail'")
  expect(source.indexOf('login-email-primary')).toBeLessThan(source.indexOf('login-social-secondary'))
})

test('recuperação e criação viram ações secundárias', () => {
  const source = read('web/app/login/page.tsx')
  const css = read('web/app/globals.css')

  expect(source).toContain('Ainda não tem conta?')
  expect(source).toContain('Esqueci minha senha')
  expect(css).toContain('.login-account-action.recovery{ color: #69717b; text-decoration: underline;')
  expect(css).toContain('.login-create-account button{ border: 0; background: transparent;')
})

test('google fica menor e visualmente discreto', () => {
  const source = read('web/app/login/page.tsx')
  const css = read('web/app/globals.css')

  expect(source).toContain('<div className="login-auth-divider login-auth-divider-secondary"><span>ou</span></div>')
  expect(css).toContain('.login-social-secondary .social-login-stack{ width:min(300px,100%);')
  expect(css).toContain('.login-social-secondary .social-login-button{ min-height:40px; font-size:9px; background:transparent;')
})
