'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, ChevronRight, CirclePlus, ExternalLink, Link2, Loader2, RefreshCw, Shield, Swords, Trophy, Users } from 'lucide-react'

type ChampionshipItem = {
  id: string
  nome: string
  tipo?: string | null
  logo_url?: string | null
  banner_url?: string | null
  status?: string | null
  relationship: 'admin' | 'participant'
  permission?: Record<string, any> | null
  registrations?: Array<Record<string, any>>
}

type Structure = {
  campeonato?: Record<string, any>
  fases?: Array<Record<string, any>>
  grupos?: Array<Record<string, any>>
  slots?: Array<Record<string, any>>
  jogos?: Array<Record<string, any>>
  resumo?: Record<string, number>
  permission?: Record<string, any>
}

export function LiliChampionshipHub({ accessToken }: { accessToken?: string | null }) {
  const [items, setItems] = useState<ChampionshipItem[]>([])
  const [selected, setSelected] = useState<ChampionshipItem | null>(null)
  const [structure, setStructure] = useState<Structure | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [activePhase, setActivePhase] = useState<string>('all')
  const [creating, setCreating] = useState<'phase' | 'group' | null>(null)
  const [feedback, setFeedback] = useState('')

  async function request(url: string, options?: RequestInit) {
    const response = await fetch(url, {
      ...options,
      cache: 'no-store',
      headers: {
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(options?.headers || {}),
      },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.error || 'Não foi possível concluir a ação.')
    return payload
  }

  async function loadItems() {
    if (!accessToken) return
    setLoading(true); setError('')
    try {
      const payload = await request('/api/lili/campeonatos')
      setItems(payload.items || [])
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar seus campeonatos.')
    } finally { setLoading(false) }
  }

  async function openChampionship(item: ChampionshipItem) {
    setSelected(item); setStructure(null); setDetailLoading(true); setError(''); setActivePhase('all')
    try {
      const payload = await request(`/api/campeonatos/${item.id}/estrutura`)
      setStructure(payload)
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar a estrutura do campeonato.')
    } finally { setDetailLoading(false) }
  }

  useEffect(() => { void loadItems() }, [accessToken])

  const phases = structure?.fases || []
  const groups = structure?.grupos || []
  const slots = structure?.slots || []
  const games = structure?.jogos || []
  const visibleGroups = useMemo(() => activePhase === 'all' ? groups : groups.filter((group) => String(group.fase_id) === activePhase), [groups, activePhase])

  async function createPhase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const form = new FormData(event.currentTarget)
    setFeedback('')
    try {
      await request(`/api/campeonatos/${selected.id}/estrutura`, { method: 'POST', body: JSON.stringify({ action: 'create_phase', nome: form.get('nome'), ordem: Number(form.get('ordem') || phases.length + 1) }) })
      setCreating(null); setFeedback('Fase criada com sucesso.'); await openChampionship(selected)
    } catch (err: any) { setFeedback(err?.message || 'Não foi possível criar a fase.') }
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const form = new FormData(event.currentTarget)
    setFeedback('')
    try {
      await request(`/api/campeonatos/${selected.id}/estrutura`, { method: 'POST', body: JSON.stringify({ action: 'create_group', nome: form.get('nome'), fase_id: form.get('fase_id'), slots: Number(form.get('slots') || 12) }) })
      setCreating(null); setFeedback('Grupo e slots criados com sucesso.'); await openChampionship(selected)
    } catch (err: any) { setFeedback(err?.message || 'Não foi possível criar o grupo.') }
  }

  async function generateLink(group: Record<string, any>) {
    if (!selected) return
    const freeSlots = slots.filter((slot) => String(slot.grupo_id) === String(group.id) && !slot.equipe_id && !slot.line_id).length
    setFeedback('')
    try {
      const payload = await request('/api/dropzone', { method: 'POST', body: JSON.stringify({ entity_type: 'registration_link', parent_id: selected.id, generate_token: true, data: { campeonato_id: selected.id, grupo_id: group.id, fase_id: group.fase_id || null, limite_vagas: Math.max(1, freeSlots), acompanhamento_publico: true } }) })
      const url = payload?.row?.data?.public_url_full || payload?.data?.public_url_full || payload?.public_url_full
      if (!url) throw new Error('O link foi criado, mas a URL não retornou.')
      await navigator.clipboard.writeText(url)
      setFeedback(`Link de ${group.nome} criado e copiado.`)
    } catch (err: any) { setFeedback(err?.message || 'Não foi possível gerar o link.') }
  }

  if (!accessToken) return <div className="lili-champ-empty"><Shield size={30} /><strong>Entre na sua conta</strong><span>Seus campeonatos, grupos e slots aparecem aqui após o login.</span><a href="/login?returnTo=%2Flili">Entrar</a></div>

  if (!selected) return (
    <section className="lili-champ-hub">
      <div className="lili-champ-toolbar"><div><strong>Meus campeonatos</strong><span>Todos os campeonatos em que você participa ou administra.</span></div><button type="button" onClick={() => void loadItems()} aria-label="Atualizar"><RefreshCw size={17} /></button></div>
      {loading ? <div className="lili-champ-loading"><Loader2 className="spin" size={24} /> Carregando campeonatos…</div> : null}
      {error ? <div className="lili-champ-feedback error">{error}</div> : null}
      {!loading && !items.length ? <div className="lili-champ-empty"><Trophy size={30} /><strong>Nenhum campeonato encontrado</strong><span>Quando sua equipe entrar em um grupo ou você criar um campeonato, ele aparecerá aqui.</span><a href="/campeonatos">Explorar campeonatos</a></div> : null}
      <div className="lili-champ-list">{items.map((item) => {
        const registration = item.registrations?.[0]
        return <button type="button" key={item.id} className="lili-champ-list-item" onClick={() => void openChampionship(item)}>
          <span className="lili-champ-logo">{item.logo_url || item.banner_url ? <img src={item.logo_url || item.banner_url || ''} alt="" /> : <Trophy size={22} />}</span>
          <span className="lili-champ-list-copy"><strong>{item.nome}</strong><small>{registration?.grupo_nome ? `${registration.grupo_nome}${registration.slot_numero ? ` · Slot ${registration.slot_numero}` : ''}` : item.relationship === 'admin' ? 'Acesso administrativo' : 'Participante'} </small><span>{item.tipo || 'Campeonato'} · {item.status || 'ativo'}</span></span>
          <span className={`lili-champ-role ${item.relationship}`}>{item.relationship === 'admin' ? 'Admin' : 'Minha equipe'}</span><ChevronRight size={18} />
        </button>
      })}</div>
    </section>
  )

  return (
    <section className="lili-champ-hub detail">
      <div className="lili-champ-detail-head"><button type="button" onClick={() => { setSelected(null); setStructure(null); setFeedback('') }}><ArrowLeft size={18} /> Voltar</button><a href={`/campeonatos/${selected.id}`}><ExternalLink size={16} /> Painel completo</a></div>
      <div className="lili-champ-title"><span className="lili-champ-logo large">{selected.logo_url || selected.banner_url ? <img src={selected.logo_url || selected.banner_url || ''} alt="" /> : <Trophy size={25} />}</span><div><strong>{selected.nome}</strong><span>{selected.tipo || 'Campeonato'} · {selected.status || 'ativo'}</span></div></div>
      {detailLoading ? <div className="lili-champ-loading"><Loader2 className="spin" size={24} /> Carregando estrutura…</div> : null}
      {error ? <div className="lili-champ-feedback error">{error}</div> : null}
      {feedback ? <div className="lili-champ-feedback">{feedback}</div> : null}
      {structure ? <>
        <div className="lili-champ-metrics"><div><span>Fases</span><strong>{phases.length}</strong></div><div><span>Grupos</span><strong>{groups.length}</strong></div><div><span>Slots ocupados</span><strong>{slots.filter((slot) => slot.equipe_id || slot.line_id).length}/{slots.length}</strong></div><div><span>Jogos</span><strong>{games.length}</strong></div></div>
        {structure.permission?.canOrganizeGroups ? <div className="lili-champ-admin-actions"><button type="button" onClick={() => setCreating(creating === 'phase' ? null : 'phase')}><CirclePlus size={17} /> Criar fase</button><button type="button" onClick={() => setCreating(creating === 'group' ? null : 'group')} disabled={!phases.length}><Users size={17} /> Criar grupo</button></div> : null}
        {creating === 'phase' ? <form className="lili-champ-form" onSubmit={createPhase}><label>Nome da fase<input name="nome" required placeholder="Ex.: Fase classificatória" /></label><label>Ordem<input name="ordem" type="number" min="1" defaultValue={phases.length + 1} /></label><button type="submit">Salvar fase</button></form> : null}
        {creating === 'group' ? <form className="lili-champ-form" onSubmit={createGroup}><label>Fase<select name="fase_id" required>{phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.nome}</option>)}</select></label><label>Nome do grupo<input name="nome" required placeholder="Ex.: Grupo A" /></label><label>Quantidade de slots<input name="slots" type="number" min="1" max="52" defaultValue="12" /></label><button type="submit">Criar grupo e slots</button></form> : null}
        <div className="lili-champ-phase-filter"><button type="button" className={activePhase === 'all' ? 'is-active' : ''} onClick={() => setActivePhase('all')}>Todos</button>{phases.map((phase) => <button type="button" key={phase.id} className={activePhase === String(phase.id) ? 'is-active' : ''} onClick={() => setActivePhase(String(phase.id))}>{phase.nome}</button>)}</div>
        <div className="lili-champ-groups">{visibleGroups.map((group) => {
          const groupSlots = slots.filter((slot) => String(slot.grupo_id) === String(group.id)).sort((a, b) => Number(a.slot_numero || 0) - Number(b.slot_numero || 0))
          const groupGames = games.filter((game) => Array.isArray(game.grupos_ids) ? game.grupos_ids.includes(group.id) : String(game.grupo_id || '') === String(group.id))
          return <article className="lili-champ-group" key={group.id}><div className="lili-champ-group-head"><div><strong>{group.nome}</strong><span>{groupSlots.filter((slot) => slot.equipe_id || slot.line_id).length}/{groupSlots.length || group.slots || 0} slots ocupados</span></div>{structure.permission?.canGenerateToken ? <button type="button" onClick={() => void generateLink(group)} disabled={!groupSlots.some((slot) => !slot.equipe_id && !slot.line_id)}><Link2 size={16} /> Gerar link</button> : null}</div>
            {groupGames.length ? <div className="lili-champ-games">{groupGames.map((game) => <div key={game.id}><CalendarDays size={15} /><span><strong>{game.nome || 'Jogo'}</strong>{game.data_hora || game.inicio_em ? new Date(game.data_hora || game.inicio_em).toLocaleString('pt-BR') : 'Horário não definido'}</span><Swords size={15} /></div>)}</div> : null}
            <div className="lili-champ-slots">{groupSlots.map((slot) => <div className={slot.equipe_id || slot.line_id ? 'occupied' : 'free'} key={slot.id}><span>{String(slot.slot_numero || slot.numero || '?').padStart(2, '0')}</span><div><strong>{slot.nome_exibicao || slot.line_nome || slot.equipe_nome || 'Slot disponível'}</strong><small>{slot.equipe_nome && slot.line_nome ? `${slot.equipe_nome} · ${slot.line_nome}` : slot.equipe_nome || slot.line_nome || 'Aguardando equipe'}</small></div></div>)}</div>
          </article>
        })}</div>
        {!visibleGroups.length ? <div className="lili-champ-empty compact"><Users size={25} /><strong>Nenhum grupo nesta fase</strong><span>O administrador pode criar o primeiro grupo acima.</span></div> : null}
      </> : null}
    </section>
  )
}
