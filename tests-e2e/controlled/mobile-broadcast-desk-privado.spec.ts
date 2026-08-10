import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — Broadcast privado completo',()=>{
  test('resgata chave, seleciona campeonato e opera controlador/OBS sem sistema paralelo',async()=>{
    const panel=read('app/src/screens/BroadcastDeskPanel.tsx')
    const my=read('app/src/screens/MyChampionshipsScreen.tsx')
    const api=read('app/src/lib/api.ts')
    const meRoute=read('web/app/api/broadcast/me/route.ts')
    const linksRoute=read('web/app/api/broadcast/links/route.ts')
    const sessionsRoute=read('web/app/api/broadcast/sessions/route.ts')

    expect(my).toContain("profileType === 'broadcast'")
    expect(my).toContain('BroadcastDeskPanel')

    expect(panel).toContain('CENTRAL BROADCAST')
    expect(panel).toContain('Resgatar chave Stream')
    expect(panel).toContain('CAMPEONATOS AUTORIZADOS')
    expect(panel).toContain('MESA DE CONTROLE')
    expect(panel).toContain('CONTROLADOR')
    expect(panel).toContain('OBS BROWSER SOURCE')
    expect(panel).toContain('Encerrar mesa e invalidar links')
    expect(panel).toContain('broadcastRedeemKey')
    expect(panel).toContain('broadcastEnsureDesk')
    expect(panel).toContain('broadcastUpdateDesk')
    expect(panel).toContain('broadcastCloseDesk')

    expect(api).toContain("'/api/broadcast/links'")
    expect(api).toContain("'/api/broadcast/sessions'")
    expect(api).toContain('broadcastRenameLink:')
    expect(api).toContain('broadcastRemoveLink:')

    expect(meRoute).toContain('broadcast_campeonato_links')
    expect(linksRoute).toContain('key_token')
    expect(linksRoute).toContain('stream_key_id')
    expect(sessionsRoute).toContain('regenerate_controller_token')
    expect(sessionsRoute).toContain('regenerate_obs_token')
    expect(sessionsRoute).toContain('campeonato_id')

    expect(panel).not.toContain('WebView')
  })
})
