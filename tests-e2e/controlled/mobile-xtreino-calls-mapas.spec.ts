import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — Xtreino calls por mapa',()=>{
  test('usa a API oficial e mantém calls restritas a Xtreino',async()=>{
    const panel=read('app/src/screens/ChampionshipCallsPanel.tsx')
    const management=read('app/src/screens/ChampionshipManagementScreen.tsx')
    const api=read('app/src/lib/api.ts')
    const route=read('web/app/api/campeonatos/[id]/calls/route.ts')
    const migration=read('database/migrations/20260805_xtreino_calls_mapas.sql')
    const interactive=read('database/migrations/20260805_xtreino_calls_mapas_interativas.sql')

    expect(management).toContain("['calls','Calls']")
    expect(management).toContain("toLowerCase()==='xtreino'")
    expect(management).toContain('ChampionshipCallsPanel')

    expect(api).toContain('/calls')
    expect(api).toContain("action:'create_call'")
    expect(api).toContain("action:'assign'")
    expect(api).toContain('vinculo_id=')

    expect(route).toContain("String(data.tipo).toLowerCase() !== 'xtreino'")
    expect(route).toContain("from('xtreino_mapa_calls')")
    expect(route).toContain("from('xtreino_mapa_call_equipes')")
    expect(route).toContain("tipo = body.tipo === 'alternativa' ? 'alternativa' : 'principal'")

    expect(migration).toContain('xtreino_mapa_calls')
    expect(migration).toContain('xtreino_mapa_call_equipes')
    expect(interactive).toContain('poligono')
    expect(interactive).toContain('opacidade')

    expect(panel).toContain("assign(team,'principal')")
    expect(panel).toContain("assign(team,'alternativa')")
    expect(panel).not.toContain('WebView')
  })
})
