import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — agenda contextual',()=>{
  test('usa os escopos oficiais, mantém leitura pública e CRUD autenticado',async()=>{
    const screen=read('app/src/screens/AgendaScreen.tsx')
    const agenda=read('app/src/lib/agenda.ts')
    const api=read('app/src/lib/api.ts')
    const route=read('web/app/api/agenda/route.ts')
    const service=read('backend/src/agenda/agenda.service.ts')

    expect(api).toContain("scope:'me'|'campeonato'|'equipe'")
    expect(api).toContain("query.set('scope', params.scope)")
    expect(api).toContain("createAgendaEvent")
    expect(api).toContain("updateAgendaEvent")
    expect(api).toContain("deleteAgendaEvent")

    expect(screen).toContain("ScopeButton label=\"Minha\"")
    expect(screen).toContain("ScopeButton label=\"Campeonato\"")
    expect(screen).toContain("ScopeButton label=\"Equipe\"")
    expect(screen).toContain("scope==='campeonato'?selectedChampionship?.id")
    expect(screen).toContain("scope==='equipe'?selectedTeamId")
    expect(screen).toContain("A agenda pública pode ser aberta por campeonato ou equipe sem exigir login.")
    expect(screen).toContain("item.editable")
    expect(screen).toContain("mobileApi.createAgendaEvent")
    expect(screen).toContain("mobileApi.updateAgendaEvent")
    expect(screen).toContain("mobileApi.deleteAgendaEvent")

    expect(agenda).toContain('horario_inicio')
    expect(agenda).toContain('horario_fim')
    expect(agenda).toContain('item.meta?.campeonato_nome')
    expect(agenda).toContain('agendaContextIds')

    expect(route).toContain("scope === 'me'")
    expect(route).toContain("['me', 'campeonato', 'equipe'].includes(scope)")
    expect(service).toContain("params.scope === 'campeonato'")
    expect(service).toContain("params.scope === 'equipe'")
    expect(service).toContain("onlyPublicOrShared: true")
    expect(service).toContain("const editable = Boolean(authUserId && row.auth_user_id === authUserId)")
    expect(screen).not.toContain('WebView')
  })
})
