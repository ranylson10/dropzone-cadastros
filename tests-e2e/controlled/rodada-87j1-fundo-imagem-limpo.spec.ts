import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 87J1 — fundo de imagem limpo', () => {
  test('imagem não recebe fundo preto automático', () => {
    const style = source('web/features/campeonatos/stream/utils/stream-style.ts')
    expect(style).toContain("fill.useFallbackColor ? fill.fallbackColor || '#000000' : 'transparent'")
  })

  test('upload desliga cor de apoio e escurecimento', () => {
    const panel = source('web/features/campeonatos/stream/components/editor/StylePanels.tsx')
    expect(panel).toContain('useFallbackColor: false')
    expect(panel).toContain('overlayOpacity: 0')
  })

  test('cor atrás da imagem é uma escolha explícita', () => {
    const types = source('web/features/campeonatos/stream/types/stream.types.ts')
    const panel = source('web/features/campeonatos/stream/components/editor/StylePanels.tsx')
    expect(types).toContain('useFallbackColor?: boolean')
    expect(panel).toContain('Usar cor de apoio')
  })
})
