import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 88H — ajustes visuais finos compartilhados', () => {
  test('posição e escala do bloco principal existem uma única vez no pacote', () => {
    const types = source('web/features/campeonatos/stream/types/stream-package.types.ts')
    expect(types).toContain('StreamSharedLayoutConfig')
    expect(types).toContain('offsetX: number')
    expect(types).toContain('offsetY: number')
    expect(types).toContain('widthScale: number')
    expect(types).toContain('heightScale: number')
  })

  test('renderer aplica ajuste global sobre o perfil estrutural sem substituir o catálogo', () => {
    const stage = source('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
    expect(stage).toContain('layout.content.x + sharedLayout.offsetX')
    expect(stage).toContain('layout.content.y + sharedLayout.offsetY')
    expect(stage).toContain('layout.content.width * sharedLayout.widthScale')
    expect(stage).toContain('layout.content.height * sharedLayout.heightScale')
  })

  test('tabelas compartilham proporções de logo estatística pontos e cabeçalho', () => {
    const types = source('web/features/campeonatos/stream/types/stream-package.types.ts')
    const stage = source('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
    expect(types).toContain('headerHeight: number')
    expect(types).toContain('logoWidth: number')
    expect(types).toContain('statWidth: number')
    expect(types).toContain('pointsWidth: number')
    expect(stage).toContain('--stream-package-logo-width')
    expect(stage).toContain('--stream-package-points-width')
  })

  test('alinhamento do nome é compartilhado entre as tabelas', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
    const css = source('web/features/campeonatos/stream/stream.css')
    expect(editor).toContain('Alinhamento do nome')
    expect(editor).toContain("patchTable({ nameAlign:")
    expect(css).toContain('var(--stream-package-name-justify)')
  })

  test('cards possuem distribuição por linha alinhamento e escala de logo compartilhados', () => {
    const types = source('web/features/campeonatos/stream/types/stream-package.types.ts')
    const stage = source('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
    expect(types).toContain('columns: number')
    expect(types).toContain("align: 'start' | 'center' | 'end'")
    expect(types).toContain('logoScale: number')
    expect(stage).toContain('maxRowWidth')
    expect(stage).toContain('--stream-package-card-logo-scale')
  })

  test('normalização preserva layout compartilhado antigo e novo sem criar outra origem', () => {
    const config = source('web/features/campeonatos/stream/services/stream-package-config.ts')
    const editor = source('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
    expect(config).toContain('DEFAULT_STREAM_PACKAGE_SHARED_CONFIG.layout')
    expect(config).toContain('rawShared.layout')
    expect(editor).toContain('resolveStreamLayoutConfig')
    expect(editor).toContain("{ id: 'layout', label: 'Layout'")
  })
})
