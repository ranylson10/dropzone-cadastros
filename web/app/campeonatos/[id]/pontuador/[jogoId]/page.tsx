'use client'

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Eye, EyeOff, FileUp, Link2, Loader2, RefreshCcw, Save, Trophy, Users, X } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'

type Row = Record<string, any>
type PontuadorData = {
  campeonato: { id: string; nome: string; logo_url?: string | null }
  fase?: { id: string; nome: string } | null
  rodada?: { id: string; nome: string; numero: number } | null
  jogo: { id: string; nome: string; numero_partidas: number }
  partidas: Row[]; slots: Row[]; matriz: Row[]; jogadores: Row[]
  resultados_jogadores: Row[]
  classificacao_geral: Row[]; classificacao_jogo: Row[]
  mvp_geral: Row[]; mvp_jogo: Row[]; vinculos_matchresult: Row[]
}
type ViewMode = 'equipes' | 'mvp' | 'vinculos'
type TeamEdit = { posicao: string; abates: string; jogadores: Record<string, string> }

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    const returnTo = `${window.location.pathname}${window.location.search}`
    window.location.replace(`/login?profileType=produtora&returnTo=${encodeURIComponent(returnTo)}`)
    throw new Error('Redirecionando para o login...')
  }
  const response = await fetch(url, {
    ...options,
    cache: 'no-store',
    headers: { ...(options?.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token}`, ...(options?.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.')
  return payload as T
}

const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0
const playerId = (row: Row) => String(row.campeonato_jogador_id || row.id || '')

export default function PontuadorJogoPage() {
  const params = useParams<{ id: string; jogoId: string }>()
  const router = useRouter()
  const [data, setData] = useState<PontuadorData | null>(null)
  const [view, setView] = useState<ViewMode>('equipes')
  const [selectedDropId, setSelectedDropId] = useState('')
  const [edits, setEdits] = useState<Record<string, TeamEdit>>({})
  const [showGeneral, setShowGeneral] = useState(true)
  const [showDay, setShowDay] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [matchName, setMatchName] = useState('')
  const [matchContent, setMatchContent] = useState('')
  const [preview, setPreview] = useState<Row | null>(null)
  const [previewLinks, setPreviewLinks] = useState<Record<string, string>>({})
  const [newLink, setNewLink] = useState({ nome_raw: '', campeonato_equipe_id: '' })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await request<PontuadorData>(`/api/campeonatos/${params.id}/pontuador/${params.jogoId}`)
      setData(result)
      setSelectedDropId(current => current || result.partidas[0]?.id || '')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro ao carregar pontuador.') }
    finally { setLoading(false) }
  }, [params.id, params.jogoId])

  useEffect(() => { void load() }, [load])

  const selectedDrop = data?.partidas.find(drop => drop.id === selectedDropId)
  const selectedMatrix = useMemo(() => new Map((data?.matriz || []).filter(row => row.partida_id === selectedDropId).map(row => [row.campeonato_equipe_id, row])), [data?.matriz, selectedDropId])
  const playersByTeam = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const row of data?.jogadores || []) {
      const list = map.get(row.campeonato_equipe_id) || []
      list.push(row); map.set(row.campeonato_equipe_id, list)
    }
    return map
  }, [data?.jogadores])

  useEffect(() => {
    if (!data || !selectedDropId) return
    const next: Record<string, TeamEdit> = {}
    for (const slot of data.slots.filter(item => !item.slot_vazio && item.campeonato_equipe_id)) {
      const current = data.matriz.find(row => row.partida_id === selectedDropId && row.campeonato_equipe_id === slot.campeonato_equipe_id)
      const playerValues: Record<string, string> = {}
      for (const player of playersByTeam.get(slot.campeonato_equipe_id) || []) {
        const result = data.resultados_jogadores.find(item => item.partida_id === selectedDropId && item.campeonato_jogador_id === playerId(player))
        playerValues[playerId(player)] = result ? String(result.abates || 0) : ''
      }
      next[slot.campeonato_equipe_id] = {
        posicao: current?.resultado_id ? String(current.posicao || '') : '',
        abates: current?.resultado_id ? String(current.abates || 0) : '',
        jogadores: playerValues,
      }
    }
    setEdits(next)
  }, [data, selectedDropId, playersByTeam])

  function patchTeam(id: string, patch: Partial<TeamEdit>) {
    setEdits(current => ({ ...current, [id]: { ...(current[id] || { posicao: '', abates: '', jogadores: {} }), ...patch } }))
  }

  function patchPlayer(teamId: string, id: string, value: string) {
    const previous = edits[teamId] || { posicao: '', abates: '', jogadores: {} }
    const jogadores = { ...previous.jogadores, [id]: value }
    const total = Object.values(jogadores).reduce((sum, kills) => sum + num(kills), 0)
    patchTeam(teamId, { jogadores, abates: String(total) })
  }

  async function saveManual() {
    if (!selectedDropId || !data) return
    const equipes = data.slots.filter(slot => !slot.slot_vazio && edits[slot.campeonato_equipe_id]?.posicao).map(slot => {
      const edit = edits[slot.campeonato_equipe_id]
      return {
        campeonato_equipe_id: slot.campeonato_equipe_id,
        posicao: num(edit.posicao), abates: num(edit.abates),
        jogadores: (playersByTeam.get(slot.campeonato_equipe_id) || []).map(player => ({ campeonato_jogador_id: playerId(player), abates: num(edit.jogadores[playerId(player)]) })),
      }
    })
    if (!equipes.length) return setError('Preencha a posição de pelo menos uma equipe.')
    setSaving(true); setError(''); setNotice('')
    try {
      await request(`/api/campeonatos/${params.id}/sumula/manual`, { method: 'POST', body: JSON.stringify({ partida_id: selectedDropId, equipes }) })
      setNotice(`Queda ${selectedDrop?.numero_partida || ''} salva e tabelas recalculadas.`)
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro ao salvar pontuação.') }
    finally { setSaving(false) }
  }

  async function readMatchFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setMatchName(file.name); setMatchContent(await file.text()); setPreview(null); setPreviewLinks({}); event.target.value = ''
  }

  async function previewMatch() {
    if (!selectedDropId || !matchContent) return setError('Selecione a queda e o arquivo Match Result.')
    setSaving(true); setError('')
    try {
      const result = await request<{ preview: Row }>(`/api/campeonatos/${params.id}/sumula/matchresult/preview`, { method: 'POST', body: JSON.stringify({ partida_id: selectedDropId, conteudo_bruto: matchContent }) })
      setPreview(result.preview)
      setPreviewLinks(Object.fromEntries((result.preview.equipes || []).map((team: Row) => [team.nome_normalizado, team.campeonato_equipe_id || ''])))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro ao interpretar Match Result.') }
    finally { setSaving(false) }
  }

  async function confirmMatch() {
    if (!preview) return
    const missing = preview.equipes.find((team: Row) => !previewLinks[team.nome_normalizado])
    if (missing) return setError(`Vincule a equipe "${missing.nome}" antes de confirmar.`)
    setSaving(true); setError('')
    try {
      await request(`/api/campeonatos/${params.id}/sumula/matchresult/confirmar`, { method: 'POST', body: JSON.stringify({ partida_id: selectedDropId, nome_arquivo: matchName, conteudo_bruto: matchContent, equipes: preview.equipes.map((team: Row) => ({ nome: team.nome, campeonato_equipe_id: previewLinks[team.nome_normalizado] })) }) })
      setPreview(null); setMatchContent(''); setMatchName(''); setNotice('Match Result confirmado e pontuação registrada.'); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro ao confirmar Match Result.') }
    finally { setSaving(false) }
  }

  async function saveLink() {
    if (!newLink.nome_raw.trim() || !newLink.campeonato_equipe_id) return setError('Informe o TeamName e a equipe de destino.')
    setSaving(true); setError('')
    try {
      await request(`/api/campeonatos/${params.id}/pontuador/${params.jogoId}/vinculos`, { method: 'POST', body: JSON.stringify({ vinculos: [newLink] }) })
      setNewLink({ nome_raw: '', campeonato_equipe_id: '' }); setNotice('Vínculo salvo para os próximos Match Results.'); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro ao salvar vínculo.') }
    finally { setSaving(false) }
  }

  if (loading && !data) return <main className="fullscreen-scorer-state"><Loader2 className="spin" /> Carregando pontuador...</main>
  if (error && !data) return <main className="fullscreen-scorer-state error"><strong>{error}</strong><button className="button secondary" onClick={() => void load()}>Tentar novamente</button></main>
  if (!data) return null

  return <main className="scorer-workspace">
    <header className="scorer-workspace-header">
      <div className="scorer-brand"><button className="icon-button" onClick={() => router.back()} aria-label="Voltar"><ArrowLeft size={18}/></button>{data.campeonato.logo_url ? <img src={data.campeonato.logo_url} alt=""/> : null}<div><p>{data.fase?.nome || 'Fase'}{data.rodada?.nome ? ` · ${data.rodada.nome}` : ''}</p><h1>{data.jogo.nome}</h1><small>{data.campeonato.nome} · {data.slots.length} slots</small></div></div>
      <div className="scorer-drop-picker"><span>Partida ativa</span><select value={selectedDropId} onChange={event => setSelectedDropId(event.target.value)}>{data.partidas.map(drop => <option key={drop.id} value={drop.id}>Q{drop.numero_partida} · {drop.mapa_nome || drop.mapa || 'Mapa'}{drop.status === 'finalizada' ? ' · finalizada' : ''}</option>)}</select></div>
      <div className="scorer-header-actions"><label className="button secondary scorer-file-button"><FileUp size={15}/> Match Result<input type="file" accept=".txt,.log,text/plain" onChange={readMatchFile}/></label><button className="button secondary" onClick={() => void load()} disabled={loading}><RefreshCcw size={15}/> Atualizar</button><button className="button" onClick={() => void saveManual()} disabled={saving || selectedDrop?.status === 'finalizada'}>{saving ? <Loader2 className="spin" size={15}/> : <Save size={15}/>} Salvar queda</button></div>
    </header>

    <div className="scorer-commandbar">
      <nav><button className={view === 'equipes' ? 'active' : ''} onClick={() => setView('equipes')}><Trophy size={15}/> Equipes</button><button className={view === 'mvp' ? 'active' : ''} onClick={() => setView('mvp')}><Users size={15}/> MVP</button><button className={view === 'vinculos' ? 'active' : ''} onClick={() => setView('vinculos')}><Link2 size={15}/> Vínculos</button></nav>
      <div className="scorer-visibility"><button onClick={() => setShowDay(value => !value)}>{showDay ? <Eye size={14}/> : <EyeOff size={14}/>} Pontuação do jogo</button><button onClick={() => setShowGeneral(value => !value)}>{showGeneral ? <Eye size={14}/> : <EyeOff size={14}/>} Pontuação geral</button></div>
    </div>

    {error ? <div className="scorer-feedback error">{error}<button onClick={() => setError('')}><X size={14}/></button></div> : null}
    {notice ? <div className="scorer-feedback success">{notice}<button onClick={() => setNotice('')}><X size={14}/></button></div> : null}
    {matchContent && !preview ? <section className="scorer-import-ready"><div><FileUp size={20}/><span><strong>{matchName}</strong><small>Arquivo pronto para conferir na Q{selectedDrop?.numero_partida}</small></span></div><button className="button" onClick={() => void previewMatch()} disabled={saving}>Ler Match Result</button></section> : null}

    {preview ? <section className="scorer-preview"><header><div><p className="eyebrow">Prévia da importação</p><h2>{matchName}</h2></div><button className="icon-button" onClick={() => setPreview(null)}><X size={17}/></button></header><div className="scorer-preview-list">{preview.equipes.map((team: Row) => <div key={team.nome_normalizado}><span><strong>{team.posicao}º · {team.nome}</strong><small>{team.abates} abates · {team.jogadores.length} jogadores</small></span><select value={previewLinks[team.nome_normalizado] || ''} onChange={event => setPreviewLinks(current => ({ ...current, [team.nome_normalizado]: event.target.value }))}><option value="">Vincular equipe...</option>{data.slots.filter(slot => !slot.slot_vazio).map(slot => <option key={slot.campeonato_equipe_id} value={slot.campeonato_equipe_id}>{slot.equipe_nome} · {slot.grupo_nome} S{slot.slot_numero}</option>)}</select></div>)}</div><footer><button className="button secondary" onClick={() => setPreview(null)}>Cancelar</button><button className="button" onClick={() => void confirmMatch()} disabled={saving}>{saving ? <Loader2 className="spin" size={15}/> : <Save size={15}/>} Confirmar e pontuar</button></footer></section> : null}

    {view === 'equipes' ? <section className="scorer-edit-table-wrap"><table className="scorer-edit-table"><thead><tr><th>Slot</th><th>Equipe / line</th><th>Vínculo</th><th>Posição Q{selectedDrop?.numero_partida}</th><th>Abates Q{selectedDrop?.numero_partida}</th>{showDay ? <><th>Pts. jogo</th><th>Quedas jogo</th></> : null}{showGeneral ? <><th>Pts. geral</th><th>Pos. geral</th></> : null}</tr></thead><tbody>{data.slots.map(slot => {
      const id = slot.campeonato_equipe_id; const edit = edits[id]; const day = data.classificacao_jogo.find(row => row.campeonato_equipe_id === id); const general = data.classificacao_geral.find(row => row.campeonato_equipe_id === id); const links = data.vinculos_matchresult.filter(row => row.campeonato_equipe_id === id)
      return <tr key={`${slot.grupo_id}:${slot.slot_numero}`} className={slot.slot_vazio ? 'is-empty' : ''}><td><b>{slot.slot_numero}</b><small>{slot.grupo_nome}</small></td><td><div className="scorer-team">{slot.equipe_logo_url ? <img src={slot.equipe_logo_url} alt=""/> : <span/>}<div><strong>{slot.equipe_nome || 'Slot vazio'}</strong><small>{slot.equipe_tag || 'Sem equipe'}</small></div></div></td><td>{links.length ? links.map(link => <span className="link-chip" key={link.id}>{link.nome_raw}</span>) : <em>Sem vínculo</em>}</td><td>{slot.slot_vazio ? '—' : <input type="number" min="1" max={data.slots.length} value={edit?.posicao || ''} onChange={event => patchTeam(id, { posicao: event.target.value })}/>}</td><td>{slot.slot_vazio ? '—' : <input type="number" min="0" value={edit?.abates || ''} onChange={event => patchTeam(id, { abates: event.target.value })}/>}</td>{showDay ? <><td className="score-accent">{day?.pontos_total || 0}</td><td>{day?.quedas_jogadas || 0}</td></> : null}{showGeneral ? <><td className="score-total">{general?.pontos_total || 0}</td><td>{general?.colocacao || '—'}</td></> : null}</tr>
    })}</tbody></table></section> : null}

    {view === 'mvp' ? <section className="scorer-mvp-layout"><div className="scorer-edit-table-wrap"><table className="scorer-edit-table"><thead><tr><th>Equipe</th><th>Jogador</th><th>ID de jogo</th><th>Abates Q{selectedDrop?.numero_partida}</th><th>Abates jogo</th><th>Abates geral</th></tr></thead><tbody>{data.slots.filter(slot => !slot.slot_vazio).flatMap(slot => (playersByTeam.get(slot.campeonato_equipe_id) || []).map(player => { const id = playerId(player); const game = data.mvp_jogo.find(row => row.campeonato_jogador_id === id); const general = data.mvp_geral.find(row => row.campeonato_jogador_id === id); return <tr key={`${slot.campeonato_equipe_id}:${id}`}><td><strong>{slot.equipe_nome}</strong><small>{slot.equipe_tag}</small></td><td><strong>{player.nick || player.nome || 'Jogador'}</strong></td><td>{player.id_jogo || '—'}</td><td><input type="number" min="0" value={edits[slot.campeonato_equipe_id]?.jogadores[id] || ''} onChange={event => patchPlayer(slot.campeonato_equipe_id, id, event.target.value)}/></td><td>{game?.abates || 0}</td><td className="score-total">{general?.abates || 0}</td></tr> }))}</tbody></table></div></section> : null}

    {view === 'vinculos' ? <section className="scorer-links-panel"><div className="scorer-link-form"><label><span>TeamName do Match Result</span><input value={newLink.nome_raw} onChange={event => setNewLink({ ...newLink, nome_raw: event.target.value })} placeholder="Nome exato do arquivo"/></label><label><span>Equipe / line de destino</span><select value={newLink.campeonato_equipe_id} onChange={event => setNewLink({ ...newLink, campeonato_equipe_id: event.target.value })}><option value="">Selecione...</option>{data.slots.filter(slot => !slot.slot_vazio).map(slot => <option key={slot.campeonato_equipe_id} value={slot.campeonato_equipe_id}>{slot.equipe_nome} · {slot.grupo_nome} S{slot.slot_numero}</option>)}</select></label><button className="button" onClick={() => void saveLink()} disabled={saving}><Link2 size={15}/> Salvar vínculo</button></div><div className="scorer-link-list">{data.vinculos_matchresult.map(link => { const slot = data.slots.find(item => item.campeonato_equipe_id === link.campeonato_equipe_id); return <article key={link.id}><span>{link.nome_raw}</span><strong>{slot?.equipe_nome || 'Equipe não encontrada'}</strong><small>{slot ? `${slot.grupo_nome} · Slot ${slot.slot_numero}` : ''}</small></article> })}{!data.vinculos_matchresult.length ? <p className="empty">Nenhum vínculo salvo neste jogo.</p> : null}</div></section> : null}
  </main>
}
