/**
 * Varredura de integridade: equipes, lines, slots, participações, links de grupo.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const text = readFileSync(resolve('web/.env.local'), 'utf8')
for (const line of text.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  process.env[m[1]] = process.env[m[1]] || v
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const report = { ok: true, findings: [], counts: {}, samples: {} }

function find(sev, code, message, extra = {}) {
  report.findings.push({ severity: sev, code, message, ...extra })
  if (sev === 'critical' || sev === 'high') report.ok = false
}

async function count(table, filter) {
  let q = sb.from(table).select('id', { count: 'exact', head: true })
  if (filter) q = filter(q)
  const { count: c, error } = await q
  if (error) return { error: error.message, count: null }
  return { count: c }
}

// --- loads ---
const [
  equipes,
  lines,
  parts,
  slots,
  groups,
  champs,
  groupLinks,
  vagas,
] = await Promise.all([
  sb.from('equipes').select('id,nome,tag,status,auth_user_id,dono_auth_user_id').limit(2000),
  sb.from('equipe_lines').select('id,equipe_id,nome,status').limit(5000),
  sb.from('campeonato_equipes').select('id,campeonato_id,equipe_id,line_id,grupo_id,slot_id,slot_numero,status,nome_exibicao,origem_entrada').limit(5000),
  sb.from('campeonato_slots').select('id,campeonato_id,grupo_id,fase_id,slot_numero,slot_letra,equipe_id,line_id,status').limit(5000),
  sb.from('campeonato_grupos').select('id,campeonato_id,nome,slots,fase_id').limit(2000),
  sb.from('campeonatos').select('id,nome,status,deleted_at').limit(500),
  sb.from('campeonato_links').select('id,token,tipo,ativo,campeonato_id,grupo_id,expira_em,descricao').eq('tipo', 'inscricao_equipes_grupo').limit(500),
])

const errors = [equipes, lines, parts, slots, groups, champs, groupLinks]
  .map((r) => r.error)
  .filter(Boolean)
if (errors.length) {
  console.log(JSON.stringify({ ok: false, load_errors: errors }, null, 2))
  process.exit(1)
}

const E = equipes.data || []
const L = lines.data || []
const P = parts.data || []
const S = slots.data || []
const G = groups.data || []
const C = champs.data || []
const GL = groupLinks.data || []
const V = [] // campeonato_vagas removida do modelo

report.counts = {
  equipes: E.length,
  lines: L.length,
  participacoes: P.length,
  participacoes_ativas: P.filter((p) => p.status === 'ativo').length,
  slots: S.length,
  grupos: G.length,
  campeonatos: C.length,
  links_grupo: GL.length,
  vagas: V.length,
}

// --- lines without team ---
const equipeIds = new Set(E.map((e) => e.id))
const orphanLines = L.filter((l) => !equipeIds.has(l.equipe_id))
if (orphanLines.length) find('high', 'orphan_lines', `${orphanLines.length} lines sem equipe`, { sample: orphanLines.slice(0, 5) })

// --- equipes without any line ---
const linesByEquipe = new Map()
for (const l of L) {
  const arr = linesByEquipe.get(l.equipe_id) || []
  arr.push(l)
  linesByEquipe.set(l.equipe_id, arr)
}
const equipesSemLine = E.filter((e) => e.status === 'ativo' && !(linesByEquipe.get(e.id) || []).some((l) => l.status !== 'inativo'))
if (equipesSemLine.length) {
  find('high', 'equipe_sem_line', `${equipesSemLine.length} equipes ativas sem line ativa`, {
    sample: equipesSemLine.slice(0, 10).map((e) => ({ id: e.id, nome: e.nome })),
  })
}

// --- duplicate line names per team (case-insensitive) ---
const dupNames = []
for (const [eid, arr] of linesByEquipe) {
  const seen = new Map()
  for (const l of arr) {
    const key = String(l.nome || '').trim().toLowerCase()
    if (!key) continue
    if (seen.has(key)) dupNames.push({ equipe_id: eid, nome: l.nome, a: seen.get(key), b: l.id })
    else seen.set(key, l.id)
  }
}
if (dupNames.length) find('medium', 'dup_line_names', `${dupNames.length} nomes de line duplicados na mesma equipe`, { sample: dupNames.slice(0, 5) })

// --- active parts ---
const activeP = P.filter((p) => p.status === 'ativo')
const lineIds = new Set(L.map((l) => l.id))

// parts without line
const partsNoLine = activeP.filter((p) => !p.line_id)
if (partsNoLine.length) find('high', 'part_sem_line', `${partsNoLine.length} participações ativas sem line_id`, { sample: partsNoLine.slice(0, 5) })

// parts with invalid line
const partsBadLine = activeP.filter((p) => p.line_id && !lineIds.has(p.line_id))
if (partsBadLine.length) find('high', 'part_line_invalida', `${partsBadLine.length} participações com line inexistente`, { sample: partsBadLine.slice(0, 5) })

// same line twice active in same champ
const lineChampKey = new Map()
for (const p of activeP) {
  if (!p.line_id) continue
  const k = `${p.campeonato_id}|${p.line_id}`
  const arr = lineChampKey.get(k) || []
  arr.push(p.id)
  lineChampKey.set(k, arr)
}
const multiLineSame = [...lineChampKey.entries()].filter(([, ids]) => ids.length > 1)
if (multiLineSame.length) {
  find('critical', 'line_duplicada_campeonato', `${multiLineSame.length} lines ativas mais de uma vez no mesmo campeonato`, {
    sample: multiLineSame.slice(0, 5),
  })
}

// same equipe multiple times (info - allowed by design if multi-line)
const equipeChamp = new Map()
for (const p of activeP) {
  const k = `${p.campeonato_id}|${p.equipe_id}`
  equipeChamp.set(k, (equipeChamp.get(k) || 0) + 1)
}
const multiEquipe = [...equipeChamp.entries()].filter(([, n]) => n > 1)
report.samples.multi_vaga_por_equipe = multiEquipe.slice(0, 10).map(([k, n]) => ({ key: k, count: n }))

// same grupo+slot multiple active
const grupoSlot = new Map()
for (const p of activeP) {
  if (!p.grupo_id || p.slot_numero == null) continue
  const k = `${p.grupo_id}|${p.slot_numero}`
  const arr = grupoSlot.get(k) || []
  arr.push(p)
  grupoSlot.set(k, arr)
}
const multiSlot = [...grupoSlot.entries()].filter(([, arr]) => arr.length > 1)
if (multiSlot.length) {
  find('critical', 'slot_grupo_duplicado', `${multiSlot.length} conflitos (grupo_id, slot_numero) com >1 participação ativa`, {
    sample: multiSlot.slice(0, 5).map(([k, arr]) => ({ key: k, ids: arr.map((p) => p.id) })),
  })
}

// --- desync slots vs parts ---
const desyncSlotLivrePartAtiva = []
const desyncSlotOcupadoSemPart = []
const partsByGrupoSlot = new Map()
for (const p of activeP) {
  if (!p.grupo_id || p.slot_numero == null) continue
  partsByGrupoSlot.set(`${p.grupo_id}|${p.slot_numero}`, p)
}

for (const s of S) {
  const k = `${s.grupo_id}|${s.slot_numero}`
  const part = partsByGrupoSlot.get(k)
  const slotOcupado = Boolean(s.equipe_id || s.line_id || s.status === 'ocupado')
  if (!slotOcupado && part) {
    desyncSlotLivrePartAtiva.push({
      slot_id: s.id,
      letra: s.slot_letra,
      num: s.slot_numero,
      grupo_id: s.grupo_id,
      part_id: part.id,
      part_equipe: part.equipe_id,
      part_line: part.line_id,
      nome_exibicao: part.nome_exibicao,
    })
  }
  if (slotOcupado && !part) {
    // maybe part without grupo/slot filled
    const byLine = s.line_id
      ? activeP.find((p) => p.line_id === s.line_id && p.campeonato_id === s.campeonato_id)
      : null
    if (!byLine) {
      desyncSlotOcupadoSemPart.push({
        slot_id: s.id,
        letra: s.slot_letra,
        num: s.slot_numero,
        equipe_id: s.equipe_id,
        line_id: s.line_id,
        status: s.status,
      })
    }
  }
}

if (desyncSlotLivrePartAtiva.length) {
  find('critical', 'desync_slot_livre_part_ativa', `${desyncSlotLivrePartAtiva.length} slots livres com participação ativa (causa do erro falso)`, {
    sample: desyncSlotLivrePartAtiva.slice(0, 10),
  })
}
if (desyncSlotOcupadoSemPart.length) {
  find('high', 'desync_slot_ocupado_sem_part', `${desyncSlotOcupadoSemPart.length} slots ocupados sem participação ativa`, {
    sample: desyncSlotOcupadoSemPart.slice(0, 10),
  })
}

// --- parts with grupo/slot but slot row missing or wrong ---
const slotByGrupoNum = new Map()
for (const s of S) slotByGrupoNum.set(`${s.grupo_id}|${s.slot_numero}`, s)

const partSemSlotRow = []
for (const p of activeP) {
  if (!p.grupo_id || p.slot_numero == null) continue
  const s = slotByGrupoNum.get(`${p.grupo_id}|${p.slot_numero}`)
  if (!s) partSemSlotRow.push(p)
  else if (s.line_id && p.line_id && s.line_id !== p.line_id) {
    find('high', 'slot_line_mismatch', 'Slot e participação apontam lines diferentes', {
      slot_id: s.id,
      part_id: p.id,
      slot_line: s.line_id,
      part_line: p.line_id,
    })
  }
}
if (partSemSlotRow.length) {
  find('medium', 'part_sem_slot_row', `${partSemSlotRow.length} participações com grupo/slot sem row em campeonato_slots`, {
    sample: partSemSlotRow.slice(0, 5),
  })
}

// --- groups: slot count vs declared ---
for (const g of G) {
  const n = S.filter((s) => s.grupo_id === g.id).length
  if (g.slots && n && n !== Number(g.slots)) {
    find('medium', 'grupo_slots_count', `Grupo ${g.nome} declara ${g.slots} slots mas tem ${n} rows`, {
      grupo_id: g.id,
      campeonato_id: g.campeonato_id,
    })
  }
}

// --- group links without grupo/campeonato ---
const brokenLinks = GL.filter((l) => !l.campeonato_id || !l.grupo_id)
if (brokenLinks.length) find('high', 'link_grupo_incompleto', `${brokenLinks.length} links de grupo incompletos`)

// --- vagas desync ---
const partById = new Map(P.map((p) => [p.id, p]))
const vagaOcupadaSemPart = V.filter((v) => v.status === 'ocupada' && v.campeonato_equipe_id && !partById.get(v.campeonato_equipe_id))
const vagaOcupadaPartInativa = V.filter((v) => {
  if (v.status !== 'ocupada' || !v.campeonato_equipe_id) return false
  const p = partById.get(v.campeonato_equipe_id)
  return p && p.status !== 'ativo'
})
if (vagaOcupadaSemPart.length) find('medium', 'vaga_sem_part', `${vagaOcupadaSemPart.length} vagas ocupadas sem participação`)
if (vagaOcupadaPartInativa.length) {
  find('medium', 'vaga_part_inativa', `${vagaOcupadaPartInativa.length} vagas ocupadas apontando part removida`, {
    sample: vagaOcupadaPartInativa.slice(0, 5),
  })
}

// --- probe unique constraints by attempting known patterns (dry via existing multi-line) ---
// Check if second line same team same champ exists (design OK)
report.samples.multi_line_design_ok = multiEquipe.length > 0

// origem_entrada values
const origens = {}
for (const p of P) origens[p.origem_entrada || '(null)'] = (origens[p.origem_entrada || '(null)'] || 0) + 1
report.counts.origem_entrada = origens

const statusP = {}
for (const p of P) statusP[p.status || '(null)'] = (statusP[p.status || '(null)'] || 0) + 1
report.counts.status_participacao = statusP

// Sort findings
const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
report.findings.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))

console.log(JSON.stringify(report, null, 2))
