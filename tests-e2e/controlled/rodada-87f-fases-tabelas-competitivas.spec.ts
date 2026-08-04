import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')

function source(file: string) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

test.describe('Rodada 87F — fases e tabelas competitivas', () => {
  test('mantém o nome das fases legível no cabeçalho grafite', () => {
    const css = source('web/app/globals.css')
    expect(css).toContain('.phase-folder-row .folder-toggle strong')
    expect(css).toContain('color: #f7f7f5')
  })

  test('tabela geral mostra somente grupo, quedas, booyah, abates e pontos', () => {
    const component = source('web/features/campeonatos/estatisticas/components/CampeonatoEstatisticasTab.tsx')
    expect(component).toContain('title="Grupo">GP')
    expect(component).toContain('title="Quedas">QD')
    expect(component).toContain('title="Booyah">B!')
    expect(component).toContain('title="Abates">KILL')
    expect(component).toContain('title="Pontos">PTS')
    expect(component).not.toContain('<th>P. posição</th>')
    expect(component).not.toContain('<th>P. abates</th>')
  })

  test('MVP mostra somente quedas, KD e abates', () => {
    const component = source('web/features/campeonatos/estatisticas/components/CampeonatoEstatisticasTab.tsx')
    expect(component).toContain('title="Abates por queda">K.D')
    expect(component).toContain('kdValue(row.abates, row.quedas)')
    expect(component).not.toContain('<th>Dano</th>')
    expect(component).not.toContain('<th>Assist.</th>')
    expect(component).not.toContain('<th>Revives</th>')
  })

  test('API agrega o grupo da equipe sem alterar a pontuação', () => {
    const service = source('backend/src/campeonatos/estatisticas/estatisticas.service.ts')
    expect(service).toContain('grupo_id: row.grupo_id || null')
    expect(service).toContain('pontos_total: 0')
  })
})
