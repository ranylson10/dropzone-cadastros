import { expect, test } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const root = process.cwd()

function read(relative: string) {
  return fs.readFileSync(path.join(root, relative), 'utf8')
}

test.describe('painel de equipe - ações contextuais', () => {
  test('painel mostra central operacional e ação de escalar elenco no campeonato', () => {
    const panel = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')

    expect(panel).toContain('team-command-center')
    expect(panel).toContain('team-next-game-card')
    expect(panel).toContain('Escalar elenco')
    expect(panel).toContain('team-championship-quick-actions')
    expect(panel).toContain('Copiar token')
    expect(panel).toContain('Gerar link')
    expect(panel).toContain('Ver campeonato')
  })

  test('aba lines abre jogadores/escalações da line no próprio painel', () => {
    const panel = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')

    expect(panel).toContain('LineRosterManager')
    expect(panel).toContain('team-line-inline-detail')
    expect(panel).toContain('openLineDetail')
    expect(panel).toContain('Jogadores')
    expect(panel).toContain('jogador(es) escalado(s) nesta line')
  })

  test('staff não aparece para acesso de manager', () => {
    const panel = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')

    expect(panel).toContain("const showStaffTools = props.accountType !== 'manager'")
    expect(panel).toContain("if (tab === 'staff' && !showStaffTools) setTab('campeonatos')")
  })

  test('diretório de campeonatos tem filtro e ação para campeonatos inscritos', () => {
    const directory = read('web/features/directory/components/DirectoryListClient.tsx')

    expect(directory).toContain('myChampionshipIds')
    expect(directory).toContain('/api/equipe/escalacoes')
    expect(directory).toContain('Meus campeonatos')
    expect(directory).toContain('directory-champ-lineup-action')
    expect(directory).toContain('Escalar elenco')
  })
})
