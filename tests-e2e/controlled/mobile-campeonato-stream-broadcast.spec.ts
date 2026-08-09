import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Campeonato mobile — Stream, OBS e overlays',()=>{
  test('integra o painel nativo com os contratos oficiais sem criar um segundo sistema de transmissão',async()=>{
    const panel=read('app/src/screens/ChampionshipStreamPanel.tsx')
    const management=read('app/src/screens/ChampionshipManagementScreen.tsx')
    const api=read('app/src/lib/api.ts')
    const key=read('web/app/api/campeonatos/[id]/stream/key/route.ts')
    const pack=read('web/app/api/campeonatos/[id]/stream/pack/route.ts')
    const overlays=read('web/app/api/campeonatos/[id]/stream/overlays/route.ts')
    const live=read('web/app/api/stream/live/[token]/route.ts')
    const broadcast=read('web/app/api/broadcast/me/route.ts')

    expect(management).toContain("['stream','Stream']")
    expect(management).toContain('ChampionshipStreamPanel')
    expect(api).toContain('/stream/key')
    expect(api).toContain('/stream/pack')
    expect(api).toContain('/stream/overlays')
    expect(api).toContain('/stream/data?sheet=')
    expect(api).toContain('/api/broadcast/me')
    expect(panel).toContain('ensureChampionshipStreamKey')
    expect(panel).toContain('saveChampionshipStreamPack')
    expect(panel).toContain('createChampionshipStreamOverlay')
    expect(panel).toContain('updateChampionshipStreamOverlay')
    expect(panel).toContain('deleteChampionshipStreamOverlay')
    expect(panel).toContain('/stream/live/${row.share_token}')
    expect(panel).toContain('/broadcast/control/${currentBroadcastDesk.controller_token}')
    expect(panel).toContain('/broadcast/obs/${currentBroadcastDesk.obs_token}')
    expect(key).toContain("from('campeonato_stream_keys')")
    expect(pack).toContain("from('campeonato_stream_pack')")
    expect(overlays).toContain("from('campeonato_stream_overlays')")
    expect(live).toContain(".eq('share_token', clean)")
    expect(broadcast).toContain("from('broadcast_live_sessions')")
    expect(broadcast).toContain("from('broadcast_campeonato_links')")
    expect(panel).not.toContain('WebView')
    expect(panel).not.toContain('distribute_phase')
  })
})
