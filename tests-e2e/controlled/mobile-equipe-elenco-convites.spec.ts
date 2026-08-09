import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — elenco e convites de jogadores',()=>{
  test('gera, compartilha, renova e cancela convites usando a API oficial',async()=>{
    const roster=read('app/src/screens/TeamRosterScreen.tsx')
    const panel=read('app/src/screens/TeamPlayersPanel.tsx')
    const api=read('app/src/lib/api.ts')
    const route=read('web/app/api/equipes/convites-elenco/route.ts')

    expect(roster).toContain('TeamPlayersPanel')
    expect(roster).toContain("selected.papel === 'dono' || Boolean(selected.permissoes?.pode_gerar_token)")

    expect(api).toContain('teamRosterInvites:')
    expect(api).toContain('createTeamRosterInvite:')
    expect(api).toContain('renewTeamRosterInvite:')
    expect(api).toContain('cancelTeamRosterInvite:')

    expect(panel).toContain('ELENCO ATUAL')
    expect(panel).toContain('CONVIDAR JOGADOR')
    expect(panel).toContain('LINE DE DESTINO')
    expect(panel).toContain('CAMPEONATO (OPCIONAL)')
    expect(panel).toContain('Share.share')
    expect(panel).toContain('Gerar e compartilhar')
    expect(panel).toContain('CONVITES ATIVOS')
    expect(panel).toContain('Renovar convite?')
    expect(panel).toContain('Cancelar convite?')

    expect(route).toContain('export async function GET')
    expect(route).toContain('export async function POST')
    expect(route).toContain('export async function PATCH')
    expect(route).toContain('export async function DELETE')
    expect(route).toContain("tipo: 'convite_jogador_equipe'")
    expect(panel).not.toContain('WebView')
  })
})
