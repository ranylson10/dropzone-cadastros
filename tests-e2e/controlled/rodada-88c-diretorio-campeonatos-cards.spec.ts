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
    expect(component).toContain('directory-champ-zoom')
    expect(component).toContain('directory-banner-preview')
    expect(component).toContain('Ver banner')
    expect(component).toContain('vagas reais')
    expect(component).toContain('Live')
    expect(component).toContain('Prêmio')

    expect(css).toContain('.directory-theme-campeonatos .directory-champ-card-grid')
    expect(css).toContain('grid-template-columns:1fr')
    expect(css).toContain('grid-template-columns:150px minmax(0,1fr)')
    expect(css).toContain('grid-template-columns:118px minmax(0,1fr)')
    expect(css).toContain('.directory-theme-campeonatos .directory-champ-cover')
    expect(css).toContain('background-size:cover')
    expect(css).toContain('.directory-theme-campeonatos .directory-champ-metrics')
    expect(css).toContain('display:none')
    expect(css).toContain('.directory-banner-preview')
    expect(css).toContain('@media(max-width:760px)')

    expect(types).toContain('commercial?:')
    expect(types).toContain('banner?: string')

    expect(server).toContain('banner: first(row.banner_url)')
    expect(server).toContain('tem_live: Boolean(config.tem_live)')
    expect(server).toContain('vagas_livres: freeVacancies')
  })
})
