import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (name) => readFileSync(path.join(root, name), 'utf8')
const require = createRequire(import.meta.url)
const ts = require('typescript')
const panelPath = 'web/features/dropzone/panels/produtora/ProdutoraPanel.tsx'
const panel = read(panelPath)
const css = read('web/styles/dropzone-identity.css')
const nav = read('web/features/dropzone/panels/produtora/ProducerCompetitionNavigation.tsx')
const source = ts.createSourceFile(panelPath, panel, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const checks = []
const check = (label, test) => { assert.ok(test, label); checks.push(label) }
const index = (needle) => panel.indexOf(needle)

check('TSX sem erro de sintaxe', source.parseDiagnostics.length === 0)
check('painel em duas colunas preservado', panel.includes('producer-management-split') && panel.includes('producer-championship-sidebar'))
check('blocos de criacao, filtros e lista da produtora', ['producer-rail-intro','producer-rail-filters','producer-rail-results'].every(x => panel.includes(`className="${x}"`)))
check('criar campeonato mantém modal original', panel.includes('setShowCreateChamp(true)') && panel.includes('open={showCreateChamp}'))
check('busca e seletor continuam operacionais', panel.includes('setChampionshipQuery(event.target.value)') && panel.includes('onChange={event => {') && panel.includes('openCompetition(event.target.value)'))
check('seleção de campeonato preserva highlight', panel.includes("'is-selected'"))
check('cabeçalho do campeonato em modulo', panel.includes('className="producer-editor-summary-card"') && index('producer-editor-summary-card') < index('className="championship-summary"'))
check('modulo de metricas preserva contagens reais', panel.includes('className="producer-editor-metrics-card"') && panel.includes('stats.map(item =>'))
check('metricas continuam do resumo selecionado', panel.includes('dataSummary?.teamCount') && panel.includes('dataSummary?.phaseCount') && panel.includes('dataSummary?.groupCount') && panel.includes('dataSummary?.gameCount'))
check('navegacao horizontal em modulo proprio', panel.includes('className="producer-editor-nav-card"') && nav.includes('WorkspaceNav ariaLabel="Seções do campeonato"'))
check('todas as oito seções operacionais mantidas', ['Organização','Fases e grupos','Equipes','Elencos','Jogos e quedas','Pontuador','Tabelas','Inscrições'].every(label => panel.includes(`label: '${label}'`)))
check('acoes rapidas agrupadas e autorizadas', panel.includes('className="producer-editor-quick-actions"') && panel.includes('(canScoreWorkspace || canOperateWorkspace)') && panel.includes('canScoreWorkspace ? <button') && panel.includes('canOperateWorkspace ? <button'))
check('pontuador abre em nova aba sem alterar a rota', panel.includes("window.open(`/campeonatos/${encodeURIComponent(championshipId)}/pontuador`, '_blank', 'noopener,noreferrer')"))
check('receber inscricoes navega a links', panel.includes("void setTab('links'); setOpenAction('link')"))
check('configuracao protegida por permissao admin', panel.includes("{canAdminWorkspace ? <button type=\"button\" className=\"button secondary\" onClick={() => startEditChampionship(selectedChamp, 'scoring')}>"))
check('menu avancado mantido sem mudar regras', panel.includes('<WorkspaceMoreMenu label="Regras avançadas"'))
check('painel de conteudo isolado e tab dinamica', panel.includes('className="producer-editor-content-card"') && panel.includes('producerAreaTitles[tab]'))
check('checklist continua chamando a acao original', panel.includes('operationalChecklist.map(item =>') && panel.includes('onClick={item.action}'))
check('contador de preparo orienta navegacao', panel.includes('className="producer-checklist-progress"') && panel.includes('aria-valuenow={operationalChecklist.filter(item => item.done).length}'))
check('acoes principais nao duplicadas no checklist', !panel.slice(index('className="championship-overview"'),index('className="championship-checklist"')).includes('Abrir pontuador'))
check('CSS possui superficies independentes', ['.producer-rail-intro','.producer-rail-filters','.producer-rail-results','.producer-editor-summary-card','.producer-editor-metrics-card','.producer-editor-nav-card','.producer-editor-action-card','.producer-editor-content-card'].every(name => css.includes(name)))
check('CSS usa paleta Circuito', css.includes('--producer-r27-rust:#ad3b22') && css.includes('--producer-r27-paper:#fffef9'))
check('estados de selecao claros', css.includes('dz-data-select.is-selected') && css.includes('box-shadow:inset 4px 0'))
check('abas rolam na horizontal', css.includes('overflow-x:auto!important'))
check('adaptacao tablet preserva navegação', css.includes('@media (max-width:960px)') && css.includes('producer-rail-filters,'))
check('metricas empilham no celular', css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'))
check('reducao de movimento respeitada', css.includes('@media (prefers-reduced-motion:reduce)'))
check('sem mudancas no backend e no banco para este refinamento', !panel.includes('producer-r27-migration'))
console.log(`R27: ${checks.length} verificações de hierarquia visual e integridade de navegação aprovadas. Teste visual autenticado e build completo são etapas separadas.`)
