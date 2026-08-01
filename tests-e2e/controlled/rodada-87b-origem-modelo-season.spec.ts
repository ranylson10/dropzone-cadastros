import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 87B — origem, modelo e nova season', () => {
  test('criação começa pela origem e pesquisa somente campeonatos do mesmo tipo', () => {
    const source = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(source).toContain("{ id: 'origin', label: 'Origem' }")
    expect(source).toContain('Criar do zero')
    expect(source).toContain('Usar como modelo')
    expect(source).toContain('Criar nova season')
    expect(source).toContain("String(item.data?.tipo || '') === value.tipo")
    expect(source).toContain('campeonato_origem_id')
  })

  test('modelo é independente e season preserva vínculo histórico', () => {
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    const panel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    const api = read('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')
    expect(form).toContain("copied.origem_criacao = value.origem_criacao")
    expect(form).toContain("copied.franquia_origem_id = value.origem_criacao === 'season'")
    expect(panel).toContain('source_championship_id')
    expect(api).toContain('sourceChampionshipId')
    expect(api).toContain("campeonato_edicoes').upsert")
  })

  test('etapas genéricas não são impostas a Diário e Copa', () => {
    const source = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(source).toContain("['liga', 'xtreino', 'confronto'].includes(value.tipo)")
    expect(source).toContain("value.tipo === 'liga' ? 'Liga' : 'Formato'")
    expect(source).toContain("type: 'diario'")
    expect(source).toContain("type: 'copa'")
  })
})
