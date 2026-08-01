import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const css = fs.readFileSync(path.join(root, 'web/app/globals.css'), 'utf8')

test.describe('Rodada 87B.1 — lista de campeonatos com rolagem independente', () => {
  test('mantém ações visíveis e rola somente a lista no desktop', () => {
    expect(css).toContain('.championship-nav-card')
    expect(css).toContain('grid-template-rows: auto auto minmax(0, 1fr) auto auto')
    expect(css).toContain('max-height: calc(100vh - 112px)')
    expect(css).toContain('.championship-nav-card .championship-list')
    expect(css).toContain('overflow-y: auto')
    expect(css).toContain('overscroll-behavior: contain')
  })
})
