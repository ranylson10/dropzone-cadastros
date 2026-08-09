import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root=path.resolve(__dirname,'../..')
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile — Xtreino mapa territorial interativo',()=>{
  test('edita polígono, label e aparência territorial usando o contrato já publicado',async()=>{
    const panel=read('app/src/screens/ChampionshipCallsPanel.tsx')
    const route=read('web/app/api/campeonatos/[id]/calls/route.ts')
    const migration=read('database/migrations/20260805_xtreino_calls_mapas_interativas.sql')

    expect(panel).toContain("type EditorMode='territory'|'label'")
    expect(panel).toContain('locationX/mapSize.width')
    expect(panel).toContain('locationY/mapSize.height')
    expect(panel).toContain('setPolygon(current=>[...current,point])')
    expect(panel).toContain('setLabel(point)')
    expect(panel).toContain('poligono:polygon')
    expect(panel).toContain('label_x:label?.x??null')
    expect(panel).toContain('label_y:label?.y??null')
    expect(panel).toContain('TEAM_COLORS')
    expect(panel).toContain('opacidade:op')
    expect(panel).toContain("assign(team,appearanceType,{cor:c,opacidade:currentOpacity})")
    expect(panel).not.toContain('react-native-svg')
    expect(panel).not.toContain('WebView')

    expect(route).toContain('poligono: Array.isArray(body.poligono)')
    expect(route).toContain('label_x:')
    expect(route).toContain('label_y:')
    expect(route).toContain('cor: text(body.cor)')
    expect(route).toContain('opacidade: Math.min(0.9, Math.max(0.1')

    expect(migration).toContain('poligono jsonb')
    expect(migration).toContain('label_x numeric')
    expect(migration).toContain('label_y numeric')
    expect(migration).toContain("cor text not null default '#d6b84b'")
    expect(migration).toContain('opacidade numeric not null default 0.42')
    expect(migration).toContain('opacidade >= 0.10 and opacidade <= 0.90')
  })
})
