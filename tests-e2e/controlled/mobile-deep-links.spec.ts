import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — deep links e abertura direta',()=>{
  test('reconhece entidades públicas, tokens e preserva o callback OAuth',async()=>{
    const app=read('app/src/App.tsx')
    const deep=read('app/src/lib/deepLinks.ts')
    const token=read('app/src/screens/TokenActionScreen.tsx')
    const appJson=JSON.parse(read('app/app.json'))

    expect(appJson.expo.scheme).toBe('dropzone')
    expect(appJson.expo.android.intentFilters?.[0]?.action).toBe('VIEW')

    expect(deep).toContain("lower[0]==='auth'&&lower[1]==='callback'")
    expect(deep).toContain("kind:'championship'")
    expect(deep).toContain("kind:'team'")
    expect(deep).toContain("kind:'player'")
    expect(deep).toContain("kind:'token'")
    expect(deep).toContain("['escala']")
    expect(deep).toContain("['equipe','entrar']")
    expect(deep).toContain("['convite','equipe']")

    expect(app).toContain('Linking.getInitialURL()')
    expect(app).toContain("Linking.addEventListener('url'")
    expect(app).toContain('resolveQuickToken(target.token')
    expect(app).toContain("setRouteWithHistory('championship_public')")
    expect(app).toContain("setRouteWithHistory('team_public')")
    expect(app).toContain("setRouteWithHistory('player_public')")
    expect(app).toContain("setRouteWithHistory('token_action')")

    expect(token).toContain('requireLogin: () => void')
    expect(token).toContain("resolvedResult.kind==='lineup'")
    expect(token).toContain('executeQuickTokenAction(resolvedResult,props.accessToken)')
    expect(app).not.toContain('WebView')
  })
})
