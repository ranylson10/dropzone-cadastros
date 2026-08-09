import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — integração de equipe, lines, elenco e capitão',()=>{
  test('preserva gestão de line e integra staff/convites sem criar fluxo paralelo',async()=>{
    const roster=read('app/src/screens/TeamRosterScreen.tsx')
    const line=read('app/src/screens/LineManagementScreen.tsx')
    const players=read('app/src/screens/TeamPlayersPanel.tsx')
    const staff=read('app/src/screens/TeamStaffPanel.tsx')
    const api=read('app/src/lib/api.ts')
    const lineRoute=read('web/app/api/equipes/[id]/lines/[lineId]/route.ts')
    const rosterInviteRoute=read('web/app/api/equipes/convites-elenco/route.ts')
    const staffRoute=read('web/app/api/equipes/[id]/staff/route.ts')

    expect(roster).toContain('onManageLine?.(selected.id,String(line.id))')
    expect(roster).toContain('TeamPlayersPanel')
    expect(roster).toContain('TeamStaffPanel')

    expect(line).toContain("action:inside?'remove_member':'add_member'")
    expect(line).toContain("action:'transfer_member'")
    expect(line).toContain('line_destino_id:transferDestinationLineId')
    expect(line).toContain('TRANSFERIR PARA OUTRA LINE')

    expect(line).toContain("action:'save_formation'")
    expect(line).toContain('tipo_formacao:draft.tipo_formacao')
    expect(line).toContain('capitao:draft.capitao')
    expect(line).toContain('toggleCaptain')
    expect(line).toContain("draft.capitao?'star':'star-outline'")
    expect(line).toContain('Salvar formação')

    expect(line).toContain("action:'transfer_line'")
    expect(lineRoute).toContain("action === 'transfer_member'")
    expect(lineRoute).toContain("action === 'save_formation'")
    expect(lineRoute).toContain("action === 'transfer_line'")
    expect(lineRoute).toContain('capitao: Boolean(requestedRow.capitao)')
    expect(lineRoute).toContain("acao: 'removido_line'")
    expect(lineRoute).toContain("acao: 'adicionado_line'")

    expect(players).toContain('createTeamRosterInvite')
    expect(players).toContain('renewTeamRosterInvite')
    expect(players).toContain('cancelTeamRosterInvite')
    expect(staff).toContain('inviteTeamStaff')
    expect(staff).toContain('updateTeamStaff')
    expect(staff).toContain('removeTeamStaff')

    expect(api).toContain('/api/equipes/convites-elenco')
    expect(api).toContain('/staff/convites')
    expect(rosterInviteRoute).toContain('export async function POST')
    expect(staffRoute).toContain('export async function PATCH')

    expect(line).not.toContain('WebView')
    expect(players).not.toContain('WebView')
    expect(staff).not.toContain('WebView')
  })
})
