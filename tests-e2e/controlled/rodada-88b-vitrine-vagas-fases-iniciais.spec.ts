import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 88B — vitrine de vagas e fases iniciais', () => {
  test('página /vagas tem filtros comerciais e badges de venda', async () => {
    const page = read('web/app/vagas/page.tsx')
    const css = read('web/app/vagas/vagas.css')
    const api = read('web/app/api/vagas/route.ts')

    for (const label of ['Hoje', 'Grátis', 'Com live', 'Premiação', 'Últimas vagas']) {
      expect(page).toContain(label)
    }

    expect(page).toContain("filter === 'live'")
    expect(page).toContain("filter === 'prize'")
    expect(page).toContain("filter === 'last'")
    expect(page).toContain('vaga')
    expect(page).toContain('vagas reais')
    expect(page).toContain('vacancy-banner-badges')
    expect(page).toContain('vacancy-sale-line')
    expect(page).toContain('Transmissão ao vivo')
    expect(page).toContain('Compra segura, vaga liberada e inscrição guiada pelo sistema.')

    expect(css).toContain('.vacancy-type-badge')
    expect(css).toContain('.vacancy-banner-badges')
    expect(css).toContain('.vacancy-sale-line')
    expect(css).toContain('.vacancy-commercial-badges')

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
    expect(producer).toContain("action: 'create_phase'")
    expect(producer).toContain('await createInitialPhases(created.id, props.championship)')
    expect(producer).toContain('reloadStructure')
  })
})
