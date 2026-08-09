import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — campeonato público e regulamento nativo',()=>{
  test('mantém leitura pública sem login e carrega somente regulamento publicado',async()=>{
    const screen=read('app/src/screens/ChampionshipPublicScreen.tsx')
    const api=read('app/src/lib/api.ts')
    const route=read('web/app/api/campeonatos/[id]/rulebook/route.ts')

    expect(screen).toContain("['rulebook', 'Regulamento']")
    expect(screen).toContain('loadRulebook')
    expect(screen).toContain('REGULAMENTO OFICIAL')
    expect(screen).toContain('Versão publicada pela organização do campeonato.')
    expect(screen).toContain('conteudo_markdown')
    expect(screen).toContain('O regulamento ainda não foi publicado.')

    expect(api).toContain('publicChampionshipRulebook:')
    expect(api).toContain('/rulebook?public=1')

    expect(route).toContain("url.searchParams.get('public') === '1'")
    expect(route).toContain('getPublishedRulebook(id)')
    expect(route).toContain('Regulamento não publicado.')

    expect(screen).toContain("requireAuth?.(() => onNavigate('purchase_claim'))")
    expect(screen).not.toContain("requireAuth?.(() => void loadRulebook())")
    expect(screen).not.toContain('WebView')
  })
})
