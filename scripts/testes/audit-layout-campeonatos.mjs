import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const requiredFiles = [
  'web/app/campeonatos/page.tsx',
  'web/app/campeonatos/[id]/page.tsx',
  'web/app/campeonatos/[id]/regulamento/page.tsx',
  'web/app/campeonatos/[id]/stream/page.tsx',
  'web/app/campeonatos/[id]/pontuador/[jogoId]/page.tsx',
  'web/app/central-campeonato/page.tsx',
  'web/components/forms/campeonato/CampeonatoForm.tsx',
  'web/features/campeonatos/equipes/components/CampeonatoEquipesTab.tsx',
  'web/features/campeonatos/jogadores/components/CampeonatoJogadoresTab.tsx',
  'web/features/campeonatos/fases/components/CampeonatoEstruturaTab.tsx',
  'web/features/campeonatos/estrutura-avancada/AdvancedStructureTab.tsx',
  'web/features/campeonatos/jogos/components/CampeonatoJogosTab.tsx',
  'web/features/campeonatos/estatisticas/components/CampeonatoEstatisticasTab.tsx',
  'web/features/campeonatos/calls/components/CampeonatoCallsTab.tsx',
  'web/features/campeonatos/rulebook/components/CampeonatoRulebookTab.tsx',
  'web/features/campeonatos/export/components/CampeonatoExportTab.tsx',
  'web/features/campeonatos/stream/components/CampeonatoStreamTab.tsx',
]

const cssFile = path.join(root, 'web/features/campeonatos/championship-page-refresh.css')
const css = fs.readFileSync(cssFile, 'utf8') + '\n' + fs.readFileSync(path.join(root, 'web/features/directory/components/championship-directory.css'), 'utf8')
const requiredCssMarkers = [
  'R191 — CAMPEONATOS',
  '.directory-market-page .dz-market-showcase',
  '.champ-public-panel',
  '.rulebook-public-page',
  '.local-studio-handoff-page',
  '.scorer-workspace.scorer-sheet-workspace',
  '.championship-central-page',
  '.champ-registration',
  '.championship-players-tab',
  '.structure-workspace',
  '.advanced-structure-stack',
  '.champ-games',
  '.champ-stats',
  '.xt-calls',
  '.rulebook-tab',
  '.export-tab-panel',
  '.stream-tab',
]

let failed = false
console.log('Auditoria R191 — Campeonato página por página')
for (const relative of requiredFiles) {
  const ok = fs.existsSync(path.join(root, relative))
  console.log(`${ok ? 'OK ' : 'ERRO'} ${relative}`)
  if (!ok) failed = true
}
for (const marker of requiredCssMarkers) {
  const ok = css.includes(marker)
  console.log(`${ok ? 'OK ' : 'ERRO'} CSS ${marker}`)
  if (!ok) failed = true
}
if (failed) {
  console.error('ERRO: módulo Campeonatos ainda não está integralmente coberto pela R191.')
  process.exit(1)
}
console.log(`OK: ${requiredFiles.length} arquivos funcionais e ${requiredCssMarkers.length} marcadores visuais cobertos.`)
