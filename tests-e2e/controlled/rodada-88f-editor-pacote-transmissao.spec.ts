import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 88F — editor real do pacote de transmissão', () => {
  test('editor organiza overlays, configuração compartilhada e preview no mesmo workbench', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
    expect(editor).toContain('Editor de transmissão')
    expect(editor).toContain('Overlays do pacote')
    expect(editor).toContain('EDITOR_PANELS')
    expect(editor).toContain('stream-package-editor-grid')
    expect(editor).toContain('StreamPackageStage')
    expect(editor).toContain('Preview ao vivo do editor')
  })

  test('configurações compartilhadas aparecem uma vez por categoria', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
    expect(editor).toContain('Identidade compartilhada')
    expect(editor).toContain('Kit visual compartilhado')
    expect(editor).toContain('Tabelas compartilhadas')
    expect(editor).toContain('Cards compartilhados')
    expect(editor).toContain('Animação compartilhada')
    expect(editor).toContain('Envie cada arte uma única vez')
  })

  test('cena individual mantém somente seleção, título, limite, layout e campos', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
    expect(editor).toContain('Configuração individual')
    expect(editor).toContain('Somente regras que realmente mudam nesta cena')
    expect(editor).toContain('Máximo de itens')
    expect(editor).toContain('Distribuição desta tabela')
    expect(editor).toContain('Campos exibidos')
    expect(editor).toContain('Restaurar padrão')
  })

  test('enabled_overlay_types é a única origem de ativação das overlays', () => {
    const types = source('web/features/campeonatos/stream/types/stream-package.types.ts')
    const editor = source('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
    expect(types).not.toContain('enabled?: boolean')
    expect(editor).toContain('enabled_overlay_types')
    expect(editor).toContain('setOverlayEnabled')
  })

  test('layout mantém responsividade sem criar editor alternativo', () => {
    const css = source('web/features/campeonatos/stream/stream.css')
    expect(css).toContain('.stream-package-workbench')
    expect(css).toContain('.stream-package-scenes')
    expect(css).toContain('.stream-package-preview-column')
    expect(css).toContain('@media(max-width:1120px)')
    expect(css).toContain('@media(max-width:700px)')
  })
})
