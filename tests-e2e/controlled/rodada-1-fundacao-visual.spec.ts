import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const css = fs.readFileSync(path.join(root, 'web/app/globals.css'), 'utf8')

test('1 - fundacao premium nasce separada dos tokens legados', async () => {
  expect(css).toContain('--ui-bg: #0c0d0f')
  expect(css).toContain('--ui-surface: #141518')
  expect(css).toContain('--ui-text: #f5f3ed')
  expect(css).toContain('--ui-accent: #c9b766')
})

test('1 - cantos sao discretos e sombra nao faz parte da linguagem base', async () => {
  expect(css).toContain('--ui-radius-sm: 6px')
  expect(css).toContain('--ui-radius-md: 10px')
  expect(css).toContain('--ui-radius-lg: 14px')
  expect(css).toContain('--ui-shadow: none')
})

test('1 - espacamento possui escala unica para construir hierarquia sem caixas', async () => {
  expect(css).toContain('--ui-space-1: 4px')
  expect(css).toContain('--ui-space-4: 16px')
  expect(css).toContain('--ui-space-7: 48px')
})
