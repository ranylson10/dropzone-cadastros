import { supabaseAdmin } from '@backend/shared/supabase-admin'
import type { LiliIntent, LiliLocale } from './types'
import { normalizeLocale } from './i18n'

type IntentMatch = {
  intent: LiliIntent
  confidence: number
  source: 'rule' | 'pattern' | 'gemini'
  searchTerm?: string
  locale?: LiliLocale
}

const NORMALIZED_RULES: Array<{ intent: LiliIntent; phrases: string[] }> = [
  {
    intent: 'ajuda_contextual',
    phrases: ['ajuda nesta pagina', 'o que posso fazer aqui', 'me ajude aqui', 'ajuda contextual', 'help on this page', 'what can i do here', 'ayuda en esta pagina'],
  },
  {
    intent: 'escalar_elenco',
    phrases: [
      'escalar elenco', 'montar escalacao', 'gerenciar escalacao', 'token de escalacao',
      'escalar plantilla', 'gestionar alineacion',
      'manage lineup', 'build lineup', 'lineup token',
    ],
  },
  {
    intent: 'abrir_central_agenda',
    phrases: ['central de agenda', 'agenda e notificacoes', 'meus compromissos e avisos', 'painel de agenda', 'agenda y notificaciones', 'schedule and notifications'],
  },
  {
    intent: 'listar_notificacoes',
    phrases: ['minhas notificacoes', 'ver notificacoes', 'avisos da conta', 'novas notificacoes', 'mis notificaciones', 'my notifications'],
  },
  {
    intent: 'marcar_notificacoes_lidas',
    phrases: ['marcar notificacoes como lidas', 'ler todas notificacoes', 'limpar avisos', 'marcar todas como lidas', 'marcar notificaciones leidas', 'mark notifications read'],
  },
  {
    intent: 'abrir_central_carteira',
    phrases: ['central da carteira', 'resumo da carteira', 'meu saldo', 'saldo disponivel', 'minha carteira', 'resumen de cartera', 'wallet overview', 'my balance'],
  },
  {
    intent: 'listar_movimentacoes_carteira',
    phrases: ['movimentacoes da carteira', 'extrato da carteira', 'meus lancamentos', 'historico do saldo', 'movimientos de cartera', 'wallet transactions'],
  },
  {
    intent: 'listar_saques_carteira',
    phrases: ['meus saques', 'historico de saques', 'status do saque', 'acompanhar saque', 'mis retiros', 'withdrawal history'],
  },
  {
    intent: 'abrir_central_vendedores',
    phrases: ['central de vendedores', 'meus vendedores', 'minhas vendas', 'comissoes de vendedor', 'vagas que vendo', 'central de vendedores', 'seller center', 'my sales'],
  },
  {
    intent: 'abrir_central_competitiva',
    phrases: ['central competitiva', 'pontuacao resultados e transmissao', 'operacao competitiva', 'jogos e resultados', 'central competitiva do campeonato', 'central competitiva del torneo', 'competitive operations center'],
  },
  {
    intent: 'listar_jogos_pontuacao',
    phrases: ['jogos para pontuar', 'abrir pontuador', 'partidas para pontuacao', 'status dos jogos', 'juegos para puntuar', 'games to score', 'scoring games'],
  },
  {
    intent: 'auditar_resultados_campeonato',
    phrases: ['auditar resultados', 'verificar pontuacao', 'problemas nos resultados', 'divergencia de abates', 'conferir sumula', 'auditar resultados del torneo', 'audit tournament results'],
  },
  {
    intent: 'abrir_central_transmissao',
    phrases: ['central de transmissao', 'transmissao e obs', 'configurar obs', 'links da live', 'mesa de transmissao', 'transmision y obs', 'broadcast and obs', 'stream control'],
  },
  {
    intent: 'explorar_campeonatos',
    phrases: [
      'campeonatos', 'ver campeonatos', 'informacoes de campeonatos', 'quero acessar campeonatos',
      'torneos', 'ver torneos', 'informacion de torneos',
      'tournaments', 'view tournaments', 'tournament information',
    ],
  },
  {
    intent: 'explorar_equipes',
    phrases: [
      'equipes', 'ver equipes', 'informacoes de equipes', 'quero acessar equipes',
      'equipos', 'ver equipos', 'informacion de equipos',
      'teams', 'view teams', 'team information',
    ],
  },
  {
    intent: 'explorar_jogadores',
    phrases: [
      'jogadores', 'ver jogadores', 'informacoes de jogadores', 'lista de jogadores',
      'jugadores', 'ver jugadores', 'informacion de jugadores',
      'players', 'view players', 'player information',
    ],
  },
  {
    intent: 'explorar_organizacao',
    phrases: [
      'minha organizacao', 'dados da minha organizacao', 'area da organizacao', 'acessar minha organizacao',
      'mi organizacion', 'datos de mi organizacion',
      'my organization', 'organization data', 'organization area',
    ],
  },
  {
    intent: 'explorar_servicos',
    phrases: [
      'agenda e servicos', 'servicos', 'acessar servicos', 'agenda e financeiro',
      'agenda y servicios', 'servicios',
      'schedule and services', 'services', 'schedule and finance',
    ],
  },
  {
    intent: 'listar_campeonatos_gerenciados',
    phrases: [
      'meus campeonatos organizados', 'campeonatos que administro', 'gerenciar campeonatos', 'painel do organizador', 'meus eventos',
      'mis torneos administrados', 'torneos que organizo', 'panel del organizador',
      'my managed tournaments', 'tournaments i manage', 'organizer dashboard',
    ],
  },
  {
    intent: 'abrir_central_organizador',
    phrases: [
      'central do organizador', 'central operacional do campeonato', 'gestao do campeonato', 'administrar este campeonato',
      'central del organizador', 'gestion del torneo', 'administrar este torneo',
      'organizer center', 'tournament operations center', 'manage this tournament',
    ],
  },
  {
    intent: 'ver_estrutura_operacional_campeonato',
    phrases: [
      'ver estrutura do campeonato', 'fases grupos e slots', 'estrutura operacional', 'organizar grupos do campeonato',
      'ver estructura del torneo', 'fases grupos y cupos',
      'view tournament structure', 'phases groups and slots',
    ],
  },
  {
    intent: 'ver_operacao_campeonato',
    phrases: [
      'operacao do campeonato', 'jogos equipes e inscricoes', 'resumo operacional do campeonato', 'andamento do campeonato',
      'operacion del torneo', 'partidos equipos e inscripciones',
      'tournament operations', 'games teams and registrations',
    ],
  },
  {
    intent: 'auditar_campeonato',
    phrases: [
      'auditar campeonato', 'diagnostico do campeonato', 'o que falta no campeonato', 'problemas do campeonato', 'verificar configuracao do campeonato',
      'auditar torneo', 'diagnostico del torneo', 'que falta en el torneo',
      'audit tournament', 'tournament diagnostics', 'what is missing from the tournament',
    ],
  },
  {
    intent: 'central_operacional_equipe',
    phrases: [
      'central operacional da equipe', 'gerenciar minha equipe', 'gestao da equipe', 'painel da equipe', 'administrar equipe',
      'central operativa del equipo', 'gestionar mi equipo', 'administrar equipo',
      'team operations center', 'manage my team', 'team management',
    ],
  },
  {
    intent: 'ver_elenco_equipe',
    phrases: [
      'ver elenco da equipe', 'jogadores da minha equipe', 'quem esta na equipe', 'listar jogadores da equipe',
      'ver plantilla del equipo', 'jugadores de mi equipo', 'quien esta en el equipo',
      'team roster', 'players on my team', 'show team players',
    ],
  },
  {
    intent: 'ver_lines_equipe',
    phrases: [
      'ver lines da equipe', 'minhas lines', 'listar lines', 'composicoes da equipe',
      'ver lines del equipo', 'mis lines', 'listar lines del equipo',
      'team lines', 'my lineups', 'show team lines',
    ],
  },
  {
    intent: 'ver_staff_equipe',
    phrases: [
      'ver staff da equipe', 'managers da equipe', 'quem administra a equipe', 'equipe tecnica',
      'ver staff del equipo', 'managers del equipo', 'quien administra el equipo',
      'team staff', 'team managers', 'who manages the team',
    ],
  },
  {
    intent: 'ver_convites_equipe',
    phrases: [
      'convites da equipe', 'convites pendentes da equipe', 'links de convite da equipe', 'gerenciar convites',
      'invitaciones del equipo', 'invitaciones pendientes', 'gestionar invitaciones',
      'team invites', 'pending team invites', 'manage invitations',
    ],
  },
  {
    intent: 'auditar_equipe',
    phrases: [
      'auditar equipe', 'ver pendencias da equipe', 'o que falta na equipe', 'diagnostico da equipe', 'problemas da equipe',
      'auditar equipo', 'pendencias del equipo', 'que falta en el equipo', 'diagnostico del equipo',
      'audit team', 'team issues', 'what is missing from my team', 'team diagnostics',
    ],
  },
  {
    intent: 'abrir_central_financeira',
    phrases: [
      'central financeira', 'minha central financeira', 'resumo financeiro', 'meus pagamentos',
      'financeiro da lili', 'situacao dos pagamentos', 'pagamentos e estornos',
      'central financiera', 'resumen financiero', 'mis pagos',
      'financial center', 'financial overview', 'my payments', 'payment overview',
    ],
  },
  {
    intent: 'listar_historico_revisoes_financeiras',
    phrases: [
      'historico de revisoes financeiras', 'revisoes financeiras encerradas', 'decisoes financeiras anteriores',
      'historico de estornos do campeonato', 'casos financeiros resolvidos',
      'historial de revisiones financieras', 'revisiones financieras cerradas',
      'financial review history', 'closed financial reviews', 'resolved chargebacks',
    ],
  },
  {
    intent: 'listar_revisoes_financeiras',
    phrases: [
      'revisoes financeiras', 'pendencias financeiras do campeonato', 'estornos para revisar', 'chargebacks para revisar',
      'revisiones financieras', 'pendencias financieras del torneo', 'reembolsos para revisar',
      'financial reviews', 'tournament financial issues', 'refunds to review', 'chargebacks to review',
    ],
  },
  {
    intent: 'cancelar_compra_vaga_pendente',
    phrases: [
      'cancelar compra da vaga', 'desistir da compra', 'liberar a vaga', 'cancelar pagamento pendente',
      'cancelar compra del cupo', 'desistir de la compra', 'liberar el cupo',
      'cancel spot purchase', 'give up purchase', 'release the spot', 'cancel pending payment',
    ],
  },
  {
    intent: 'listar_minhas_vagas_compradas',
    phrases: [
      'minhas vagas compradas', 'vagas que comprei', 'vaga paga', 'usar minha vaga', 'continuar inscricao paga',
      'mis cupos comprados', 'cupos que compre', 'usar mi cupo', 'continuar inscripcion pagada',
      'my purchased spots', 'spots i bought', 'use my spot', 'continue paid registration',
    ],
  },
  {
    intent: 'perguntar_regra_campeonato',
    phrases: [
      'perguntar sobre as regras', 'duvida sobre o regulamento', 'tenho uma duvida sobre as regras', 'consultar uma regra',
      'preguntar sobre las reglas', 'duda sobre el reglamento', 'tengo una duda sobre las reglas', 'consultar una regla',
      'ask about the rules', 'question about the rulebook', 'i have a rules question', 'check a rule',
    ],
  },
  {
    intent: 'ver_regulamento_campeonato',
    phrases: [
      'ver regulamento', 'regras do campeonato', 'mostrar regras', 'consultar regulamento', 'topicos do regulamento',
      'ver reglamento', 'reglas del torneo', 'mostrar reglas', 'consultar reglamento', 'temas del reglamento',
      'view rules', 'tournament rules', 'show rules', 'view rulebook', 'rulebook topics',
    ],
  },
  {
    intent: 'listar_campeonatos_abertos',
    phrases: [
      'campeonatos com vagas', 'vagas abertas', 'campeonatos abertos', 'ver campeonatos', 'tem vaga', 'quero vaga',
      'tem algum campeonato', 'algum campeonato', 'campeonato para jogar', 'onde minha equipe possa jogar',
      'onde minha equipe pode jogar', 'campeonato disponivel',
      'torneos con cupos', 'cupos disponibles', 'torneos abiertos', 'ver torneos', 'hay cupos', 'quiero un cupo',
      'donde puede jugar mi equipo', 'competencias disponibles',
      'tournaments with spots', 'open spots', 'open tournaments', 'show tournaments', 'available spots',
      'where can my team play', 'available tournaments',
    ],
  },
  {
    intent: 'resumo_minha_conta',
    phrases: [
      'resumo da minha conta', 'minha central', 'visao geral da minha conta', 'resumo do meu perfil', 'o que tenho no sistema',
      'resumen de mi cuenta', 'mi central', 'vista general de mi cuenta', 'resumen de mi perfil',
      'my account summary', 'my dashboard', 'account overview', 'profile summary',
    ],
  },
  {
    intent: 'listar_proximos_jogos',
    phrases: [
      'proximos jogos', 'meus proximos jogos', 'agenda de jogos', 'quando minha equipe joga', 'quando eu jogo',
      'calendario da minha equipe', 'ver minha agenda', 'minha agenda',
      'proximos partidos', 'mis proximos partidos', 'agenda de partidos', 'cuando juega mi equipo',
      'calendario de mi equipo', 'ver mi agenda', 'mi agenda',
      'upcoming matches', 'my upcoming matches', 'game schedule', 'when does my team play',
      'team calendar', 'show my schedule', 'my schedule',
    ],
  },
  {
    intent: 'listar_minhas_inscricoes',
    phrases: [
      'minhas inscricoes', 'ver minhas inscricoes', 'campeonatos que estou inscrito',
      'campeonatos que minha equipe esta inscrita', 'onde minha equipe esta inscrita', 'acompanhar minhas inscricoes',
      'status das minhas inscricoes', 'mis inscripciones', 'ver mis inscripciones', 'donde esta inscrito mi equipo',
      'estado de mis inscripciones', 'my registrations', 'show my registrations', 'where is my team registered',
      'registration status',
    ],
  },
  {
    intent: 'listar_minhas_equipes',
    phrases: [
      'minhas equipes', 'ver minhas equipes', 'qual minha equipe', 'equipes que administro', 'meus times',
      'mis equipos', 'ver mis equipos', 'equipos que administro', 'my teams', 'show my teams', 'teams i manage',
    ],
  },
  {
    intent: 'usar_convite_token',
    phrases: [
      'usar convite', 'usar token', 'tenho um token', 'tenho um convite', 'validar convite', 'validar token',
      'usar invitacion', 'usar token', 'tengo un token', 'tengo una invitacion', 'validar invitacion',
      'use invite', 'use token', 'i have a token', 'i have an invite', 'validate invite', 'validate token',
    ],
  },
  {
    intent: 'iniciar_inscricao',
    phrases: [
      'fazer inscricao', 'quero me inscrever', 'inscrever equipe', 'nova inscricao', 'cadastrar no campeonato',
      'hacer inscripcion', 'quiero inscribirme', 'inscribir equipo', 'nueva inscripcion',
      'register team', 'start registration', 'new registration', 'sign up for tournament',
    ],
  },
  {
    intent: 'comprar_vaga',
    phrases: [
      'nao tenho token', 'nao tenho convite', 'comprar vaga', 'quero comprar uma vaga',
      'no tengo token', 'no tengo invitacion', 'comprar cupo', 'quiero comprar un cupo',
      'i do not have a token', 'i dont have a token', 'buy a spot', 'purchase a spot',
    ],
  },
  {
    intent: 'simular_pagamento_internacional',
    phrases: [
      'converter valor', 'pagar em dolar', 'pagar em euro', 'pagamento internacional', 'simular paypal',
      'valor em dolar', 'valor em euro', 'cotacao internacional',
      'pagar en dolares', 'pagar en euros', 'pago internacional', 'simular paypal', 'precio en dolares', 'precio en euros',
      'pay in dollars', 'pay in euros', 'international payment', 'paypal quote', 'price in dollars', 'price in euros',
    ],
  },
  {
    intent: 'voltar_etapa',
    phrases: [
      'voltar uma etapa', 'etapa anterior', 'voltar passo', 'quero voltar',
      'volver un paso', 'paso anterior', 'volver etapa',
      'go back one step', 'previous step', 'back one step',
    ],
  },
  {
    intent: 'cancelar_fluxo',
    phrases: [
      'cancelar', 'cancelar operacao', 'cancelar inscricao', 'parar processo', 'sair deste fluxo',
      'cancelar operacion', 'cancelar inscripcion', 'detener proceso', 'salir del flujo',
      'cancel', 'cancel operation', 'cancel registration', 'stop process', 'exit flow',
    ],
  },
  {
    intent: 'status_fluxo',
    phrases: [
      'onde parei', 'em que etapa estou', 'status da operacao', 'status do processo', 'continuar de onde parei',
      'donde quede', 'en que paso estoy', 'estado de la operacion', 'continuar donde quede',
      'where did i stop', 'what step am i on', 'operation status', 'continue where i left off',
    ],
  },
  {
    intent: 'reiniciar_conversa',
    phrases: [
      'reiniciar conversa', 'recomecar conversa', 'limpar conversa', 'comecar de novo', 'novo atendimento',
      'reiniciar conversacion', 'empezar de nuevo', 'limpiar conversacion', 'nueva conversacion',
      'restart conversation', 'start over', 'clear conversation', 'new conversation',
    ],
  },
  {
    intent: 'alterar_idioma',
    phrases: ['portugues', 'espanol', 'english', 'mudar idioma', 'cambiar idioma', 'change language'],
  },
  {
    intent: 'menu',
    phrases: [
      'menu', 'inicio', 'voltar ao inicio', 'ajuda', 'o que voce faz',
      'volver al inicio', 'ayuda', 'que puedes hacer', 'back to start', 'help', 'what can you do',
    ],
  },
]


export function normalizeLiliText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function detectLiliLocale(message: string): LiliLocale {
  const text = normalizeLiliText(message)
  if (/\b(hello|hi|please|team|tournament|registration|spots|english)\b/.test(text)) return 'en'
  if (/\b(hola|por favor|equipo|torneo|inscripcion|cupos|espanol|gracias)\b/.test(text)) return 'es'
  return 'pt-BR'
}

function ruleMatch(message: string): IntentMatch | null {
  const text = normalizeLiliText(message)
  for (const rule of NORMALIZED_RULES) {
    if (rule.phrases.some((phrase) => text.includes(phrase))) {
      return { intent: rule.intent, confidence: 0.99, source: 'rule', locale: detectLiliLocale(message) }
    }
  }

  const namedSearch = text.match(
    /(?:buscar|procurar|achar|ver|resultado(?:s)?(?: do| da)?|campeonato chamado|liga chamada|copa chamada)\s+(?:o |a |do |da |de )?(?:campeonato |liga |copa )?(.+)$/,
  )
  if (namedSearch?.[1]?.trim()) {
    const searchTerm = namedSearch[1].trim()
    const generic = ['com vagas', 'aberto', 'abertos', 'disponivel', 'disponiveis', 'para jogar']
    if (!generic.some((value) => searchTerm === value || searchTerm.startsWith(`${value} `))) {
      return { intent: 'buscar_campeonato', confidence: 0.9, source: 'rule', searchTerm, locale: detectLiliLocale(message) }
    }
  }
  return null
}

async function patternMatch(message: string): Promise<IntentMatch | null> {
  const normalized = normalizeLiliText(message)
  if (!normalized) return null
  const { data, error } = await supabaseAdmin
    .from('lili_intent_patterns')
    .select('intent_code,frase_normalizada,confianca')
    .eq('ativo', true)
    .eq('aprovado', true)
    .eq('frase_normalizada', normalized)
    .limit(1)
    .maybeSingle()
  if (error) {
    if (['42P01', 'PGRST205'].includes(error.code || '')) return null
    throw error
  }
  if (!data) return null
  return {
    intent: data.intent_code as LiliIntent,
    confidence: Number(data.confianca || 0.9),
    source: 'pattern',
    locale: detectLiliLocale(message),
  }
}

function stripJsonFence(value: string) {
  return value.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
}

async function geminiMatch(message: string): Promise<IntentMatch> {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) return { intent: 'desconhecido', confidence: 0, source: 'gemini', locale: detectLiliLocale(message) }
  const model = String(process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite').trim()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: 'Classifique a mensagem de um usuário do DropZone. Responda SOMENTE JSON válido com intent, confidence, searchTerm e locale. locale deve ser pt-BR, es ou en conforme o idioma da mensagem. Intents permitidas: menu, ajuda_contextual, explorar_campeonatos, explorar_equipes, explorar_jogadores, explorar_organizacao, explorar_servicos, listar_campeonatos_abertos, buscar_campeonato, ver_regulamento_campeonato, perguntar_regra_campeonato, comprar_vaga, usar_convite_token, listar_minhas_equipes, escalar_elenco, abrir_escalacoes_equipe, gerar_token_escalacao, listar_campeonatos_gerenciados, abrir_central_organizador, ver_estrutura_operacional_campeonato, ver_operacao_campeonato, auditar_campeonato, central_operacional_equipe, ver_elenco_equipe, ver_lines_equipe, ver_staff_equipe, ver_convites_equipe, auditar_equipe, listar_minhas_inscricoes, listar_proximos_jogos, abrir_central_agenda, abrir_central_financeira, abrir_central_competitiva, listar_jogos_pontuacao, auditar_resultados_campeonato, abrir_central_transmissao, iniciar_inscricao, simular_pagamento_internacional, alterar_idioma, voltar_etapa, cancelar_fluxo, status_fluxo, reiniciar_conversa, desconhecido. Use listar_campeonatos_abertos para perguntas genéricas sobre campeonatos, vagas, oportunidades ou onde uma equipe pode jogar. Use escalar_elenco para começar a montar ou administrar uma escalação. Use abrir_escalacoes_equipe quando a equipe já estiver definida. Use gerar_token_escalacao somente quando a participação também estiver definida no contexto. Use buscar_campeonato somente quando houver um nome próprio explícito de campeonato, liga ou copa. searchTerm deve conter exclusivamente esse nome próprio e deve ficar vazio nas perguntas genéricas.' }],
          },
          contents: [{ role: 'user', parts: [{ text: message.slice(0, 500) }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 120, responseMimeType: 'application/json' },
        }),
      },
    )
    if (!response.ok) return { intent: 'desconhecido', confidence: 0, source: 'gemini', locale: detectLiliLocale(message) }
    const json = await response.json()
    const text = json?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || ''
    const parsed = JSON.parse(stripJsonFence(text))
    const allowed: LiliIntent[] = ['menu', 'ajuda_contextual', 'explorar_campeonatos', 'explorar_equipes', 'explorar_jogadores', 'explorar_organizacao', 'explorar_servicos', 'listar_campeonatos_abertos', 'buscar_campeonato', 'ver_regulamento_campeonato', 'perguntar_regra_campeonato', 'comprar_vaga', 'usar_convite_token', 'listar_minhas_equipes', 'escalar_elenco', 'abrir_escalacoes_equipe', 'gerar_token_escalacao', 'listar_campeonatos_gerenciados', 'abrir_central_organizador', 'ver_estrutura_operacional_campeonato', 'ver_operacao_campeonato', 'auditar_campeonato', 'central_operacional_equipe', 'ver_elenco_equipe', 'ver_lines_equipe', 'ver_staff_equipe', 'ver_convites_equipe', 'auditar_equipe', 'listar_minhas_inscricoes', 'listar_proximos_jogos', 'abrir_central_agenda', 'abrir_central_financeira', 'abrir_central_competitiva', 'listar_jogos_pontuacao', 'auditar_resultados_campeonato', 'abrir_central_transmissao', 'iniciar_inscricao', 'simular_pagamento_internacional', 'alterar_idioma', 'voltar_etapa', 'cancelar_fluxo', 'status_fluxo', 'reiniciar_conversa', 'desconhecido']
    let intent = allowed.includes(parsed.intent) ? parsed.intent : 'desconhecido'
    let searchTerm = String(parsed.searchTerm || '').trim() || undefined

    if (intent === 'buscar_campeonato') {
      const normalized = normalizeLiliText(message)
      const looksGeneric =
        !searchTerm
        || normalized.includes('algum campeonato')
        || normalized.includes('campeonato com vaga')
        || normalized.includes('campeonatos com vaga')
        || normalized.includes('onde minha equipe')
        || normalized.includes('para jogar')
      if (looksGeneric) {
        intent = 'listar_campeonatos_abertos'
        searchTerm = undefined
      }
    }

    return {
      intent,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0.6))),
      source: 'gemini',
      searchTerm,
      locale: normalizeLocale(parsed.locale || detectLiliLocale(message)),
    }
  } catch {
    return { intent: 'desconhecido', confidence: 0, source: 'gemini', locale: detectLiliLocale(message) }
  } finally {
    clearTimeout(timer)
  }
}

async function saveCandidate(message: string, match: IntentMatch) {
  if (match.source !== 'gemini' || match.intent === 'desconhecido' || match.confidence < 0.7) return
  const normalized = normalizeLiliText(message)
  if (!normalized) return
  const { error } = await supabaseAdmin.from('lili_pattern_candidates').insert({
    mensagem_original: message.slice(0, 500),
    frase_normalizada: normalized,
    intent_sugerida: match.intent,
    confianca: match.confidence,
  })
  if (error && !['42P01', 'PGRST205'].includes(error.code || '')) console.error('Lili candidate error:', error.message)
}

export async function resolveLiliIntent(message: string): Promise<IntentMatch> {
  const direct = ruleMatch(message)
  if (direct) return direct
  const learned = await patternMatch(message)
  if (learned) return learned
  const gemini = await geminiMatch(message)
  await saveCandidate(message, gemini)
  return gemini
}
