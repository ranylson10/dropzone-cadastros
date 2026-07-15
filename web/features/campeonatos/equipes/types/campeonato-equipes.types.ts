export type VagaStatus = 'livre' | 'reservada' | 'ocupada' | 'bloqueada'

export type CampeonatoEquipeResumo = {
  id: string
  equipe_id: string | null
  line_id: string | null
  nome_exibicao: string | null
  /** Nome competitivo (line-first) */
  line_nome?: string | null
  line_logo_url?: string | null
  line_tag?: string | null
  equipe_nome?: string | null
  origem_entrada: string
  equipe: { id: string; nome: string; tag: string | null; logo_url: string | null } | null
  line: { id: string; nome: string; tag: string | null; logo_url: string | null } | null
}

export type ConviteResumo = {
  id: string
  token: string
  expira_em: string | null
  status: string
  usado: boolean
  nome_equipe_reservada: string | null
  nome_line_reservada: string | null
  /** @deprecated use slot_id — mantido só se a API ainda devolver o campo em convites antigos */
  vaga_id?: string | null
  slot_id?: string | null
}

export type CampeonatoVaga = {
  id: string
  numero_vaga: number
  status: VagaStatus
  nome_equipe_reservada: string | null
  nome_line_reservada: string | null
  reserva_expira_em: string | null
  grupo_id?: string | null
  fase_id?: string | null
  fase?: { id: string; nome: string; ordem?: number } | null
  grupo?: { id: string; nome: string; fase_id?: string | null } | null
  slot_numero?: number | null
  slot_letra?: string | null
  line_nome?: string | null
  line_logo_url?: string | null
  line_tag?: string | null
  equipe_nome?: string | null
  campeonato_equipe: CampeonatoEquipeResumo | null
  convite: ConviteResumo | null
}

export type EquipeBusca = {
  id: string
  nome: string
  tag: string | null
  logo_url: string | null
  lines: Array<{
    id: string
    nome: string
    tag: string | null
    logo_url: string | null
    ja_inscrita: boolean
    vaga_numero: number | null
    participacao_id: string | null
  }>
}

export type CampeonatoCapacidade = {
  limite_vagas: number | null
  slots_criados: number
  slots_ocupados: number
  slots_livres_estrutura: number
  slots_ainda_podem_ser_criados: number | null
  vagas_restantes_meta: number | null
}

export type CampeonatoEquipesPayload = {
  campeonato: { id: string; nome: string; logo_url: string | null }
  vagas: CampeonatoVaga[]
  capacidade?: CampeonatoCapacidade | null
  permission: {
    canView: boolean
    canManage: boolean
    canGenerateToken: boolean
    canOrganizeGroups?: boolean
    canScore?: boolean
    role: string
  }
}
