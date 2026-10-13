import { supabaseAdmin } from '../../shared/supabase-admin'
import { readGroupInviteAvailability } from './group-availability'
import { canEnrollTeam } from './types'
import { listControllableEquipes } from '../../equipes/manager-team-access'
import { loadParticipacoesLineNoCampeonato, markLinesJaInscritas } from '../participacao-sync'
import type { InviteActor } from './types'
import { isPublicDirectoryRow } from '../../shared/public-visibility'
import { assertCampeonatoNoAr } from '../../admin/aprovacao'
import { enrollmentClosedMessage, readEnrollmentStatus } from './enrollment-policy'

const TOKEN_SELECT =
  'id,token,tipo,status,usado,expira_em,campeonato_id,grupo_id,fase_id,slot_id,nome_equipe_reservada,nome_line_reservada,equipe_id,line_destino_id'

export async function loadTeamInvite(token: string, includeAvailability = true) {
  // The route parameter is already decoded by Next. Percent sequences can be literal token data.
  const clean = String(token || '').trim()
  const { data: convite, error } = await supabaseAdmin
    .from('tokens')
    .select(TOKEN_SELECT)
    .eq('token', clean)
    .in('tipo', ['convite_equipe_campeonato', 'team_invite'])
    .maybeSingle()
  if (error) throw error
  if (!convite) throw new Error('Convite não encontrado.')
  await assertCampeonatoNoAr(convite.campeonato_id)

  const [campRes, slotRes, temaRes] = await Promise.all([
    supabaseAdmin
      .from('campeonatos')
      .select('id,nome,logo_url,status,deleted_at')
      .eq('id', convite.campeonato_id)
      .maybeSingle(),
    convite.slot_id
      ? supabaseAdmin
          .from('campeonato_slots')
          .select('id,slot_numero,slot_letra,equipe_id,line_id,status,grupo_id,fase_id,campeonato_id')
          .eq('id', convite.slot_id).eq('campeonato_id', convite.campeonato_id)
          .maybeSingle()
      : Promise.resolve({ data: null as any, error: null }),
    includeAvailability ? supabaseAdmin
      .from('campeonato_configuracoes')
      .select('cor_principal,cor_secundaria,cor_texto_clara,cor_texto_escura,bg_opacidade,bg_image_url')
      .eq('campeonato_id', convite.campeonato_id)
      .maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  if (campRes.error) throw campRes.error
  if (slotRes.error) throw slotRes.error

  const slot = slotRes.data
  if (convite.slot_id && !slot) throw new Error('Slot do convite não encontrado neste campeonato.')
  if (!campRes.data) throw new Error('Campeonato não encontrado.')
  if (!isPublicDirectoryRow(campRes.data)) throw new Error('Campeonato indisponível.')
  const grupoId = slot?.grupo_id || convite.grupo_id || null
  const modoGrupo = Boolean(grupoId && !convite.slot_id)
  const temaRow = temaRes.error ? null : temaRes.data

  const [grupoRes, vagas] = await Promise.all([
    grupoId
      ? supabaseAdmin.from('campeonato_grupos').select('id,nome,fase_id').eq('id', grupoId).eq('campeonato_id', convite.campeonato_id).maybeSingle()
      : Promise.resolve({ data: null as any, error: null }),
    grupoId && includeAvailability ? readGroupInviteAvailability(convite.campeonato_id, grupoId) : Promise.resolve([] as any[]),
  ])
  if (grupoRes.error) throw grupoRes.error
  if (grupoId && !grupoRes.data) throw new Error('Grupo do convite não encontrado neste campeonato.')

  return {
    convite,
    campeonato: { id: campRes.data.id, nome: campRes.data.nome, logo_url: campRes.data.logo_url },
    tema: {
      cor_principal: temaRow?.cor_principal || '#ff4655',
      cor_secundaria: temaRow?.cor_secundaria || '#17191d',
      bg_opacidade: temaRow?.bg_opacidade != null ? Number(temaRow.bg_opacidade) : 18,
      bg_image_url: temaRow?.bg_image_url || null,
      cor_texto_clara: temaRow?.cor_texto_clara || '#ffffff',
      cor_texto_escura: temaRow?.cor_texto_escura || '#17191d',
    },
    slot,
    grupo: grupoRes.data,
    vagas,
    modoGrupo,
    grupoId,
  }
}

async function loadTeamSession(actor: InviteActor | null, campeonatoId: string, preferredEquipeId: string) {
  if (!actor) return { autenticado: false, equipe: null, equipes_disponiveis: [], lines: [], lines_disponiveis: [] }
  const { user, accounts } = actor
  const controllable = await listControllableEquipes(user.id, accounts)
  const hasManager = accounts.some((a) => a.profile_type === 'manager')
  const selected =
    (preferredEquipeId && controllable.find((e) => e.id === preferredEquipeId))
    || (controllable.length === 1 ? controllable[0] : null)

  if (!selected) {
    return {
      autenticado: true,
      equipe: null,
      papel_sessao: hasManager ? 'manager' : null,
      equipes_disponiveis: controllable.map((e) => ({
        id: e.id,
        nome: e.nome,
        username: e.username,
        logo_url: e.logo_url,
        tag: e.tag,
        papel: e.papel,
      })),
      lines: [] as any[],
      lines_disponiveis: [] as any[],
    }
  }

  const { lines, parts } = await loadParticipacoesLineNoCampeonato(selected.id, campeonatoId)
  const mapped = markLinesJaInscritas(lines, parts).map((line) => ({
    ...line,
    logo_url: line.logo_url || selected.logo_url || null,
  }))
  const livres = mapped
    .filter((l) => !l.ja_inscrita)
    .filter((l) => String(l.nome || '').trim().toLowerCase() !== 'nova line')

  return {
    autenticado: true,
    papel_sessao: hasManager ? 'manager' : 'equipe',
    equipes_disponiveis: controllable.map((e) => ({
      id: e.id,
      nome: e.nome,
      username: e.username,
      logo_url: e.logo_url,
      tag: e.tag,
      papel: e.papel,
    })),
    equipe: {
      id: selected.id,
      nome: selected.nome,
      tag: selected.tag || null,
      logo_url: selected.logo_url || null,
      papel: selected.papel,
      pode_inscrever: canEnrollTeam(selected),
      pode_criar_line: selected.permissoes.pode_editar,
    },
    // Só lines livres — evita opções inválidas
    lines: livres,
    lines_disponiveis: livres,
    lines_inscritas: mapped.filter((l) => l.ja_inscrita),
  }
}

export function teamInviteValid(convite: any) {
  if (convite.status !== 'ativo' || convite.usado) return false
  if (convite.expira_em && (!Number.isFinite(Date.parse(convite.expira_em)) || Date.parse(convite.expira_em) <= Date.now())) return false
  return true
}

function statusMensagem(params: {
  validoBase: boolean
  valido: boolean
  convite: any
  slotOcupado: boolean
  livres: number
}) {
  if (params.valido) return null
  if (params.convite.usado || params.convite.status === 'usado') {
    return 'Este convite já foi utilizado. Você ainda pode acompanhar o grupo.'
  }
  if (params.convite.expira_em && new Date(params.convite.expira_em).getTime() <= Date.now()) {
    return 'Este convite expirou. Você ainda pode acompanhar o grupo.'
  }
  if (params.slotOcupado) {
    return 'O slot deste convite já está ocupado. Você ainda pode acompanhar o grupo.'
  }
  if (params.livres <= 0) {
    return 'Não há slots livres neste grupo no momento.'
  }
  if (params.convite.status !== 'ativo') {
    return 'Este convite não está mais ativo. Você ainda pode acompanhar o grupo.'
  }
  return 'Este convite não aceita novas inscrições no momento.'
}

export async function readTeamInvite(token: string, actor: InviteActor | null, preferredEquipeId = '') {
  const data = await loadTeamInvite(token)
  const sessao = await loadTeamSession(actor, data.convite.campeonato_id, preferredEquipeId)
  const validoBase = teamInviteValid(data.convite)

  let valido = validoBase
  let assento: 'slot' | 'grupo' | null = null
  let slotOcupado = false
  let livres = 0

  if (data.slot) {
    assento = 'slot'
    slotOcupado = Boolean(data.slot.equipe_id || data.slot.line_id)
    valido = valido && !slotOcupado
    livres = slotOcupado ? 0 : 1
  } else if (data.modoGrupo) {
    assento = 'grupo'
    livres = (data.vagas || []).filter((v: any) => !v.ocupada).length
    valido = valido && livres > 0
  } else {
    valido = false
  }

  const enrollment = await readEnrollmentStatus(data.convite.campeonato_id)
  const inscricaoAberta = valido && enrollment === 'aberto'
  const mensagem = valido && enrollment !== 'aberto' ? enrollmentClosedMessage(enrollment) : statusMensagem({
    validoBase,
    valido: inscricaoAberta,
    convite: data.convite,
    slotOcupado,
    livres,
  })

  return {
    convite: {
      id: data.convite.id,
      token: data.convite.token,
      nome_equipe_reservada: data.convite.nome_equipe_reservada,
      nome_line_reservada: data.convite.nome_line_reservada,
      expira_em: data.convite.expira_em,
      status: data.convite.status,
      usado: data.convite.usado,
      slot_id: data.convite.slot_id || null,
      grupo_id: data.convite.grupo_id || data.grupo?.id || null,
    },
    campeonato: data.campeonato,
    tema: data.tema,
    slot: data.slot
      ? {
          id: data.slot.id,
          letra: data.slot.slot_letra,
          numero: data.slot.slot_numero,
          grupo_id: data.slot.grupo_id,
        }
      : null,
    grupo: data.grupo,
    vagas: data.vagas || [],
    resumo_grupo: data.grupoId
      ? {
          total: data.vagas.length,
          ocupadas: data.vagas.filter((v: any) => v.ocupada).length,
          livres: data.vagas.filter((v: any) => !v.ocupada).length,
        }
      : null,
    vaga: data.slot
      ? { numero_vaga: data.slot.slot_numero, letra: data.slot.slot_letra }
      : null,
    modelo: { assento, vaga_fisica: 'slot', auto_slot: true },
    modo: inscricaoAberta ? 'inscricao' : 'acompanhamento',
    inscricao_aberta: inscricaoAberta,
    status_mensagem: mensagem,
    ...sessao,
    // lines no response já filtradas
    lines: sessao.lines_disponiveis || sessao.lines || [],
    valido,
  }
}
