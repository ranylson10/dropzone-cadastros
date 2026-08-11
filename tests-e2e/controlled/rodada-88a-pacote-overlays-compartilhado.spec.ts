import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 88A — pacote de overlays compartilhado', () => {
  test('modelo concentra configuração e assets no campeonato_stream_pack', () => {
    const sql = source('database/migrations/20260810_stream_overlay_package_model.sql')
    expect(sql).toContain('enabled_overlay_types')
    expect(sql).toContain('assets jsonb')
    expect(sql).toContain('shared_config jsonb')
    expect(sql).toContain('overlay_configs jsonb')
    expect(sql).not.toContain('create table public.stream_overlay_package')
    expect(sql).toContain('drop table if exists public.campeonato_stream_scenes cascade')
  })

  test('sistema oferece dez tipos oficiais de overlay', () => {
    const types = source('web/features/campeonatos/stream/types/stream-package.types.ts')
    const expected = [
      'standings_general', 'round_teams', 'round_players', 'mvp_general', 'mvp_day',
      'mvp_round', 'booyahs_day', 'qualified_teams', 'next_round', 'champion',
    ]
    for (const key of expected) expect(types).toContain(`'${key}'`)
    expect(types).toContain('StreamPackageSharedConfig')
    expect(types).toContain('table_row_bg')
    expect(types).toContain('card_bg')
    expect(types).toContain('event_logo')
  })

  test('workspace usa editor de pacote e interrompe criação avulsa pelo fluxo principal', () => {
    const workspace = source('web/features/campeonatos/stream/components/StreamWorkspace.tsx')
    const tab = source('web/features/campeonatos/stream/components/CampeonatoStreamTab.tsx')
    const index = source('web/features/campeonatos/stream/index.ts')

    expect(workspace).toContain('StreamPackageEditor')
    expect(workspace).not.toContain('/overlays/novo')
    expect(tab).toContain('Abrir pacote')
    expect(tab).not.toContain('Nova overlay')
    expect(index).not.toContain('StreamOverlaysHub')
  })

  test('editor compartilha identidade, imagem, texto, tabela, cards e animação', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
    for (const label of [
      'Identidade compartilhada',
      'Logo / imagem solta',
      'Título solto',
      'Tabelas compartilhadas',
      'Cards compartilhados',
      'Animação compartilhada',
      'Configuração individual',
    ]) {
      expect(editor).toContain(label)
    }
  })
})
