export type ExportMidiaTipo = 'campeonato_logo' | 'equipe_logo' | 'line_logo' | 'jogador_foto'

export type ExportMidia = {
  tipo: ExportMidiaTipo
  ref_id: string
  nome: string
  url: string
  /** Caminho sugerido dentro do ZIP, ex: logos/equipes/nome.png */
  zip_path?: string
}

export type ExportJogador = {
  id: string
  jogador_id: string | null
  nick: string | null
  foto_url: string | null
  id_jogo: string | null
  funcao: string | null
  localidade: string | null
  status: string
  origem: string
}

export type ExportLine = {
  participacao_id: string
  id: string | null
  nome: string
  tag: string | null
  logo_url: string | null
  nome_exibicao: string
  slot: { id: string | null; numero: number | null; letra: string | null }
  grupo: { id: string; nome: string | null; fase_id: string | null; fase_nome?: string | null } | null
  jogadores: ExportJogador[]
  quantidade_jogadores: number
}

export type ExportEquipe = {
  id: string
  nome: string
  tag: string | null
  logo_url: string | null
  lines: ExportLine[]
}

export type ExportFase = {
  id: string
  nome: string
  ordem: number
}

export type ExportGrupo = {
  id: string
  nome: string
  fase_id: string | null
  fase_nome: string | null
}

export type ExportFiltro = {
  escopo: 'campeonato' | 'fase' | 'grupo' | 'line' | 'equipe'
  fase_id?: string | null
  grupo_id?: string | null
  /** Multi-seleção de grupos */
  grupo_ids?: string[]
  line_id?: string | null
  equipe_id?: string | null
}

export type CampeonatoExportPayload = {
  export_version: number
  exported_at: string
  purpose: string
  filtro: ExportFiltro
  campeonato: {
    id: string
    nome: string
    logo_url: string | null
    banner_url: string | null
    status: string | null
    modalidade: string | null
    configuracao: {
      jogadores_por_vaga: number | null
      cor_principal: string | null
      cor_secundaria: string | null
      bg_image_url: string | null
    }
  }
  estrutura: {
    fases: ExportFase[]
    grupos: ExportGrupo[]
  }
  resumo: {
    total_equipes: number
    total_lines: number
    total_jogadores: number
    total_midias: number
  }
  equipes: ExportEquipe[]
  midias: ExportMidia[]
}

export type ExportPacoteModo = 'completo' | 'tabelas' | 'midias'
