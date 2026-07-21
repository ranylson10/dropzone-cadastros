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

export function getInviteGroupConversationState({
  step,
  inscricaoAberta,
  participacoesCount,
}: InviteGroupConversationContext): InviteGroupConversationState {
  switch (step) {
    case 'inicio':
      return { step, eyebrow: 'Convite de inscrição', chatEnabled: true, kind: 'entry' }
    case 'login':
      return { step, eyebrow: 'Entrada de equipes', chatEnabled: true, kind: 'authentication' }
    case 'sem_equipe':
      return { step, eyebrow: 'Perfil de equipe', chatEnabled: true, kind: 'profile' }
    case 'escolher_equipe':
      return { step, eyebrow: 'Escolher equipe', chatEnabled: true, kind: 'team-selection' }
    case 'confirmar_equipe':
      return { step, eyebrow: 'Confirmar equipe', chatEnabled: true, kind: 'team-confirmation' }
    case 'escolher_line':
      return { step, eyebrow: 'Escolher line', chatEnabled: true, kind: 'line-selection' }
    case 'sucesso':
      return { step, eyebrow: 'Inscrição confirmada', chatEnabled: true, kind: 'success' }
    case 'hub':
      return {
        step,
        eyebrow: participacoesCount > 1 ? `${participacoesCount} lines inscritas` : 'Equipe inscrita',
        chatEnabled: true,
        kind: 'management',
      }
    case 'escalar':
      return { step, eyebrow: 'Escalar elenco', chatEnabled: true, kind: 'roster' }
    case 'jogadores':
      return { step, eyebrow: 'Jogadores inscritos', chatEnabled: true, kind: 'players' }
    case 'duvidas':
      return { step, eyebrow: 'Tirar dúvidas', chatEnabled: true, kind: 'help' }
    case 'acompanhar':
    default:
      return {
        step,
        eyebrow: inscricaoAberta ? 'Acompanhamento do grupo' : 'Acompanhamento do grupo',
        chatEnabled: true,
        kind: 'tracking',
      }
  }
}
