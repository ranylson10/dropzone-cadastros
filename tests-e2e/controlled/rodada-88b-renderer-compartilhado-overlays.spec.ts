import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 88B — renderer compartilhado do pacote de overlays', () => {
  test('renderer único cobre imagem solta, texto solto, tabela, cards e hero', () => {
    const stage = source('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
    expect(stage).toContain('StreamPackageStage')
    expect(stage).toContain('TableRenderer')
    expect(stage).toContain('CardRenderer')
    expect(stage).toContain('HeroRenderer')
    expect(stage).toContain('looseImage')
    expect(stage).toContain('looseText')
  })

  test('tabelas reutilizam os mesmos assets do pacote por papel de coluna', () => {
    const stage = source('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
    for (const asset of ['table_row_bg', 'table_rank_bg', 'table_logo_bg', 'table_name_bg', 'table_stat_bg', 'table_points_bg']) {
      expect(stage).toContain(`'${asset}'`)
    }
    expect(stage).toContain("mode === 'single'")
    expect(stage).toContain('Math.ceil(items.length / 2)')
  })

  test('editor usa o renderer compartilhado no preview e permite escolher colunas', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
    expect(editor).toContain('StreamPackageStage')
    expect(editor).toContain('Preview ao vivo do editor')
    expect(editor).toContain('Campos exibidos')
    expect(editor).toContain('STREAM_OVERLAY_COLUMN_META')
  })

  test('modelo centraliza metadados das colunas em vez de duplicar configuração por overlay', () => {
    const types = source('web/features/campeonatos/stream/types/stream-package.types.ts')
    expect(types).toContain('STREAM_OVERLAY_COLUMN_META')
    expect(types).toContain("rank: { label: 'RK'")
    expect(types).toContain("points: { label: 'PTS'")
    expect(types).toContain("map: { label: 'Mapa'")
  })
})
