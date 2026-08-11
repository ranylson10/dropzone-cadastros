import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 88G — layouts estruturais compartilhados das overlays', () => {
  test('posicionamento estrutural fica centralizado no catálogo do sistema', () => {
    const types = source('web/features/campeonatos/stream/types/stream-package.types.ts')
    expect(types).toContain('STREAM_SYSTEM_OVERLAY_LAYOUTS')
    expect(types).toContain("variant: 'ranking'")
    expect(types).toContain("variant: 'map-card'")
    expect(types).toContain("variant: 'player-card'")
    expect(types).toContain("variant: 'logo-card'")
    expect(types).toContain("variant: 'next-round'")
    expect(types).toContain("variant: 'champion'")
  })

  test('renderer continua único e recebe o perfil estrutural do tipo', () => {
    const stage = source('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
    expect(stage).toContain('STREAM_SYSTEM_OVERLAY_LAYOUTS')
    expect(stage).toContain('layout.content.x')
    expect(stage).toContain('layout.content.y')
    expect(stage).toContain('layout.content.width')
    expect(stage).toContain('layout.content.height')
    expect(stage).toContain('TableRenderer')
    expect(stage).toContain('CardRenderer')
    expect(stage).toContain('HeroRenderer')
  })

  test('tabela mantém distribuição compartilhada de uma ou duas colunas', () => {
    const stage = source('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
    expect(stage).toContain("mode === 'single'")
    expect(stage).toContain('Math.ceil(items.length / 2)')
    expect(stage).toContain('mode-${mode}')
    expect(stage).toContain('shared.panelGap')
  })

  test('cards usam o mesmo componente com variações sem duplicar renderer', () => {
    const stage = source('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
    expect(stage).toContain('variant-${layout.variant}')
    expect(stage).toContain('stream-package-render-card-map')
    expect(stage).toContain('stream-package-render-card-logo')
    expect(stage).toContain('stream-package-render-card-rank')
    expect(stage.match(/function CardRenderer/g)?.length).toBe(1)
  })

  test('hero atende próxima queda e campeão no mesmo renderer', () => {
    const stage = source('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
    expect(stage).toContain("props.type === 'next_round'")
    expect(stage).toContain("props.type === 'champion'")
    expect(stage).toContain('stream-package-render-hero-copy')
    expect(stage.match(/function HeroRenderer/g)?.length).toBe(1)
  })

  test('css possui apenas famílias compartilhadas para tabelas cards e hero', () => {
    const css = source('web/features/campeonatos/stream/stream.css')
    expect(css).toContain('.stream-package-render-table')
    expect(css).toContain('.stream-package-render-cards.variant-map-card')
    expect(css).toContain('.stream-package-render-cards.variant-logo-card')
    expect(css).toContain('.stream-package-render-hero.variant-next-round')
    expect(css).toContain('.stream-package-render-hero.variant-champion')
  })
})
