import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 87O1 — agenda contextual somente com datas de jogos', () => {
  test('agenda pessoal mantém navegação diária responsiva', () => {
    const calendar = read('web/features/agenda/components/AgendaCalendar.tsx')
    expect(calendar).toContain('agenda-day-navigation')
    expect(calendar).toContain('agenda-day-panel')
    expect(calendar).toContain('shiftSelectedDay')
  })

  test('agenda contextual agrupa e mostra somente datas com eventos', () => {
    const calendar = read('web/features/agenda/components/AgendaCalendar.tsx')
    const css = read('web/features/agenda/agenda.css')
    expect(calendar).toContain('const contextualMode = Boolean(props.compact && !canCreate)')
    expect(calendar).toContain('agenda-sequence')
    expect(calendar).toContain('eventMonths.map')
    expect(calendar).toContain('Nenhum jogo ou compromisso agendado nos próximos meses.')
    expect(css).toContain('.agenda-sequence-month')
    expect(css).toContain('.agenda-sequence-day')
  })

  test('campeonato e perfis públicos não permitem criar agenda', () => {
    const tabs = read('web/features/directory/components/DirectoryProfileTabs.tsx')
    const championship = read('web/features/directory/components/ChampionshipPublicView.tsx')
    expect(tabs).toContain('canCreate={false}')
    expect(championship).toContain('canCreate={false}')
    expect(championship).toContain('Datas e horários do campeonato')
  })
})
