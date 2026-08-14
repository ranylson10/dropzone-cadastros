'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, ChevronRight, Copy, Link2, Loader2, Lock, RefreshCw, Save, Search, Send, Trash2, UserMinus, UserPlus, Users, X } from 'lucide-react'

type Props = {
  accessToken: string
  equipeId: string
  line: any
  compact?: boolean
  onBack?: () => void
  onChanged?: () => void
}

export function LineRosterManager({ accessToken, equipeId, line, compact = false, onBack, onChanged }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [invites, setInvites] = useState<any[]>([])
  const [openEvent, setOpenEvent] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Array<{ equipe_jogador_id: string; tipo_formacao: 'titular' | 'reserva' }>>>({})
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferQuery, setTransferQuery] = useState('')
  const [transferTeams, setTransferTeams] = useState<any[]>([])
  const [transferTarget, setTransferTarget] = useState<any>(null)
  const [transferSearching, setTransferSearching] = useState(false)

  async function request(options?: RequestInit) {
    const response = await fetch(`/api/equipes/${equipeId}/lines/${line.id}`, {
      cache: 'no-store',
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options?.headers || {}),
      },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.error || 'Não foi possível concluir a ação.')
    return payload
  }

  async function load() {
    setLoading(true); setMessage('')
    try {
      const [payload, inviteResponse] = await Promise.all([
        request(),
        fetch(`/api/equipes/convites-elenco?equipe_id=${encodeURIComponent(equipeId)}&line_id=${encodeURIComponent(line.id)}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ])
      const invitePayload = await inviteResponse.json().catch(() => ({}))
      if (!inviteResponse.ok) throw new Error(invitePayload?.error || 'Não foi possível carregar os convites.')
      setInvites(invitePayload.invites || [])
      setData(payload)
      const next: Record<string, any[]> = {}
      for (const event of payload.events || []) {
        next[event.id] = (event.formacao || []).map((row: any) => ({
          equipe_jogador_id: String(row.equipe_jogador_id),
          tipo_formacao: row.tipo_formacao === 'reserva' ? 'reserva' : 'titular',
        }))
      }
      setDrafts(next)
    } catch (error: any) { setMessage(error?.message || 'Erro ao carregar a line.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [equipeId, line.id, accessToken])

  async function createInvite(campeonatoEquipeId?: string) {
    setBusy(`invite:${campeonatoEquipeId || 'line'}`); setMessage(''); setInviteUrl('')
    try {
      const response = await fetch('/api/equipes/convites-elenco', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipe_id: equipeId, line_id: line.id, campeonato_equipe_id: campeonatoEquipeId || null }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível gerar o convite.')
      const url = String(payload.url || '')
      setInviteUrl(url)
      if (url && navigator.clipboard) await navigator.clipboard.writeText(url)
      setMessage(campeonatoEquipeId
        ? 'Convite da formação copiado. Ao aceitar, o jogador entra no elenco, na line e, se permitido, na formação.'
        : 'Convite da line copiado. Ao aceitar, o jogador entra no elenco e nesta line.')
      await load()
    } catch (error: any) { setMessage(error?.message || 'Não foi possível gerar o convite.') }
    finally { setBusy('') }
  }

  async function copyInvite() {
    if (!inviteUrl || !navigator.clipboard) return
    await navigator.clipboard.writeText(inviteUrl)
    setMessage('Link copiado novamente.')
  }

  async function manageInvite(method: 'PATCH' | 'DELETE', tokenId: string) {
    setBusy(`invite-manage:${tokenId}`); setMessage('')
    try {
      const response = await fetch('/api/equipes/convites-elenco', {
        method,
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipe_id: equipeId, token_id: tokenId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível atualizar o convite.')
      setMessage(method === 'DELETE' ? 'Convite cancelado.' : 'Convite renovado por mais 7 dias.')
      await load()
    } catch (error: any) { setMessage(error?.message || 'Não foi possível atualizar o convite.') }
    finally { setBusy('') }
  }

  async function act(action: string, body: Record<string, unknown>, key: string) {
    setBusy(key); setMessage('')
    try {
      const payload = await request({ method: 'POST', body: JSON.stringify({ action, ...body }) })
      setData((current: any) => ({ ...current, ...payload }))
      setMessage(action === 'save_formation' ? 'Formação salva.' : 'Line atualizada.')
      onChanged?.()
      await load()
    } catch (error: any) { setMessage(error?.message || 'Não foi possível atualizar.') }
    finally { setBusy('') }
  }

  async function searchTransferTeams() {
    const query = transferQuery.trim()
    if (query.length < 2) {
      setTransferTeams([])
      return
    }
    setTransferSearching(true); setMessage('')
    try {
      const response = await fetch(`/api/equipes/busca-publica?q=${encodeURIComponent(query)}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível buscar equipes.')
      setTransferTeams((payload.items || []).filter((team: any) => String(team.id) !== String(equipeId)))
    } catch (error: any) {
      setMessage(error?.message || 'Não foi possível buscar equipes.')
    } finally {
      setTransferSearching(false)
    }
  }

  async function transferLine() {
    if (!transferTarget?.id) return
    setBusy('transfer'); setMessage('')
    try {
      const payload = await request({
        method: 'POST',
        body: JSON.stringify({ action: 'transfer_line', equipe_destino_id: transferTarget.id }),
      })
      setTransferOpen(false)
      setMessage(`Line transferida para ${payload.destination?.nome || 'a equipe real'}. Todos os vínculos foram preservados.`)
      onChanged?.()
      onBack?.()
    } catch (error: any) {
      setMessage(error?.message || 'Não foi possível transferir a line.')
    } finally {
      setBusy('')
    }
  }

  const memberIds = useMemo(() => new Set((data?.members || []).map((row: any) => String(row.id))), [data])
  const formationExcesses = useMemo(() => (data?.events || []).map((event: any) => ({
    id: String(event.id),
    championship: String(event.campeonato?.nome || 'Campeonato'),
    excess: Math.max(0, Number((drafts[event.id] || []).length) - Number(event.limite_jogadores || 0)),
  })).filter((item: any) => item.excess > 0), [data?.events, drafts])

  function toggleFormation(eventId: string, playerId: string) {
    setDrafts((current) => {
      const rows = current[eventId] || []
      const exists = rows.some((row) => row.equipe_jogador_id === playerId)
      return {
        ...current,
        [eventId]: exists
          ? rows.filter((row) => row.equipe_jogador_id !== playerId)
          : [...rows, { equipe_jogador_id: playerId, tipo_formacao: 'titular' }],
      }
    })
  }

  function changeType(eventId: string, playerId: string, type: 'titular' | 'reserva') {
    setDrafts((current) => ({
      ...current,
      [eventId]: (current[eventId] || []).map((row) => row.equipe_jogador_id === playerId ? { ...row, tipo_formacao: type } : row),
    }))
  }

  if (loading) return <div className="line-roster-loading"><Loader2 className="spin" size={18}/> Carregando line...</div>
  if (!data) return <div className="line-roster-message error">{message || 'Line indisponível.'}</div>

  return <div className={`line-roster-manager ${compact ? 'compact' : ''}`}>
      <div className="line-roster-head">
      {onBack ? <button type="button" className="icon-action" onClick={onBack}><ArrowLeft size={17}/></button> : null}
      <div><strong>{line.nome}</strong><span>{data.members?.length || 0} jogador(es) · {data.events?.length || 0} campeonato(s)</span></div>
    </div>

    {message ? <div className={`line-roster-message ${message.includes('Erro') || message.includes('Não') ? 'error' : ''}`}><span>{message}</span>{inviteUrl ? <button type="button" onClick={() => void copyInvite()}><Copy size={13}/> Copiar link</button> : null}</div> : null}


    {data.transfer ? <section className="line-roster-block line-transfer-block">
      <div className="line-roster-title with-action">
        <div>
          <strong>Transferir para equipe real</strong>
          <span>Mova esta mesma line sem perder grupo, slot, resultados, estatísticas ou MVP.</span>
        </div>
        {data.transfer.allowed && data.permissions?.pode_editar ? <button type="button" className="line-small-action" onClick={() => { setTransferOpen(true); setTransferTarget(null); setTransferTeams([]); setTransferQuery('') }}><Send size={14}/> Transferir line</button> : null}
      </div>

    {formationExcesses.length ? <div className="line-roster-message warning"><span>{formationExcesses.map((item: any) => `${item.championship}: ${item.excess} excedente(s) registrado(s)`).join(' · ')}. Os jogadores permanecem no elenco e na line; ajuste somente a formação quando necessário.</span></div> : null}
      <div className="line-transfer-summary">
        {data.transfer.allowed ? <>
          <strong>{data.transfer.championships?.length || 0} campeonato(s) serão preservados</strong>
          <span>{(data.transfer.championships || []).map((championship: any) => championship.nome).join(' · ')}</span>
        </> : <span>{data.transfer.reason}</span>}
      </div>
    </section> : null}

    <section className="line-roster-block">
      <div className="line-roster-title with-action"><div><strong>Jogadores da line</strong><span>Adicione quem já está no elenco ou convide um novo jogador.</span></div>{data.permissions?.pode_editar || data.permissions?.pode_gerar_token ? <button type="button" className="line-small-action" disabled={Boolean(busy)} onClick={() => void createInvite()}>{busy === 'invite:line' ? <Loader2 className="spin" size={14}/> : <Link2 size={14}/>} Convidar</button> : null}</div>
      <div className="line-roster-list">
        {(data.roster || []).map((player: any) => {
          const member = memberIds.has(String(player.id))
          return <article key={player.id} className={member ? 'selected' : ''}>
            <span className="line-roster-avatar">{player.foto_url ? <img src={player.foto_url} alt=""/> : String(player.nick || 'J').slice(0, 1)}</span>
            <div><strong>{player.nick || 'Jogador'}</strong><small>{player.funcao || 'Função não informada'} · ID {player.id_jogo || 'pendente'}</small></div>
            {data.permissions?.pode_editar ? <button
              type="button"
              className={member ? 'danger-icon' : 'positive-icon'}
              disabled={Boolean(busy)}
              title={member ? 'Remover da line' : 'Adicionar à line'}
              onClick={() => void act(member ? 'remove_member' : 'add_member', { equipe_jogador_id: player.id }, `${member ? 'remove' : 'add'}:${player.id}`)}
            >{busy.endsWith(`:${player.id}`) ? <Loader2 className="spin" size={16}/> : member ? <UserMinus size={16}/> : <UserPlus size={16}/>}</button> : null}
          </article>
        })}
      </div>
      {!data.roster?.length ? <div className="line-roster-empty"><Users size={24}/><span>O elenco geral da equipe ainda está vazio.</span></div> : null}
      {invites.length ? <div className="line-roster-list">
        {invites.map((invite: any) => <article key={invite.id}>
          <span className="line-roster-avatar"><Link2 size={15}/></span>
          <div><strong>{invite.campeonato_equipe_id ? 'Convite para formação' : 'Convite da line'}</strong><small>Expira em {invite.expira_em ? new Date(invite.expira_em).toLocaleString('pt-BR') : 'data não informada'}</small></div>
          <button type="button" className="positive-icon" disabled={Boolean(busy)} title="Copiar convite" onClick={() => navigator.clipboard?.writeText(invite.url)}><Copy size={15}/></button>
          <button type="button" className="positive-icon" disabled={Boolean(busy)} title="Renovar por 7 dias" onClick={() => void manageInvite('PATCH', invite.id)}>{busy === `invite-manage:${invite.id}` ? <Loader2 className="spin" size={15}/> : <RefreshCw size={15}/>}</button>
          <button type="button" className="danger-icon" disabled={Boolean(busy)} title="Cancelar convite" onClick={() => void manageInvite('DELETE', invite.id)}><Trash2 size={15}/></button>
        </article>)}
      </div> : null}
    </section>

    <section className="line-roster-block">
      <div className="line-roster-title"><div><strong>Formações por campeonato</strong><span>Cada campeonato usa apenas os jogadores permitidos por sua regra.</span></div></div>
      <div className="line-event-list">
        {(data.events || []).map((event: any) => {
          const open = openEvent === String(event.id)
          const draft = drafts[event.id] || []
          return <article key={event.id} className={open ? 'open' : ''}>
            <button type="button" className="line-event-summary" onClick={() => setOpenEvent(open ? null : String(event.id))}>
              <span className="line-event-logo">{event.campeonato?.logo_url ? <img src={event.campeonato.logo_url} alt=""/> : 'C'}</span>
              <div><strong>{event.campeonato?.nome || 'Campeonato'}</strong><small>{event.grupo?.nome || 'Sem grupo'} · {draft.length}/{event.limite_jogadores} jogadores</small></div>
              {!event.pode_alterar ? <Lock size={15}/> : open ? <ChevronDown size={17}/> : <ChevronRight size={17}/>} 
            </button>
            {open ? <div className="line-event-editor">
              {!event.pode_alterar ? <div className="line-event-lock"><Lock size={15}/><span>{event.bloqueio_motivo || 'Formação bloqueada.'}</span></div> : null}
              {data.permissions?.pode_gerar_token || data.permissions?.pode_editar ? <button type="button" className="line-invite-formation" disabled={Boolean(busy)} onClick={() => void createInvite(String(event.id))}>{busy === `invite:${event.id}` ? <Loader2 className="spin" size={14}/> : <UserPlus size={14}/>} Convidar jogador para esta formação</button> : null}
              <div className="line-formation-list">
                {(data.members || []).map((player: any) => {
                  const selected = draft.some((row) => row.equipe_jogador_id === String(player.id))
                  const row = draft.find((item) => item.equipe_jogador_id === String(player.id))
                  return <div key={player.id} className={selected ? 'selected' : ''}>
                    <button type="button" disabled={!event.pode_alterar} onClick={() => toggleFormation(event.id, String(player.id))}>
                      <span>{selected ? <Check size={14}/> : null}</span><strong>{player.nick || 'Jogador'}</strong>
                    </button>
                    {selected ? <select disabled={!event.pode_alterar} value={row?.tipo_formacao || 'titular'} onChange={(e) => changeType(event.id, String(player.id), e.target.value as any)}><option value="titular">Titular</option><option value="reserva">Reserva</option></select> : null}
                  </div>
                })}
              </div>
              {event.pode_alterar ? <button type="button" className="line-save-formation" disabled={Boolean(busy) || draft.length > event.limite_jogadores} onClick={() => void act('save_formation', { campeonato_equipe_id: event.id, players: draft }, `formation:${event.id}`)}>{busy === `formation:${event.id}` ? <Loader2 className="spin" size={16}/> : <Save size={16}/>} Salvar formação</button> : null}
              {draft.length > event.limite_jogadores ? <small className="line-limit-error">Há {draft.length - event.limite_jogadores} excedente(s) registrado(s) pelo MatchResult. Eles continuam no elenco; para salvar uma nova formação, selecione apenas os jogadores que jogarão.</small> : null}
            </div> : null}
          </article>
        })}
      </div>
      {!data.events?.length ? <div className="line-roster-empty"><span>Esta line ainda não está inscrita em campeonato ativo.</span></div> : null}
    </section>

    {transferOpen ? <div className="line-transfer-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setTransferOpen(false) }}>
      <div className="line-transfer-modal" role="dialog" aria-modal="true" aria-label="Transferir line para equipe real">
        <header>
          <div><strong>Transferir {line.nome}</strong><span>Selecione a equipe real que receberá esta line.</span></div>
          <button type="button" className="icon-action" disabled={Boolean(busy)} onClick={() => setTransferOpen(false)}><X size={17}/></button>
        </header>
        <div className="line-transfer-search">
          <input value={transferQuery} onChange={(event) => setTransferQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void searchTransferTeams() }} placeholder="Nome, tag ou ID da equipe" />
          <button type="button" disabled={transferSearching || transferQuery.trim().length < 2} onClick={() => void searchTransferTeams()}>{transferSearching ? <Loader2 className="spin" size={16}/> : <Search size={16}/>} Buscar</button>
        </div>
        <div className="line-transfer-results">
          {transferTeams.map((team: any) => <button key={team.id} type="button" className={String(transferTarget?.id) === String(team.id) ? 'selected' : ''} onClick={() => setTransferTarget(team)}>
            <span>{team.logo_url ? <img src={team.logo_url} alt=""/> : String(team.tag || team.nome || 'E').slice(0, 2)}</span>
            <div><strong>{team.nome}</strong><small>{team.tag || team.username || `ID ${team.public_id || ''}`}</small></div>
            {String(transferTarget?.id) === String(team.id) ? <Check size={17}/> : <ChevronRight size={17}/>} 
          </button>)}
          {!transferSearching && transferQuery.trim().length >= 2 && !transferTeams.length ? <small>Nenhuma equipe encontrada.</small> : null}
        </div>
        {transferTarget ? <div className="line-transfer-confirm">
          <strong>Confirme a transferência</strong>
          <p>A line <b>{line.nome}</b> passará para <b>{transferTarget.nome}</b>. O mesmo ID da line será mantido e todos os campeonatos, grupos, slots, resultados e estatísticas continuarão vinculados.</p>
          <button type="button" disabled={Boolean(busy)} onClick={() => void transferLine()}>{busy === 'transfer' ? <Loader2 className="spin" size={16}/> : <Send size={16}/>} Confirmar transferência</button>
        </div> : null}
      </div>
    </div> : null}

  </div>
}
