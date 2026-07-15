/**
 * Exibição line-first: a line é a unidade competitiva; a equipe é pasta/organizadora.
 */

export type LineLike = {
  id?: string | null
  nome?: string | null
  tag?: string | null
  logo_url?: string | null
} | null

export type EquipeLike = {
  id?: string | null
  nome?: string | null
  tag?: string | null
  logo_url?: string | null
} | null

export function lineDisplayName(params: {
  nome_exibicao?: string | null
  line?: LineLike
  equipe?: EquipeLike
  fallback?: string
}) {
  return (
    String(params.nome_exibicao || '').trim()
    || String(params.line?.nome || '').trim()
    || String(params.equipe?.nome || '').trim()
    || params.fallback
    || 'Line'
  )
}

export function lineDisplayLogo(params: { line?: LineLike; equipe?: EquipeLike }) {
  return params.line?.logo_url || params.equipe?.logo_url || null
}

export function lineDisplayTag(params: { line?: LineLike; equipe?: EquipeLike }) {
  return params.line?.tag || params.equipe?.tag || null
}

/** Payload de resposta padronizado para participação no campeonato. */
export function mapParticipacaoDisplay(part: {
  id: string
  equipe_id?: string | null
  line_id?: string | null
  nome_exibicao?: string | null
  origem_entrada?: string | null
  grupo_id?: string | null
  slot_numero?: number | null
  equipe?: EquipeLike
  line?: LineLike
}) {
  const line = part.line || null
  const equipe = part.equipe || null
  return {
    id: part.id,
    campeonato_equipe_id: part.id,
    equipe_id: part.equipe_id || null,
    line_id: part.line_id || null,
    nome_exibicao: lineDisplayName({
      nome_exibicao: part.nome_exibicao,
      line,
      equipe,
    }),
    // Campos line-first (UI deve preferir estes)
    line_nome: lineDisplayName({ nome_exibicao: part.nome_exibicao, line, equipe }),
    line_tag: lineDisplayTag({ line, equipe }),
    line_logo_url: lineDisplayLogo({ line, equipe }),
    // Pasta (contexto)
    equipe_nome: equipe?.nome || null,
    equipe_tag: equipe?.tag || null,
    equipe_logo_url: equipe?.logo_url || null,
    origem_entrada: part.origem_entrada || null,
    grupo_id: part.grupo_id || null,
    slot_numero: part.slot_numero ?? null,
    equipe,
    line,
  }
}
