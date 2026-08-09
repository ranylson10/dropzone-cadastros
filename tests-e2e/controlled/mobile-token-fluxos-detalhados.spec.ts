import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — fluxos detalhados por token',()=>{
  test('usa formulários nativos para equipe, grupo e inscrição de jogador',async()=>{
    const screen=read('app/src/screens/TokenActionScreen.tsx')
    const api=read('app/src/lib/api.ts')
    const teamInvite=read('web/app/api/convites/equipe/[token]/route.ts')
    const groupInvite=read('web/app/api/convites/grupo/[token]/route.ts')
    const playerInvite=read('web/app/api/dropzone/public/inscricao/[token]/route.ts')

    expect(api).toContain('supportsDetailedQuickTokenAction')
    expect(api).toContain("kind==='team_championship_invite'")
    expect(api).toContain("kind==='group_registration'")
    expect(api).toContain("kind==='player_registration'")
    expect(api).toContain('reloadQuickTokenPayload')
    expect(api).toContain('executeDetailedQuickTokenAction')

    expect(screen).toContain('equipes_disponiveis')
    expect(screen).toContain('lines_disponiveis')
    expect(screen).toContain('body.equipe_id=equipeId')
    expect(screen).toContain('body.line_id=lineId')
    expect(screen).toContain('body.nome_line=newLineName.trim()')
    expect(screen).toContain('body.slot_id=slotId')
    expect(screen).toContain('body.campeonato_equipe_id=participationId')
    expect(screen).toContain('body.nick=nick.trim()')
    expect(screen).toContain('body.id_jogo=gameId.trim()')
    expect(screen).toContain('body.funcao=role.trim()')

    expect(teamInvite).toContain("const equipeIdInformada = String(body.equipe_id || '').trim()")
    expect(teamInvite).toContain("lineId: body.line_id ? String(body.line_id) : null")
    expect(teamInvite).toContain("const slotIdInformado = String(body.slot_id || '').trim()")
    expect(groupInvite).toContain("const lineIdInformada = String(body.line_id || '').trim()")
    expect(groupInvite).toContain("const nomeNovaLine = String(body.nome_line || '').trim()")
    expect(playerInvite).toContain("const campeonatoEquipeId = String(body.campeonato_equipe_id || body.equipe_id || '')")
    expect(playerInvite).toContain("const nick = String(body.nick || account.nome || '').trim()")
    expect(playerInvite).toContain("const idJogo = String(body.id_jogo || account.id_jogo || '').trim()")
    expect(screen).not.toContain('WebView')
  })
})
