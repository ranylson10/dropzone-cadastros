/**
 * Validação estática dos fluxos críticos (sem banco).
 * Rode: node scripts/validate-code-flows.mjs
 */
import fs from 'fs'
import path from 'path'

const root = process.cwd()
const fails = []
const warns = []
const oks = []

function read(rel) {
  const p = path.join(root, rel)
  if (!fs.existsSync(p)) return null
  return fs.readFileSync(p, 'utf8')
}

function mustInclude(rel, needles, label) {
  const src = read(rel)
  if (src == null) {
    fails.push(`${label}: arquivo ausente ${rel}`)
    return
  }
  for (const n of needles) {
    if (!src.includes(n)) fails.push(`${label}: falta "${n}" em ${rel}`)
    else oks.push(`${label}: ok "${String(n).slice(0, 48)}"`)
  }
}

function mustNotInclude(rel, needles, label) {
  const src = read(rel)
  if (src == null) {
    fails.push(`${label}: arquivo ausente ${rel}`)
    return
  }
  for (const n of needles) {
    if (src.includes(n)) fails.push(`${label}: ainda contém legado "${n}" em ${rel}`)
    else oks.push(`${label}: sem legado "${n}"`)
  }
}

// 1) Legado campeonato_vagas no runtime
const banFiles = [
  'web/app/api/campeonatos/[id]/equipes/route.ts',
  'web/app/api/campeonatos/[id]/jogadores/route.ts',
  'web/app/api/campeonatos/[id]/equipes/busca/route.ts',
  'web/app/api/campeonatos/[id]/convites-equipe/[tokenId]/route.ts',
  'web/app/api/campeonatos/[id]/convites-equipe/[tokenId]/renovar/route.ts',
  'web/app/api/convites/equipe/[token]/route.ts',
  'web/app/api/convites/grupo/[token]/route.ts',
  'backend/src/campeonatos/participacao-sync.ts',
]
for (const f of banFiles) {
  mustNotInclude(f, ["from('campeonato_vagas')", 'from("campeonato_vagas")'], 'legado')
}

// 2) Participação sempre via slot
mustInclude(
  'backend/src/campeonatos/participacao-sync.ts',
  ['slot_id: params.slotId', "status: 'ocupado'", "status: 'removido'"],
  'participacao-sync',
)

// 3) Convite equipe: só slot/grupo
mustInclude('web/app/api/convites/equipe/[token]/route.ts', ['slot_id', 'inserirParticipacaoNoSlot', "origem: 'convite'"], 'convite-equipe')
mustNotInclude('web/app/api/convites/equipe/[token]/route.ts', ["from('campeonato_vagas')"], 'convite-equipe')

// 4) Link de grupo
mustInclude(
  'web/app/api/convites/grupo/[token]/route.ts',
  ['inserirParticipacaoNoSlot', "origem: 'link'", 'softRemoveParticipacao'],
  'convite-grupo',
)

// 5) POST equipes admin/vendedor
mustInclude(
  'web/app/api/campeonatos/[id]/equipes/route.ts',
  ['inserirParticipacaoNoSlot', "origem = permission.role === 'seller' ? 'vendedor'", 'getCampeonatoCapacidade'],
  'equipes-api',
)

// 6) Capacidade / limite
mustInclude('backend/src/campeonatos/capacidade.ts', ['assertPodeCriarSlots', 'numero_vagas', 'slots_criados'], 'capacidade')
mustInclude('web/app/api/dropzone/route.ts', ['assertPodeCriarSlots'], 'dropzone-limite')

// 7) Inscrição pública lista só ativo
mustInclude(
  'web/app/api/dropzone/public/inscricao/[token]/route.ts',
  [".eq('status', 'ativo')"],
  'inscricao-publica',
)

// 8) UI envia slot_id
mustInclude(
  'web/features/campeonatos/equipes/components/CampeonatoEquipesTab.tsx',
  ['slot_id: vagaAlvo.id'],
  'ui-equipes',
)

// 9) Manager panel fluxos
mustInclude(
  'web/features/dropzone/panels/manager/ManagerPanel.tsx',
  ['openChampionship', 'ManagerFlowStrip', 'ManagerCampeonatosView'],
  'manager-panel',
)

// 10) Permissões pontuação
mustInclude(
  'backend/src/campeonatos/campeonato-permissions.ts',
  ['requireCampeonatoScore', 'campeonato_vendedores', 'pontuar_tabela'],
  'perms',
)

console.log('\n=== VALIDATE CODE FLOWS ===\n')
for (const o of oks.slice(0, 40)) console.log('  ✓', o)
if (oks.length > 40) console.log(`  … +${oks.length - 40} ok`)
for (const w of warns) console.log('  ⚠', w)
for (const f of fails) console.log('  ✗', f)
console.log(`\nResumo: ${oks.length} ok | ${warns.length} warn | ${fails.length} fail\n`)
process.exit(fails.length ? 1 : 0)
