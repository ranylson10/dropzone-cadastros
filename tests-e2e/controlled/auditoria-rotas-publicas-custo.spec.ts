import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('endpoints públicos de escrita têm decisão de segurança explícita', () => {
  const classification = JSON.parse(read('database/api-route-security-classification.json'))
  const expected = [
    '/api/auth/login',
    '/api/auth/verification/confirm-reset',
    '/api/auth/verification/request',
    '/api/currency/quote',
    '/api/desktop/auth/google/start',
    '/api/i18n/translate',
  ]

  for (const route of expected) {
    expect(classification.routes[route]?.decision).toMatch(/^public-/)
    expect(classification.routes[route]?.reason.length).toBeGreaterThan(30)
  }
})

test('cotação reaproveita a taxa externa por cinco minutos', () => {
  const source = read('web/features/lili/currency.ts')

  expect(source).toContain('next: { revalidate: 300 }')
  expect(source).not.toContain("cache: 'no-store'")
})

test('tradução limita custo e memória do controle por cliente', () => {
  const source = read('web/app/api/i18n/translate/route.ts')

  expect(source).toContain('const RATE_LIMIT = 30')
  expect(source).toContain('const MAX_RATE_KEYS = 2_000')
  expect(source).toContain('while (requests.size >= MAX_RATE_KEYS)')
  expect(source).toContain('while (cache.size > 5000)')
})
