import { supabaseAdmin } from '../../shared/supabase-admin'
import { readPagedRows, readRowsByIds } from '../../shared/paginated-query'
import { listControllableEquipes } from '../../equipes/manager-team-access'
import { loadParticipacoesLineNoCampeonato, markLinesJaInscritas } from '../participacao-sync'
import { canEnrollTeam, type InviteActor } from './types'

async function loadMinhasParticipacoes(equipeId: string, campeonatoId: string, grupoId: string, allowLineupLinks: boolean) {
  const parts = await readPagedRows<any>(supabaseAdmin
    .from('campeonato_equipes')
    .select('id,equipe_id,line_id,grupo_id,slot_numero,slot_id,nome_exibicao')
    .eq('campeonato_id', campeonatoId)
    .eq('grupo_id', grupoId)
    .eq('equipe_id', equipeId)
    .eq('status', 'ativo')
    .order('slot_numero', { ascending: true }).order('id', { ascending: true }))
  if (!parts?.length) return [] as any[]

  const partIds = parts.map((p) => p.id)
  const lineIds = parts.map((p) => p.line_id).filter(Boolean)

  const [lines, jogadores, links] = await Promise.all([
    readRowsByIds<any>(lineIds, batch => supabaseAdmin.from('equipe_lines')
      .select('id,nome,tag,logo_url').eq('equipe_id', equipeId).in('id', batch).order('id')),
    readRowsByIds<any>(partIds, batch => supabaseAdmin.from('campeonato_jogadores')
      .select('id,campeonato_equipe_id,nick,foto_url,id_jogo,funcao,status,slot_numero')
      .eq('campeonato_id', campeonatoId).in('campeonato_equipe_id', batch).eq('status', 'ativo')
      .order('slot_numero').order('id')),
    allowLineupLinks ? readRowsByIds<any>(partIds, batch => supabaseAdmin.from('campeonato_links_inscricao')
      .select('id,campeonato_equipe_id,token,ativo,expira_em,limite_jogadores,created_at')
      .eq('campeonato_id', campeonatoId).in('campeonato_equipe_id', batch).eq('tipo', 'escalacao_line')
      .eq('ativo', true).order('created_at', { ascending: false }).order('id')) : Promise.resolve([]),
  ])

  const lineMap = new Map((lines || []).map((l) => [l.id, l]))
  const now = Date.now()
  const linkByPart = new Map<string, any>()
  for (const link of links || []) {
    if (link.expira_em && (!Number.isFinite(new Date(link.expira_em).getTime()) || new Date(link.expira_em).getTime() <= now)) continue
    if (!linkByPart.has(link.campeonato_equipe_id)) linkByPart.set(link.campeonato_equipe_id, link)
  }

  const result = parts.map((part) => {
    const line = part.line_id ? lineMap.get(part.line_id) || null : null
    const players = (jogadores || []).filter((j) => j.campeonato_equipe_id === part.id)
    const link = linkByPart.get(part.id) || null
    const limite = Number(link?.limite_jogadores || 6)
    // Sempre o nome da line real — nunca a etiqueta de referência do admin (legado em nome_exibicao)
    const nomeLine = String(line?.nome || '').trim() || String(part.nome_exibicao || '').trim() || 'Line'
    return {
      id: part.id,
      campeonato_equipe_id: part.id,
      equipe_id: part.equipe_id,
      line_id: part.line_id,
      grupo_id: part.grupo_id,
      slot_id: part.slot_id || null,
      slot_numero: part.slot_numero,
      nome_exibicao: nomeLine,
      line: line ? { id: line.id, nome: line.nome, tag: line.tag, logo_url: line.logo_url } : null,
      jogadores: players,
      quantidade_jogadores: players.length,
      limite_jogadores: limite,
      vagas_disponiveis: Math.max(0, limite - players.length),
      link_escalacao: link
        ? {
            id: link.id,
            token: link.token,
            expira_em: link.expira_em,
            limite_jogadores: limite,
            public_path: `/escala/${link.token}`,
          }
        : null,
    }
  })

  return result
}

const emptySession = {
  autenticado: false,
  equipe: null as null,
  equipes_disponiveis: [] as any[],
  papel_sessao: null as null | 'equipe' | 'manager',
  lines: [] as any[],
  lines_disponiveis: [] as any[],
  lines_inscritas: [] as any[],
  minhas_participacoes: [] as any[],
  inscrita: false,
  total_lines_inscritas_campeonato: 0,
}

async function loadSessionForEquipe(equipeId: string, campeonatoId: string, grupoId: string, meta: {
  nome: string
  tag?: string | null
  logo_url?: string | null
  papel?: string
  pode_inscrever?: boolean
  pode_criar_line?: boolean
  pode_escalar: boolean
  pode_gerar_token: boolean
}) {
  const [{ lines, parts: participacoesCampeonato }, minhasParticipacoes] = await Promise.all([
    loadParticipacoesLineNoCampeonato(equipeId, campeonatoId),
    loadMinhasParticipacoes(equipeId, campeonatoId, grupoId, meta.pode_escalar || meta.pode_gerar_token),
  ])

  const allLines = markLinesJaInscritas(lines, participacoesCampeonato)
  const linesDisponiveis = allLines.filter((line) => !line.ja_inscrita)
  const linesInscritas = allLines
    .filter((line) => line.ja_inscrita)
    .map((line) => {
      const part = (participacoesCampeonato || []).find(
        (p) =>
          p.line_id === line.id
          || String(p.nome_exibicao || '').trim().toLowerCase() === String(line.nome || '').trim().toLowerCase(),
      )
      return {
        ...line,
        participacao_id: part?.id || null,
        grupo_id: part?.grupo_id || null,
        slot_numero: part?.slot_numero || null,
        nome_exibicao: line.nome || part?.nome_exibicao || null,
      }
    })

  return {
    autenticado: true,
    equipe: {
      id: equipeId,
      nome: meta.nome,
      tag: meta.tag || null,
      logo_url: meta.logo_url || null,
      papel: meta.papel || null,
      pode_inscrever: meta.pode_inscrever,
      pode_criar_line: meta.pode_criar_line,
      pode_escalar: meta.pode_escalar,
      pode_gerar_token: meta.pode_gerar_token,
    },
    lines: linesDisponiveis,
    lines_disponiveis: linesDisponiveis,
    lines_inscritas: linesInscritas,
    lines_ja_no_campeonato: linesInscritas.length,
    minhas_participacoes: minhasParticipacoes,
    inscrita: minhasParticipacoes.length > 0,
    total_lines_inscritas_campeonato: linesInscritas.length,
  }
}

export async function readGroupSession(actor: InviteActor | null, campeonatoId: string, grupoId: string, preferredEquipeId: string) {
    if (!actor) return { ...emptySession }
    const { user, accounts } = actor
    const controllable = await listControllableEquipes(user.id, accounts)
    const hasManager = accounts.some((a) => a.profile_type === 'manager')

    if (!controllable.length) {
      return {
        ...emptySession,
        autenticado: true,
        papel_sessao: hasManager ? 'manager' : null,
        equipes_disponiveis: [],
      }
    }

    // Manager (ou multi-equipe): lista todas; se só 1, já seleciona
    const papelSessao: 'manager' | 'equipe' = hasManager ? 'manager' : 'equipe'
    let selected = preferredEquipeId
      ? controllable.find((e) => e.id === preferredEquipeId) || null
      : controllable.length === 1
        ? controllable[0]
        : null

    // Usuário só com perfil equipe e uma pasta: mantém fluxo antigo
    if (!selected && !hasManager && controllable.length === 1) {
      selected = controllable[0]
    }

    // Multi-equipe sem preferência: prioriza equipe já inscrita neste grupo
    // (link fechado / acompanhamento → manager ainda precisa gerenciar escalação)
    let equipesInscritasNoGrupo: string[] = []
    if (!selected && controllable.length > 1) {
      const partsInGroup = await readRowsByIds<any>(controllable.map(e => e.id), batch => supabaseAdmin
        .from('campeonato_equipes').select('id,equipe_id').eq('campeonato_id', campeonatoId)
        .eq('grupo_id', grupoId).eq('status', 'ativo').in('equipe_id', batch).order('id'))
      equipesInscritasNoGrupo = [
        ...new Set((partsInGroup || []).map((p) => String(p.equipe_id)).filter(Boolean)),
      ]
      if (equipesInscritasNoGrupo.length === 1) {
        selected = controllable.find((e) => e.id === equipesInscritasNoGrupo[0]) || null
      }
    }

    const mapEquipe = (e: (typeof controllable)[number], inscrita?: boolean) => ({
      id: e.id,
      nome: e.nome,
      username: e.username,
      logo_url: e.logo_url,
      tag: e.tag,
      papel: e.papel,
      pode_inscrever: canEnrollTeam(e),
      pode_criar_line: e.permissoes.pode_editar,
      pode_escalar: e.permissoes.pode_escalar,
      pode_gerar_token: e.permissoes.pode_gerar_token,
      inscrita_no_grupo: Boolean(inscrita),
    })

    if (!selected) {
      // Marca quais pastas já estão no grupo (UI de escolha / escalação)
      if (!equipesInscritasNoGrupo.length && controllable.length > 1) {
      const partsInGroup = await readRowsByIds<any>(controllable.map(e => e.id), batch => supabaseAdmin
        .from('campeonato_equipes').select('id,equipe_id').eq('campeonato_id', campeonatoId)
        .eq('grupo_id', grupoId).eq('status', 'ativo').in('equipe_id', batch).order('id'))
        equipesInscritasNoGrupo = [
          ...new Set((partsInGroup || []).map((p) => String(p.equipe_id)).filter(Boolean)),
        ]
      }
      const inscribed = new Set(equipesInscritasNoGrupo)
      return {
        ...emptySession,
        autenticado: true,
        papel_sessao: papelSessao,
        equipes_disponiveis: controllable.map((e) => mapEquipe(e, inscribed.has(e.id))),
        tem_equipe_inscrita_no_grupo: inscribed.size > 0,
      }
    }

    const session = await loadSessionForEquipe(selected.id, campeonatoId, grupoId, {
      nome: selected.nome,
      tag: selected.tag,
      logo_url: selected.logo_url,
      papel: selected.papel,
      pode_inscrever: canEnrollTeam(selected),
      pode_criar_line: selected.permissoes.pode_editar,
      pode_escalar: selected.permissoes.pode_escalar,
      pode_gerar_token: selected.permissoes.pode_gerar_token,
    })

    return {
      ...session,
      papel_sessao: papelSessao,
      equipes_disponiveis: controllable.map((e) =>
        mapEquipe(e, e.id === selected!.id ? session.inscrita : undefined),
      ),
      tem_equipe_inscrita_no_grupo: Boolean(session.inscrita),
    }
}
