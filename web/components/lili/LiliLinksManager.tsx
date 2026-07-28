'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Clock3, Copy, ExternalLink, Link2, Loader2, Pause, Play, RefreshCw, Settings2, Trash2 } from 'lucide-react'

type RequestFn = (url: string, options?: RequestInit) => Promise<any>

type Props = {
  championshipId: string
  phases: Array<Record<string, any>>
  groups: Array<Record<string, any>>
  slots: Array<Record<string, any>>
  canManage: boolean
  request: RequestFn
  onFeedback: (message: string) => void
}

type LinkRow = {
  id: string
  token?: string | null
  name?: string | null
  status?: string | null
  created_at?: string | null
  parent_id?: string | null
  data?: Record<string, any>
}

function toLocalDateTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function LiliLinksManager({ championshipId, phases, groups, slots, canManage, request, onFeedback }: Props) {
  const [links, setLinks] = useState<LinkRow[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ titulo: '', limite_vagas: 1, expira_em: '' })

  const groupById = useMemo(() => new Map(groups.map((group) => [String(group.id), group])), [groups])
  const phaseById = useMemo(() => new Map(phases.map((phase) => [String(phase.id), phase])), [phases])

  async function loadLinks() {
    if (!canManage) return
    setLoading(true)
    try {
      const payload = await request('/api/dropzone?entity_type=registration_link')
      const rows = (payload.rows || []).filter((row: LinkRow) => String(row.data?.championship_id || row.parent_id || '') === championshipId)
      setLinks(rows)
    } catch (error: any) {
      onFeedback(error?.message || 'Não foi possível carregar os links do campeonato.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (expanded) void loadLinks()
  }, [expanded, championshipId])

  function publicUrl(link: LinkRow) {
    const relative = String(link.data?.public_url || '')
    if (!relative) return ''
    if (typeof window === 'undefined') return relative
    return `${window.location.origin}${relative}`
  }

  async function copyLink(link: LinkRow) {
    const url = publicUrl(link)
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopiedId(link.id)
    onFeedback('Link copiado para a área de transferência.')
    window.setTimeout(() => setCopiedId((current) => current === link.id ? null : current), 1800)
  }

  async function patchLink(link: LinkRow, data: Record<string, any>, success: string) {
    setActionId(link.id)
    try {
      await request('/api/dropzone', {
        method: 'PATCH',
        body: JSON.stringify({ entity_type: 'registration_link', id: link.id, data }),
      })
      onFeedback(success)
      setEditingId(null)
      await loadLinks()
    } catch (error: any) {
      onFeedback(error?.message || 'Não foi possível atualizar o link.')
    } finally {
      setActionId(null)
    }
  }

  async function removeLink(link: LinkRow) {
    if (!window.confirm('Excluir este link? O histórico ficará preservado, mas novas entradas serão bloqueadas.')) return
    setActionId(link.id)
    try {
      await request('/api/dropzone', {
        method: 'DELETE',
        body: JSON.stringify({ entity_type: 'registration_link', id: link.id }),
      })
      onFeedback('Link excluído com segurança.')
      await loadLinks()
    } catch (error: any) {
      onFeedback(error?.message || 'Não foi possível excluir o link.')
    } finally {
      setActionId(null)
    }
  }

  function startEditing(link: LinkRow) {
    setEditingId(link.id)
    setDraft({
      titulo: String(link.data?.titulo || link.name || ''),
      limite_vagas: Math.max(1, Number(link.data?.limite_vagas || 1)),
      expira_em: toLocalDateTime(link.data?.expira_em),
    })
  }

  const activeCount = links.filter((link) => link.data?.status === 'ativo').length
  const totalUses = links.reduce((sum, link) => sum + Number(link.data?.usos || 0), 0)
  const totalRemaining = links.reduce((sum, link) => sum + Number(link.data?.restantes || 0), 0)

  if (!canManage) return null

  return <section className="lili-links-manager">
    <button type="button" className="lili-links-manager-toggle" onClick={() => setExpanded((value) => !value)}>
      <span><Link2 size={18} /><span><strong>Central de links</strong><small>Gerencie os links de inscrição de todos os grupos em um só lugar.</small></span></span>
      <span className="lili-links-manager-summary">{links.length ? `${activeCount} ativos · ${totalUses} usos` : 'Abrir'}</span>
    </button>

    {expanded ? <div className="lili-links-manager-body">
      <div className="lili-links-stats">
        <div><strong>{links.length}</strong><span>links</span></div>
        <div><strong>{activeCount}</strong><span>ativos</span></div>
        <div><strong>{totalUses}</strong><span>entradas</span></div>
        <div><strong>{totalRemaining}</strong><span>vagas restantes</span></div>
        <button type="button" onClick={() => void loadLinks()} disabled={loading}>{loading ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />} Atualizar</button>
      </div>

      {loading && !links.length ? <div className="lili-links-empty"><Loader2 className="spin" size={20} /> Carregando links…</div> : null}
      {!loading && !links.length ? <div className="lili-links-empty"><Link2 size={22} /><strong>Nenhum link criado</strong><span>Use “Gerar link” em um grupo para criar o primeiro.</span></div> : null}

      <div className="lili-links-list">{links.map((link) => {
        const group = groupById.get(String(link.data?.group_id || ''))
        const phase = phaseById.get(String(link.data?.fase_id || group?.fase_id || ''))
        const status = String(link.data?.status || link.status || 'ativo')
        const isActive = status === 'ativo'
        const isExpired = status === 'expirado'
        const groupSlots = slots.filter((slot) => String(slot.grupo_id) === String(group?.id || '')).length
        const busy = actionId === link.id
        return <article key={link.id} className={`lili-link-card status-${status}`}>
          <div className="lili-link-card-main">
            <div className="lili-link-card-title"><span className={`lili-link-status ${isActive ? 'active' : isExpired ? 'expired' : 'paused'}`}>{isActive ? 'Ativo' : isExpired ? 'Expirado' : 'Pausado'}</span><strong>{link.data?.titulo || link.name || 'Link de inscrição'}</strong></div>
            <div className="lili-link-card-meta"><span>{phase?.nome || 'Fase não informada'}</span><span>·</span><span>{group?.nome || 'Grupo não encontrado'}</span><span>·</span><span>{groupSlots} slots</span></div>
            <div className="lili-link-card-progress"><span><b>{Number(link.data?.usos || 0)}</b> usados de <b>{Number(link.data?.limite_vagas || 0)}</b></span><span>{Number(link.data?.restantes || 0)} restantes</span></div>
            <div className="lili-link-progress-track"><span style={{ width: `${Math.min(100, Number(link.data?.limite_vagas || 0) ? (Number(link.data?.usos || 0) / Number(link.data?.limite_vagas || 1)) * 100 : 0)}%` }} /></div>
            {link.data?.expira_em ? <div className="lili-link-expiry"><Clock3 size={14} /> Encerra em {new Date(link.data.expira_em).toLocaleString('pt-BR')}</div> : null}
          </div>
          <div className="lili-link-card-actions">
            <button type="button" onClick={() => void copyLink(link)}>{copiedId === link.id ? <Check size={15} /> : <Copy size={15} />} {copiedId === link.id ? 'Copiado' : 'Copiar'}</button>
            <a href={publicUrl(link)} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Abrir</a>
            <button type="button" onClick={() => startEditing(link)}><Settings2 size={15} /> Ajustar</button>
            <button type="button" onClick={() => void patchLink(link, { ativo: !isActive }, isActive ? 'Link pausado.' : 'Link reativado.')} disabled={busy}>{busy ? <Loader2 className="spin" size={15} /> : isActive ? <Pause size={15} /> : <Play size={15} />} {isActive ? 'Pausar' : 'Ativar'}</button>
            <button type="button" onClick={() => void patchLink(link, { regenerate_token: true }, 'Token renovado. O link anterior deixou de funcionar.')} disabled={busy}><RefreshCw size={15} /> Renovar</button>
            <button type="button" className="danger" onClick={() => void removeLink(link)} disabled={busy}><Trash2 size={15} /> Excluir</button>
          </div>
          {editingId === link.id ? <div className="lili-link-edit">
            <label>Título<input value={draft.titulo} onChange={(event) => setDraft((current) => ({ ...current, titulo: event.target.value }))} /></label>
            <label>Limite de vagas<input type="number" min="1" max={Math.max(1, groupSlots)} value={draft.limite_vagas} onChange={(event) => setDraft((current) => ({ ...current, limite_vagas: Math.max(1, Number(event.target.value || 1)) }))} /></label>
            <label>Encerramento<input type="datetime-local" value={draft.expira_em} onChange={(event) => setDraft((current) => ({ ...current, expira_em: event.target.value }))} /></label>
            <div><button type="button" onClick={() => setEditingId(null)}>Cancelar</button><button type="button" onClick={() => void patchLink(link, { titulo: draft.titulo, limite_vagas: draft.limite_vagas, expira_em: draft.expira_em ? new Date(draft.expira_em).toISOString() : null }, 'Link atualizado com sucesso.')} disabled={busy}>{busy ? <Loader2 className="spin" size={15} /> : <Settings2 size={15} />} Salvar ajustes</button></div>
          </div> : null}
        </article>
      })}</div>
    </div> : null}
  </section>
}
