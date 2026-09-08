import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const compact = (value: string) => value.replace(/\s+/g, '')

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
  expect(compact(css)).toContain('.login-account-action.recovery{border:1pxsolidrgba(255,255,255,.11);background:transparent;color:#9ca3ad}')
  expect(compact(css)).toContain('.login-account-action.create{border:1pxsolid#dfcf85;background:#dfcf85;color:#11151a}')
})

test('google fica abaixo do divisor e visualmente discreto', () => {
  const source = read('web/app/login/page.tsx')
  const css = read('web/app/globals.css')

  expect(source).toContain('<div className="login-auth-divider login-auth-divider-secondary"><span>ou</span></div>')
  expect(compact(css)).toContain('.login-auth-divider-secondary{margin:20px012px}.login-social-secondary{margin-bottom:2px}')
  expect(compact(css)).toContain('.login-auth-step.social-login-button{width:100%;min-height:46px;border:1pxsolidrgba(223,207,133,.22);border-radius:0;background:#151a21;color:#d5d0c6')
})
