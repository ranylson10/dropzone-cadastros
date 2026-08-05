import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 87O — agenda responsiva e contextual', () => {
  test('agenda principal oferece navegação diária sem depender da tabela larga', () => {
    const calendar = read('web/features/agenda/components/AgendaCalendar.tsx')
    const css = read('web/features/agenda/agenda.css')
    expect(calendar).toContain('agenda-day-navigation')
    expect(calendar).toContain('agenda-day-panel')
    expect(calendar).toContain('shiftSelectedDay')
    expect(css).toContain('@media (max-width: 760px)')
    expect(css).toContain('.agenda-sheet-scroll')
    expect(css).toContain('display: none')
  })

  test('agendas contextuais são compactas e somente leitura', () => {
    const tabs = read('web/features/directory/components/DirectoryProfileTabs.tsx')
    const championship = read('web/features/directory/components/ChampionshipPublicView.tsx')
    expect(tabs).toContain('canCreate={false}')
    expect(tabs).toContain('compact')
    expect(championship).toContain('canCreate={false}')
    expect(championship).toContain('compact')
  })

  test('carregamento evita consultas duplicadas e usa cache curto', () => {
    const client = read('web/features/agenda/services/agenda-client.ts')
    expect(client).toContain('agendaCache')
    expect(client).toContain('agendaPending')
    expect(client).toContain('Date.now() + 30_000')
  })
})
