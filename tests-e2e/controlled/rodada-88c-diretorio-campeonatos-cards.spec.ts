import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 88C — diretório de campeonatos em cards', () => {
  test('campeonatos usam cards comerciais em vez de tabela', async () => {
    const component = read('web/features/directory/components/DirectoryListClient.tsx')
    const css = read('web/app/globals.css')
    const types = read('web/features/directory/types.ts')
    const server = read('web/features/directory/server.ts')

    expect(component).toContain('isChampionshipDirectory')
    expect(component).toContain('ChampionshipCards')
    expect(component).toContain('directory-champ-card-grid')
    expect(component).toContain('directory-champ-card')
    expect(component).toContain('vagas reais')
    expect(component).toContain('Live')
    expect(component).toContain('Prêmio')
    expect(component).toContain('filterChampionships')
    expect(component).toContain('directory-market-filters')
    expect(component).toContain('Últimas vagas')
    expect(component).toContain('Com premiação')
    expect(component).toContain('Até R$')

    expect(css).toContain('.directory-champ-card-grid')
    expect(css).toContain('.directory-champ-cover')
    expect(css).toContain('.directory-champ-metrics')
    expect(css).toContain('.directory-market-filters')
    expect(css).toContain('.directory-market-filter-chips')
    expect(css).toContain('@media(max-width:760px)')

    expect(types).toContain('commercial?:')
    expect(types).toContain('banner?: string')
    expect(types).toContain('data_jogo?: string | null')

    expect(server).toContain('banner: first(row.banner_url)')
    expect(server).toContain('tem_live: Boolean(config.tem_live)')
    expect(server).toContain('vagas_livres: freeVacancies')
    expect(server).toContain('data_limite_inscricao')
  })
})
