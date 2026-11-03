import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const focus = read('web/components/workspace/WorkspaceFocus.tsx')
const producer = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
const team = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')
const player = read('web/features/dropzone/panels/jogador/JogadorPanel.tsx')
const manager = read('web/features/dropzone/panels/manager/ManagerPanel.tsx')
const modes = read('web/features/dropzone/panels/manager/manager-modes.ts')
const css = read('web/styles/workspace-r22.css')
const exportsFile = read('web/components/workspace/index.ts')
const layout = read('web/app/layout.tsx')
const pkg = JSON.parse(read('package.json'))
const workflow = read('.github/workflows/quality.yml')
let checks = 0
function ok(name, expr) { assert.ok(expr, name); checks++ }

ok('Componente de foco compartilhado exportado', exportsFile.includes('WorkspaceFocus') && focus.includes('export function WorkspaceFocus'))
for (const role of ['produtora','equipe','jogador','manager','vendedor']) {
  ok(`Papel ${role} declarado`, focus.includes(`'${role}'`))
  ok(`Foco usado para ${role}`, [producer,team,player,manager].some(x => x.includes(`role="${role}"`)))
}
ok('Foco não pode mostrar mais de 3 ações', focus.includes('actions.slice(0, 3)'))
ok('Ações são links ou botões de verdade', focus.includes('<Link key={action.id}') && focus.includes('<button key={action.id}'))
ok('Ação com permissão negada não executa callback', focus.includes('disabled={action.disabled || !action.onClick}'))
ok('Ação sem permissão também não vira link', focus.includes('action.href && !action.disabled'))
ok('Links de foco não usam JS inline', !focus.includes('window.location') && !focus.includes('dangerouslySetInnerHTML'))
ok('Foco usa textos explicativos acessíveis', focus.includes('aria-label="O que fazer agora"') && focus.includes('aria-label={`Ações prioritárias: ${eyebrow}`}'))

for (const [label, source] of [['Produtora',producer],['Equipe',team],['Jogador',player],['Manager',manager]]) {
  ok(`${label} importa foco`, source.includes('WorkspaceFocus'))
}
ok('Produtora cria com a rotina existente', producer.includes('onClick: () => setShowCreateChamp(true)'))
ok('Produtora respeita aprovação', producer.includes("disabled: produtoraAprovacao !== 'aprovado' || !canCreateChampionship"))
ok('Produtora leva à gestão existente', producer.includes("setProducerSection('campeonatos')"))
ok('Equipe navega para elenco existente', team.includes("onClick: () => setTab('jogadores')"))
ok('Equipe encontra campeonato pela rota pública', team.includes("href: '/campeonatos?vagas=1'"))
ok('Jogador pode encontrar equipe', player.includes("onClick: () => setTab('equipe')"))
ok('Jogador consulta competições existentes', player.includes("onClick: () => setTab('competicoes')"))
ok('Não duplicar callout do jogador', !player.includes('className="player-next-step"'))
ok('Vendedor tem tela própria no manager', manager.includes("'Painel do vendedor'") && manager.includes('role="vendedor"'))
ok('Manager tem dashboard separado', manager.includes('role="manager"') && manager.includes("id: 'hub', label: 'Início'"))
ok('Vendas mantidas como área dedicada', manager.includes("label: item.id === 'produtora' ? 'Vendas'"))
ok('Manager mantém áreas antigas', manager.includes('MANAGER_CONTEXT_CARDS.map'))
ok('Manager abre perfil pelo menu avançado', manager.includes('WorkspaceMoreMenu') && manager.includes("id: 'perfil'"))
ok('Vendedor abre configuração antes do link quando falta WhatsApp', manager.includes('actions={whatsapp.trim() ? [') && manager.includes('Defina seu WhatsApp para vender'))
ok('Links externos continuam com funções existentes', manager.includes("href: '/carteira'") && manager.includes('copyPublicLink'))
ok('Perfil do manager aparece sem sobrepor outros contextos', manager.includes('{showManagerPerfil ? (') && manager.includes("{mode === 'equipes' && !showManagerPerfil ? ("))
ok('Arquitetura antiga de ações preservada', manager.includes('ManagerVendasView') && manager.includes('ManagerContextsView'))

// Executa a normalização real, sem Next, usando o TS global instalado no laboratório.
let ts
try { ts = await import('typescript') } catch { try { ts = await import('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js') } catch {} }
if (ts) {
  const compiled = ts.transpileModule(modes, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(compiled, { module, exports: module.exports })
  for (const [input, expected] of [[undefined,'hub'],['hub','hub'],['vendas','produtora'],['campeonatos','produtora'],['produtora','produtora'],['equipes','equipes'],['jogador','jogador'],['nonsense','hub']]) {
    ok(`Normalização ${input ?? 'indefinido'}`, module.exports.normalizeManagerMode(input) === expected)
  }
  for (const file of ['web/components/workspace/WorkspaceFocus.tsx','web/features/dropzone/panels/manager/ManagerPanel.tsx','web/features/dropzone/panels/produtora/ProdutoraPanel.tsx','web/features/dropzone/panels/equipe/EquipePanel.tsx','web/features/dropzone/panels/jogador/JogadorPanel.tsx']) {
    const sf = ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
    ok(`Parsing TSX ${file}`, sf.parseDiagnostics.length === 0)
  }
} else console.log('TypeScript indisponível: checagens AST e runtime ignoradas.')

ok('CSS carregado por último',layout.indexOf("workspace-r22.css") > layout.indexOf("redesign-r20.css"))
ok('Mobile não comprime desktop',css.includes('@media(max-width:820px)') && css.includes('grid-template-columns:minmax(0,1fr)'))
ok('Mobile min 44px toque',css.includes('min-height:56px'))
ok('Respeita preferência de movimento',css.includes('prefers-reduced-motion:reduce'))
ok('Navegação do manager adaptada para quatro destinos',css.includes('[data-workspace-kind="manager"]') && css.includes('grid-template-columns:repeat(4,minmax(0,1fr))'))
ok('Script da rodada registrado no package.json',pkg.scripts['test:round22']==='node scripts/testes/test-round22-role-hubs.mjs')
ok('CI inclui nova rodada',workflow.includes('npm run test:round22'))
ok('R22 preserva retorno da R21',read('docs/redesign/RODADA_22_PAINEIS_POR_PERFIL.md').includes('R21'))
console.log(`R22: ${checks} verificações locais aprovadas (inclui normalização funcional; não substitui teste visual autenticado).`)
