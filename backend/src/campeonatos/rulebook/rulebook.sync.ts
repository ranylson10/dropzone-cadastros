/**
 * Sincronização de campos ligados entre campeonato (config) e rulebook.
 * Evita divergência: premiação, taxa, transmissão, plataforma, elenco etc.
 */
import { supabaseAdmin } from '../../shared/supabase-admin'
import type { AnswersMap } from './rulebook.types'

function moneyNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value)
  const raw = String(value ?? '')
    .replace(/r\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, (m, _i, str) => (String(str).includes(',') ? '' : m))
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function moneyText(value: unknown): string {
  const n = moneyNumber(value)
  if (n <= 0) return ''
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function parseDivisao(raw: unknown): Array<{ id: string; nome: string; valor: number }> {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((item: any, i) => ({
      id: String(item?.id || `d-${i}`),
      nome: String(item?.nome || `Posição ${i + 1}`),
      valor: moneyNumber(item?.valor),
    }))
  }
  const text = String(raw).trim()
  if (!text) return []
  if (text.startsWith('[')) {
    try {
      return parseDivisao(JSON.parse(text))
    } catch {
      return []
    }
  }
  return []
}

function formatDivisaoText(items: Array<{ nome: string; valor: number }>): string {
  return items.map((i) => `${i.nome}: ${moneyText(i.valor)}`).join('\n')
}

function buildPremiacaoDescricao(camp: Record<string, any>): string {
  const tipo = String(camp.tipo_premiacao || '').toLowerCase()
  if (tipo === 'sem_premiacao') return 'Sem premiação definida pela organização.'
  if (tipo === 'brinde') return String(camp.descricao_premiacao || 'Brindes conforme a organização.')
  const parts: string[] = []
  const total = moneyNumber(camp.premiacao)
  if (total > 0) parts.push(`Premiação total: ${moneyText(total)}.`)
  const items = parseDivisao(camp.divisao_premiacao)
  if (items.length) {
    parts.push('Divisão:')
    parts.push(formatDivisaoText(items))
  }
  if (camp.tem_trofeu) parts.push('Inclui troféu.')
  if (camp.descricao_premiacao && tipo !== 'brinde') parts.push(String(camp.descricao_premiacao))
  return parts.join('\n') || 'Premiação conforme a organização.'
}

/** Respostas do rulebook derivadas do campeonato (fonte da verdade na leitura). */
export function linkedAnswersFromCampeonato(camp: Record<string, any> | null | undefined): AnswersMap {
  if (!camp) return {}
  const a: AnswersMap = {}

  const tipoPremio = String(camp.tipo_premiacao || '').toLowerCase()
  if (tipoPremio === 'sem_premiacao') {
    a.possui_premiacao = false
  } else if (tipoPremio) {
    a.possui_premiacao = true
    a.descricao_premiacao = buildPremiacaoDescricao(camp)
    a.premiacao_total = camp.premiacao != null ? String(camp.premiacao) : ''
    const items = parseDivisao(camp.divisao_premiacao)
    if (items.length) a.divisao_premiacao_json = JSON.stringify(items)
  } else if (camp.premiacao || camp.divisao_premiacao) {
    a.possui_premiacao = true
    a.descricao_premiacao = buildPremiacaoDescricao(camp)
    a.premiacao_total = camp.premiacao != null ? String(camp.premiacao) : ''
  }

  const taxa = moneyNumber(camp.valor_inscricao)
  if (taxa > 0) {
    a.possui_taxa = true
    a.valor_taxa = moneyText(taxa)
  } else if (camp.valor_inscricao != null && String(camp.valor_inscricao).trim() !== '') {
    // explicit zero
    if (String(camp.valor_inscricao) === '0' || String(camp.valor_inscricao) === '0.00') {
      a.possui_taxa = false
    }
  }

  if (typeof camp.tem_live === 'boolean') {
    a.possui_transmissao = camp.tem_live
  }

  const plat = String(camp.plataforma || '').toLowerCase()
  if (plat === 'misto' || plat.includes('misto')) {
    a.plataforma = ['ambos']
    a.emulador_proibido = false
  } else if (plat.includes('emul')) {
    a.plataforma = ['emulador']
    a.emulador_proibido = false
  } else if (plat.includes('mobile')) {
    a.plataforma = ['mobile']
    a.emulador_proibido = true
  }

  const porVaga = Number(camp.jogadores_por_vaga)
  if (Number.isFinite(porVaga) && porVaga > 0) {
    if (porVaga >= 4) {
      a.qtd_titulares = 4
      a.modalidade = 'squad'
      if (porVaga > 4) {
        a.permite_reservas = true
        a.qtd_reservas = Math.min(4, porVaga - 4)
      }
    } else if (porVaga === 2) {
      a.qtd_titulares = 2
      a.modalidade = 'duo'
    } else if (porVaga === 1) {
      a.qtd_titulares = 1
      a.modalidade = 'solo'
    } else {
      a.qtd_titulares = Math.round(porVaga)
    }
  }

  // Tipo e formato competitivo do campeonato (pontos corridos, mata-mata, etc.)
  const tipoCamp = String(camp.tipo || '').toLowerCase().trim()
  if (tipoCamp) a.tipo_campeonato = tipoCamp
  const formatoComp = String(camp.formato || '').trim()
  if (formatoComp) a.formato_competicao = formatoComp

  return a
}

/** Mescla respostas atuais com valores ligados do campeonato (campeonato sobrescreve links). */
export function mergeLinkedAnswers(
  answers: AnswersMap,
  camp: Record<string, any> | null | undefined,
): AnswersMap {
  const linked = linkedAnswersFromCampeonato(camp)
  return { ...answers, ...linked }
}

/** Patch de campeonato_configuracoes a partir das respostas do rulebook. */
export function campeonatoPatchFromAnswers(
  answers: AnswersMap,
  currentCamp: Record<string, any> = {},
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}

  if (answers.possui_premiacao === false) {
    patch.tipo_premiacao = 'sem_premiacao'
    patch.premiacao = null
    patch.divisao_premiacao = null
  } else if (answers.possui_premiacao === true) {
    const currentTipo = String(currentCamp.tipo_premiacao || '').toLowerCase()
    if (!currentTipo || currentTipo === 'sem_premiacao') {
      patch.tipo_premiacao = 'pix'
    }
    if (answers.premiacao_total !== undefined && answers.premiacao_total !== null && answers.premiacao_total !== '') {
      const n = moneyNumber(answers.premiacao_total)
      patch.premiacao = n > 0 ? n : null
    }
    if (typeof answers.divisao_premiacao_json === 'string' && answers.divisao_premiacao_json) {
      patch.divisao_premiacao = answers.divisao_premiacao_json
    } else if (answers.descricao_premiacao && currentTipo === 'brinde') {
      patch.descricao_premiacao = String(answers.descricao_premiacao)
    }
    // Se só marcou possui e não tem tipo money, e tem texto — brinde
    if (
      currentTipo === 'brinde'
      || (
        !answers.premiacao_total
        && typeof answers.descricao_premiacao === 'string'
        && answers.descricao_premiacao
        && !answers.divisao_premiacao_json
      )
    ) {
      if (currentTipo === 'brinde' || !currentTipo || currentTipo === 'sem_premiacao') {
        if (!patch.tipo_premiacao || patch.tipo_premiacao === 'pix') {
          // keep brinde if was brinde
          if (currentTipo === 'brinde') patch.tipo_premiacao = 'brinde'
        }
      }
      if (answers.descricao_premiacao && (currentTipo === 'brinde' || patch.tipo_premiacao === 'brinde')) {
        patch.descricao_premiacao = String(answers.descricao_premiacao)
      }
    }
  }

  if (answers.possui_taxa === false) {
    patch.valor_inscricao = null
  } else if (answers.possui_taxa === true && answers.valor_taxa) {
    const n = moneyNumber(answers.valor_taxa)
    if (n > 0) patch.valor_inscricao = n
  }

  if (typeof answers.possui_transmissao === 'boolean') {
    patch.tem_live = answers.possui_transmissao
  }

  if (Array.isArray(answers.plataforma) && answers.plataforma.length) {
    const p = answers.plataforma.map(String)
    if (p.includes('ambos') || (p.includes('mobile') && p.includes('emulador'))) {
      patch.plataforma = 'misto'
    } else if (p.includes('emulador')) {
      patch.plataforma = 'emulador'
    } else if (p.includes('mobile')) {
      patch.plataforma = 'mobile'
    }
  }

  if (typeof answers.qtd_titulares === 'number' && answers.qtd_titulares > 0) {
    const reservas =
      answers.permite_reservas === true && typeof answers.qtd_reservas === 'number'
        ? answers.qtd_reservas
        : 0
    patch.jogadores_por_vaga = answers.qtd_titulares + (reservas > 0 ? reservas : 0)
    if (answers.permite_reservas === true && typeof answers.qtd_reservas === 'number') {
      patch.vagas_por_equipe = answers.qtd_titulares + answers.qtd_reservas
    } else {
      patch.vagas_por_equipe = answers.qtd_titulares
    }
  }

  return patch
}

export async function loadCampeonatoConfig(campeonatoId: string) {
  const { data: camp } = await supabaseAdmin
    .from('campeonatos')
    .select('*')
    .eq('id', campeonatoId)
    .maybeSingle()

  let config: Record<string, any> = {}
  try {
    const { data: cfg } = await supabaseAdmin
      .from('campeonato_configuracoes')
      .select('*')
      .eq('campeonato_id', campeonatoId)
      .maybeSingle()
    if (cfg) config = cfg
  } catch {
    // optional
  }

  return { ...(camp || {}), ...config, nome: camp?.nome || config.nome }
}

/** Escreve campos ligados do rulebook no campeonato. */
export async function syncCampeonatoFromRulebookAnswers(
  campeonatoId: string,
  answers: AnswersMap,
) {
  const current = await loadCampeonatoConfig(campeonatoId)
  const patch = campeonatoPatchFromAnswers(answers, current)
  if (!Object.keys(patch).length) return { patched: false }

  const { error } = await supabaseAdmin
    .from('campeonato_configuracoes')
    .upsert(
      { campeonato_id: campeonatoId, ...patch },
      { onConflict: 'campeonato_id' },
    )

  if (error) {
    // best-effort: não derruba o save do rulebook
    console.warn('[rulebook.sync] falha ao sincronizar campeonato:', error.message)
    return { patched: false, error: error.message }
  }
  return { patched: true, patch }
}

/** Atualiza respostas do rulebook a partir do campeonato (após editar campeonato). */
export async function syncRulebookFromCampeonato(campeonatoId: string) {
  const { data: row, error } = await supabaseAdmin
    .from('campeonato_rulebooks')
    .select('id, respostas')
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()

  if (error || !row) return { synced: false }

  const camp = await loadCampeonatoConfig(campeonatoId)
  const merged = mergeLinkedAnswers(
    (row.respostas && typeof row.respostas === 'object' ? row.respostas : {}) as AnswersMap,
    camp,
  )

  // Atualiza também descricao legível para o gerador
  if (merged.possui_premiacao) {
    merged.descricao_premiacao = buildPremiacaoDescricao(camp)
  }

  const { error: upError } = await supabaseAdmin
    .from('campeonato_rulebooks')
    .update({ respostas: merged })
    .eq('id', row.id)

  if (upError) {
    console.warn('[rulebook.sync] falha ao atualizar rulebook:', upError.message)
    return { synced: false }
  }
  return { synced: true }
}

/** IDs de perguntas que são “ligadas” ao campeonato (UI). */
export const LINKED_QUESTION_IDS = new Set([
  'possui_premiacao',
  'descricao_premiacao',
  'possui_taxa',
  'valor_taxa',
  'possui_transmissao',
  'plataforma',
  'emulador_proibido',
  'qtd_titulares',
  'permite_reservas',
  'qtd_reservas',
  'modalidade',
  'premiacao_total',
  'divisao_premiacao_json',
])
