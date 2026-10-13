import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import ts from 'typescript'

const ROOT = process.cwd()
const APP = path.join(ROOT, 'web', 'app')

const COVERAGE = new Map([
  ['/', 'R190'],
  ['/admin', 'R184'],
  ['/afiliados', 'R182'],
  ['/agenda', 'R183'],
  ['/atualizar-senha', 'R185'],
  ['/auth/mobile-callback', 'R189'],
  ['/broadcast/control/[token]', 'R187'],
  ['/broadcast/obs/[token]', 'R187-OBS'],
  ['/campeonatos', 'R161'],
  ['/campeonatos/[id]', 'R162'],
  ['/campeonatos/[id]/pontuador/[jogoId]', 'R165'],
  ['/campeonatos/[id]/regulamento', 'R163'],
  ['/campeonatos/[id]/stream', 'R164'],
  ['/carrinho', 'R181'],
  ['/carteira', 'R183'],
  ['/central-campeonato', 'R166'],
  ['/comunidade', 'R178'],
  ['/convite/equipe/[token]', 'R170/R186'],
  ['/convite/grupo/[token]', 'R186'],
  ['/convite/produtora/[token]', 'R186'],
  ['/equipe/entrar/[token]', 'R170/R186'],
  ['/equipe/reivindicar/[token]', 'R170/R186'],
  ['/equipes', 'R168'],
  ['/equipes/[id]', 'R168'],
  ['/escala/[token]', 'R170/R186'],
  ['/exclusao-de-dados', 'R188'],
  ['/i/[token]', 'R186'],
  ['/jogadores', 'R171'],
  ['/jogadores/[id]', 'R171'],
  ['/lili', 'R187'],
  ['/login', 'R185'],
  ['/managers', 'R175'],
  ['/managers/[id]', 'R175'],
  ['/politica-de-privacidade', 'R188'],
  ['/produtoras', 'R173'],
  ['/produtoras/[id]', 'R173'],
  ['/rank', 'R177'],
  ['/termos-de-servico', 'R188'],
  ['/vagas', 'R179'],
  ['/vagas/compra/[token]', 'R180'],
  ['/vendas/[token]', 'R182'],
  ['/vendedor/[token]', 'R182/R186'],
  ['/vendedores/[managerId]', 'R179'],
])

const REQUIRED_SUBVIEWS = [
  ['Campeonato form', 'web/components/forms/campeonato/CampeonatoForm.tsx'],
  ['Campeonato equipes', 'web/features/campeonatos/equipes/components/CampeonatoEquipesTab.tsx'],
  ['Campeonato jogadores', 'web/features/campeonatos/jogadores/components/CampeonatoJogadoresTab.tsx'],
  ['Campeonato estrutura', 'web/features/campeonatos/fases/components/CampeonatoEstruturaTab.tsx'],
  ['Campeonato estrutura avançada', 'web/features/campeonatos/estrutura-avancada/AdvancedStructureTab.tsx'],
  ['Campeonato jogos', 'web/features/campeonatos/jogos/components/CampeonatoJogosTab.tsx'],
  ['Campeonato calls', 'web/features/campeonatos/calls/components/CampeonatoCallsTab.tsx'],
  ['Campeonato estatísticas', 'web/features/campeonatos/estatisticas/components/CampeonatoEstatisticasTab.tsx'],
  ['Campeonato rulebook', 'web/features/campeonatos/rulebook/components/CampeonatoRulebookTab.tsx'],
  ['Campeonato export', 'web/features/campeonatos/export/components/CampeonatoExportTab.tsx'],
  ['Campeonato stream', 'web/features/campeonatos/stream/components/CampeonatoStreamTab.tsx'],
  ['Painel produtora', 'web/features/dropzone/panels/produtora/ProdutoraPanel.tsx'],
  ['Painel equipe', 'web/features/dropzone/panels/equipe/EquipePanel.tsx'],
  ['Painel jogador', 'web/features/dropzone/panels/jogador/JogadorPanel.tsx'],
  ['Painel manager', 'web/features/dropzone/panels/manager/ManagerPanel.tsx'],
  ['Editor da home', 'web/features/admin/HomePageEditor.tsx'],
]

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

function routeFromPage(file) {
  let dir = path.relative(APP, path.dirname(file)).replaceAll('\\', '/')
  if (!dir || dir === '.') return '/'
  return '/' + dir
}

const pages = walk(APP).filter((file) => path.basename(file) === 'page.tsx')
const routes = pages.map(routeFromPage).sort()
const missing = routes.filter((route) => !COVERAGE.has(route))
const stale = [...COVERAGE.keys()].filter((route) => !routes.includes(route))
const missingSubviews = REQUIRED_SUBVIEWS.filter(([, rel]) => !fs.existsSync(path.join(ROOT, rel)))

console.log(`Inventário de fontes de layout: ${routes.length} rotas page.tsx encontradas. Não executa navegador.`)
for (const route of routes) console.log(`  INVENTÁRIO  ${COVERAGE.get(route) || 'SEM REFERÊNCIA'}  ${route}`)
for (const [label, rel] of REQUIRED_SUBVIEWS) {
  const ok = fs.existsSync(path.join(ROOT, rel))
  console.log(`  ${ok ? 'PRESENTE' : 'AUSENTE'} SUBVIEW ${label} — ${rel}`)
}

// Imports and hashes describe available sources, not the branch actually rendered.
const relative=file=>path.relative(ROOT,file).replaceAll('\\','/'),hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const analyzed=new Map()
function imports(file){
  if(analyzed.has(file))return analyzed.get(file)
  const code=fs.readFileSync(file,'utf8'),values=new Set(),source=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true)
  function visit(node){
    if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))values.add(node.moduleSpecifier.text)
    if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments.length===1&&ts.isStringLiteral(node.arguments[0]))values.add(node.arguments[0].text)
    ts.forEachChild(node,visit)
  }
  if(!file.endsWith('.css'))visit(source)
  const resolved=[],external=[]
  for(const value of values){const base=value.startsWith('@/')?path.join(ROOT,'web',value.slice(2)):value.startsWith('.')?path.resolve(path.dirname(file),value):null
    if(!base){external.push(value);continue}
    const candidate=[base,...['.ts','.tsx','.css','.json','.js','/index.ts','/index.tsx'].map(ext=>base+ext)].find(item=>fs.existsSync(item)&&fs.statSync(item).isFile())
    if(candidate&&relative(candidate)!=='..'&&!relative(candidate).startsWith('../'))resolved.push(candidate)
    else external.push(value)
  }
  const result={resolved,external};analyzed.set(file,result);return result
}
function dependencyGraph(entries){const found=new Set(),packages=new Set();function visit(file){if(found.has(file))return;found.add(file);const row=imports(file);row.external.forEach(value=>packages.add(value));row.resolved.forEach(visit)}entries.forEach(visit);return {files:[...found].map(relative).sort(),unresolvedOrPackageImports:[...packages].sort()}}
const testFiles=walk(path.join(ROOT,'tests-e2e')).filter(file=>file.endsWith('.spec.ts'))
const historicalFile='relatorios-testes/auditoria-2026-10-10/browser-pages.json',historical=fs.existsSync(historicalFile)?JSON.parse(fs.readFileSync(historicalFile,'utf8')):null
function record(label,file,route){
  const entries=[file],layouts=[]
  if(route){let dir=path.dirname(file);while(dir===APP||dir.startsWith(APP+path.sep)){for(const name of ['layout.tsx','layout.ts']){const candidate=path.join(dir,name);if(fs.existsSync(candidate))layouts.push(candidate)}if(dir===APP)break;dir=path.dirname(dir)}entries.push(...layouts)}
  const graph=dependencyGraph(entries),declaredReference=route?COVERAGE.get(route):null,numbers=[...(declaredReference||'').matchAll(/R(\d+)/g)].map(match=>match[1])
  const declaredTestSources=testFiles.filter(file=>numbers.some(number=>new RegExp(`rodada-${number}(?:-|[a-z]|\\.)`,'i').test(path.basename(file)))).map(relative).sort()
  const prior=route?(historical?.results||[]).filter(row=>row.template===route).map(row=>({viewport:row.viewport,state:row.state,status:row.status,overflow:row.overflow,pageErrors:row.errors?.length??null})):[]
  return {label,route:route||null,file:relative(file),sha256:hash(file),layouts:layouts.map(relative).sort(),declaredReference,declaredTestSources,...graph,
    declaredSharedFamilies:graph.files.filter(file=>/components\/(?:ui|shell|workspace|token-flow)|styles\/(?:ui-foundation|dz-layout-tokens)|WorkspaceShell|AppShell/.test(file)),
    historicalBrowser:{file:historicalFile,generatedAt:historical?.generatedAt||null,states:prior,boundToCurrentSources:false},
    currentValidation:{sourceInventory:true,browser:false,contrast:false,zoom:false,keyboard:false,modalStates:false,allConditionalBranches:false,newLayoutCertified:false,architectureCertified:false},
    note:'Declared/reachable imports and old test names do not prove mounted components, all subviews, CSS cascade, or current visual/accessibility conformity.'}
}
const pageRows=pages.sort().map(file=>record(routeFromPage(file),file,routeFromPage(file))),subviews=REQUIRED_SUBVIEWS.filter(([,file])=>fs.existsSync(path.join(ROOT,file))).map(([label,file])=>record(label,path.join(ROOT,file)))
const reportArgument=process.argv.indexOf('--report'),reportFile=path.resolve(ROOT,reportArgument>=0?process.argv[reportArgument+1]||'': 'relatorios-testes/layout-matriz-source.json'),reportRelative=relative(reportFile)
if(!reportRelative.startsWith('relatorios-testes/')||!reportRelative.endsWith('.json'))throw Error('Report must be a JSON file under workspace relatorios-testes')
const sourceFiles=[...new Set([...pageRows,...subviews].flatMap(row=>row.files))].sort().map(file=>({file,bytes:fs.statSync(path.join(ROOT,file)).size,sha256:hash(path.join(ROOT,file))}))
fs.mkdirSync(path.dirname(reportFile),{recursive:true})
fs.writeFileSync(reportFile,JSON.stringify({version:2,generatedAt:new Date().toISOString(),scope:'Current static sources only. No browser, authentication, database or network calls. Historical browser states are not bound to current hashes.',summary:{pages:pageRows.length,subviews:subviews.length,sourceFiles:sourceFiles.length,missingReferences:missing,staleReferences:stale,missingSubviews,currentVisualCertifications:0,currentArchitectureCertifications:0},pages:pageRows,subviews,sourceFiles},null,2)+'\n')
console.log(`Matriz de fontes salva: ${reportRelative}. Estados históricos separados de validação atual.`)

if (missing.length || stale.length || missingSubviews.length) {
  if (missing.length) console.error('\nRotas sem rodada:', missing.join(', '))
  if (stale.length) console.error('\nRotas declaradas que não existem:', stale.join(', '))
  if (missingSubviews.length) console.error('\nSubviews ausentes:', missingSubviews.map(([label]) => label).join(', '))
  process.exit(1)
}

console.log(`\nInventário completo: ${routes.length} rotas referenciadas e ${REQUIRED_SUBVIEWS.length} subáreas presentes. Layout, arquitetura e acessibilidade atuais não certificados por este script.`)
