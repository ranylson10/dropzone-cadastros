import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 87C — organização guiada de ligas', () => {
  test('liga permite estrutura simples ou agrupamentos personalizados', async () => {
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(form).toContain('Liga simples')
    expect(form).toContain('Liga com agrupamentos')
    expect(form).toContain('Nome do agrupamento')
    expect(form).toContain('Nome personalizado')
    expect(form).toContain('Bronze/Prata/Ouro')
    expect(form).toContain('liga_divisoes')
  })

  test('tipos simples não recebem estrutura avançada de liga', async () => {
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(form).toContain("value.tipo === 'liga' ? (")
    expect(form).toContain("value.tipo === 'copa' ? 'Mata-mata' : 'Jogo único'")
    expect(form).toContain("value.tipo === 'xtreino' ? (")
    expect(form).toContain('Resumo do Xtreino')
    expect(form).toContain('Modo do confronto')
    expect(form).not.toContain('distribuição automática')
  })

  test('configuração da liga permanece no campeonato para edição e cópia', async () => {
    const home = read('web/features/dropzone/DropZoneHome.tsx')
    const panel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')

    expect(home).toContain('liga_nome_agrupamento')
    expect(panel).toContain('champ.data?.liga_divisoes')
    expect(panel).toContain('liga_usa_divisoes')
  })
})
