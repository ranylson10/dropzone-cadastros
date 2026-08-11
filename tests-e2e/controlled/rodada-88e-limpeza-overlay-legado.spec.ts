import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file: string) => fs.existsSync(path.join(root, file))

test.describe('Rodada 88E — limpeza definitiva do editor livre', () => {
  test('pack não consulta overlay livre nem selected_overlay_ids', () => {
    const api = source('web/app/api/campeonatos/[id]/stream/pack/route.ts')
    expect(api).not.toContain('campeonato_stream_overlays')
    expect(api).not.toContain('selected_overlay_ids')
    expect(api).toContain('enabled_overlay_types')
    expect(api).toContain('normalizeStreamOverlayPackage')
  })

  test('aba Stream aponta apenas para pacote e não lista editor antigo', () => {
    const tab = source('web/features/campeonatos/stream/components/CampeonatoStreamTab.tsx')
    expect(tab).toContain('O pacote de overlays é a única origem visual da transmissão')
    expect(tab).toContain('Abrir pacote')
    expect(tab).not.toContain('listOverlays')
    expect(tab).not.toContain('deleteOverlayRemote')
    expect(tab).not.toContain('share_token')
    expect(tab).not.toContain('selected_overlay_ids')
  })

  test('rotas públicas e APIs do editor livre foram removidas', () => {
    for (const file of [
      'web/app/stream/live/[token]/page.tsx',
      'web/app/api/stream/live/[token]/route.ts',
      'web/app/api/stream/catalog/route.ts',
      'web/app/api/campeonatos/[id]/stream/overlays/route.ts',
      'web/app/campeonatos/[id]/stream/overlays/novo/page.tsx',
      'web/features/campeonatos/stream/components/StreamOverlayEditor.tsx',
      'web/features/campeonatos/stream/components/StreamOverlayCatalog.tsx',
      'web/features/campeonatos/stream/components/StreamLiveStage.tsx',
    ]) expect(exists(file), `${file} não deve existir`).toBe(false)
  })

  test('migration remove tabelas e coluna sem manter arquitetura paralela', () => {
    const sql = source('database/migrations/20260810_stream_overlay_legacy_cleanup.sql')
    expect(sql).toContain('drop column if exists selected_overlay_ids')
    expect(sql).toContain('drop table if exists public.campeonato_stream_overlays cascade')
    expect(sql).toContain('drop table if exists public.stream_overlay_catalog cascade')
    expect(sql).toContain('drop table if exists public.stream_overlay_entitlements cascade')
    expect(sql).toContain('drop function if exists public.fn_resgatar_stream_overlay_code')
  })

  test('serviço de dados não mantém CRUD/localStorage de overlays antigas', () => {
    const service = source('web/features/campeonatos/stream/services/stream-data.service.ts')
    expect(service).not.toContain('dropzone_stream_overlays_')
    expect(service).not.toContain('listOverlays')
    expect(service).not.toContain('saveOverlayRemote')
    expect(service).not.toContain('deleteOverlayRemote')
    expect(service).not.toContain('migrateOverlay')
  })
})
