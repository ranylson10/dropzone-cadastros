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

  test('agenda central carrega o mês e o diretório completo em paralelo', () => {
    const calendar = read('web/features/agenda/components/AgendaCalendar.tsx')
    const css = read('web/features/agenda/agenda.css')
    expect(calendar).toContain('const contextualMode = false')
    expect(calendar).toContain('Promise.all([')
    expect(calendar).toContain('fetchAgenda({ scope: props.scope, scopeId: props.scopeId, year, month, all: true })')
    expect(calendar).toContain('agenda-day-navigation')
    expect(css).toContain('.agenda-day-panel')
  })

  test('campeonato e perfis públicos não permitem criar agenda', () => {
    const tabs = read('web/features/directory/components/DirectoryProfileTabs.tsx')
    const championship = read('web/features/directory/components/ChampionshipPublicView.tsx')
    expect(tabs).not.toContain('AgendaCalendar')
    expect(championship).not.toContain('AgendaCalendar')
    expect(championship).toContain('Datas e horários do campeonato')
  })
})
