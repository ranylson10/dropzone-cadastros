import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 88C — diretório de campeonatos em cards', () => {
  test('campeonatos usam cards comerciais com filtros, carrinho e favoritos', async () => {
    const component = read('web/features/directory/components/DirectoryListClient.tsx')
    const commerce = read('web/features/commerce/local-commerce.ts')
    const css = read('web/features/directory/components/championship-directory.css')
    const types = read('web/features/directory/types.ts')
    const server = read('web/features/directory/server.ts')
    const builder = read('web/features/directory/championship-directory.ts')

    expect(component).toContain('isChampionshipDirectory')
    expect(component).toContain('ChampionshipCards')
    expect(component).toContain('directory-champ-card-grid')
    expect(component).toContain('directory-champ-card')
    expect(component).toContain('vagas disponíveis')
    expect(component).toContain('Live')
    expect(component).toContain('Prêmio')
    expect(component).toContain('filterChampionships')
    expect(component).toContain('directory-market-filters')
    expect(component).toContain('Últimas vagas')
    expect(component).toContain('>Premiação</button>')
    expect(component).toContain('Vaga até R$')
    expect(component).toContain('directory-market-cart-link')
    expect(component).toContain('Adicionar ao carrinho')
    expect(component).toContain('Favoritos')
    expect(component).toContain('toggleWishlist')

    expect(commerce).toContain('dropzone:cart:v1')
    expect(commerce).toContain('dropzone:wishlist:v1')
    expect(commerce).toContain('addToCart')
    expect(commerce).toContain('toggleWishlist')

    expect(css).toContain('.directory-champ-card-grid')
    expect(css).toContain('.directory-champ-cover')
    expect(css).toContain('.directory-champ-facts')
    expect(css).toContain('.directory-champ-cart-action')
    expect(css).toContain('.directory-champ-wish')
    expect(css).toContain('.directory-market-cart-link')
    expect(css).toContain('.directory-market-filters')
    expect(css).toContain('.directory-market-filter-chips')
    expect(css).toContain('@media(max-width:760px)')

    expect(types).toContain('commercial?:')
    expect(types).toContain('banner?: string')
    expect(types).toContain('data_jogo?: string | null')

    expect(server).toContain('buildChampionshipDirectoryItems({ championships, configs, phases, slots, games })')
    expect(builder).toContain('banner: first(row.banner_url)')
    expect(builder).toContain('tem_live: Boolean(config.tem_live)')
    expect(builder).toContain('vagas_livres: freeVacancies')
    expect(builder).toContain('data_limite_inscricao')
  })
})
