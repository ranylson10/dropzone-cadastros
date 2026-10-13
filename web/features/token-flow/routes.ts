export const TOKEN_FLOW_ROUTES = {
  conviteEquipe: '/convite/equipe',
  conviteGrupo: '/convite/grupo',
  conviteProdutora: '/convite/produtora',
  equipeEntrar: '/equipe/entrar',
  equipeReivindicar: '/equipe/reivindicar',
  escala: '/escala',
  inscricao: '/i',
  vendedor: '/vendedor',
  venda: '/vendas',
  vagaCompra: '/vagas/compra',
} as const

export type TokenFlowKind = keyof typeof TOKEN_FLOW_ROUTES

function cleanToken(value: string | null | undefined) {
  return String(value || '').trim()
}

export function tokenFlowPath(kind: TokenFlowKind, token: string | null | undefined, fallback = '/') {
  const value = cleanToken(token)
  if (!value) return fallback
  return `${TOKEN_FLOW_ROUTES[kind]}/${encodeURIComponent(value)}`
}

const DIRECT_AUTH_PREFIXES = [
  `${TOKEN_FLOW_ROUTES.equipeReivindicar}/`,
  `${TOKEN_FLOW_ROUTES.conviteProdutora}/`,
] as const

export function isDirectTokenAuthReturnPath(value: string | null | undefined) {
  const path = String(value || '').trim()
  return DIRECT_AUTH_PREFIXES.some((prefix) => path.startsWith(prefix))
}

export function isTokenFlowPath(value: string | null | undefined) {
  const path = String(value || '').trim()
  return Object.values(TOKEN_FLOW_ROUTES).some((base) => path === base || path.startsWith(`${base}/`))
}
