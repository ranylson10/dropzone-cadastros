import { supabaseAdmin } from '../../shared/supabase-admin'

export type EnrollmentStatus = 'aberto' | 'inscricoes_fechadas' | 'prazo_encerrado' | 'prazo_invalido'

export function enrollmentStatus(config: {
  aceita_novas_inscricoes_equipes?: boolean | null
  data_limite_inscricao?: string | null
} | null, now = Date.now()): EnrollmentStatus {
  if (config?.aceita_novas_inscricoes_equipes === false) return 'inscricoes_fechadas'
  if (config?.data_limite_inscricao) {
    const deadline = new Date(config.data_limite_inscricao).getTime()
    if (!Number.isFinite(deadline)) return 'prazo_invalido'
    if (deadline <= now) return 'prazo_encerrado'
  }
  return 'aberto'
}

export function enrollmentClosedMessage(status: Exclude<EnrollmentStatus, 'aberto'>) {
  if (status === 'inscricoes_fechadas') return 'As inscrições de equipes deste campeonato estão fechadas. Você ainda pode acompanhar o grupo.'
  if (status === 'prazo_invalido') return 'O prazo de inscrição precisa ser corrigido pela produtora. Você ainda pode acompanhar o grupo.'
  return 'O prazo de inscrição deste campeonato terminou. Você ainda pode acompanhar o grupo.'
}

export async function readEnrollmentStatus(campeonatoId: string) {
  const { data, error } = await supabaseAdmin.from('campeonato_configuracoes')
    .select('aceita_novas_inscricoes_equipes,data_limite_inscricao')
    .eq('campeonato_id', campeonatoId).maybeSingle()
  if (error) throw error
  return enrollmentStatus(data)
}

export async function assertEnrollmentOpen(campeonatoId: string) {
  const status = await readEnrollmentStatus(campeonatoId)
  if (status !== 'aberto') throw new Error(enrollmentClosedMessage(status))
}

/** A team request is public enrollment, including when the team owner also manages it. */
export async function assertTeamEnrollmentVisible(campeonatoId: string) {
  const { data, error } = await supabaseAdmin.from('campeonatos').select('id,aprovacao_status,status')
    .eq('id', campeonatoId).eq('aprovacao_status', 'aprovado').is('deleted_at', null).maybeSingle()
  if (error) throw error
  if (!data || data.aprovacao_status !== 'aprovado'
    || ['suspenso', 'banido', 'excluido', 'excluído'].includes(String(data.status || 'ativo').trim().toLowerCase())) {
    throw new Error('Campeonato indisponível para inscrição.')
  }
}
