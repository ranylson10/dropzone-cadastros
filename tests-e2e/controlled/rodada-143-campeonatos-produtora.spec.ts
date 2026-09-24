import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

const panel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
const tabs = read('web/features/dropzone/panels/produtora/producer-tabs.ts')
const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')
const styles = read('web/app/globals.css')

test.describe('Rodada 143 — campeonatos e gestão simples da produtora', () => {
  test('produtora reduz o primeiro nível para campeonatos operação e comercial', () => {
    expect(panel).toContain('producer-hub-nav producer-hub-nav-primary')
    expect(panel).toContain('<span>Campeonatos</span>')
    expect(panel).toContain('<span>Operação</span>')
    expect(panel).toContain('<span>Comercial</span>')
    expect(panel).not.toContain("setProducerSection('provisorias')")
    expect(panel).not.toContain("setProducerSection('vendedores')")
  })

  test('operação agrupa equipes provisórias e equipe interna', () => {
    expect(panel).toContain('aria-label="Ferramentas de operação da produtora"')
    expect(panel).toContain("setProducerOperationView('provisorias')")
    expect(panel).toContain("setProducerOperationView('staff')")
  })

  test('comercial agrupa vendedores e página de vagas', () => {
    expect(panel).toContain('aria-label="Ferramentas comerciais da produtora"')
    expect(panel).toContain("setProducerCommercialView('vendedores')")
    expect(panel).toContain("setProducerCommercialView('vagas')")
  })

  test('campeonato passa a ter seis áreas principais', () => {
    expect(tabs).toContain("{ id: 'visao', label: 'Início'")
    expect(tabs).toContain("{ id: 'participantes', label: 'Participantes'")
    expect(tabs).toContain("{ id: 'estrutura', label: 'Estrutura'")
    expect(tabs).toContain("{ id: 'jogos', label: 'Jogos'")
    expect(tabs).toContain("{ id: 'resultados', label: 'Resultados'")
    expect(tabs).toContain("{ id: 'mais', label: 'Mais'")
    expect(panel).toContain('aria-label="Áreas do campeonato"')
  })

  test('participantes reúne equipes jogadores e inscrições sem remover funções', () => {
    expect(tabs).toContain("tabs: ['equipes', 'jogadores', 'links']")
    expect(tabs).toContain("{ id: 'links', label: 'Inscrições e links' }")
    expect(panel).toContain('contextualChampTabs.map')
  })

  test('estrutura jogos e mais usam navegação contextual', () => {
    expect(tabs).toContain("tabs: ['grupos', 'regulamento']")
    expect(tabs).toContain("tabs: ['jogos', 'calls']")
    expect(tabs).toContain("tabs: ['financeiro', 'vendedores']")
    expect(panel).toContain('producerWorkspaceForTab(tab)')
  })

  test('calls continuam exclusivos de xtreino', () => {
    expect(panel).toContain("item.id !== 'calls' || selectedChampType.toLowerCase() === 'xtreino'")
    expect(panel).toContain("tab === 'calls' && selectedChamp && selectedChampType.toLowerCase() !== 'xtreino'")
  })

  test('criação rápida usa pontuação Garena padrão e deixa ajuste avançado para edição', () => {
    const createWizard = form.slice(form.indexOf("const wizardPages"), form.indexOf('const currentPageIndex'))
    expect(createWizard).toContain("{ id: 'scoring', label: 'Pontuação' }")
    expect((createWizard.match(/id: 'scoring'/g) || []).length).toBe(1)
    expect(form).toContain('Você pode alterar este sistema depois em Editar campeonato → Pontuação.')
    expect(form).toContain("sistema_pontuacao_tipo: 'garena'")
  })

  test('criação rápida preserva o contrato obrigatório de nome e logo', () => {
    const home = read('web/features/dropzone/DropZoneHome.tsx')
    const api = read('web/app/api/dropzone/route.ts')
    expect(form).toContain('Logo *')
    expect(form).toContain("if (!value.nome.trim() || !value.logo_url) return setWizardError('Informe o nome e envie a logo para continuar.')")
    expect(home).toContain("if (!draft.logo_url.trim())")
    expect(api).toContain("if (!logoUrl) throw new Error('Envie a logo do campeonato.')")
  })

  test('mobile mantém hierarquia em vez de empilhar todas as ferramentas', () => {
    expect(styles).toContain('.producer-hub-nav.producer-hub-nav-primary')
    expect(styles).toContain('.producer-layout-ref .champ-workspace-nav')
    expect(styles).toContain('overflow-x:auto;')
    expect(styles).toContain('.producer-layout-ref .champ-context-nav')
  })

  test('teste da rodada 142 acompanha a migration aplicada em produção', () => {
    const previous = read('tests-e2e/controlled/rodada-142-agenda-notificacoes-realtime.spec.ts')
    expect(previous).toContain('20260924173500_notificacoes_realtime_privado.sql')
    expect(previous).not.toContain('20260924153000_notificacoes_realtime_privado.sql')
  })

  test('navegação competitiva não reintroduz ferramentas de transmissão', () => {
    expect(tabs).not.toContain('stream')
    expect(tabs).not.toContain('broadcast')
    expect(tabs).not.toContain('overlay')
    expect(tabs).not.toContain('OBS')
  })
})
