export type StatusEscalacao = 'pendente' | 'parcial' | 'completa'

export type JogadorEscalado = {
  id: string
  nick: string
  id_jogo: string
  funcao: string
  foto_url: string | null
  localidade: string | null
  status: string
  origem: 'campeonato_jogadores' | 'inscricoes_jogadores'
}

export type ParticipacaoJogadores = {
  id: string
  nome_exibicao: string
  equipe: { id: string; nome: string; tag: string | null; logo_url: string | null }
  line: { id: string; nome: string; tag: string | null; logo_url: string | null }
  vaga: { id: string; numero_vaga: number }
  jogadores: JogadorEscalado[]
  quantidade_jogadores: number
  limite_jogadores: number | null
  status_escalacao: StatusEscalacao
}

export type CampeonatoJogadoresPayload = {
  campeonato: { id: string; nome: string; logo_url: string | null }
  limite_jogadores: number | null
  participacoes: ParticipacaoJogadores[]
}
