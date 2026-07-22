export type InviteGroupStep =
  | 'inicio'
  | 'acompanhar'
  | 'login'
  | 'sem_equipe'
  | 'escolher_equipe'
  | 'confirmar_equipe'
  | 'escolher_line'
  | 'sucesso'
  | 'hub'
  | 'escalar'
  | 'jogadores'
  | 'duvidas'

export type InviteGroupConversationContext = {
  step: InviteGroupStep
  inscricaoAberta: boolean
  participacoesCount: number
  campeonatoNome?: string | null
  grupoNome?: string | null
  equipeNome?: string | null
  papelSessao?: string | null
  podeInscrever?: boolean
}

export type InviteGroupConversationAction = {
  id:
    | 'inscrever'
    | 'acompanhar'
    | 'cadastrar_equipe'
    | 'confirmar_equipe'
    | 'escolher_equipe'
    | 'escolher_line'
    | 'gerenciar_inscricao'
    | 'entrar_gerenciar'
  label: string
  primary?: boolean
}

export type InviteGroupConversationState = {
  step: InviteGroupStep
  eyebrow: string
  chatEnabled: boolean
  kind:
    | 'entry'
    | 'authentication'
    | 'profile'
    | 'team-selection'
    | 'team-confirmation'
    | 'line-selection'
    | 'success'
    | 'management'
    | 'tracking'
    | 'roster'
    | 'players'
    | 'help'
  messages: string[]
  actions: InviteGroupConversationAction[]
}

const CHAT_STEPS = new Set<InviteGroupStep>([
  'inicio',
  'login',
  'sem_equipe',
  'escolher_equipe',
  'confirmar_equipe',
  'escolher_line',
  'sucesso',
  'hub',
  'acompanhar',
  'escalar',
  'jogadores',
  'duvidas',
])

export function isInviteGroupChatStep(step: InviteGroupStep) {
  return CHAT_STEPS.has(step)
}

function names(context: InviteGroupConversationContext) {
  return {
    campeonato: context.campeonatoNome || 'campeonato',
    grupo: context.grupoNome || 'grupo',
    equipe: context.equipeNome || 'sua equipe',
  }
}

export function getInviteGroupConversationState(
  context: InviteGroupConversationContext,
): InviteGroupConversationState {
  const { step, inscricaoAberta, participacoesCount, papelSessao, podeInscrever } = context
  const { campeonato, grupo, equipe } = names(context)

  switch (step) {
    case 'inicio':
      return {
        step,
        eyebrow: 'Convite de inscrição',
        chatEnabled: true,
        kind: 'entry',
        messages: [
          'Oi! Eu sou a Lili, assistente virtual da DropZone.',
          `Você recebeu um convite para o grupo ${grupo} do campeonato ${campeonato}.`,
          'Como você quer continuar?',
        ],
        actions: [
          { id: 'inscrever', label: 'Quero inscrever minha equipe', primary: true },
          { id: 'acompanhar', label: 'Só acompanhar as inscrições' },
        ],
      }
    case 'login':
      return {
        step,
        eyebrow: 'Entrada de equipes',
        chatEnabled: true,
        kind: 'authentication',
        messages: [
          podeInscrever
            ? 'Verifiquei aqui: você ainda não está conectado a uma conta de equipe.'
            : 'Esse link não aceita novas inscrições agora.',
          podeInscrever
            ? 'Entre com Google para eu identificar sua equipe. Caso ainda não tenha uma, vou orientar o cadastro.'
            : 'Caso sua equipe já esteja neste grupo, entre com Google para gerenciar e escalar o elenco.',
        ],
        actions: [
          { id: 'entrar_gerenciar', label: podeInscrever ? 'Entrar com Google' : 'Entrar para gerenciar', primary: true },
          { id: 'acompanhar', label: 'Só acompanhar as inscrições' },
        ],
      }
    case 'sem_equipe':
      return {
        step,
        eyebrow: 'Perfil de equipe',
        chatEnabled: true,
        kind: 'profile',
        messages:
          papelSessao === 'manager'
            ? [
                'Você entrou como manager, mas ainda não controla nenhuma equipe.',
                'Cadastre uma equipe ou aceite um vínculo para continuar.',
              ]
            : [
                'Seu acesso com Google foi confirmado.',
                'Ainda não encontrei uma equipe cadastrada nessa conta.',
                'Cadastre sua equipe e depois continuamos a inscrição.',
              ],
        actions: [
          { id: 'cadastrar_equipe', label: 'Cadastrar minha equipe', primary: true },
          { id: 'acompanhar', label: 'Só acompanhar' },
        ],
      }
    case 'escolher_equipe':
      return {
        step,
        eyebrow: 'Escolher equipe',
        chatEnabled: true,
        kind: 'team-selection',
        messages: [
          papelSessao === 'manager'
            ? 'Você entrou como manager.'
            : 'Você controla mais de uma equipe.',
          inscricaoAberta
            ? 'Escolha com qual equipe deseja entrar neste campeonato.'
            : 'Escolha uma equipe já inscrita neste grupo para gerenciar a escalação.',
        ],
        actions: [
          { id: 'escolher_equipe', label: 'Escolher equipe', primary: true },
          { id: 'acompanhar', label: 'Só acompanhar' },
        ],
      }
    case 'confirmar_equipe':
      return {
        step,
        eyebrow: 'Confirmar equipe',
        chatEnabled: true,
        kind: 'team-confirmation',
        messages: [
          `Você está conectado com a equipe ${equipe}.`,
          `Quer inscrever essa equipe no grupo ${grupo}?`,
        ],
        actions: [
          { id: 'confirmar_equipe', label: `Sim, inscrever ${equipe}`, primary: true },
          { id: 'acompanhar', label: 'Só acompanhar' },
        ],
      }
    case 'escolher_line':
      return {
        step,
        eyebrow: 'Escolher line',
        chatEnabled: true,
        kind: 'line-selection',
        messages: [`Agora escolha um slot livre e a line que será inscrita pela equipe ${equipe}.`],
        actions: [{ id: 'escolher_line', label: 'Escolher slot e line', primary: true }],
      }
    case 'sucesso':
      return {
        step,
        eyebrow: 'Inscrição confirmada',
        chatEnabled: true,
        kind: 'success',
        messages: [`A inscrição da equipe ${equipe} foi confirmada no grupo ${grupo}.`],
        actions: [{ id: 'gerenciar_inscricao', label: 'Gerenciar minha inscrição', primary: true }],
      }
    case 'hub':
      return {
        step,
        eyebrow: participacoesCount > 1 ? `${participacoesCount} lines inscritas` : 'Equipe inscrita',
        chatEnabled: true,
        kind: 'management',
        messages: ['Sua inscrição está ativa. Por aqui você pode acompanhar e gerenciar o elenco.'],
        actions: [
          { id: 'gerenciar_inscricao', label: 'Escalar elenco', primary: true },
          { id: 'acompanhar', label: 'Acompanhar grupo' },
        ],
      }
    case 'escalar':
      return {
        step,
        eyebrow: 'Escalar elenco',
        chatEnabled: true,
        kind: 'roster',
        messages: ['Vamos preparar o elenco desta line.'],
        actions: [],
      }
    case 'jogadores':
      return {
        step,
        eyebrow: 'Jogadores inscritos',
        chatEnabled: true,
        kind: 'players',
        messages: ['Aqui estão os jogadores vinculados à inscrição.'],
        actions: [],
      }
    case 'duvidas':
      return {
        step,
        eyebrow: 'Tirar dúvidas',
        chatEnabled: true,
        kind: 'help',
        messages: ['Pergunte sobre inscrição, slots, jogadores, pagamentos ou agenda.'],
        actions: [],
      }
    case 'acompanhar':
    default:
      return {
        step,
        eyebrow: 'Acompanhamento do grupo',
        chatEnabled: true,
        kind: 'tracking',
        messages: [
          inscricaoAberta
            ? `Acompanhe as equipes e os slots disponíveis no grupo ${grupo}.`
            : `As novas inscrições estão fechadas, mas você ainda pode acompanhar o grupo ${grupo}.`,
        ],
        actions: [],
      }
  }
}
