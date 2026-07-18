import type { RulebookChapterId } from './rulebook.types'

/** Ordem fixa do regulamento — mesmo com módulos ocultos a numeração de capítulos ativos permanece consistente. */
export const RULEBOOK_CHAPTERS: Array<{
  id: RulebookChapterId
  order: number
  title: string
  /** Módulos que, se todos desabilitados, omitem o capítulo (vazio = sempre incluir se houver conteúdo) */
  requireAnyModule?: string[]
}> = [
  { id: 'disposicoes_gerais', order: 1, title: 'Disposições Gerais' },
  { id: 'organizacao', order: 2, title: 'Organização' },
  { id: 'participacao', order: 3, title: 'Participação' },
  { id: 'elegibilidade', order: 4, title: 'Elegibilidade' },
  { id: 'equipes', order: 5, title: 'Equipes' },
  { id: 'jogadores', order: 6, title: 'Jogadores' },
  { id: 'manager', order: 7, title: 'Manager', requireAnyModule: ['manager'] },
  { id: 'coach', order: 8, title: 'Coach', requireAnyModule: ['coach'] },
  { id: 'cadastro', order: 9, title: 'Cadastro' },
  { id: 'check_in', order: 10, title: 'Check-in', requireAnyModule: ['check_in'] },
  { id: 'partidas', order: 11, title: 'Partidas' },
  { id: 'pontuacao', order: 12, title: 'Pontuação' },
  { id: 'desconexoes', order: 13, title: 'Desconexões', requireAnyModule: ['desconexoes'] },
  { id: 'remakes', order: 14, title: 'Remakes', requireAnyModule: ['remakes'] },
  { id: 'infracoes', order: 15, title: 'Infrações' },
  { id: 'penalidades', order: 16, title: 'Penalidades' },
  { id: 'recursos', order: 17, title: 'Recursos', requireAnyModule: ['recursos_disciplinares'] },
  { id: 'premiacao', order: 18, title: 'Premiação', requireAnyModule: ['premiacao'] },
  { id: 'direitos_imagem', order: 19, title: 'Direitos de Imagem', requireAnyModule: ['direitos_imagem'] },
  { id: 'disposicoes_finais', order: 20, title: 'Disposições Finais' },
]

export const CATALOG_VERSION = '1.1.0'

/** Rótulos amigáveis para agrupar perguntas na etapa “Regras” (por tema). */
export const CHAPTER_GROUP_LABELS: Partial<Record<RulebookChapterId, string>> = {
  disposicoes_gerais: 'Regras gerais',
  organizacao: 'Organização e comunicação',
  participacao: 'Participação',
  elegibilidade: 'Elegibilidade',
  equipes: 'Equipes e elenco',
  jogadores: 'Jogadores',
  manager: 'Manager',
  coach: 'Coach',
  cadastro: 'Cadastro e inscrição',
  check_in: 'Check-in',
  partidas: 'Partidas, lobby e plataforma',
  pontuacao: 'Pontuação',
  desconexoes: 'Desconexões',
  remakes: 'Remakes',
  infracoes: 'Bugs, hacks, ghosting e integridade',
  penalidades: 'Processo disciplinar',
  recursos: 'Recursos',
  premiacao: 'Premiação',
  direitos_imagem: 'Direitos de imagem',
  disposicoes_finais: 'Disposições finais',
}

export const PERFIL_LABELS: Record<string, string> = {
  comunitario: 'Comunitário',
  semiprofissional: 'Semiprofissional',
  profissional: 'Profissional',
  personalizado: 'Personalizado',
}

export const PERFIL_DESCRIPTIONS: Record<string, string> = {
  comunitario:
    'Poucas perguntas. Regras padrão pré-preenchidas para campeonatos pequenos e comunitários.',
  semiprofissional:
    'Mais opções. Permite ajustar regras importantes com um fluxo intermediário.',
  profissional:
    'Todas as perguntas disponíveis. Controle completo, inspirado em competições de alto nível.',
  personalizado:
    'Nenhuma regra padrão aplicada. Tudo configurável do zero.',
}
