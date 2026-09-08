import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = process.cwd()
const homeFile = path.join(root, 'web/features/dropzone/DropZoneHome.tsx')

test.describe('Home — painéis privados sob demanda', () => {
  test('não inclui todos os painéis operacionais no carregamento inicial', () => {
    const source = fs.readFileSync(homeFile, 'utf8')

    expect(source).toContain("import dynamic from 'next/dynamic'")
    expect(source).not.toMatch(/^import \{ (EquipePanel|JogadorPanel|ManagerPanel|ProdutoraPanel|BroadcastPanel) \}/m)

    for (const panel of ['ProdutoraPanel', 'EquipePanel', 'JogadorPanel', 'ManagerPanel', 'BroadcastPanel']) {
      expect(source).toContain(`const ${panel} = dynamic(`)
    }
  })

  test('mantém PDF e ZIP fora do manifesto inicial da home compilada', () => {
    const manifestFile = path.join(root, 'web/.next/server/app/page_client-reference-manifest.js')
    test.skip(!fs.existsSync(manifestFile), 'O manifesto existe somente depois do build de produção.')

    const manifest = fs.readFileSync(manifestFile, 'utf8')
    const chunkNames = [...new Set(manifest.match(/static\/chunks\/[A-Za-z0-9_-]+\.js/g) || [])]
    const initialCode = chunkNames
      .map((chunk) => fs.readFileSync(path.join(root, 'web/.next', chunk), 'utf8'))
      .join('\n')

    expect(initialCode).not.toContain('jspdf')
    expect(initialCode).not.toContain('JSZip')
  })
})
