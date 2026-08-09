import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — gestão nativa de staff da equipe',()=>{
  test('usa APIs oficiais para convite, permissões, remoção e cancelamento',async()=>{
    const roster=read('app/src/screens/TeamRosterScreen.tsx')
    const panel=read('app/src/screens/TeamStaffPanel.tsx')
    const api=read('app/src/lib/api.ts')
    const staffRoute=read('web/app/api/equipes/[id]/staff/route.ts')
    const invitesRoute=read('web/app/api/equipes/[id]/staff/convites/route.ts')

    expect(roster).toContain('TeamStaffPanel')
    expect(roster).toContain("isOwner={selected.papel === 'dono'}")

    expect(api).toContain('teamStaff:')
    expect(api).toContain('inviteTeamStaff:')
    expect(api).toContain('updateTeamStaff:')
    expect(api).toContain('removeTeamStaff:')
    expect(api).toContain('cancelTeamStaffInvite:')

    expect(panel).toContain('CONVIDAR MANAGER')
    expect(panel).toContain('@username ou ID público')
    expect(panel).toContain('pode_editar')
    expect(panel).toContain('pode_escalar')
    expect(panel).toContain('pode_gerar_token')
    expect(panel).toContain('CONVITES PENDENTES')
    expect(panel).toContain('Somente o dono da equipe')

    expect(staffRoute).toContain('export async function GET')
    expect(staffRoute).toContain('export async function PATCH')
    expect(staffRoute).toContain('export async function DELETE')
    expect(invitesRoute).toContain('export async function POST')
    expect(invitesRoute).toContain('export async function DELETE')
    expect(panel).not.toContain('WebView')
  })
})
