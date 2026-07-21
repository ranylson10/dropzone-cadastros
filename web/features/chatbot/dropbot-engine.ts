export type DropBotIntent =
  | 'agenda'
  | 'jogadores'
  | 'pontuacao'
  | 'inscricao'
  | 'pagamento'
  | 'link_escala'
  | 'slots'
  | 'ajuda'
  | 'ambigua'
  | 'desconhecida'

export type DropBotSystemContext = {
  campeonatoNome?: string | null
  grupoNome?: string | null
  equipeNome?: string | null
  lineNome?: string | null
  resumoGrupo?: { total?: number | null; ocupadas?: number | null; livres?: number | null } | null
  resumoLink?: { usos?: number | null; limite_vagas?: number | null; restantes?: number | null } | null
  participacoes?: Array<{
    nome?: string | null
    lineNome?: string | null
    slot?: string | number | null
    quantidadeJogadores?: number | null
    limiteJogadores?: number | null
    linkEscalacao?: string | null
  }>
  jogos?: Array<{
    titulo?: string | null
    data?: string | null
    horario?: string | null
    rodada?: string | null
    status?: string | null
  }>
  pontuacao?: Array<{
    equipe?: string | null
    line?: string | null
    pontos?: number | null
    posicao?: number | null
  }>
  pagamentos?: Array<{
    descricao?: string | null
    valor?: number | null
    status?: string | null
    url?: string | null
  }>
}

export type DropBotResolution = {
  intent: DropBotIntent
  confidence: number
  answer: string
  suggestions?: Array<{ id: DropBotIntent; label: string }>
  needsAi?: boolean
}

const INTENT_KEYWORDS: Record<Exclude<DropBotIntent, 'ambigua' | 'desconhecida'>, string[]> = {
  agenda: ['quando', 'dia', 'dias', 'data', 'horario', 'horário', 'joga', 'jogar', 'partida', 'partidas', 'rodada', 'agenda'],
  jogadores: ['jogador', 'jogadores', 'escalado', 'escalados', 'escalação', 'escalacao', 'lineup', 'elenco', 'quantos'],
  pontuacao: ['ponto', 'pontos', 'pontuação', 'pontuacao', 'tabela', 'posição', 'posicao', 'ranking', 'classificação', 'classificacao'],
  inscricao: ['inscrição', 'inscricao', 'inscrito', 'inscrita', 'status', 'vaga', 'slot', 'aprovado', 'aprovada'],
  pagamento: ['pagar', 'pagamento', 'pago', 'pix', 'cobrança', 'cobranca', 'fatura', 'valor', 'taxa'],
  link_escala: ['link', 'copiar', 'escala', 'escalação', 'escalacao', 'convite jogador', 'jogadores'],
  slots: ['slot', 'slots', 'vaga', 'vagas', 'livre', 'livres', 'ocupado', 'ocupadas'],
  ajuda: ['ajuda', 'menu', 'opções', 'opcoes', 'comandos', 'duvida', 'dúvida'],
}

function normalize(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function formatDateTime(item: { data?: string | null; horario?: string | null }) {
  const date = item.data ? String(item.data) : ''
  const time = item.horario ? String(item.horario) : ''
  return [date, time].filter(Boolean).join(' às ')
}

export function detectDropBotIntents(question: string) {
  const text = normalize(question)
  const scores = Object.entries(INTENT_KEYWORDS).map(([intent, keywords]) => ({
    intent: intent as Exclude<DropBotIntent, 'ambigua' | 'desconhecida'>,
    score: keywords.reduce((total, keyword) => total + (text.includes(normalize(keyword)) ? 1 : 0), 0),
  }))
  return scores.filter((item) => item.score > 0).sort((a, b) => b.score - a.score)
}

export function resolveDropBotQuestion(question: string, context: DropBotSystemContext = {}): DropBotResolution {
  const matches = detectDropBotIntents(question)
  const top = matches[0]
  const related = matches.filter((item) => item.score === top?.score)

  if (!question.trim()) {
    return buildHelp(context)
  }

  if (!top) {
    return {
      intent: 'desconhecida',
      confidence: 0,
      needsAi: true,
      answer: 'Eu ainda não consegui entender com segurança. Posso te ajudar com agenda, jogadores escalados, pontuação, inscrição, pagamento ou link de escalação.',
      suggestions: defaultSuggestions(),
    }
  }

  if (related.length > 1 && top.score <= 1) {
    return {
      intent: 'ambigua',
      confidence: 0.45,
      answer: 'Acho que entendi alguns caminhos possíveis. Você quis dizer uma dessas opções?',
      suggestions: related.map((item) => ({ id: item.intent, label: labelForIntent(item.intent) })),
    }
  }

  return buildIntentAnswer(top.intent, context, top.score)
}

export function buildIntentAnswer(intent: DropBotIntent, context: DropBotSystemContext = {}, score = 1): DropBotResolution {
  switch (intent) {
    case 'agenda': {
      const jogos = context.jogos || []
      if (!jogos.length) {
        return {
          intent,
          confidence: score,
          answer: `Eu procurei aqui, mas ainda não encontrei jogos com data definida para ${context.equipeNome || 'sua equipe'}. Quando a tabela for configurada, eu consigo te responder por dia, rodada e horário.`,
        }
      }
      const linhas = jogos.slice(0, 5).map((jogo) => `• ${jogo.rodada || jogo.titulo || 'Jogo'}: ${formatDateTime(jogo) || 'data a definir'}${jogo.status ? ` (${jogo.status})` : ''}`)
      return { intent, confidence: score, answer: `Encontrei esses jogos para ${context.equipeNome || 'sua equipe'}:\n${linhas.join('\n')}` }
    }
    case 'jogadores': {
      const parts = context.participacoes || []
      if (!parts.length) return { intent, confidence: score, answer: 'Ainda não encontrei uma line inscrita vinculada à sua conta nesse grupo.' }
      const linhas = parts.map((part) => {
        const qtd = part.quantidadeJogadores ?? 0
        const limite = part.limiteJogadores ?? 0
        return `• ${part.lineNome || part.nome || 'Line'}${part.slot ? ` · slot ${part.slot}` : ''}: ${qtd}/${limite || '?'} jogadores escalados`
      })
      return { intent, confidence: score, answer: `Aqui está a escalação atual:\n${linhas.join('\n')}` }
    }
    case 'pontuacao': {
      const rows = context.pontuacao || []
      if (!rows.length) return { intent, confidence: score, answer: 'Ainda não encontrei pontuação lançada para esse grupo/campeonato.' }
      return {
        intent,
        confidence: score,
        answer: `Tabela atual:\n${rows.slice(0, 8).map((row) => `• ${row.posicao ? `${row.posicao}º ` : ''}${row.line || row.equipe || 'Equipe'}: ${row.pontos ?? 0} pts`).join('\n')}`,
      }
    }
    case 'inscricao': {
      const parts = context.participacoes || []
      if (!parts.length) return { intent, confidence: score, answer: 'Não encontrei inscrição da sua equipe nesse grupo ainda.' }
      return {
        intent,
        confidence: score,
        answer: `Sua inscrição aparece assim:\n${parts.map((part) => `• ${part.lineNome || part.nome || 'Line'}${part.slot ? ` no slot ${part.slot}` : ''}`).join('\n')}`,
      }
    }
    case 'pagamento': {
      const pagamentos = context.pagamentos || []
      if (!pagamentos.length) return { intent, confidence: score, answer: 'Não encontrei pagamento pendente vinculado a essa inscrição agora.' }
      return {
        intent,
        confidence: score,
        answer: `Encontrei estes pagamentos:\n${pagamentos.map((p) => `• ${p.descricao || 'Pagamento'}: ${p.status || 'status não informado'}${p.valor ? ` · R$ ${Number(p.valor).toFixed(2).replace('.', ',')}` : ''}`).join('\n')}`,
      }
    }
    case 'link_escala': {
      const withLink = (context.participacoes || []).find((part) => part.linkEscalacao)
      if (!withLink) return { intent, confidence: score, answer: 'Ainda não encontrei link de escalação ativo. Você pode gerar um novo na opção “Escalar elenco”.' }
      return { intent, confidence: score, answer: `Achei o link de escalação da ${withLink.lineNome || withLink.nome || 'line'}:\n${withLink.linkEscalacao}` }
    }
    case 'slots': {
      const resumo = context.resumoGrupo
      if (!resumo) return { intent, confidence: score, answer: 'Ainda não tenho o resumo de slots dessa tela.' }
      return { intent, confidence: score, answer: `Resumo dos slots do grupo ${context.grupoNome || ''}: ${resumo.ocupadas ?? 0} ocupadas, ${resumo.livres ?? 0} livres, ${resumo.total ?? 0} no total.` }
    }
    case 'ajuda':
      return buildHelp(context)
    default:
      return { intent: 'desconhecida', confidence: 0, needsAi: true, answer: 'Não consegui entender ainda. Quer tentar perguntar de outro jeito?', suggestions: defaultSuggestions() }
  }
}

export function buildHelp(context: DropBotSystemContext = {}): DropBotResolution {
  return {
    intent: 'ajuda',
    confidence: 1,
    answer: `Posso consultar informações ${context.equipeNome ? `da ${context.equipeNome}` : 'da sua equipe'} para você. Me pergunte, por exemplo:\n• Quais dias minha equipe joga?\n• Quantos jogadores tenho escalados?\n• Qual a pontuação do grupo?\n• Minha inscrição está confirmada?\n• Tenho pagamento pendente?`,
    suggestions: defaultSuggestions(),
  }
}

export function defaultSuggestions() {
  return [
    { id: 'agenda' as DropBotIntent, label: 'Ver próximos jogos' },
    { id: 'jogadores' as DropBotIntent, label: 'Ver jogadores escalados' },
    { id: 'pontuacao' as DropBotIntent, label: 'Ver pontuação' },
    { id: 'inscricao' as DropBotIntent, label: 'Status da inscrição' },
    { id: 'pagamento' as DropBotIntent, label: 'Pagamentos' },
    { id: 'link_escala' as DropBotIntent, label: 'Link de escalação' },
  ]
}

function labelForIntent(intent: DropBotIntent) {
  return defaultSuggestions().find((item) => item.id === intent)?.label || 'Outra dúvida'
}
