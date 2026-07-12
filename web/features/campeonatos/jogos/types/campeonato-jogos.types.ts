import type { DropZoneRow } from '@/lib/types'

export type CampeonatoJogoForm = {
  nome: string
  campeonato_id: string
  fase_id: string
  rodada: string
  data_jogo: string
  horario: string
  numero_partidas: string
  intervalo_minutos: string
  mapas: string
  grupos_ids: string[]
  status: string
  classificam_quantidade: string
  define_campeao: boolean
  permite_troca_jogadores: boolean
  prazo_troca_minutos: string
  prazo_escalacao_minutos: string
  minimo_partidas_jogadas_jogador: string
}

export type CampeonatoJogosTabProps = {
  campeonato: DropZoneRow
  fases: DropZoneRow[]
  grupos: DropZoneRow[]
  jogos: DropZoneRow[]
  value: CampeonatoJogoForm
  setValue: (value: CampeonatoJogoForm) => void
  createGame: () => void
  updateGame: (id: string, data: Record<string, unknown>) => Promise<void>
  deleteGame: (id: string) => Promise<void>
  loading: boolean
}
