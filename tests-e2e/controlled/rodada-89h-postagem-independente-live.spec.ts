import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

const editor = read('web/features/campeonatos/stream/components/StreamOutputLayoutsEditor.tsx')
const types = read('web/features/campeonatos/stream/types/stream-package.types.ts')
const config = read('web/features/campeonatos/stream/services/stream-package-config.ts')
const css = read('web/features/campeonatos/stream/stream.css')

test.describe('Rodada 89H — postagem independente da overlay de live', () => {
  test('área salva se herda ou não a configuração da live', () => {
    expect(types).toContain('inheritFromLive: boolean')
    expect(config).toContain('inheritFromLive: row.inheritFromLive !== false')
  })

  test('compatibilidade mantém layouts antigos herdando da live', () => {
    expect(config).toContain('row.inheritFromLive !== false')
    expect(editor).toContain('inheritFromLive: true')
  })

  test('editor permite desvincular e voltar a herdar', () => {
    expect(editor).toContain('Desvincular da live')
    expect(editor).toContain('Voltar a herdar da live')
    expect(editor).toContain('makeAreaIndependent')
    expect(editor).toContain('inheritAreaFromLive')
  })

  test('desvincular cria snapshot visual e não usa overlay de live como base', () => {
    expect(editor).toContain('resolveStreamLayoutConfig')
    expect(editor).toContain('resolveStreamTableConfig')
    expect(editor).toContain('resolveStreamCardConfig')
    expect(editor).toContain('resolveStreamLooseImageConfig')
    expect(editor).toContain('resolveStreamLooseTextConfig')
    expect(editor).toContain('assets: {}')
    expect(editor).toContain('shared_config: DEFAULT_STREAM_PACKAGE_SHARED_CONFIG')
  })

  test('editor local continua explícito e separado da live', () => {
    expect(editor).toContain('Editor desta postagem')
    expect(editor).toContain('Configuração própria. Mudanças na live não alteram esta postagem.')
    expect(css).toContain('89H — independência visual das postagens')
  })
})
