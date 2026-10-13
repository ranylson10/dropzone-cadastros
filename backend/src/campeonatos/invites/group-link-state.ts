import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../../shared/supabase-admin'
import { assertCampeonatoNoAr } from '../../admin/aprovacao'
import { isPublicDirectoryRow } from '../../shared/public-visibility'
import {
  CAMPEONATO_LINK_SELECT_FULL, CAMPEONATO_LINK_SELECT_FULL_LEGACY,
  CAMPEONATO_LINK_SELECT_NO_META, CAMPEONATO_LINK_SELECT_NO_META_LEGACY,
  buildLinkMetaPayload, extractHumanDescricao, isMissingDeletedAtColumn,
  isMissingMetadataColumn, parseLinkMetadata, resolveLinkLimiteVagas,
  type LinkEntrada,
} from '../../shared/campeonato-link-metadata'
import { readGroupInviteBoard, countGroupFreeSlots } from './group-availability'
import { enrollmentClosedMessage, readEnrollmentStatus, type EnrollmentStatus } from './enrollment-policy'

type LinkAvailability = 'ok' | 'limite' | 'grupo_cheio' | 'pausado' | 'expirado' | 'excluido' | Exclude<EnrollmentStatus, 'aberto'>
const LINK_TYPE = 'inscricao_equipes_grupo'

async function fetchLink(builder: (columns: string) => any) {
  const withMeta = await builder(CAMPEONATO_LINK_SELECT_FULL)
  if (!withMeta.error) return withMeta
  if (isMissingDeletedAtColumn(withMeta.error) && !isMissingMetadataColumn(withMeta.error)) {
    const legacyMeta = await builder(CAMPEONATO_LINK_SELECT_FULL_LEGACY)
    if (!legacyMeta.error || !isMissingMetadataColumn(legacyMeta.error)) return legacyMeta
  }
  if (isMissingMetadataColumn(withMeta.error) || isMissingDeletedAtColumn(withMeta.error)) {
    const noMeta = await builder(CAMPEONATO_LINK_SELECT_NO_META)
    if (!noMeta.error || !isMissingDeletedAtColumn(noMeta.error)) return noMeta
    return builder(CAMPEONATO_LINK_SELECT_NO_META_LEGACY)
  }
  return withMeta
}

export function linkClosedMessage(reason: LinkAvailability | 'invalido', limite?: number) {
  if (reason === 'inscricoes_fechadas' || reason === 'prazo_encerrado' || reason === 'prazo_invalido') return enrollmentClosedMessage(reason)
  if (reason === 'limite') return limite === 1
    ? 'Este link já foi utilizado e não aceita novas inscrições.'
    : `Este link esgotou as vagas (limite de ${limite} equipes) e não aceita novas inscrições.`
  if (reason === 'grupo_cheio') return 'O grupo não tem slots livres no momento. Novas inscrições por este link estão encerradas.'
  if (reason === 'expirado') return 'Este link expirou e não aceita mais inscrições.'
  if (reason === 'pausado') return 'Este link foi pausado pelo organizador e não aceita mais inscrições.'
  if (reason === 'excluido') return 'Este link foi encerrado pelo organizador. Você ainda pode acompanhar o grupo.'
  return 'Link de equipes inválido ou inativo.'
}

function expired(link: any) {
  if (!link.expira_em) return false
  const deadline = new Date(link.expira_em).getTime()
  return !Number.isFinite(deadline) || deadline <= Date.now()
}

export async function readGroupLinkParents(link: any) {
  // Validate the public parent before reading the group, board or private session.
  const campRes = await supabaseAdmin.from('campeonatos')
    .select('id,nome,logo_url,status,deleted_at').eq('id', link.campeonato_id).maybeSingle()
  if (campRes.error) throw campRes.error
  if (!campRes.data || !isPublicDirectoryRow(campRes.data)) throw new Error('Campeonato indisponível.')
  await assertCampeonatoNoAr(link.campeonato_id)
  const groupRes = await supabaseAdmin.from('campeonato_grupos')
    .select('id,nome,slots').eq('id', link.grupo_id).eq('campeonato_id', link.campeonato_id).maybeSingle()
  if (groupRes.error) throw groupRes.error
  if (!groupRes.data) throw new Error('Grupo do convite não encontrado neste campeonato.')
  const enrollment = await readEnrollmentStatus(link.campeonato_id)
  const { deleted_at: _deleted, ...campeonato } = campRes.data
  return { campeonato, grupo: groupRes.data, enrollment }
}

export async function resolveGroupLink(token: string, includeBoard = true) {
  // Next route params already contain the decoded capability.
  const clean = String(token || '').trim()
  if (!clean) throw new Error(linkClosedMessage('invalido'))
  const exact = await fetchLink(columns => supabaseAdmin.from('campeonato_links')
    .select(columns).eq('token', clean).eq('tipo', LINK_TYPE).maybeSingle())
  if (exact.error) throw exact.error
  let link = exact.data
  // ILIKE rewrites every * to %, including escaped ones. An anchored, escaped
  // regex preserves the exact capability while retaining legacy case-insensitivity.
  if (!link) {
    const literal = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const insensitive = await fetchLink(columns => supabaseAdmin.from('campeonato_links')
      .select(columns).eq('tipo', LINK_TYPE).filter('token', 'imatch', `^${literal}$`).maybeSingle())
    if (insensitive.error) throw insensitive.error
    link = insensitive.data
  }
  if (!link || !link.campeonato_id || !link.grupo_id) throw new Error(linkClosedMessage('invalido'))
  const parents = await readGroupLinkParents(link)
  const meta = parseLinkMetadata(link)
  const limite = resolveLinkLimiteVagas(meta, parents.grupo.slots)
  let status: LinkAvailability = 'ok'
  if (link.deleted_at || meta.closed_reason === 'excluido') status = 'excluido'
  else if (expired(link)) status = 'expirado'
  else if (meta.usos >= limite || meta.closed_reason === 'limite_atingido') status = 'limite'
  else if (link.ativo === false && meta.closed_reason !== 'grupo_cheio') status = 'pausado'
  else if (parents.enrollment !== 'aberto') status = parents.enrollment
  const refs = new Map<string, string>()
  for (const entry of meta.entradas) {
    if (entry.referencia_lista && !refs.has(entry.participacao_id)) refs.set(entry.participacao_id, entry.referencia_lista)
  }
  const grade = includeBoard ? await readGroupInviteBoard(link.campeonato_id, link.grupo_id, refs) : null
  // Full, paged availability; POST only needs occupancy, without names or rosters.
  if (status === 'ok') {
    const free = grade ? grade.vagas.filter(vaga => !vaga.ocupada).length
      : await countGroupFreeSlots(link.campeonato_id, link.grupo_id)
    if (free === 0) status = 'grupo_cheio'
  }
  return { link, status, limite, grade, ...parents }
}

export async function loadLinkForInscricao(token: string) {
  const result = await resolveGroupLink(token, false)
  if (result.status !== 'ok') throw new Error(linkClosedMessage(result.status, result.limite))
  return result.link
}

async function freshLink(linkId: string) {
  const result = await fetchLink(columns => supabaseAdmin.from('campeonato_links')
    .select(columns).eq('id', linkId).eq('tipo', LINK_TYPE).maybeSingle())
  if (result.error) throw result.error
  if (!result.data) throw new Error(linkClosedMessage('invalido'))
  return result.data
}

function assertSameLink(current: any, expected: any) {
  for (const field of ['id', 'token', 'tipo', 'campeonato_id', 'grupo_id']) {
    if (current[field] !== expected[field]) throw new Error('O link foi alterado. Atualize e tente novamente.')
  }
}

/** One conditional UPDATE claims the complete observed version and returns its receipt.
 * The opaque revision survives the descricao-only legacy format and prevents ABA reuse.
 * This makes the counter atomic; enrollment still needs an end-to-end DB transaction.
 */
async function compareAndWrite(current: any, patch: Record<string, unknown>, live = false) {
  let query = supabaseAdmin.from('campeonato_links').update({ ...patch, updated_at: new Date().toISOString() })
  for (const field of ['id', 'token', 'tipo', 'campeonato_id', 'grupo_id', 'ativo', 'expira_em', 'deleted_at', 'updated_at', 'descricao', 'metadata']) {
    if (!Object.hasOwn(current, field)) continue
    const value = current[field]
    query = value == null ? query.is(field, null)
      : query.eq(field, field === 'metadata' ? JSON.stringify(value) : value)
  }
  if (live && current.expira_em) query = query.gt('expira_em', new Date().toISOString())
  const result = await query.select(Object.keys(current).join(',')).maybeSingle()
  if (result.error) throw result.error
  return result.data
}

function metadataPatch(current: any, payload: Record<string, unknown>, ativo?: boolean) {
  const raw = current.metadata && typeof current.metadata === 'object' ? current.metadata : {}
  const revised = { ...raw, ...payload, _group_revision: randomUUID() }
  const human = extractHumanDescricao(current.descricao)
  return {
    ...(Object.hasOwn(current, 'metadata') ? { metadata: revised } : {}),
    descricao: `${human ? `${human}\n` : ''}__dz_meta__:${JSON.stringify(revised)}`,
    ...(ativo !== undefined ? { ativo } : {}),
  }
}

export async function consumirVagaDoLink(link: any) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const before = await freshLink(link.id)
    assertSameLink(before, link)
    const meta = parseLinkMetadata(before)
    if (before.deleted_at || meta.closed_reason === 'excluido') throw new Error(linkClosedMessage('excluido'))
    if (expired(before)) throw new Error(linkClosedMessage('expirado'))
    if (before.ativo === false) throw new Error(linkClosedMessage('pausado'))
    const { grupo, enrollment } = await readGroupLinkParents(before)
    if (enrollment !== 'aberto') throw new Error(enrollmentClosedMessage(enrollment))
    const limite = resolveLinkLimiteVagas(meta, grupo.slots)
    if (meta.usos >= limite || meta.closed_reason === 'limite_atingido') throw new Error(linkClosedMessage('limite', limite))
    const usos = meta.usos + 1
    const atLimit = usos >= limite
    const payload = buildLinkMetaPayload({ ...meta, limite_vagas: limite, usos }, atLimit
      ? { closed_reason: 'limite_atingido', closed_at: new Date().toISOString() } : {})
    const after = await compareAndWrite(before, metadataPatch(before, payload, atLimit ? false : undefined), true)
    if (after) return { usos, limite, restantes: Math.max(0, limite - usos), entradas: meta.entradas, before, after }
  }
  throw new Error('Muitas equipes tentando entrar ao mesmo tempo. Atualize e tente de novo.')
}

export async function devolverVagaDoLink(receipt: Awaited<ReturnType<typeof consumirVagaDoLink>>) {
  // Never lower a later counter, discard later history or revive a revoked/expired link.
  if (expired(receipt.after)) return false
  const patch = metadataPatch(receipt.before, receipt.before.metadata && typeof receipt.before.metadata === 'object'
    ? receipt.before.metadata : buildLinkMetaPayload(parseLinkMetadata(receipt.before)), receipt.before.ativo)
  return Boolean(await compareAndWrite(receipt.after, patch, true))
}

export async function registrarEntradaNoLink(link: any, entrada: LinkEntrada) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const fresh = await freshLink(link.id)
    assertSameLink(fresh, link)
    const meta = parseLinkMetadata(fresh)
    if (meta.entradas.some(item => item.participacao_id === entrada.participacao_id)) return
    const entradas = [...meta.entradas, entrada]
    // Preserve the latest counter and administrative flags; this operation only appends history.
    const payload = buildLinkMetaPayload({ ...meta, entradas })
    if (await compareAndWrite(fresh, metadataPatch(fresh, payload))) return
  }
  throw new Error('Não foi possível atualizar o histórico da inscrição.')
}

export async function maybeCloseGroupLinkAfterUse(link: any) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const fresh = await freshLink(link.id)
    assertSameLink(fresh, link)
    if (fresh.ativo === false || fresh.deleted_at || expired(fresh)) return
    const meta = parseLinkMetadata(fresh)
    const { grupo } = await readGroupLinkParents(fresh)
    const limite = resolveLinkLimiteVagas(meta, grupo.slots)
    const reason = meta.usos >= limite ? 'limite_atingido'
      : await countGroupFreeSlots(fresh.campeonato_id, fresh.grupo_id) > 0 ? null : 'grupo_cheio'
    if (!reason) return
    if (await compareAndWrite(fresh, metadataPatch(fresh, buildLinkMetaPayload(meta, {
      closed_reason: reason, closed_at: new Date().toISOString(),
    }), false), true)) return
  }
  throw new Error('O link foi alterado durante o fechamento.')
}
