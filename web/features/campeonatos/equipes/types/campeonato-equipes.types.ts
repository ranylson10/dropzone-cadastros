export type VagaStatus = 'livre' | 'reservada' | 'ocupada' | 'bloqueada'

export type CampeonatoEquipeResumo = {
  id: string
  equipe_id: string
  line_id: string | null
  nome_exibicao: string | null
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
  vaga_id: string | null
}

export type CampeonatoVaga = {
  id: string
  numero_vaga: number
  status: VagaStatus
  nome_equipe_reservada: string | null
  nome_line_reservada: string | null
  reserva_expira_em: string | null
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

export type CampeonatoEquipesPayload = {
  campeonato: { id: string; nome: string; logo_url: string | null }
  vagas: CampeonatoVaga[]
  permission: { canView: boolean; canManage: boolean; canGenerateToken: boolean; role: string }
}
