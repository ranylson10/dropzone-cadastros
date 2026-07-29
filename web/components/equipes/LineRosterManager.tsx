'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, ChevronRight, Copy, Link2, Loader2, Lock, Save, UserMinus, UserPlus, Users } from 'lucide-react'

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
  const [openEvent, setOpenEvent] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Array<{ equipe_jogador_id: string; tipo_formacao: 'titular' | 'reserva' }>>>({})

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
      const payload = await request()
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
    } catch (error: any) { setMessage(error?.message || 'Não foi possível gerar o convite.') }
    finally { setBusy('') }
  }

  async function copyInvite() {
    if (!inviteUrl || !navigator.clipboard) return
    await navigator.clipboard.writeText(inviteUrl)
    setMessage('Link copiado novamente.')
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

  const memberIds = useMemo(() => new Set((data?.members || []).map((row: any) => String(row.id))), [data])

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
              {draft.length > event.limite_jogadores ? <small className="line-limit-error">Remova {draft.length - event.limite_jogadores} jogador(es) para respeitar o limite.</small> : null}
            </div> : null}
          </article>
        })}
      </div>
      {!data.events?.length ? <div className="line-roster-empty"><span>Esta line ainda não está inscrita em campeonato ativo.</span></div> : null}
    </section>
  </div>
}
