import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 88I — presets estruturais compartilhados do pacote', () => {
  test('presets de tabela ficam centralizados e reutilizam a configuração compartilhada', () => {
    const types = source('web/features/campeonatos/stream/types/stream-package.types.ts')
    expect(types).toContain('STREAM_TABLE_PRESETS')
    expect(types).toContain("key: 'compact'")
    expect(types).toContain("key: 'broadcast'")
    expect(types).toContain("key: 'double'")
    expect(types).toContain('values: StreamSharedTableConfig')
  })

  test('presets de card ficam centralizados e não criam configuração por overlay', () => {
    const types = source('web/features/campeonatos/stream/types/stream-package.types.ts')
    expect(types).toContain('STREAM_CARD_PRESETS')
    expect(types).toContain("key: 'hero'")
    expect(types).toContain('values: StreamSharedCardConfig')
    expect(types).not.toContain('tablePresetByOverlay')
    expect(types).not.toContain('cardPresetByOverlay')
  })

  test('editor aplica preset substituindo a origem compartilhada da tabela', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
    expect(editor).toContain('function applyTablePreset')
    expect(editor).toContain('table: structuredClone(preset.values)')
    expect(editor).toContain('Presets de tabela')
  })

  test('editor aplica preset substituindo a origem compartilhada dos cards', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
    expect(editor).toContain('function applyCardPreset')
    expect(editor).toContain('card: structuredClone(preset.values)')
    expect(editor).toContain('Presets de cards')
  })

  test('presets são atalhos visuais e não exigem nova tabela ou migration', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
    const types = source('web/features/campeonatos/stream/types/stream-package.types.ts')
    expect(editor).toContain('Escolha uma base pronta e ajuste somente se precisar.')
    expect(types).not.toContain('preset_id')
    expect(types).not.toContain('presetId')
  })

  test('layout dos presets é responsivo e fica dentro do editor do pacote', () => {
    const css = source('web/features/campeonatos/stream/stream.css')
    expect(css).toContain('.stream-package-preset-grid')
    expect(css).toContain('@media(max-width:720px)')
    expect(css).toContain('.stream-package-preset-card')
  })
})
