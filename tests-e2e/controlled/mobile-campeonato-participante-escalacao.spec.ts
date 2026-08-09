import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — campeonato do participante e escalação nativa',()=>{
  test('foca a participação selecionada e gerencia jogadores/convite sem WebView',async()=>{
    const screen=read('app/src/screens/LineupScreen.tsx')
    const api=read('app/src/lib/api.ts')
    const route=read('web/app/api/equipe/escalacoes/route.ts')

    expect(screen).toContain('selectedLineup')
    expect(screen).toContain('campeonato_equipe_id')
    expect(screen).toContain('JOGADORES CONFIRMADOS')
    expect(screen).toContain('CAPITÃO')
    expect(screen).toContain('removeLineupPlayer')
    expect(screen).toContain('revokeLineupInvite')
    expect(screen).toContain('Share.share')
    expect(screen).toContain('Gerar convite de escalação')
    expect(screen).toContain('Gerar novo convite')
    expect(screen).toContain('CONVITE ATIVO')

    expect(api).toContain('removeLineupPlayer:')
    expect(api).toContain('revokeLineupInvite:')
    expect(api).toContain('createLineupInvite:')

    expect(route).toContain('export async function GET')
    expect(route).toContain('export async function POST')
    expect(route).toContain('export async function PATCH')
    expect(route).toContain('export async function DELETE')
    expect(route).toContain('jogador_inscricao_id')
    expect(route).toContain('link_id')
    expect(route).toContain("requireEquipeAccess(userId, accounts, data.equipe_id, 'escalar')")

    expect(screen).not.toContain('Linking.openURL')
    expect(screen).not.toContain('WebView')
  })
})
