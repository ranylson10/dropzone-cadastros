import { supabaseAdmin } from "@backend/shared/supabase-admin";
import { CHAMPIONSHIP_TYPES, DAILY_HOURS, GROUP_LETTERS, type ChampionshipType } from "@backend/shared/dropzone-constants";

export const DEFAULT_CHAMPIONSHIP_TYPE: ChampionshipType = 'copa'

export function normalizeChampionshipType(value: unknown): ChampionshipType {
  const clean = String(value || '').trim().toLowerCase()
  return CHAMPIONSHIP_TYPES.includes(clean as ChampionshipType) ? clean as ChampionshipType : DEFAULT_CHAMPIONSHIP_TYPE
}

export function nullablePositiveInteger(value: unknown) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error('Os campos numéricos devem ser maiores que zero.')
  return parsed
}

export function nullableMoney(value: unknown) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(String(value).replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Os valores financeiros devem ser maiores ou iguais a zero.')
  return parsed
}

export function nullableDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new Error('Data inválida.')
  return date.toISOString()
}

export function normalizeWhatsappContacts(value: unknown) {
  if (!Array.isArray(value)) return []
  if (value.length > 10) throw new Error('Cadastre no maximo 10 contatos de WhatsApp.')
  return value.map((item: any, index: number) => {
    const nome = String(item?.nome || '').trim().slice(0, 80)
    const pais = String(item?.pais || '').trim().slice(0, 60)
    const bandeira = String(item?.bandeira || '').trim().slice(0, 8)
    const ddiDigits = String(item?.ddi || '').replace(/\D/g, '').slice(0, 4)
    const phoneDigits = String(item?.telefone || '').replace(/\D/g, '').slice(0, 15)
    if (!nome || !pais || !ddiDigits || phoneDigits.length < 8) throw new Error(`Preencha corretamente o contato ${index + 1} do WhatsApp.`)
    return { id: String(item?.id || crypto.randomUUID()).slice(0, 80), nome, pais, bandeira, ddi: `+${ddiDigits}`, telefone: phoneDigits }
  })
}

export const THEME_COLOR_KEYS = [
  'cor_principal',
  'cor_secundaria',
  'cor_texto_clara',
  'cor_texto_escura',
  'bg_opacidade',
] as const

export const OPTIONAL_STRUCTURE_KEYS = [
  'estrutura_planejada',
  'liga_usa_divisoes',
  'liga_nome_agrupamento',
  'liga_divisoes',
  'sistema_pontuacao_tipo',
  'sistema_pontuacao_nome',
  'xtreino_call_fixa',
  'xtreino_registra_primeira_safe',
  'xtreino_registra_segunda_safe',
  'xtreino_mapas',
  'partidas_por_jogo',
] as const

export const OFFICIAL_GARENA_SCORING = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0] as const

export function normalizeScoring(data: Record<string, any>) {
  const type = String(data.sistema_pontuacao_tipo || 'garena').trim().toLowerCase() === 'personalizado'
    ? 'personalizado'
    : 'garena'
  if (type === 'garena') {
    return {
      sistema_pontuacao_tipo: 'garena',
      sistema_pontuacao_nome: 'Oficial Garena',
      pontos_colocacao: [...OFFICIAL_GARENA_SCORING],
      pontos_por_abate: 1,
    }
  }

  const teamCount = Math.max(2, Math.min(15, Number.parseInt(String(data.pontuacao_equipes_por_partida || '12'), 10) || 12))
  const rawPoints = Array.isArray(data.pontos_colocacao) ? data.pontos_colocacao : []
  const placementPoints = Array.from({ length: teamCount }, (_, index) => {
    const point = Number(rawPoints[index] ?? 0)
    if (!Number.isFinite(point)) return 0
    return Math.max(0, Math.trunc(point))
  })
  const killPoints = Number(data.pontos_por_abate ?? 1)
  const name = String(data.sistema_pontuacao_nome || '').trim().slice(0, 80)
  if (!name) throw new Error('Informe o nome do sistema de pontuação personalizado.')
  if (!Number.isFinite(killPoints) || killPoints < 0) throw new Error('O valor por abate precisa ser zero ou maior.')

  return {
    sistema_pontuacao_tipo: 'personalizado',
    sistema_pontuacao_nome: name,
    pontos_colocacao: placementPoints,
    pontos_por_abate: killPoints,
  }
}

export function championshipConfigurationPayload(data: Record<string, any>, campeonatoId: string) {
  const permiteTroca = Boolean(data.permite_troca_jogadores)
  const scoring = normalizeScoring(data)
  return {
    campeonato_id: campeonatoId,
    premiacao: String(data.premiacao || '').trim() || null,
    valor_inscricao: nullableMoney(data.valor_inscricao),
    descricao_premiacao: String(data.descricao_premiacao || '').trim() || null,
    divisao_premiacao: String(data.divisao_premiacao || '').trim() || null,
    numero_vagas: nullablePositiveInteger(data.numero_vagas),
    sistema_pontuacao_tipo: scoring.sistema_pontuacao_tipo,
    sistema_pontuacao_nome: scoring.sistema_pontuacao_nome,
    pontos_colocacao: scoring.pontos_colocacao,
    pontos_por_abate: scoring.pontos_por_abate,
    xtreino_call_fixa: Boolean(data.xtreino_call_fixa),
    xtreino_registra_primeira_safe: data.xtreino_registra_primeira_safe !== false,
    xtreino_registra_segunda_safe: data.xtreino_registra_segunda_safe !== false,
    xtreino_mapas: Array.isArray(data.xtreino_mapas)
      ? Array.from(new Set<string>(data.xtreino_mapas
          .map((item: unknown) => String(item).trim().toLowerCase())
          .filter((item: string) => ['bermuda', 'purgatorio', 'kalahari', 'alpine', 'nexterra', 'solara'].includes(item))))
          .slice(0, 6)
      : [],
    partidas_por_jogo: Math.max(1, Math.min(20, Number.parseInt(String(data.partidas_por_jogo || '4'), 10) || 4)),
    formato: String(data.formato || '').trim() || null,
    plataforma: (() => {
      const value = String(data.plataforma || '').trim().toLowerCase()
      if (!value) return null
      if (['mobile', 'emulador', 'misto'].includes(value)) return value
      if (['ambos', 'both'].includes(value)) return 'misto'
      throw new Error('Plataforma inválida. Escolha Mobile, Emulador ou Misto.')
    })(),
    servidor: String(data.servidor || '').trim() || null,
    tipo_premiacao: String(data.tipo_premiacao || '').trim() || null,
    tem_trofeu: Boolean(data.tem_trofeu),
    tem_live: Boolean(data.tem_live),
    vagas_por_equipe: nullablePositiveInteger(data.vagas_por_equipe),
    jogadores_por_vaga: nullablePositiveInteger(data.jogadores_por_vaga),
    permite_jogador_multiplas_equipes: Boolean(data.permite_jogador_multiplas_equipes),
    permite_troca_jogadores: permiteTroca,
    data_limite_trocas: permiteTroca ? nullableDate(data.data_limite_trocas) : null,
    data_limite_inscricao: nullableDate(data.data_limite_inscricao),
    aceita_novas_inscricoes_equipes: data.aceita_novas_inscricoes_equipes !== false,
    contatos_whatsapp: normalizeWhatsappContacts(data.contatos_whatsapp),
    pagamento_pix_ativo: data.pagamento_pix_ativo !== false,
    pagamento_cartao_ativo: data.pagamento_cartao_ativo !== false,
    pagamento_paypal_ativo: data.pagamento_paypal_ativo === true,
    pagamento_whatsapp_ativo: data.pagamento_whatsapp_ativo !== false,
    cartao_max_parcelas: Math.min(12, Math.max(1, Number.parseInt(String(data.cartao_max_parcelas || '1'), 10) || 1)),
    paypal_moedas: Array.isArray(data.paypal_moedas)
      ? [...new Set(data.paypal_moedas.map((item: unknown) => String(item).toUpperCase()).filter((item: string) => ['BRL', 'USD', 'EUR'].includes(item)))]
      : ['BRL', 'USD', 'EUR'],
    estrutura_planejada: normalizeStructurePlan(data.estrutura_planejada),
    liga_usa_divisoes: Boolean(data.liga_usa_divisoes),
    liga_nome_agrupamento: String(data.liga_nome_agrupamento || 'Divisões').trim().slice(0, 60) || 'Divisões',
    liga_divisoes: normalizeLeagueDivisions(data.liga_divisoes, String(data.liga_nome_agrupamento || 'Divisões')),
    ...buildThemeColumns(data),
  }
}

export function normalizeStructurePlan(value: unknown) {
  if (!Array.isArray(value)) return []
  if (value.length > 12) throw new Error('A estrutura inicial aceita no máximo 12 fases.')
  return value.map((item, index) => {
    const nome = String((item as any)?.nome || '').trim().slice(0, 100) || `Fase ${index + 1}`
    const grupos = Math.max(1, Math.min(26, Number.parseInt(String((item as any)?.grupos || '1'), 10) || 1))
    const equipesPorGrupo = Math.max(1, Math.min(52, Number.parseInt(String((item as any)?.equipes_por_grupo || '12'), 10) || 12))
    const classificamRaw = String((item as any)?.classificam_por_grupo || '').trim()
    const classificam = classificamRaw
      ? Math.max(1, Math.min(equipesPorGrupo, Number.parseInt(classificamRaw, 10) || 1))
      : null
    const diarioHorarios = Array.isArray((item as any)?.diario_horarios)
      ? (item as any).diario_horarios.slice(0, 26).map((schedule: any, scheduleIndex: number) => {
          const raw = String(schedule?.horario || '').trim()
          const horario = /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : `${String(Math.min(23, 19 + scheduleIndex)).padStart(2, '0')}:00`
          return { id: String(schedule?.id || `horario-${scheduleIndex + 1}`).slice(0, 80), horario }
        })
      : []
    const rawFinalDays = Array.isArray((item as any)?.final_dias_config) ? (item as any).final_dias_config : []
    const finalDiasConfig = rawFinalDays.slice(0, 15).map((day: any, dayIndex: number) => ({
      dia: dayIndex + 1,
      quedas: Math.max(1, Math.min(30, Number.parseInt(String(day?.quedas || '1'), 10) || 1)),
    }))
    const finalFormatRaw = String((item as any)?.final_formato || '').trim()
    const finalFormato = ['pontos_corridos', 'champion_point', 'point_rush', 'point_rush_champion_point', 'personalizado'].includes(finalFormatRaw) ? finalFormatRaw : null
    const bonusRanking = Array.isArray((item as any)?.final_bonus_ranking)
      ? (item as any).final_bonus_ranking.slice(0, 30).map((bonus: any, bonusIndex: number) => ({
          posicao: bonusIndex + 1,
          pontos_bonus: Math.max(0, Number(bonus?.pontos_bonus || 0)),
        }))
      : []
    return {
      nome,
      grupos,
      equipes_por_grupo: equipesPorGrupo,
      classificam_por_grupo: classificam,
      ...((item as any)?.oculta === true ? { oculta: true } : {}),
      ...(diarioHorarios.length ? { diario_horarios: diarioHorarios } : {}),
      ...(finalDiasConfig.length ? { final_dias_config: finalDiasConfig } : {}),
      ...(finalFormato ? { final_formato: finalFormato } : {}),
      ...((item as any)?.final_champion_point_pontos ? { final_champion_point_pontos: Math.max(1, Number((item as any).final_champion_point_pontos)) } : {}),
      ...((item as any)?.final_point_rush_dias ? { final_point_rush_dias: Math.max(1, Math.min(15, Number((item as any).final_point_rush_dias))) } : {}),
      ...(bonusRanking.length ? { final_bonus_ranking: bonusRanking } : {}),
    }
  })
}

export function normalizeLeagueDivisions(value: unknown, grouping = 'Divisões') {
  if (!Array.isArray(value)) return []
  if (value.length > 12) throw new Error('A liga aceita no máximo 12 agrupamentos.')
  const labels: Record<string, string> = { Séries: 'Série', Divisões: 'Divisão', Categorias: 'Categoria', Níveis: 'Nível', Conferências: 'Conferência', Circuitos: 'Circuito' }
  const baseLabel = labels[grouping] || String(grouping || 'Grupo').replace(/s$/i, '') || 'Grupo'
  const allowedEntryTypes = new Set(['mantida', 'promovida', 'rebaixada', 'classificatoria_aberta', 'vaga_paga', 'convite_direto'])
  return value.map((item, index) => {
    const id = String((item as any)?.id || crypto.randomUUID()).slice(0, 80)
    const equipesRaw = (item as any)?.equipes
    if (equipesRaw != null && typeof equipesRaw !== 'string' && typeof equipesRaw !== 'number') throw new Error('Informe uma quantidade inteira de equipes para o agrupamento da Liga.')
    const equipesInformadas = Number(equipesRaw === '' || equipesRaw == null ? 12 : equipesRaw)
    if (!Number.isSafeInteger(equipesInformadas) || equipesInformadas < 1) throw new Error('Informe uma quantidade inteira de equipes para o agrupamento da Liga.')
    const equipes = Math.max(2, Math.min(200, equipesInformadas))
    const rawEntries = Array.isArray((item as any)?.entradas) ? (item as any).entradas.slice(0, 12) : []
    const entradas = rawEntries.map((entry: any) => {
      const tipo = String(entry?.tipo || '').trim()
      if (!allowedEntryTypes.has(tipo)) throw new Error('Forma de entrada inválida na Liga.')
      const quantidadeRaw = entry?.quantidade
      if (quantidadeRaw != null && typeof quantidadeRaw !== 'string' && typeof quantidadeRaw !== 'number') throw new Error('Informe uma quantidade inteira de vagas para cada origem da Liga.')
      const quantidadeInformada = Number(quantidadeRaw === '' || quantidadeRaw == null ? 1 : quantidadeRaw)
      if (!Number.isSafeInteger(quantidadeInformada) || quantidadeInformada < 1) throw new Error('Informe uma quantidade inteira de vagas para cada origem da Liga.')
      const quantidade = Math.max(1, Math.min(equipes, quantidadeInformada))
      const origemAgrupamentoId = String(entry?.origem_agrupamento_id || '').trim().slice(0, 80)
      if ((tipo === 'promovida' || tipo === 'rebaixada') && !origemAgrupamentoId) throw new Error('Promoção e rebaixamento precisam informar o agrupamento de origem.')
      if (origemAgrupamentoId === id) throw new Error('Um agrupamento não pode usar a si mesmo como origem.')
      return { id: String(entry?.id || crypto.randomUUID()).slice(0, 80), tipo, quantidade: String(quantidade), origem_agrupamento_id: origemAgrupamentoId }
    })
    const entryTotal = entradas.reduce((sum: number, entry: { quantidade: string }) => sum + Number(entry.quantidade || 0), 0)
    if (entryTotal > equipes) throw new Error('As formas de entrada não podem ultrapassar o total de equipes do agrupamento.')
    return {
      id,
      nome: String((item as any)?.nome || '').trim().slice(0, 80) || `${baseLabel} ${index + 1}`,
      codigo: String((item as any)?.codigo || '').trim().slice(0, 30),
      ordem: index + 1,
      equipes: String(equipes),
      valor_inscricao: String(Math.max(0, Number((item as any)?.valor_inscricao || 0))),
      premiacao: String(Math.max(0, Number((item as any)?.premiacao || 0))),
      entradas,
    }
  })
}

export function normalizeHexColor(value: unknown, fallback: string) {
  const raw = String(value || '').trim()
  if (/^#([0-9a-fA-F]{3})$/.test(raw)) {
    const m = raw.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/)
    if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase()
  }
  if (/^#([0-9a-fA-F]{6})$/.test(raw)) return raw.toLowerCase()
  return fallback
}

/** Tema: somente cores. Imagens de fundo não são persistidas para manter o carregamento leve. */
function buildThemeColumns(data: Record<string, any>) {
  const primary = normalizeHexColor(data.cor_principal, '#c9b766')
  const secondary = normalizeHexColor(data.cor_secundaria, '#141518')
  const onLight = contrastTextForBg('#f7f8fa')
  const opacityRaw = Number(data.bg_opacidade)
  const bgOpacidade = Number.isFinite(opacityRaw)
    ? Math.min(100, Math.max(0, Math.round(opacityRaw)))
    : 18
  return {
    cor_principal: primary,
    cor_secundaria: secondary,
    cor_texto_clara: '#ffffff',
    cor_texto_escura: onLight,
    bg_opacidade: bgOpacidade,
    bg_image_url: null,
  }
}

export function relativeLuminanceHex(hex: string) {
  const h = normalizeHexColor(hex, '#000000').slice(1)
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const lin = rgb.map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4))
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

export function contrastTextForBg(bgHex: string) {
  return relativeLuminanceHex(bgHex) > 0.45 ? '#17191d' : '#ffffff'
}

export function isMissingThemeColumnError(error: any) {
  const code = String(error?.code || '')
  const message = String(error?.message || error?.details || '')
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    [...THEME_COLOR_KEYS, ...OPTIONAL_STRUCTURE_KEYS].some((key) => message.includes(key)) ||
    /column .* does not exist/i.test(message)
  )
}

/** Upsert config; se colunas de tema ainda não existem no DB, grava o resto e avisa. */
export async function saveChampionshipConfiguration(payload: Record<string, any>) {
  const first = await supabaseAdmin
    .from('campeonato_configuracoes')
    .upsert(payload, { onConflict: 'campeonato_id' })
    .select('*')
    .single()
  if (!first.error) return { data: first.data, warning: null as string | null }

  if (!isMissingThemeColumnError(first.error)) throw first.error

  const withoutTheme = { ...payload }
  for (const key of THEME_COLOR_KEYS) delete withoutTheme[key]
  for (const key of OPTIONAL_STRUCTURE_KEYS) delete withoutTheme[key]
  const retry = await supabaseAdmin
    .from('campeonato_configuracoes')
    .upsert(withoutTheme, { onConflict: 'campeonato_id' })
    .select('*')
    .single()
  if (retry.error) throw retry.error
  return {
    data: retry.data,
    warning: 'Colunas de configuração ainda não existem. Rode as migrations mais recentes de campeonato.',
  }
}

export function normalizeGroupName(rawName: unknown, championshipType: ChampionshipType) {
  const clean = String(rawName || '').trim()
  if (championshipType === 'diario') {
    const hour = clean.replace(':00', 'h').replace(/\s+/g, '').toLowerCase()
    const normalized = hour.match(/^([01]?\d|2[0-3])h$/)?.[0]
    const padded = normalized ? `${normalized.replace('h', '').padStart(2, '0')}h` : ''
    if (!padded || !DAILY_HOURS.includes(padded)) throw new Error('Selecione um horario valido para campeonato diario.')
    return padded
  }

  const letter = clean.replace(/^grupo\s+/i, '').trim().toUpperCase()
  if (!GROUP_LETTERS.includes(letter)) throw new Error('Selecione uma letra valida para o grupo.')
  return `Grupo ${letter}`
}
