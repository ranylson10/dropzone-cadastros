import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — retorno e persistência de contexto',()=>{
  test('mantém histórico em memória e restaura somente contexto público seguro',async()=>{
    const app=read('app/src/App.tsx')
    const state=read('app/src/lib/navigationState.ts')
    const pkg=JSON.parse(read('app/package.json'))

    expect(pkg.dependencies['@react-native-async-storage/async-storage']).toBeTruthy()
    expect(state).toContain("const KEY='dropzone.mobile.navigation.v1'")
    expect(state).toContain("'championship_public'")
    expect(state).toContain("'team_public'")
    expect(state).toContain("'player_public'")
    expect(state).not.toContain("'wallet'")
    expect(state).not.toContain("'championship_management'")
    expect(state).toContain("parsed.route==='championship_public'&&!parsed.championship?.id")
    expect(state).toContain("parsed.route==='team_public'&&!parsed.teamId")
    expect(state).toContain("parsed.route==='player_public'&&!parsed.playerId")

    expect(app).toContain('routeHistoryRef')
    expect(app).toContain('function setRouteWithHistory')
    expect(app).toContain('function goBack()')
    expect(app).toContain('routeHistoryRef.current.pop()')
    expect(app).toContain('onBack: goBack')
    expect(app).toContain('loadNavigationState()')
    expect(app).toContain('saveNavigationState({')
    expect(app).toContain("setRouteWithHistory('token_action')")
    expect(app).toContain("setRouteWithHistory('championship_public')")
    expect(app).toContain("setRouteWithHistory('team_public')")
    expect(app).toContain("setRouteWithHistory('player_public')")
    expect(app).not.toContain('WebView')
  })
})
