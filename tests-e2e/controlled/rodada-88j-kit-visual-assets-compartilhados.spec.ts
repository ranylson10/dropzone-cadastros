import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 88J — kit visual e assets compartilhados', () => {
  test('assets continuam armazenados uma única vez no pacote', () => {
    const types = source('web/features/campeonatos/stream/types/stream-package.types.ts')
    expect(types).toContain('assets: Partial<Record<StreamPackageAssetKey, string>>')
    expect(types).not.toContain('assetsByOverlay')
    expect(types).not.toContain('overlayAssets')
  })

  test('editor trata arquivos como kit visual compartilhado', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
    expect(editor).toContain("label: 'Kit visual'")
    expect(editor).toContain('Kit visual compartilhado')
    expect(editor).toContain('Nenhuma overlay cria cópia própria do arquivo.')
  })

  test('cada papel visual informa quais overlays o reutilizam', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
    expect(editor).toContain('function assetUsageOverlays')
    expect(editor).toContain('STREAM_SYSTEM_OVERLAY_META[type].structure === asset.usage')
    expect(editor).toContain('Usado por {usedBy.length} overlays')
  })

  test('uso ativo do asset acompanha as overlays selecionadas no pacote', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
    expect(editor).toContain('const activeUsedBy = usedBy.filter')
    expect(editor).toContain('pack.enabled_overlay_types.includes(type)')
    expect(editor).toContain('{activeUsedBy.length} ativas')
  })

  test('troca de arte reaproveita o mesmo asset key sem upload por overlay', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
    expect(editor).toContain('[key]: url')
    expect(editor).toContain("pack.assets[asset.key] ? 'Trocar arte' : 'Enviar arte'")
    expect(editor).not.toContain('uploadAsset(activeType')
  })

  test('kit visual possui layout responsivo próprio dentro do editor existente', () => {
    const css = source('web/features/campeonatos/stream/stream.css')
    expect(css).toContain('.stream-package-asset-summary')
    expect(css).toContain('.stream-package-asset-usage-list')
    expect(css).toContain('.stream-package-asset-kit')
    expect(css).toContain('@media(max-width:700px)')
  })
})
