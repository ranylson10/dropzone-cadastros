import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 87B — origem, modelo e nova season', () => {
  test('criação começa pela origem e pesquisa somente campeonatos do mesmo tipo', () => {
    const source = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(source).toContain("{ id: 'origin', label: 'Início' }")
    expect(source).toContain('Criar novo')
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
    expect(form).toContain("editionNumber = json?.edition ? Number(json.edition.numero_edicao || 1) + 1 : 2")
    expect(form).toContain("copied.titulo_publico = copied.nome")
    expect(panel).toContain('source_championship_id')
    expect(api).toContain('sourceChampionshipId')
    expect(api).toContain("campeonato_edicoes').upsert")
  })

  test('Diário e Copa seguem para estrutura sem etapa técnica de season', () => {
    const source = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(source).toContain("value.tipo === 'diario' && 'Um grupo e um jogo.")
    expect(source).toContain("mode === 'create' && value.tipo === 'copa'")
    expect(source).toContain('Como começa esta Copa?')
    expect(source).toContain("{ id: 'origin', label: 'Início' }")
    expect(source).toContain("{ id: 'format' as const, label: 'Estrutura' }")
    expect(source).not.toContain("...(value.origem_criacao === 'season' || value.tipo === 'liga'")
  })
})
