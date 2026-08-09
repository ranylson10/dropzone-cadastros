import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — busca global pública',()=>{
  test('navega entre campeonato, equipe e jogador sem exigir login',async()=>{
    const app=read('app/src/App.tsx')
    const shell=read('app/src/screens/AppShell.tsx')
    const screen=read('app/src/screens/GlobalSearchScreen.tsx')
    const types=read('app/src/types/dropzone.ts')
    const api=read('app/src/lib/api.ts')

    expect(types).toContain("| 'search'")
    expect(app).toContain("'search',")
    expect(app).toContain("route === 'search'")
    expect(app).toContain('GlobalSearchScreen')
    expect(shell).toContain('accessibilityLabel="Busca global"')
    expect(shell).toContain("props.onNavigate('search')")

    expect(screen).toContain('mobileApi.championshipsPublic()')
    expect(screen).toContain('mobileApi.publicTeams(term)')
    expect(screen).toContain('mobileApi.publicPlayers(term)')
    expect(screen).toContain('setTimeout(async()=>')
    expect(screen).toContain('},300)')
    expect(screen).toContain("onSelectChampionship?.(toChampionshipCard(item))")
    expect(screen).toContain('onSelectTeam?.(team.id)')
    expect(screen).toContain('onSelectPlayer?.(player.id)')
    expect(screen).toContain("term.length<2")

    expect(api).toContain('/api/vagas?diretorio=1')
    expect(api).toContain('/api/equipes/busca-publica?q=')
    expect(api).toContain('/api/jogadores/busca-publica?q=')
    expect(screen).not.toContain('/api/campeonatos/busca')
    expect(screen).not.toContain('WebView')
  })
})
