import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 7 — equipes, grupos e inscrições', () => {
  test('organiza slots por fase e grupo antes das ações', () => {
    const source = read('web/features/campeonatos/equipes/components/CampeonatoEquipesTab.tsx')
    expect(source).toContain('const gruposOperacionais = useMemo')
    expect(source).toContain('group.faseNome')
    expect(source).toContain('group.grupoNome')
    expect(source).toContain('group.ocupadas')
    expect(source).toContain('group.total')
    expect(source).toContain('champ-registration-groups')
  })

  test('hierarquia inicial prioriza inscrições, reservas e vagas livres', () => {
    const source = read('web/features/campeonatos/equipes/components/CampeonatoEquipesTab.tsx')
    expect(source).toContain('<small>inscritas</small>')
    expect(source).toContain('<small>reservadas</small>')
    expect(source).toContain('<small>livres</small>')
    expect(source).toContain('Equipes e inscrições')
    expect(source).toContain('Grupos e slots')
    expect(source).not.toContain('teams-mini-stats')
  })

  test('convites de grupo ficam progressivos', () => {
    const source = read('web/features/campeonatos/equipes/components/CampeonatoEquipesTab.tsx')
    expect(source).toContain('<details className="champ-registration-group-invites">')
    expect(source).toContain('champ-registration-invite-actions')
  })

  test('mobile usa linhas compactas e não tabela espremida', () => {
    const css = read('web/features/campeonatos/equipes/campeonato-equipes.css')
    expect(css).toContain('@media(max-width:760px)')
    expect(css).toContain('grid-template-columns:29px 30px minmax(0,1fr) auto 17px')
    expect(css).toContain('min-height:51px')
    expect(css).not.toContain('box-shadow:')
    expect(css).not.toContain('backdrop-filter:')
  })
})
