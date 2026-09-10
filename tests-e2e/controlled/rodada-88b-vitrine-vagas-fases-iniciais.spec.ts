import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 88B — vitrine de vagas e fases iniciais', () => {
  test('página /vagas tem filtros comerciais e badges de venda', async () => {
    const page = read('web/app/vagas/page.tsx')
    const card = read('web/features/vacancies/VacancyCard.tsx')
    const api = read('web/app/api/vagas/route.ts')

    for (const label of ['Hoje', 'Grátis', 'Com live', 'Premiação', 'Últimas vagas']) {
      expect(page).toContain(label)
    }

    expect(page).toContain("filter === 'live'")
    expect(page).toContain("filter === 'prize'")
    expect(page).toContain("filter === 'last'")
    expect(page).toContain('vaga')
    expect(page).toContain('<VacancyCard')
    expect(page).toContain('vacancy-catalog-grid')
    expect(card).toContain('vacancy-catalog-card')
    expect(card).toContain('vacancy-catalog-facts')
    expect(card).toContain('vacancy-catalog-actions')
    expect(read('web/features/vacancies/vacancy-card.css')).toContain('aspect-ratio:4/5')

    expect(api).toContain('premiacao')
    expect(api).toContain('tem_live')
    expect(api).toContain('entryPhaseIds')
    expect(api).toContain('officialTotal')
    expect(api).toContain('officialFree')
  })

  test('criação de campeonato sincroniza fases iniciais com Grupos e fases', async () => {
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    const shell = read('web/features/dropzone/DropZoneHome.tsx')
    const producer = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')

    expect(form).toContain('numero_fases: string')
    expect(form).toContain('nomes_fases: string[]')
    expect(form).toContain('Fases iniciais')
    expect(form).toContain('Estas fases serão criadas automaticamente')
    expect(form).toContain('As vagas comerciais contam somente a fase de entrada')
    expect(form).toContain('updateInitialPhaseCount')
    expect(form).toContain('updateInitialPhaseName')

    expect(shell).toContain("numero_fases: '1'")
    expect(shell).toContain("nomes_fases: ['Fase 1']")

    expect(producer).toContain('createInitialPhases')
    expect(producer).toContain("action: 'create_bulk', fases: phasePayload")
    expect(producer).toContain('await createInitialPhases(created.id, resolvedChampionship)')
    expect(producer).toContain('reloadStructure')
  })
})
