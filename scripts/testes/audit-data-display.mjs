import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []
let checks = 0

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function ok(label, condition, detail = '') {
  checks += 1
  if (condition) console.log(`OK  ${label}${detail ? ` — ${detail}` : ''}`)
  else {
    failures.push(label)
    console.error(`ERRO ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function walk(dir, result = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(rel, result)
    else result.push(rel)
  }
  return result
}

const tableFile = 'web/components/ui/DataTable.tsx'
const listFile = 'web/components/ui/DataList.tsx'
const cssFile = 'web/styles/data-display.css'
const barrel = read('web/components/ui/index.ts')
const layout = read('web/app/layout.tsx')

ok(`existe ${tableFile}`, fs.existsSync(path.join(root, tableFile)))
ok(`existe ${listFile}`, fs.existsSync(path.join(root, listFile)))
ok(`existe ${cssFile}`, fs.existsSync(path.join(root, cssFile)))
ok('barrel exporta DataTable', barrel.includes("export * from './DataTable'"))
ok('barrel exporta DataList', barrel.includes("export * from './DataList'"))
ok('layout carrega CSS único de dados', layout.includes("@/styles/data-display.css"))

const tableSource = read(tableFile)
ok('DataTable marca a tabela canônica', tableSource.includes('data-dz-table="true"'))
ok('DataTable mantém tags semânticas reais', tableSource.includes('<table') && tableSource.includes('<thead') && tableSource.includes('<tbody'))
ok('DataTable exporta células e linhas compartilhadas', ['DataTableRow','DataTableHeaderCell','DataTableCell'].every((name) => tableSource.includes(`function ${name}`)))

const tsx = walk('web').filter((file) => file.endsWith('.tsx'))
const rogueTables = []
let canonicalUses = 0
for (const file of tsx) {
  // walk() usa path.join(), então no Windows o caminho chega com \\ enquanto
  // tableFile é declarado com /. Normalize antes de comparar para nunca contar
  // o próprio primitive canônico como uma tabela duplicada.
  const normalizedFile = file.replace(/\\/g, '/')
  if (normalizedFile === tableFile) continue

  const source = read(file)
  const matches = source.match(/<table\b/g) || []
  if (matches.length) rogueTables.push(`${normalizedFile} (${matches.length})`)
  canonicalUses += (source.match(/<DataTable\b/g) || []).length
}
ok('nenhum <table> direto fora do primitive canônico', rogueTables.length === 0, rogueTables.join(', '))
ok('14 tabelas reais migradas para DataTable', canonicalUses === 14, `${canonicalUses} usos encontrados`)

const expectedConsumers = [
  'web/app/admin/page.tsx',
  'web/app/campeonatos/[id]/pontuador/[jogoId]/page.tsx',
  'web/features/agenda/components/AgendaCalendar.tsx',
  'web/features/billing/WalletPanel.tsx',
  'web/features/campeonatos/export/components/CampeonatoExportTab.tsx',
  'web/features/campeonatos/export/components/SpecMediaPanel.tsx',
  'web/features/campeonatos/stream/components/StreamSpreadsheetPanel.tsx',
  'web/features/directory/components/ChampionshipPublicView.tsx',
]
for (const file of expectedConsumers) {
  ok(`${file} usa tabela canônica`, read(file).includes("@/components/ui/DataTable"))
}

const championship = read('web/features/directory/components/ChampionshipPublicView.tsx')
ok('ranking mobile usa DataList compartilhada', championship.includes('<DataList className="champ-stats-mobile-list">'))
ok('linhas do ranking mobile usam DataListItem', championship.includes('<DataListItem as="article"'))

const directory = read('web/features/directory/components/DirectoryListClient.tsx')
ok('listas públicas de entidades continuam usando EntityListRow compartilhada', directory.includes('<EntityListRow'))

const css = read(cssFile)
ok('fundação protege largura e overflow das tabelas', css.includes('.dz-data-table-viewport') && css.includes('overflow-x: auto'))
ok('fundação protege largura dos itens de lista', css.includes('.dz-data-list__item') && css.includes('max-width: 100%'))

if (failures.length) {
  console.error(`\nFalhou: ${failures.length} verificação(ões).`)
  process.exit(1)
}
console.log(`OK: ${checks}/${checks} verificações passaram. ${canonicalUses} tabelas reais usam a fundação compartilhada.`)
