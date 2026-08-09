import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — ações nativas por token',()=>{
  test('aceita escalação, convite de elenco e vendedor pelas APIs oficiais',async()=>{
    const app=read('app/src/App.tsx')
    const screen=read('app/src/screens/TokenActionScreen.tsx')
    const api=read('app/src/lib/api.ts')
    const lineup=read('web/app/api/escalacoes/[token]/route.ts')
    const roster=read('web/app/api/equipes/convites-elenco/[token]/route.ts')
    const seller=read('web/app/api/vendedores/convite/[token]/route.ts')

    expect(api).toContain("result.kind==='lineup'")
    expect(api).toContain("`/api/escalacoes/${token}`")
    expect(api).toContain("result.kind==='team_roster_invite'")
    expect(api).toContain("`/api/equipes/convites-elenco/${token}`")
    expect(api).toContain("result.kind==='seller_invite'")
    expect(api).toContain("`/api/vendedores/convite/${token}`")
    expect(api).toContain('supportsNativeQuickTokenAction')

    expect(screen).toContain("props.accessToken?(detailedAction?'Confirmar inscrição':'Aceitar no app'):'Entrar para continuar'")
    expect(screen).toContain('executeQuickTokenAction(resolvedResult,props.accessToken)')
    expect(screen).toContain('props.requireLogin()')
    expect(screen).toContain('Este fluxo pode ser concluído diretamente no app.')

    expect(app).toContain("requireLogin('token_action')")
    expect(app).toContain('accessToken={auth.session?.access_token}')

    expect(lineup).toContain('export async function POST')
    expect(roster).toContain('export async function POST')
    expect(seller).toContain('export async function POST')
    expect(screen).not.toContain('WebView')
  })
})
