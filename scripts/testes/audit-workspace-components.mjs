import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const exists = (rel) => fs.existsSync(path.join(root, rel))
const checks = []
const ok = (label, condition) => checks.push({ label, condition: Boolean(condition) })

const shared = [
  'web/components/workspace/WorkspaceShell.tsx',
  'web/components/workspace/index.ts',
  'web/styles/workspace.css',
]
for (const file of shared) ok(`existe ${file}`, exists(file))

const shell = read('web/components/workspace/WorkspaceShell.tsx')
const css = read('web/styles/workspace.css')
const layout = read('web/app/layout.tsx')

for (const symbol of ['WorkspaceShell', 'WorkspaceHeader', 'WorkspaceNav', 'WorkspaceSubnav', 'WorkspaceContent']) {
  ok(`exporta ${symbol}`, shell.includes(`export function ${symbol}`))
}
ok('workspace usa uma raiz canônica', shell.includes("'dz-workspace'") && shell.includes('data-workspace-kind'))
ok('navegação primária canônica', shell.includes("'dz-workspace-nav'") && shell.includes('data-workspace-nav'))
ok('navegação secundária canônica', shell.includes("'dz-workspace-subnav'"))
ok('CSS workspace carregado globalmente', layout.includes("@/styles/workspace.css"))
ok('CSS define header compartilhado', css.includes('.dz-workspace-header{'))
ok('CSS define navegação compartilhada', css.includes('.dz-workspace-nav{') && css.includes('.dz-workspace-subnav{'))
ok('CSS define conteúdo compartilhado', css.includes('.dz-workspace-content{'))
ok('workspace canônico neutraliza grid legado do dashboard', css.includes('.dz-workspace.dashboard{grid-template-columns:minmax(0,1fr)!important}'))

const panels = [
  ['produtora', 'web/features/dropzone/panels/produtora/ProdutoraPanel.tsx'],
  ['equipe', 'web/features/dropzone/panels/equipe/EquipePanel.tsx'],
  ['jogador', 'web/features/dropzone/panels/jogador/JogadorPanel.tsx'],
  ['manager', 'web/features/dropzone/panels/manager/ManagerPanel.tsx'],
]

for (const [kind, file] of panels) {
  const source = read(file)
  ok(`${kind}: usa WorkspaceShell`, source.includes(`<WorkspaceShell kind="${kind}"`))
  ok(`${kind}: usa WorkspaceHeader`, source.includes('<WorkspaceHeader'))
  ok(`${kind}: usa WorkspaceNav`, source.includes('<WorkspaceNav'))
  ok(`${kind}: usa WorkspaceContent`, source.includes('<WorkspaceContent'))
}

const producer = read(panels[0][1])
const team = read(panels[1][1])
const player = read(panels[2][1])
const manager = read(panels[3][1])

ok('produtora: subnav financeiro/equipe compartilhada', (producer.match(/<WorkspaceSubnav/g) || []).length >= 2)
ok('equipe: subnav elenco/mais compartilhada', (team.match(/<WorkspaceSubnav/g) || []).length >= 2)
ok('manager: contextos usam MANAGER_CONTEXT_CARDS', manager.includes('MANAGER_CONTEXT_CARDS.map'))
ok('manager: perfil faz parte da nav canônica', manager.includes("{ id: 'perfil', label: 'Perfil'"))
ok('manager: perfil não duplica vendas ao editar', manager.includes("mode === 'produtora' && !showManagerPerfil"))

const legacyRoots = [
  ['produtora', producer, 'producer-hub-nav-primary'],
  ['produtora subnav', producer, 'producer-hub-subnav'],
  ['equipe', team, 'team-primary-nav'],
  ['equipe subnav', team, 'team-secondary-nav'],
  ['jogador', player, 'player-primary-nav'],
  ['manager', manager, 'manager-mode-nav-main'],
  ['manager subnav', manager, 'manager-subnav'],
]
for (const [label, source, token] of legacyRoots) ok(`${label}: nav antiga removida do JSX`, !source.includes(token))

console.log('Auditoria R199 — workspace compartilhado')
for (const check of checks) console.log(`${check.condition ? 'OK ' : 'ERRO'} ${check.label}`)
const failed = checks.filter((check) => !check.condition)
if (failed.length) {
  console.error(`ERRO: ${failed.length} verificação(ões) falharam.`)
  process.exit(1)
}
console.log(`OK: ${checks.length}/${checks.length} verificações passaram.`)
