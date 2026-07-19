import { supabaseAdmin } from '../shared/supabase-admin'

export type AprovacaoStatus = 'pendente' | 'aprovado' | 'rejeitado'

export function isPublicavel(status: unknown) {
  return String(status || 'aprovado') === 'aprovado'
}

/** Falha se a coluna não existir (migração não rodada) → trata como aprovado (legado). */
export async function getProdutoraAprovacao(produtoraId: string): Promise<AprovacaoStatus> {
  const { data, error } = await supabaseAdmin
    .from('produtoras')
    .select('aprovacao_status')
    .eq('id', produtoraId)
    .maybeSingle()
  if (error) {
    if (['42703', 'PGRST204'].includes(error.code || '')) return 'aprovado'
    throw error
  }
  return (data?.aprovacao_status as AprovacaoStatus) || 'aprovado'
}

export async function getCampeonatoAprovacao(campeonatoId: string): Promise<AprovacaoStatus> {
  const { data, error } = await supabaseAdmin
    .from('campeonatos')
    .select('aprovacao_status, status, deleted_at')
    .eq('id', campeonatoId)
    .maybeSingle()
  if (error) {
    if (['42703', 'PGRST204'].includes(error.code || '')) return 'aprovado'
    throw error
  }
  if (!data) throw new Error('Campeonato não encontrado.')
  if (data.deleted_at || data.status === 'excluido') throw new Error('Campeonato indisponível.')
  return (data.aprovacao_status as AprovacaoStatus) || 'aprovado'
}

/** Bloqueia recursos públicos / "no ar" se não aprovado. */
export async function assertCampeonatoNoAr(campeonatoId: string) {
  const status = await getCampeonatoAprovacao(campeonatoId)
  if (status !== 'aprovado') {
    throw new Error(
      status === 'rejeitado'
        ? 'Este campeonato foi rejeitado pela administração do DropZone.'
        : 'Campeonato aguardando aprovação da administração do DropZone para ir ao ar.',
    )
  }
}

export async function assertProdutoraAprovada(produtoraId: string) {
  const status = await getProdutoraAprovacao(produtoraId)
  if (status !== 'aprovado') {
    throw new Error(
      status === 'rejeitado'
        ? 'Produtora rejeitada pela administração. Contate o suporte DropZone.'
        : 'Produtora aguardando aprovação da administração do DropZone.',
    )
  }
}

export async function setAprovacao(input: {
  alvo: 'produtora' | 'campeonato'
  id: string
  status: AprovacaoStatus
  motivo?: string | null
  adminUserId: string
}) {
  const table = input.alvo === 'produtora' ? 'produtoras' : 'campeonatos'
  const patch: Record<string, unknown> = {
    aprovacao_status: input.status,
    aprovacao_motivo: input.motivo || null,
    aprovado_em: input.status === 'aprovado' ? new Date().toISOString() : null,
    aprovado_por: input.status === 'aprovado' ? input.adminUserId : null,
  }
  const { data, error } = await supabaseAdmin
    .from(table)
    .update(patch)
    .eq('id', input.id)
    .select('id,nome,aprovacao_status')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Registro não encontrado.')

  await supabaseAdmin.from('sistema_auditoria').insert({
    administrador_auth_user_id: input.adminUserId,
    acao: `aprovacao_${input.alvo}_${input.status}`,
    alvo_tipo: input.alvo,
    alvo_id: input.id,
    detalhes: { motivo: input.motivo || null, nome: (data as any).nome },
  })

  return data
}
