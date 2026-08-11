import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 88D — Broadcast/OBS no pacote oficial', () => {
  test('mesa troca tipo oficial e não id de overlay livre', () => {
    const api = source('web/app/api/broadcast/control/[token]/route.ts')
    const page = source('web/app/broadcast/control/[token]/page.tsx')
    expect(api).toContain('active_overlay_type')
    expect(api).toContain('enabled_overlay_types')
    expect(api).toContain('Esta overlay não está habilitada no pacote do campeonato.')
    expect(page).toContain('active_overlay_type')
    expect(page).not.toContain('active_overlay_id')
  })

  test('OBS renderiza StreamPackageStage diretamente e abandona share token/blocks', () => {
    const page = source('web/app/broadcast/obs/[token]/page.tsx')
    expect(page).toContain('StreamPackageStage')
    expect(page).toContain('payload.overlay.type')
    expect(page).not.toContain('StreamLiveStage')
    expect(page).not.toContain('share_token')
    expect(page).not.toContain('blocks=')
  })

  test('API OBS devolve pacote normalizado e busca dados só quando solicitado', () => {
    const api = source('web/app/api/broadcast/obs/[token]/route.ts')
    expect(api).toContain('normalizeStreamOverlayPackage')
    expect(api).toContain("req.nextUrl.searchParams.get('data') === '1'")
    expect(api).toContain('loadPublicStreamPackageRenderData')
    expect(api).not.toContain('campeonato_stream_overlays')
    expect(api).not.toContain('selected_overlay_ids')
  })

  test('polling de sessão cai para 1 segundo e dados continuam em ciclo separado', () => {
    const page = source('web/app/broadcast/obs/[token]/page.tsx')
    expect(page).toContain('const SESSION_POLL_MS = 1000')
    expect(page).toContain('const DATA_REFRESH_MS = 6000')
    expect(page).not.toContain('SESSION_POLL_MS = 350')
  })

  test('rota legada de sessions é removida e painel usa somente /api/broadcast/me', () => {
    expect(fs.existsSync(path.join(root, 'web/app/api/broadcast/sessions/route.ts'))).toBe(false)
    const dashboard = source('web/features/broadcast/components/StreamDashboard.tsx')
    expect(dashboard).toContain("authFetch('/api/broadcast/me')")
    expect(dashboard).not.toContain('me.sessions')
  })

  test('migration troca FK antiga pelo tipo oficial validado', () => {
    const sql = source('database/migrations/20260810_stream_package_broadcast_runtime.sql')
    expect(sql).toContain('rename column active_overlay_id to active_overlay_type')
    expect(sql).toContain('broadcast_live_sessions_active_overlay_type_check')
    expect(sql).toContain("'standings_general'")
    expect(sql).toContain("'champion'")
  })
})
