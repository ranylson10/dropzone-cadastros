import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (name) => readFileSync(path.join(root, name), 'utf8')
const require = createRequire(import.meta.url)
const ts = require('typescript')
const panelPath = 'web/features/dropzone/panels/produtora/ProdutoraPanel.tsx'
const navPath = 'web/features/dropzone/panels/produtora/ProducerCompetitionNavigation.tsx'
const scorerPath = 'web/app/campeonatos/[id]/pontuador/page.tsx'
const panel = read(panelPath)
const nav = read(navPath)
const scorer = read(scorerPath)
const css = read('web/styles/dropzone-identity.css')
let checks = 0
const check = (label, condition) => { assert.ok(condition, label); checks += 1 }

for (const file of [panelPath, navPath, scorerPath]) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  check(`TSX de ${file}`, source.parseDiagnostics.length === 0)
}
check('colunas montadas no mesmo workspace', panel.includes('producer-management-split') && panel.includes('producer-championship-sidebar') && panel.includes('championship-detail-card panel'))
check('lista permanece visível ao abrir detalhes', !panel.includes("producerSection === 'campeonatos' && !championshipDetailOpen ? <section"))
check('campeonato no detalhe selecionado', panel.includes('selectedChamp && championshipDetailOpen'))
check('seleção de campeonato acessível no mobile', panel.includes('aria-label="Selecionar campeonato"'))
check('seleção marca item ativo', panel.includes('aria-current={championshipDetailOpen && selectedChamp?.id === champ.id'))
check('criação mantém modal original', panel.includes('open={showCreateChamp}') && panel.includes('Criar campeonato'))
check('status e pagamento permanecem no detalhe', panel.includes('Pacote DropZone') && panel.includes('Pagar online com PIX'))
check('gestão continua protegida por permissões', panel.includes('canOperateWorkspace') && panel.includes('canScoreWorkspace') && panel.includes('canAdminWorkspace'))
check('abas horizontais preservam todas seções', ['Organização','Fases e grupos','Equipes','Elencos','Jogos e quedas','Pontuador','Tabelas','Inscrições'].every(x => panel.includes(`label: '${x}'`)))
check('pontuador abre nova aba sem reutilizar o painel', panel.includes('window.open(`/campeonatos/${encodeURIComponent(championshipId)}/pontuador`, \'_blank\', \'noopener,noreferrer\')'))
check('pontuador usa seleção de fase e jogo existente', scorer.includes('<ProducerScoringWorkspace campeonatoId={id} />'))
check('roteamento por jogo continua existente', existsSync(path.join(root,'web/app/campeonatos/[id]/pontuador/[jogoId]/page.tsx')))
check('abas usam navegação acessível existente', nav.includes('WorkspaceNav ariaLabel="Seções do campeonato"'))
check('CSS define duas colunas', css.includes('grid-template-columns:minmax(248px,290px) minmax(0,1fr)'))
check('mobile usa seletor', css.includes('.producer-mobile-champ-selector {display:grid'))
check('abas podem rolar horizontalmente', css.includes('overflow-x:auto!important'))
check('faixa da produtora destacada', css.includes('.producer-console .producer-console-identity {') && css.includes('border-left:5px solid #c24e33'))
check('respeita movimento reduzido', css.includes('@media(prefers-reduced-motion:reduce)'))
console.log(`R26: ${checks} verificações do painel da produtora aprovadas; build e visual autenticado precisam de teste separado.`)
