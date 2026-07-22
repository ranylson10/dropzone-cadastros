import type { LiliConversationAction, LiliConversationState } from './conversation'

export type InviteTeamStep =
  | 'inicio'
  | 'acompanhar'
  | 'login'
  | 'sem_equipe'
  | 'confirmar_equipe'
  | 'escolher_slot'
  | 'escolher_line'
  | 'sucesso'

export type InviteTeamConversationContext = {
  step: InviteTeamStep
  inscricaoAberta: boolean
  campeonatoNome?: string | null
  grupoNome?: string | null
  equipeNome?: string | null
  slotNome?: string | null
  linesDisponiveis: number
  vagasLivres: number
}

export type InviteTeamConversationAction = LiliConversationAction<
  | 'inscrever'
  | 'acompanhar'
  | 'entrar'
  | 'cadastrar_equipe'
  | 'confirmar_equipe'
  | 'escolher_slot'
  | 'confirmar_inscricao'
  | 'ver_grupo'
>

export type InviteTeamConversationState = LiliConversationState<
  InviteTeamStep,
  InviteTeamConversationAction['id'],
  | 'entry'
  | 'tracking'
  | 'authentication'
  | 'profile'
  | 'team-confirmation'
  | 'slot-selection'
  | 'line-selection'
  | 'success'
>

function displayNames(context: InviteTeamConversationContext) {
  return {
    campeonato: context.campeonatoNome || 'campeonato',
    grupo: context.grupoNome || 'grupo',
    equipe: context.equipeNome || 'sua equipe',
    slot: context.slotNome || 'selecionado',
  }
}

export function getInviteTeamConversationState(
  context: InviteTeamConversationContext,
): InviteTeamConversationState {
  const { step, inscricaoAberta, linesDisponiveis, vagasLivres } = context
  const { campeonato, grupo, equipe, slot } = displayNames(context)

  switch (step) {
    case 'inicio':
      return {
        step,
        eyebrow: 'Convite de inscrição',
        chatEnabled: true,
        kind: 'entry',
        messages: [
          'Oi! Eu sou a Lili, assistente virtual da DropZone.',
          `Este convite é para o campeonato ${campeonato}${context.grupoNome ? `, no grupo ${grupo}` : ''}.`,
          inscricaoAberta
            ? 'Posso conduzir a inscrição da sua equipe passo a passo ou mostrar o andamento do grupo.'
            : 'As inscrições estão encerradas, mas você ainda pode acompanhar o grupo.',
        ],
        actions: inscricaoAberta
          ? [
              { id: 'inscrever', label: 'Inscrever minha equipe', primary: true },
              { id: 'acompanhar', label: 'Apenas acompanhar' },
            ]
          : [{ id: 'acompanhar', label: 'Acompanhar grupo', primary: true }],
      }
    case 'login':
      return {
        step,
        eyebrow: 'Identificar equipe',
        chatEnabled: true,
        kind: 'authentication',
        messages: [
          'Para continuar, preciso confirmar qual equipe está aceitando o convite.',
          'Entre com a conta da equipe. Depois do login, você volta exatamente para esta etapa.',
        ],
        actions: [
          { id: 'entrar', label: 'Entrar com a conta da equipe', primary: true },
          { id: 'acompanhar', label: 'Só acompanhar' },
        ],
      }
    case 'sem_equipe':
      return {
        step,
        eyebrow: 'Criar perfil de equipe',
        chatEnabled: true,
        kind: 'profile',
        messages: [
          'Seu login foi confirmado, mas ainda não existe um perfil de equipe vinculado a ele.',
          'Crie o perfil e eu trago você de volta para concluir esta inscrição.',
        ],
        actions: [{ id: 'cadastrar_equipe', label: 'Criar perfil de equipe', primary: true }],
      }
    case 'confirmar_equipe':
      return {
        step,
        eyebrow: 'Confirmar equipe',
        chatEnabled: true,
        kind: 'team-confirmation',
        messages: [
          `Encontrei a equipe ${equipe} nesta sessão.`,
          `Confirme para continuar a inscrição no campeonato ${campeonato}.`,
        ],
        actions: [{ id: 'confirmar_equipe', label: `Continuar com ${equipe}`, primary: true }],
      }
    case 'escolher_slot':
      return {
        step,
        eyebrow: 'Escolher slot',
        chatEnabled: true,
        kind: 'slot-selection',
        messages: [
          `Agora escolha onde a equipe ${equipe} ficará no grupo ${grupo}.`,
          vagasLivres === 1
            ? 'Existe 1 slot livre. Toque nele e confirme para seguir.'
            : `Existem ${vagasLivres} slots livres. Toque no slot desejado para seguir.`,
        ],
        actions: [{ id: 'escolher_slot', label: 'Escolher um slot', primary: true }],
      }
    case 'escolher_line':
      return {
        step,
        eyebrow: 'Escolher line',
        chatEnabled: true,
        kind: 'line-selection',
        messages: [
          context.slotNome
            ? `O slot ${slot} está reservado para ${equipe} nesta etapa.`
            : `A equipe ${equipe} está pronta para escolher a line.`,
          linesDisponiveis > 0
            ? `Você tem ${linesDisponiveis} ${linesDisponiveis === 1 ? 'line disponível' : 'lines disponíveis'}. Também pode criar uma nova.`
            : 'Não encontrei uma line livre. Crie uma nova e eu faço a inscrição automaticamente.',
        ],
        actions: [{ id: 'confirmar_inscricao', label: 'Confirmar inscrição', primary: true }],
      }
    case 'sucesso':
      return {
        step,
        eyebrow: 'Inscrição confirmada',
        chatEnabled: true,
        kind: 'success',
        messages: [
          `Pronto! A inscrição da equipe ${equipe} foi confirmada no campeonato ${campeonato}.`,
          'O comprovante abaixo reúne a line e o slot registrados.',
        ],
        actions: [{ id: 'ver_grupo', label: 'Ver grupo', primary: true }],
      }
    case 'acompanhar':
    default:
      return {
        step,
        eyebrow: 'Acompanhamento',
        chatEnabled: true,
        kind: 'tracking',
        messages: [
          inscricaoAberta
            ? `Aqui você acompanha as equipes inscritas e os slots livres no grupo ${grupo}.`
            : `As inscrições estão fechadas, mas o acompanhamento do grupo ${grupo} continua disponível.`,
        ],
        actions: inscricaoAberta
          ? [{ id: 'inscrever', label: 'Inscrever minha equipe', primary: true }]
          : [],
      }
  }
}
