import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 87L2 — mapa territorial de calls', () => {
  test('salva polígonos normalizados e posição da legenda', () => {
    const migration = source('database/migrations/20260805_xtreino_calls_mapas_interativas.sql')
    const route = source('web/app/api/campeonatos/[id]/calls/route.ts')
    expect(migration).toContain('add column if not exists poligono jsonb')
    expect(migration).toContain('drop index if exists public.xtreino_call_principal_unica_por_equipe_mapa')
    expect(route).toContain('poligono: Array.isArray(body.poligono)')
  })

  test('permite selecionar múltiplas calls e aplicar equipe, cor e opacidade', () => {
    const component = source('web/features/campeonatos/calls/components/CampeonatoCallsTab.tsx')
    expect(component).toContain('selectedCalls')
    expect(component).toContain('Promise.all(selectedCalls.map')
    expect(component).toContain('opacidade: opacity')
    expect(component).toContain('type="color"')
    expect(component).toContain('type="range"')
  })

  test('renderiza territórios, logo e nome da equipe sobre o mapa', () => {
    const component = source('web/features/campeonatos/calls/components/CampeonatoCallsTab.tsx')
    expect(component).toContain('<polygon')
    expect(component).toContain('xt-map-team-logo')
    expect(component).toContain('xt-map-team-name')
    expect(component).toContain('preserveAspectRatio="xMidYMid meet"')
  })

  test('mantém CRUD completo das regiões', () => {
    const component = source('web/features/campeonatos/calls/components/CampeonatoCallsTab.tsx')
    expect(component).toContain('saveRegion')
    expect(component).toContain('Renomear')
    expect(component).toContain('Excluir')
    expect(component).toContain('Limpar selecionadas')
  })
})
