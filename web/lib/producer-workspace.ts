export const PRODUCER_MEMBER_ROLES = [
  'administrador',
  'operacao',
  'pontuador',
  'financeiro',
  'comercial',
  'visualizacao',
] as const

export type ProducerMemberRole = (typeof PRODUCER_MEMBER_ROLES)[number]
export type ProducerWorkspaceRole = 'proprietario' | ProducerMemberRole

export type ProducerWorkspacePermissions = {
  pode_ver: boolean
  pode_administrar: boolean
  pode_operar: boolean
  pode_pontuar: boolean
  pode_financeiro: boolean
  pode_comercial: boolean
  pode_gerenciar_membros: boolean
  pode_criar_campeonato: boolean
}

export const PRODUCER_ROLE_LABELS: Record<ProducerWorkspaceRole, string> = {
  proprietario: 'Proprietário',
  administrador: 'Administrador',
  operacao: 'Operação',
  pontuador: 'Pontuador',
  financeiro: 'Financeiro',
  comercial: 'Comercial',
  visualizacao: 'Visualização',
}

export const PRODUCER_ROLE_DESCRIPTIONS: Record<ProducerWorkspaceRole, string> = {
  proprietario: 'Controle completo da produtora, membros, campeonatos, financeiro e comercial.',
  administrador: 'Administra a produtora, membros e campeonatos com acesso amplo.',
  operacao: 'Opera estrutura, participantes e jogos dos campeonatos.',
  pontuador: 'Acessa e lança resultados, súmulas e pontuação.',
  financeiro: 'Acompanha carteira, recebimentos e gestão financeira.',
  comercial: 'Gerencia vagas, inscrições, vendedores e convites comerciais.',
  visualizacao: 'Consulta o workspace sem alterar dados.',
}

export const PRODUCER_ROLE_PERMISSIONS: Record<ProducerWorkspaceRole, ProducerWorkspacePermissions> = {
  proprietario: {
    pode_ver: true,
    pode_administrar: true,
    pode_operar: true,
    pode_pontuar: true,
    pode_financeiro: true,
    pode_comercial: true,
    pode_gerenciar_membros: true,
    pode_criar_campeonato: true,
  },
  administrador: {
    pode_ver: true,
    pode_administrar: true,
    pode_operar: true,
    pode_pontuar: true,
    pode_financeiro: true,
    pode_comercial: true,
    pode_gerenciar_membros: true,
    pode_criar_campeonato: true,
  },
  operacao: {
    pode_ver: true,
    pode_administrar: false,
    pode_operar: true,
    pode_pontuar: true,
    pode_financeiro: false,
    pode_comercial: false,
    pode_gerenciar_membros: false,
    pode_criar_campeonato: false,
  },
  pontuador: {
    pode_ver: true,
    pode_administrar: false,
    pode_operar: false,
    pode_pontuar: true,
    pode_financeiro: false,
    pode_comercial: false,
    pode_gerenciar_membros: false,
    pode_criar_campeonato: false,
  },
  financeiro: {
    pode_ver: true,
    pode_administrar: false,
    pode_operar: false,
    pode_pontuar: false,
    pode_financeiro: true,
    pode_comercial: false,
    pode_gerenciar_membros: false,
    pode_criar_campeonato: false,
  },
  comercial: {
    pode_ver: true,
    pode_administrar: false,
    pode_operar: false,
    pode_pontuar: false,
    pode_financeiro: false,
    pode_comercial: true,
    pode_gerenciar_membros: false,
    pode_criar_campeonato: false,
  },
  visualizacao: {
    pode_ver: true,
    pode_administrar: false,
    pode_operar: false,
    pode_pontuar: false,
    pode_financeiro: false,
    pode_comercial: false,
    pode_gerenciar_membros: false,
    pode_criar_campeonato: false,
  },
}

export function normalizeProducerMemberRole(value: unknown): ProducerMemberRole {
  const clean = String(value || '').trim().toLowerCase() as ProducerMemberRole
  if (!PRODUCER_MEMBER_ROLES.includes(clean)) throw new Error('Cargo inválido para a equipe da produtora.')
  return clean
}

export function producerRolePermissions(role: ProducerWorkspaceRole) {
  return { ...PRODUCER_ROLE_PERMISSIONS[role] }
}
