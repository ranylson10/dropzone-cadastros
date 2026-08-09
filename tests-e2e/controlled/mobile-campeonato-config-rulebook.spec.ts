import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Mobile campeonato — configurações e regulamento', () => {
  test('mantém edição nativa apoiada nas APIs oficiais existentes', async () => {
    const screen = read('app/src/screens/ChampionshipManagementScreen.tsx')
    const settings = read('app/src/screens/ChampionshipSettingsPanel.tsx')
    const rulebook = read('app/src/screens/ChampionshipRulebookPanel.tsx')
    const api = read('app/src/lib/api.ts')
    const dropzone = read('web/app/api/dropzone/route.ts')
    const rulebookRoute = read('web/app/api/campeonatos/[id]/rulebook/route.ts')
    const publishRoute = read('web/app/api/campeonatos/[id]/rulebook/publish/route.ts')

    expect(screen).toContain("['settings','Config.']")
    expect(screen).toContain("['rulebook','Regulamento']")
    expect(screen).toContain('ChampionshipSettingsPanel')
    expect(screen).toContain('ChampionshipRulebookPanel')

    expect(settings).toContain('championshipAdminRecord')
    expect(settings).toContain('updateChampionship')
    expect(settings).toContain('aceita_novas_inscricoes_equipes')
    expect(settings).toContain('permite_troca_jogadores')

    expect(rulebook).toContain('championshipRulebook')
    expect(rulebook).toContain('saveChampionshipRulebook')
    expect(rulebook).toContain('publishChampionshipRulebook')
    expect(rulebook).toContain('resetChampionshipRulebook')
    expect(rulebook).toContain('confirmacoes_alertas')

    expect(api).toContain("entity_type=championship&championship_id=")
    expect(api).toContain("'X-Profile-Type': 'produtora'")
    expect(dropzone).toContain("if (entityType === 'championship')")
    expect(dropzone).toContain('syncRulebookFromCampeonato')
    expect(rulebookRoute).toContain('saveRulebook')
    expect(publishRoute).toContain('publishRulebook')
  })
})
