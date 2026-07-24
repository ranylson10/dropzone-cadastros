import { getAccountsForUser } from '@backend/auth/server-auth'
import { listControllableEquipes } from '@backend/equipes/manager-team-access'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import type { LiliCard, LiliLocale } from './types'

type AuthUser = { id: string; email?: string | null; email_confirmed_at?: string | null }

export async function listOpenChampionships(searchTerm?: string) {
  let query = supabaseAdmin
    .from('campeonatos')
    .select('id,nome,tipo,logo_url,banner_url,status,aprovacao_status')
    .eq('status', 'ativo')
    .eq('aprovacao_status', 'aprovado')
    .is('deleted_at', null)
    .limit(12)
  if (searchTerm) query = query.ilike('nome', `%${searchTerm}%`)
  const { data: championships, error } = await query
  if (error) throw error
  const ids = (championships || []).map((item) => item.id)
  if (!ids.length) return []

  const [{ data: configs }, { data: slots }] = await Promise.all([
    supabaseAdmin
      .from('campeonato_configuracoes')
      .select('campeonato_id,valor_inscricao,plataforma,servidor,data_limite_inscricao,aceita_novas_inscricoes_equipes')
      .in('campeonato_id', ids)
      .eq('aceita_novas_inscricoes_equipes', true),
    supabaseAdmin
      .from('campeonato_slots')
      .select('campeonato_id,equipe_id,status')
      .in('campeonato_id', ids)
      .neq('status', 'excluido'),
  ])
  const configMap = new Map((configs || []).map((row: any) => [row.campeonato_id, row]))
  return (championships || []).flatMap((championship: any) => {
    const config: any = configMap.get(championship.id)
    if (!config) return []
    const champSlots = (slots || []).filter((slot: any) => slot.campeonato_id === championship.id)
    const free = champSlots.filter((slot: any) => !slot.equipe_id).length
    if (free <= 0) return []
    return [{ ...championship, ...config, vagas_livres: free, total_slots: champSlots.length }]
  })
}

export function championshipCards(items: any[], registrationMode = false, locale: LiliLocale = 'pt-BR'): LiliCard[] {
  return items.map((item) => ({
    id: item.id,
    kind: 'championship',
    title: item.nome,
    subtitle: [item.tipo, item.plataforma, item.servidor].filter(Boolean).join(' • '),
    imageUrl: item.logo_url || item.banner_url || null,
    badges: [`${item.vagas_livres} vaga${item.vagas_livres === 1 ? '' : 's'}`],
    details: [
      ...(item.valor_inscricao != null ? [{ label: 'Inscrição', value: `R$ ${Number(item.valor_inscricao).toFixed(2).replace('.', ',')}` }] : []),
      ...(item.data_limite_inscricao ? [{ label: 'Prazo', value: new Date(item.data_limite_inscricao).toLocaleDateString(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-419' : 'pt-BR') }] : []),
    ],
    actions: registrationMode
      ? [{
          id: `buy-${item.id}`,
          label: 'Comprar vaga',
          message: `Comprar vaga em ${item.nome}`,
          intent: 'comprar_vaga',
          variant: 'primary',
          context: { selectedChampionshipId: item.id, currentFlow: 'vacancy_purchase' },
        }]
      : [{
          id: `view-${item.id}`,
          label: 'Ver campeonato',
          message: `Abrir campeonato ${item.nome}`,
          intent: 'abrir_campeonato',
          variant: 'primary',
          context: { selectedChampionshipId: item.id, currentFlow: 'championship' },
        }],
  }))
}

export async function listUserTeams(user: AuthUser) {
  const accounts = await getAccountsForUser(user)
  return listControllableEquipes(user.id, accounts)
}

export function teamCards(teams: any[], championshipId?: string | null): LiliCard[] {
  return teams.map((team) => ({
    id: team.id,
    kind: 'team',
    title: team.nome,
    subtitle: team.tag ? `${team.tag} • ${team.papel === 'dono' ? 'Proprietário' : 'Staff'}` : team.papel === 'dono' ? 'Proprietário' : 'Staff',
    imageUrl: team.logo_url || null,
    badges: [team.permissoes?.pode_escalar ? 'Pode escalar' : 'Visualização'],
    actions: championshipId ? [{
      id: `team-${team.id}`,
      label: 'Usar esta equipe',
      message: `Quero usar a equipe ${team.nome}`,
      intent: 'iniciar_inscricao',
      variant: 'primary',
      context: { selectedChampionshipId: championshipId, selectedTeamId: team.id, currentFlow: 'registration', currentStep: 'team' },
    }] : undefined,
  }))
}

export async function buildRegistrationSummary(championshipId: string, teamId: string) {
  const [{ data: championship, error: championshipError }, { data: team, error: teamError }, { data: existing }] = await Promise.all([
    supabaseAdmin.from('campeonatos').select('id,nome,logo_url').eq('id', championshipId).maybeSingle(),
    supabaseAdmin.from('equipes').select('id,nome,tag,logo_url').eq('id', teamId).maybeSingle(),
    supabaseAdmin.from('campeonato_equipes').select('id,status,slot_numero').eq('campeonato_id', championshipId).eq('equipe_id', teamId).eq('status', 'ativo').maybeSingle(),
  ])
  if (championshipError) throw championshipError
  if (teamError) throw teamError
  if (!championship || !team) throw new Error('Campeonato ou equipe não encontrado.')
  return { championship, team, existing }
}

export function lineCards(lines: any[], baseContext: Record<string, unknown>): LiliCard[] {
  return lines.map((line) => ({
    id: line.id,
    kind: 'line',
    title: line.nome,
    subtitle: line.jogadores_count != null ? `${line.jogadores_count} jogador${Number(line.jogadores_count) === 1 ? '' : 'es'}` : 'Line da equipe',
    badges: line.disponivel === false ? ['Já utilizada'] : ['Disponível'],
    actions: line.disponivel === false ? undefined : [{
      id: `line-${line.id}`,
      label: 'Escolher esta line',
      message: `Usar a line ${line.nome}`,
      intent: 'selecionar_line_inscricao',
      variant: 'primary',
      context: { ...baseContext, selectedLineId: line.id, selectedLineName: line.nome, currentStep: 'slot' },
    }],
  }))
}

export function slotCards(slots: any[], baseContext: Record<string, unknown>): LiliCard[] {
  return slots.map((slot) => {
    const label = slot.slot_letra || String(slot.slot_numero || '')
    return {
      id: slot.id,
      kind: 'slot',
      title: `Slot ${label}`,
      subtitle: 'Vaga livre',
      badges: ['Disponível'],
      actions: [{
        id: `slot-${slot.id}`,
        label: `Escolher slot ${label}`,
        message: `Escolher o slot ${label}`,
        intent: 'selecionar_slot_inscricao',
        variant: 'primary',
        context: { ...baseContext, selectedSlotId: slot.id, selectedSlotLabel: label, currentStep: 'confirm' },
      }],
    } as LiliCard
  })
}

export function paymentCard(input: {
  token: string
  status: string
  valueCents?: number | null
  invoiceUrl?: string | null
  pixPayload?: string | null
}): LiliCard {
  const value = input.valueCents != null
    ? `R$ ${(Number(input.valueCents) / 100).toFixed(2).replace('.', ',')}`
    : 'A confirmar'
  const actions: any[] = []
  if (input.pixPayload) actions.push({ id: 'copy-pix', label: 'Copiar código PIX', copyText: input.pixPayload, variant: 'primary' })
  if (input.invoiceUrl) actions.push({ id: 'open-payment', label: 'Abrir pagamento', href: input.invoiceUrl, variant: input.pixPayload ? 'secondary' : 'primary' })
  return {
    id: input.token,
    kind: 'payment',
    title: 'Pagamento da inscrição',
    subtitle: `Status: ${input.status}`,
    badges: [value],
    details: [{ label: 'Código', value: input.token }],
    actions,
  }
}


export async function listUserRegistrations(user: AuthUser) {
  const teams = await listUserTeams(user)
  const teamIds = teams.map((team: any) => String(team.id)).filter(Boolean)
  if (!teamIds.length) return []

  const { data: entries, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id,campeonato_id,equipe_id,line_id,grupo_id,status,slot_numero,nome_exibicao,created_at')
    .in('equipe_id', teamIds)
    .neq('status', 'excluido')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  if (!entries?.length) return []

  const championshipIds = [...new Set(entries.map((row: any) => row.campeonato_id).filter(Boolean))]
  const lineIds = [...new Set(entries.map((row: any) => row.line_id).filter(Boolean))]
  const groupIds = [...new Set(entries.map((row: any) => row.grupo_id).filter(Boolean))]

  const [championshipResult, lineResult, groupResult] = await Promise.all([
    supabaseAdmin.from('campeonatos').select('id,nome,tipo,logo_url,banner_url,status').in('id', championshipIds),
    lineIds.length
      ? supabaseAdmin.from('equipe_lines').select('id,nome,tag,logo_url').in('id', lineIds)
      : Promise.resolve({ data: [], error: null }),
    groupIds.length
      ? supabaseAdmin.from('campeonato_grupos').select('id,nome').in('id', groupIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (championshipResult.error) throw championshipResult.error
  if (lineResult.error) throw lineResult.error
  if (groupResult.error) throw groupResult.error

  const championshipMap = new Map((championshipResult.data || []).map((row: any) => [row.id, row]))
  const teamMap = new Map(teams.map((row: any) => [String(row.id), row]))
  const lineMap = new Map((lineResult.data || []).map((row: any) => [row.id, row]))
  const groupMap = new Map((groupResult.data || []).map((row: any) => [row.id, row]))

  return entries.map((entry: any) => ({
    ...entry,
    campeonato: championshipMap.get(entry.campeonato_id) || null,
    equipe: teamMap.get(String(entry.equipe_id)) || null,
    line: entry.line_id ? lineMap.get(entry.line_id) || null : null,
    grupo: entry.grupo_id ? groupMap.get(entry.grupo_id) || null : null,
  }))
}

export function registrationCards(items: any[], locale: LiliLocale = 'pt-BR'): LiliCard[] {
  const labels = locale === 'en'
    ? { championship: 'Tournament', registrations: 'registrations', registration: 'registration', team: 'Team', line: 'Line', group: 'Group', slot: 'Slot', active: 'Active', pending: 'Pending', open: 'Open tournament' }
    : locale === 'es'
      ? { championship: 'Campeonato', registrations: 'inscripciones', registration: 'inscripción', team: 'Equipo', line: 'Line', group: 'Grupo', slot: 'Slot', active: 'Activa', pending: 'Pendiente', open: 'Abrir campeonato' }
      : { championship: 'Campeonato', registrations: 'inscrições', registration: 'inscrição', team: 'Equipe', line: 'Line', group: 'Grupo', slot: 'Slot', active: 'Ativa', pending: 'Pendente', open: 'Abrir campeonato' }

  const grouped = new Map<string, any[]>()
  for (const item of items) {
    const championshipId = String(item.campeonato?.id || item.campeonato_id || item.id)
    const current = grouped.get(championshipId) || []
    current.push(item)
    grouped.set(championshipId, current)
  }

  return [...grouped.entries()].map(([championshipId, registrations]) => {
    const first = registrations[0]
    const championship = first.campeonato
    const teamNames = [...new Set(registrations.map((item) => item.equipe?.nome).filter(Boolean))]
    const count = registrations.length

    const details = registrations.map((item, index) => {
      const status = String(item.status || 'ativo')
      const statusLabel = status === 'ativo' ? labels.active : status === 'pendente' ? labels.pending : status
      const lineName = item.line?.nome || item.nome_exibicao || `${labels.line} ${index + 1}`
      const values = [
        item.equipe?.nome ? `${labels.team}: ${item.equipe.nome}` : null,
        item.grupo?.nome ? `${labels.group}: ${item.grupo.nome}` : null,
        item.slot_numero ? `${labels.slot}: ${item.slot_numero}` : null,
        statusLabel,
      ].filter(Boolean)
      return { label: lineName, value: values.join(' • ') }
    })

    return {
      id: `championship-registrations-${championshipId}`,
      kind: 'registration',
      title: championship?.nome || labels.championship,
      subtitle: teamNames.join(' • ') || undefined,
      imageUrl: championship?.logo_url || championship?.banner_url || first.equipe?.logo_url || null,
      badges: [`${count} ${count === 1 ? labels.registration : labels.registrations}`],
      details,
      actions: championship?.id ? [{
        id: `open-registration-${championship.id}`,
        label: labels.open,
        href: `/campeonatos/${championship.id}`,
        variant: 'secondary',
      }] : undefined,
    }
  })
}


export async function getChampionshipDetails(championshipId: string) {
  const { data: championship, error } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,tipo,logo_url,banner_url,status,aprovacao_status,premiacao')
    .eq('id', championshipId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!championship || championship.status !== 'ativo' || championship.aprovacao_status !== 'aprovado') {
    throw new Error('Campeonato não encontrado ou indisponível.')
  }

  const [{ data: config }, { data: slots }] = await Promise.all([
    supabaseAdmin
      .from('campeonato_configuracoes')
      .select('valor_inscricao,plataforma,servidor,data_limite_inscricao,aceita_novas_inscricoes_equipes')
      .eq('campeonato_id', championshipId)
      .maybeSingle(),
    supabaseAdmin
      .from('campeonato_slots')
      .select('id,equipe_id,line_id,status')
      .eq('campeonato_id', championshipId)
      .neq('status', 'excluido'),
  ])
  const vagasLivres = (slots || []).filter((slot: any) => !slot.equipe_id && !slot.line_id).length
  return { ...championship, ...(config || {}), vagas_livres: vagasLivres, total_slots: (slots || []).length }
}


export async function getPublishedChampionshipRulebook(championshipId: string) {
  const { data, error } = await supabaseAdmin
    .from('campeonato_rulebooks')
    .select('campeonato_id,perfil,documento,status,publicado_em,versao')
    .eq('campeonato_id', championshipId)
    .eq('status', 'publicado')
    .maybeSingle()
  if (error) {
    if (['42P01', 'PGRST205'].includes(error.code || '')) return null
    throw error
  }
  if (!data) return null
  const document = data.documento && typeof data.documento === 'object' ? data.documento as any : null
  if (!document || !Array.isArray(document.chapters)) return null
  return {
    campeonatoId: data.campeonato_id,
    perfil: data.perfil,
    publicadoEm: data.publicado_em,
    versao: data.versao,
    title: String(document.title || 'Regulamento'),
    subtitle: String(document.subtitle || ''),
    chapters: document.chapters
      .filter((chapter: any) => chapter && chapter.included !== false)
      .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0)),
  }
}

function truncateRuleText(value: unknown, max = 360) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

export function rulebookTopicCards(rulebook: any, championshipId: string): LiliCard[] {
  return (rulebook.chapters || []).map((chapter: any, chapterIndex: number) => {
    const articles = Array.isArray(chapter.articles) ? chapter.articles : []
    const details = articles.slice(0, 8).map((article: any) => ({
      label: article.number ? `Art. ${article.number}` : `Regra ${detailsSafeIndex(article, articles) + 1}`,
      value: [article.title, truncateRuleText(article.body)]
        .filter(Boolean)
        .join(' — '),
    }))
    if (articles.length > 8) {
      details.push({ label: 'Mais regras', value: `Este tópico possui mais ${articles.length - 8} artigo${articles.length - 8 === 1 ? '' : 's'} no regulamento completo.` })
    }
    return {
      id: `rulebook-${chapter.id || chapterIndex}`,
      kind: 'rulebook',
      title: String(chapter.title || `Tópico ${chapterIndex + 1}`),
      subtitle: `${articles.length} artigo${articles.length === 1 ? '' : 's'}`,
      badges: [`Tópico ${chapterIndex + 1}`],
      details,
      actions: [{
        id: `open-rulebook-${chapter.id || chapterIndex}`,
        label: 'Abrir regulamento completo',
        href: `/campeonatos/${championshipId}/regulamento${chapter.id ? `#${encodeURIComponent(String(chapter.id))}` : ''}`,
        variant: 'secondary',
      }],
    }
  })
}

function detailsSafeIndex(article: any, articles: any[]) {
  const index = articles.indexOf(article)
  return index >= 0 ? index : 0
}


function normalizeRuleSearchText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const RULE_STOP_WORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'eu', 'me', 'na', 'nas', 'no', 'nos',
  'o', 'os', 'ou', 'para', 'por', 'posso', 'pode', 'podem', 'que', 'qual', 'quais', 'se', 'ser', 'sobre', 'tem', 'uma', 'um',
  'al', 'con', 'como', 'de', 'del', 'el', 'en', 'es', 'la', 'las', 'los', 'o', 'para', 'por', 'puedo', 'puede', 'que', 'se', 'sobre', 'un', 'una',
  'about', 'a', 'an', 'and', 'can', 'do', 'does', 'for', 'how', 'i', 'in', 'is', 'of', 'on', 'or', 'the', 'to', 'what', 'with',
])

function ruleSearchTokens(value: unknown) {
  return normalizeRuleSearchText(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !RULE_STOP_WORDS.has(token))
}

export function findRulebookAnswers(rulebook: any, question: string, championshipId: string): LiliCard[] {
  const tokens = [...new Set(ruleSearchTokens(question))]
  if (!tokens.length) return []

  const matches: Array<{ score: number; chapter: any; chapterIndex: number; article: any; articleIndex: number }> = []
  for (const [chapterIndex, chapter] of (rulebook.chapters || []).entries()) {
    const chapterText = normalizeRuleSearchText(chapter?.title)
    const articles = Array.isArray(chapter?.articles) ? chapter.articles : []
    for (const [articleIndex, article] of articles.entries()) {
      const titleText = normalizeRuleSearchText(article?.title)
      const bodyText = normalizeRuleSearchText(article?.body)
      const numberText = normalizeRuleSearchText(article?.number)
      let score = 0
      for (const token of tokens) {
        if (numberText === token || numberText.includes(token)) score += 8
        if (titleText.includes(token)) score += 5
        if (chapterText.includes(token)) score += 3
        if (bodyText.includes(token)) score += 1
      }
      const phrase = normalizeRuleSearchText(question)
      if (phrase.length >= 8 && titleText.includes(phrase)) score += 10
      if (score > 0) matches.push({ score, chapter, chapterIndex, article, articleIndex })
    }
  }

  return matches
    .sort((a, b) => b.score - a.score || a.chapterIndex - b.chapterIndex || a.articleIndex - b.articleIndex)
    .slice(0, 4)
    .map(({ chapter, chapterIndex, article, articleIndex }) => ({
      id: `rule-answer-${chapter?.id || chapterIndex}-${article?.id || articleIndex}`,
      kind: 'rulebook' as const,
      title: String(article?.title || (article?.number ? `Artigo ${article.number}` : `Regra ${articleIndex + 1}`)),
      subtitle: String(chapter?.title || `Tópico ${chapterIndex + 1}`),
      badges: [article?.number ? `Art. ${article.number}` : `Tópico ${chapterIndex + 1}`],
      details: [{ label: 'Regra publicada', value: truncateRuleText(article?.body, 900) || 'Conteúdo não informado.' }],
      actions: [{
        id: `open-rule-answer-${chapter?.id || chapterIndex}-${article?.id || articleIndex}`,
        label: 'Abrir no regulamento completo',
        href: `/campeonatos/${championshipId}/regulamento${chapter?.id ? `#${encodeURIComponent(String(chapter.id))}` : ''}`,
        variant: 'secondary' as const,
      }],
    }))
}

function extractInviteToken(value: string) {
  const raw = decodeURIComponent(String(value || '').trim())
  if (!raw) return { token: '', hintedPath: '' }
  try {
    const url = new URL(raw)
    const path = url.pathname
    const match = path.match(/^\/(convite\/equipe|convite\/grupo|equipe\/entrar|escala|i|vagas\/compra)\/([^/?#]+)/i)
    if (match) return { token: decodeURIComponent(match[2]), hintedPath: `/${match[1]}` }
  } catch {
    const match = raw.match(/\/?(convite\/equipe|convite\/grupo|equipe\/entrar|escala|i|vagas\/compra)\/([^/?#\s]+)/i)
    if (match) return { token: decodeURIComponent(match[2]), hintedPath: `/${match[1]}` }
  }
  return { token: raw.replace(/^['\"]|['\"]$/g, '').trim(), hintedPath: '' }
}

export async function resolveExistingInvite(value: string) {
  const parsed = extractInviteToken(value)
  const token = parsed.token
  if (!token) throw new Error('Informe o token ou cole o link de convite.')

  const byHint = (path: string) => ({ token, href: `${path}/${encodeURIComponent(token)}` })
  if (parsed.hintedPath) {
    const hinted = byHint(parsed.hintedPath)
    return { ...hinted, kind: parsed.hintedPath, title: 'Convite localizado' }
  }

  const { data: playerTeamInvite, error: playerTeamError } = await supabaseAdmin
    .from('tokens')
    .select('token,tipo,equipe_id,status,expira_em')
    .ilike('token', token)
    .eq('tipo', 'convite_jogador_equipe')
    .maybeSingle()
  if (playerTeamError) throw playerTeamError
  if (playerTeamInvite) {
    return {
      token: playerTeamInvite.token,
      href: `/equipe/entrar/${encodeURIComponent(playerTeamInvite.token)}`,
      kind: 'convite_jogador_equipe',
      title: 'Convite individual de equipe',
    }
  }

  const { data: teamInvite, error: teamError } = await supabaseAdmin
    .from('tokens')
    .select('token,tipo,campeonato_id,grupo_id,slot_id,status,expira_em')
    .ilike('token', token)
    .eq('tipo', 'convite_equipe_campeonato')
    .maybeSingle()
  if (teamError) throw teamError
  if (teamInvite) {
    return {
      token: teamInvite.token,
      href: `/convite/equipe/${encodeURIComponent(teamInvite.token)}`,
      kind: 'convite_equipe',
      title: 'Convite de equipe',
      campeonatoId: teamInvite.campeonato_id,
    }
  }

  const { data: lineupLink, error: lineupError } = await supabaseAdmin
    .from('campeonato_links_inscricao')
    .select('token,tipo,campeonato_id,grupo_id,campeonato_equipe_id,line_id,ativo,expira_em')
    .ilike('token', token)
    .eq('tipo', 'escalacao_line')
    .maybeSingle()
  if (lineupError) throw lineupError
  if (lineupLink) {
    return {
      token: lineupLink.token,
      href: `/escala/${encodeURIComponent(lineupLink.token)}`,
      kind: 'escalacao_line',
      title: 'Convite para escalação de jogadores',
      campeonatoId: lineupLink.campeonato_id,
    }
  }

  const { data: groupLink, error: groupError } = await supabaseAdmin
    .from('campeonato_links')
    .select('token,tipo,campeonato_id,grupo_id,ativo,expira_em')
    .ilike('token', token)
    .maybeSingle()
  if (groupError) throw groupError
  if (groupLink) {
    const href = groupLink.tipo === 'inscricao_equipes_grupo'
      ? `/convite/grupo/${encodeURIComponent(groupLink.token)}`
      : `/i/${encodeURIComponent(groupLink.token)}`
    return {
      token: groupLink.token,
      href,
      kind: groupLink.tipo,
      title: groupLink.tipo === 'inscricao_equipes_grupo' ? 'Link de inscrição de equipe' : 'Link de inscrição',
      campeonatoId: groupLink.campeonato_id,
    }
  }

  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from('sistema_compras_vaga')
    .select('token,campeonato_id,status')
    .ilike('token', token)
    .maybeSingle()
  if (purchaseError) throw purchaseError
  if (purchase) {
    return {
      token: purchase.token,
      href: `/vagas/compra/${encodeURIComponent(purchase.token)}`,
      kind: 'compra_vaga',
      title: 'Compra de vaga',
      campeonatoId: purchase.campeonato_id,
    }
  }

  throw new Error('Não encontrei um convite válido com esse token. Confira o código ou cole o link completo.')
}
