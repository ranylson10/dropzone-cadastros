import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd(), output = path.resolve(root, process.argv[2] || 'relatorios-testes/rpc-inscricoes-2026-10-11/writers.json')
if (!output.startsWith(root + path.sep)) throw new Error('Output must stay in the workspace')
const tables = new Set(['campeonato_equipes', 'campeonato_slots', 'campeonato_links', 'tokens', 'equipe_lines', 'campeonato_configuracoes', 'campeonatos', 'equipes', 'manager_equipe',
  'produtora_membros', 'manager_produtora', 'managers', 'produtoras', 'campeonato_vendedores', 'sistema_restricoes_conta',
  'campeonato_grupo_escolha_configuracoes', 'campeonato_grupo_escolha_bloqueios', 'campeonato_grupo_escolha_historico'])
const rows = [], dynamic = [], rpcCalls = []
const writes = new Set(['insert', 'update', 'upsert', 'delete'])
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : /\.tsx?$/.test(entry.name) ? [path.join(directory, entry.name)] : [])
}
function fromCall(expression) {
  if (!expression || !ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression)) return null
  if (expression.expression.name.text === 'from') return expression.arguments[0] || null
  return fromCall(expression.expression.expression)
}
const sourceFiles = [...files(path.join(root, 'backend/src')), ...files(path.join(root, 'web/app/api'))]
for (const filename of sourceFiles) {
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true)
  const file = path.relative(root, filename).replaceAll(path.sep, '/')
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text, line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1
      if (writes.has(method)) {
        const table = fromCall(node.expression.expression)
        if (table && ts.isStringLiteral(table) && tables.has(table.text)) rows.push({ file, line, table: table.text, method })
        else if (table && !ts.isStringLiteral(table)) dynamic.push({ file, line, method, tableExpression: table.getText(source) })
      }
      if (method === 'rpc' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) rpcCalls.push({ file, line, function: node.arguments[0].text })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}
const catalogPath = path.join(root, 'relatorios-testes/banco-publicado.json')
const catalog = fs.existsSync(catalogPath) ? JSON.parse(fs.readFileSync(catalogPath, 'utf8')) : null
const functions = (catalog?.functions || []).flatMap(item => {
  const targets = []
  for (const table of tables) {
    const regex = new RegExp(`\\b(insert\\s+into|update|delete\\s+from)\\s+(?:(?:public|"public")\\.)?"?${table}"?(?![\\w])`, 'ig')
    for (const match of (item.definition || '').matchAll(regex)) targets.push({ table, operation: match[1].toLowerCase().replace(/\s+/g, ' ') })
  }
  return targets.length ? [{ function: item.function_name, securityDefiner: item.security_definer, targets, calledFrom: rpcCalls.filter(row => row.function === item.function_name) }] : []
})
const payload = {
  generatedAt: new Date().toISOString(), sourceFiles: sourceFiles.length, literalWrites: rows, dynamicWrites: dynamic,
  includedTables: [...tables], comparison: 'Scope expanded on 2026-10-11 to permission, restriction and choice-policy writers. Counts are not directly comparable to the initial 10-table inventory; corrected the actual table name produtora_membros.',
  catalogGeneratedAt: catalog?.generated_at || null, snapshotFunctionWriters: functions,
  summary: { literalWrites: rows.length, literalWriterFiles: new Set(rows.map(row => row.file)).size, dynamicWrites: dynamic.length, snapshotFunctionWriters: functions.length },
  scope: 'Static AST inventory of literal Supabase chains in backend/src and web/app/api; dynamic targets listed for manual classification. SQL matches use the old sanitized catalog and may include unreachable branches/comments. Not a fresh catalog, exhaustive data-flow analysis, lock-order proof or production safety certification.',
  manuallyReviewedBoundaries: [
    { file: 'backend/src/campeonatos/advanced-structure-read.ts', behavior: 'STR02: structure read moved to backend, complete scoped collections paginated in stable ID order, IN150 stage/execution children, global presentation order restored across batches. History is intentionally bounded to500 choice records/30 executions while all their execution items are paginated. Returned IDs/scope/duplicates validated; Auth actor labels deduplicated and at most8 requests per reader, unavailable labels use the prior fallback. Private Auth email is no longer used as a display label when public name metadata is absent. GET authenticates/authorizes first, uses no-store and hides private diagnostics. Four existing post-write reloads delegate to the same reader; failure after a legacy write still does not imply rollback. Read pages do not share a transactional snapshot and writes/apply/reverse/season remain pending. Evidence uses current saved public metadata and controlled SDK/HTTP fixtures; no new remote calls.' },
    { file: 'backend/src/campeonatos/progression-preview.ts', behavior: 'Progression preview moved to backend. Rule/source/destination and selected participants are scoped to the championship; destination links are paginated with stable ID order. Most recent phase/execution use deterministic limited queries. NULL capacity remains unbounded; zero means no vacancies, matching the current published trigger. Range/ranking/duplicate/malformed capacity/foreign links and late-page failures are rejected, private diagnostics sanitized. No preview writes or transaction/CAS guarantee; apply/reverse remain legacy. Current metadata/owners/ACL/preflight counts collected read-only on12/10 in relatorios-testes/banco-atual-2026-10-12. DBR01/DBR02 and missing Liga schema (LG01) confirmed in the target; candidates still unapplied. Historical catalog matches the reviewed signatures/MD5s and listed definitions, not a full data backup/staging certification.' },
    { file: 'web/app/api/campeonatos/[id]/equipes/participacao-atomica/route.ts', behavior: 'Updated main web/mobile consumers send atomic participation to a dedicated URL. The shared handler authenticates before a required-family/flag guard; disabled/invalid participation mode fails with no legacy reads/writes. Missing route/RPC or 404/405/503 retains original UUID/body, with no fallback to canonical URL. This is a prepared client/server protocol, not activation or protection retroactively added to historical clients. Invitations/choice and all noncooperating writers still require rollout review.' },
    { file: 'web/app/api/campeonatos/[id]/equipes/movimentacao-atomica/route.ts', behavior: 'Dedicated PATCH handles only move/swap/shuffle_group/distribute_phase and requires the movement flag. Its participation flag is independent; a family mismatch cannot enter legacy review. Existing canonical legacy callers remain compatible, including historical Idempotency-Key headers. Generic season/progression/structure writers have not been made transactional. Supplemental local inventory and branch reviews are in relatorios-testes/contrato-atomico-2026-10-12/writers-expanded.json; the 18-table counts below are narrower and not directly comparable.' },
    { file: 'web/app/api/campeonatos/[id]/escolha-grupo/route.ts', behavior: 'Choose/cancel/restore have an opt-in RPC with ownership/window/block checks, exact cancellation intent and transactional notification/history/receipt. SLOT_MOVEMENT_MODE remains legacy; legacy blind release/compensation paths remain pending. Team restoration in the candidate now respects target blocks.' },
    { file: 'web/app/api/campeonatos/[id]/estrutura-avancada/route.ts', behavior: 'Manual assign/cancel/restore share the opt-in choice wrapper. Deletion is scoped by championship/parent identity; creation/relation/franchise inputs are validated before legacy writes. Progression has the unapplied 20261012_progression_candidate.sql and PROGRESSION_WRITE_MODE opt-in: authoritative ranking/fence, atomic apply/reverse with complete private images/receipts, parent guards for ordinary links/results/phases/rules/executions/items and revision against ABA. Updated web uses a dedicated atomic URL and persisted original intent; disabled/missing endpoint fails closed without canonical fallback. Native53, HTTP/client47 and component browser fixtures are local evidence; staging, permission phantoms, remaining structure/season/other writers and real infrastructure still require review. Current mode remains legacy.' },
    { file: 'web/app/api/campeonatos/[id]/equipes/route.ts', behavior: 'GET is read-only/no-store and validates public championship visibility before roster/token reads. Own-only seller removal remains own-only; actual seller row and current manager ownership/status are fenced. Requests enforce public visibility/closure/deadline and rejected-row/review updates use status/version CAS. Independent PARTICIPATION_WRITE_MODE prepares add/request/approve/reject/remove in one RPC with exact expected snapshots, atomic line/audit/receipt, direct seller/Liga quotas and guarded soft removal; legacy is still default. Main web/mobile participation consumers prepare original UUID/body persistence, account binding and authorized version DTOs; web batch adds are sequential, not one transaction. Advanced web/Lili league origin selectors are prepared with local quota/batch validation, scoped private plan DTO and durable original origin recovery; league normalization/legacy add reject invalid counts. Integer league quota parity is corrected and validated in the unapplied candidate by 324 native cases (91 league), from the historical reconstructed catalog. SLOT_MOVEMENT_MODE remains legacy. Lili move/swap/shuffle have prepared persisted original intents, read actor/occupant binding and explicit recovery. Shuffle/distribution batch intents use exact authorized row versions and scoped expected sets. A shared pure runtime lease and pending guards now prevent participation/movement overlap in the main web and mobile consumers, including storage preparation and explicit local discard in the app. This lease is local to each runtime, not a cross-device/server lock. Mobile transport binds the private read actor to the current stored session before/after persistence, uses the fresh bearer, respects movement legacy/atomic mode, and requires the complete movement DTO before retiring atomic attempts. Private GET equipes now exposes movement mode/actor and authorized versions; a separate scoped paginated physical-slot read fences display-view derived occupants. Orphans/mismatched mirrors have no movement snapshot. Token renewal retains selection; actor/championship epochs and unmount cancel old confirmation/discard callbacks. Legacy Lili shuffle refuses groups containing reserved/blocked positions. Distribution was in an unreachable config branch; it is now in Groups only in atomic mode, pending reviewed activation. These client fixtures do not establish staging or real Auth/PostgREST/Realtime safety. Season and device QA remain pending. Season suggestions, legacy compensation and other writers remain pending.' },
    { file: 'backend/src/campeonatos/campeonato-permissions.ts', behavior: 'Strict JSON booleans, distinct full/own seller-removal scope and paginated tier precedence. Internal sellerRowId is used with the current manager relation, and is not exposed by permissionPublicPayload. Existing grants are locked in the SQL candidates; new membership/restriction phantoms and noncooperating writers remain pending. Native schema has unique manager profiles per auth user; multi-profile fixtures are compatibility only.' },
  ],
  productionWrites: 0,
}
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(payload, null, 2))
console.log(JSON.stringify(payload.summary))
