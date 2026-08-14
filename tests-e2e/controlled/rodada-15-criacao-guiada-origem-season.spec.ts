import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 15 — criação guiada por origem', () => {
  test('mantém a escolha de formato e transforma a próxima etapa em assistente', () => {
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('<h3>Escolha o formato</h3>')
    expect(form).toContain('Como você quer criar este campeonato?')
    expect(form).toContain('<strong>Criar novo</strong>')
    expect(form).toContain('<strong>Usar como modelo</strong>')
    expect(form).toContain('<strong>Criar nova season</strong>')
    expect(form).toContain("const [originChoice, setOriginChoice]")
    expect(form).toContain("{ id: 'origin', label: 'Início' }")
    expect(form).not.toContain("{ id: 'identity', label: 'Identidade' },\n        ...(value.origem_criacao")
  })

  test('criar novo pede somente nome, logo e banner antes da estrutura', () => {
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain("originChoice === 'novo' ? renderGuidedIdentity() : null")
    expect(form).toContain('<Field label="Nome do campeonato">')
    expect(form).toContain('UploadField label="Logo *"')
    expect(form).toContain('UploadField label="Banner da vitrine"')
    expect(form).toContain('Defina somente a identidade básica agora')
  })

  test('modelo e season só mostram pesquisa após a escolha', () => {
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain("originChoice === 'modelo' || originChoice === 'season'")
    expect(form).toContain("originChoice === 'season' ? 'Pesquisar season' : 'Pesquisar modelo'")
    expect(form).toContain("String(item.data?.tipo || '') === value.tipo")
    expect(form).toContain('championship-source-selected')
    expect(form).toContain('Trocar')
  })

  test('season herda dados mas preserva vínculo e deixa o novo nome editável', () => {
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    const panel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    const api = read('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')

    expect(form).toContain("copied.franquia_origem_id = value.origem_criacao === 'season'")
    expect(form).toContain("editionNumber = json?.edition ? Number(json.edition.numero_edicao || 1) + 1 : 2")
    expect(form).toContain("copied.temporada = `Season ${Math.max(2, editionNumber)}`")
    expect(form).toContain('copied.titulo_publico = copied.nome')
    expect(form).not.toContain('copied.nome = copied.titulo_publico')
    expect(form).toContain("titulo_publico: value.origem_criacao === 'season' ? nextName : value.titulo_publico")
    expect(panel).toContain('source_championship_id')
    expect(panel).toContain("franchise_id: form.origem_criacao === 'season'")
    expect(api).toContain("campeonato_edicoes').upsert")
  })

  test('não mostra campos técnicos de histórico durante a criação guiada', () => {
    const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain("hidden={mode !== 'edit' || !pageVisible('season')}")
    expect(form).toContain("hidden={mode !== 'edit' || !pageVisible('identity')}")
    expect(form).toContain("value.origem_criacao === 'season' ? (")
  })

  test('CSS mantém o assistente no dark/gold sem cards claros concorrentes', () => {
    const css = read('web/app/globals.css')
    expect(css).toContain('.championship-guided-copy{')
    expect(css).toContain('.championship-guided-identity{')
    expect(css).toContain('.championship-source-item{ min-width: 0; min-height: 70px;')
    expect(css).toContain('background: var(--ui-surface-raised); color: var(--ui-text);')
    expect(css).toContain('.championship-source-selected{')
    expect(css).not.toContain('.championship-source-item{ min-width: 0; min-height: 82px;')
    expect(css).not.toContain('background: #fff; color: #1d2430;')
  })
})
