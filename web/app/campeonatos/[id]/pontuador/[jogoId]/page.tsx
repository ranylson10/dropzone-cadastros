'use client'

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, FileUp, Loader2, RefreshCcw, Save, Trophy, Users, X } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'

type Row = Record<string, any>
type Scope = 'geral' | 'jogo' | 'mapa'
type View = 'equipes' | 'mvp'
type TeamEdit = { posicao: string; abates: string; punicao: string; motivo: string; jogadores: Record<string, string> }
type PontuadorData = {
  campeonato: { id: string; nome: string; logo_url?: string | null; campeonato_configuracoes?: Row[] | Row | null }
  fase?: Row | null; rodada?: Row | null; jogo: Row
  partidas: Row[]; slots: Row[]; matriz: Row[]; jogadores: Row[]; resultados_jogadores: Row[]
  classificacao_geral: Row[]; classificacao_jogo: Row[]; classificacao_mapas: Record<string, Row[]>
  mvp_geral: Row[]; mvp_jogo: Row[]; vinculos_matchresult: Row[]
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    const returnTo = `${window.location.pathname}${window.location.search}`
    window.location.replace(`/login?profileType=produtora&returnTo=${encodeURIComponent(returnTo)}`)
    throw new Error('Redirecionando para o login...')
  }
  const response = await fetch(url, {
    ...options, cache: 'no-store',
    headers: { ...(options?.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token}`, ...(options?.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.')
  return payload as T
}

const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0
const playerId = (row: Row) => String(row.campeonato_jogador_id || row.id || '')

export default function PontuadorJogoPage() {
  const params = useParams<{ id: string; jogoId: string }>()
  const router = useRouter()
  const [data, setData] = useState<PontuadorData | null>(null)
  const [selectedDropId, setSelectedDropId] = useState('')
  const [scope, setScope] = useState<Scope>('geral')
  const [view, setView] = useState<View>('equipes')
  const [selectedMap, setSelectedMap] = useState('')
  const [edits, setEdits] = useState<Record<string, TeamEdit>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [matchName, setMatchName] = useState('')
  const [matchContent, setMatchContent] = useState('')
  const [preview, setPreview] = useState<Row | null>(null)
  const [previewLinks, setPreviewLinks] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await request<PontuadorData>(`/api/campeonatos/${params.id}/pontuador/${params.jogoId}`)
      setData(result)
      setSelectedDropId(current => current || result.partidas[0]?.id || '')
      setSelectedMap(current => current || result.partidas[0]?.mapa_codigo || '')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro ao carregar pontuador.') }
    finally { setLoading(false) }
  }, [params.id, params.jogoId])

  useEffect(() => { void load() }, [load])

  const selectedDrop = data?.partidas.find(drop => drop.id === selectedDropId)
  const playersByTeam = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const player of data?.jogadores || []) {
      const list = map.get(player.campeonato_equipe_id) || []
      list.push(player); map.set(player.campeonato_equipe_id, list)
    }
    return map
  }, [data?.jogadores])

  const config = useMemo(() => {
    const raw = data?.campeonato.campeonato_configuracoes
    const value = Array.isArray(raw) ? raw[0] : raw
    return { colocacoes: value?.pontos_colocacao || [12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0], porAbate: number(value?.pontos_por_abate || 1) }
  }, [data?.campeonato.campeonato_configuracoes])

  useEffect(() => {
    if (!data || !selectedDropId) return
    const next: Record<string, TeamEdit> = {}
    for (const slot of data.slots.filter(item => !item.slot_vazio && item.campeonato_equipe_id)) {
      const current = data.matriz.find(row => row.partida_id === selectedDropId && row.campeonato_equipe_id === slot.campeonato_equipe_id)
      const jogadores: Record<string, string> = {}
      for (const player of playersByTeam.get(slot.campeonato_equipe_id) || []) {
        const result = data.resultados_jogadores.find(row => row.partida_id === selectedDropId && row.campeonato_jogador_id === playerId(player))
        jogadores[playerId(player)] = result ? String(result.abates || 0) : ''
      }
      next[slot.campeonato_equipe_id] = {
        posicao: current?.resultado_id ? String(current.posicao || '') : '',
        abates: current?.resultado_id ? String(current.abates || 0) : '',
        punicao: current?.resultado_id && number(current.punicao_pontos) ? String(current.punicao_pontos) : '',
        motivo: current?.punicao_motivo || '', jogadores,
      }
    }
    setEdits(next)
  }, [data, selectedDropId, playersByTeam])

  const ranking = useMemo(() => {
    if (!data) return []
    if (scope === 'jogo') return data.classificacao_jogo
    if (scope === 'mapa') return data.classificacao_mapas?.[selectedMap] || []
    return data.classificacao_geral
  }, [data, scope, selectedMap])

  function patchTeam(id: string, patch: Partial<TeamEdit>) {
    setEdits(current => ({ ...current, [id]: { ...(current[id] || { posicao: '', abates: '', punicao: '', motivo: '', jogadores: {} }), ...patch } }))
  }

  function patchPlayer(teamId: string, id: string, value: string) {
    const previous = edits[teamId] || { posicao: '', abates: '', punicao: '', motivo: '', jogadores: {} }
    const jogadores = { ...previous.jogadores, [id]: value }
    patchTeam(teamId, { jogadores, abates: String(Object.values(jogadores).reduce((sum, kills) => sum + number(kills), 0)) })
  }

  function dropPoints(edit?: TeamEdit) {
    if (!edit?.posicao) return 0
    return number(config.colocacoes[number(edit.posicao) - 1]) + number(edit.abates) * config.porAbate + Math.min(number(edit.punicao), 0)
  }

  async function saveDrop() {
    if (!data || !selectedDropId) return
    const equipes = data.slots.filter(slot => !slot.slot_vazio && edits[slot.campeonato_equipe_id]?.posicao).map(slot => {
      const edit = edits[slot.campeonato_equipe_id]
      return {
        campeonato_equipe_id: slot.campeonato_equipe_id, posicao: number(edit.posicao), abates: number(edit.abates),
        punicao_pontos: Math.min(number(edit.punicao), 0), punicao_motivo: edit.motivo,
        jogadores: (playersByTeam.get(slot.campeonato_equipe_id) || []).map(player => ({ campeonato_jogador_id: playerId(player), abates: number(edit.jogadores[playerId(player)]) })),
      }
    })
    if (!equipes.length) return setError('Preencha a posição de pelo menos uma equipe.')
    setSaving(true); setError(''); setNotice('')
    try {
      await request(`/api/campeonatos/${params.id}/sumula/manual`, { method: 'POST', body: JSON.stringify({ partida_id: selectedDropId, equipes }) })
      setNotice(`Q${selectedDrop?.numero_partida} salva. Ranking e totais atualizados.`); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro ao salvar a queda.') }
    finally { setSaving(false) }
  }

  async function previewFile(file: File) {
    const content = await file.text()
    setMatchName(file.name); setMatchContent(content); setSaving(true); setError('')
    try {
      const result = await request<{ preview: Row }>(`/api/campeonatos/${params.id}/sumula/matchresult/preview`, { method: 'POST', body: JSON.stringify({ partida_id: selectedDropId, conteudo_bruto: content }) })
      setPreview(result.preview)
      const links = Object.fromEntries((result.preview.equipes || []).map((team: Row) => [team.nome_normalizado, team.campeonato_equipe_id || '']))
      setPreviewLinks(links)
      setEdits(current => {
        const next = { ...current }
        for (const team of result.preview.equipes || []) {
          const teamId = links[team.nome_normalizado]
          if (!teamId) continue
          next[teamId] = { ...(next[teamId] || { punicao: '', motivo: '', jogadores: {} }), posicao: String(team.posicao), abates: String(team.abates) }
        }
        return next
      })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro ao ler Match Result.') }
    finally { setSaving(false) }
  }

  async function readMatchFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (file) await previewFile(file)
  }

  function linkForTeam(teamId: string) {
    return (preview?.equipes || []).find((team: Row) => previewLinks[team.nome_normalizado] === teamId)?.nome_normalizado || ''
  }

  function setTeamLink(teamId: string, rawNormalized: string) {
    setPreviewLinks(current => {
      const next = Object.fromEntries(Object.entries(current).map(([raw, linked]) => [raw, linked === teamId ? '' : linked]))
      if (rawNormalized) next[rawNormalized] = teamId
      return next
    })
    const team = (preview?.equipes || []).find((item: Row) => item.nome_normalizado === rawNormalized)
    if (team) patchTeam(teamId, { posicao: String(team.posicao), abates: String(team.abates) })
  }

  function patchPreviewPlayer(teamName: string, order: number, patch: Row) {
    const currentTeam = (preview?.equipes || []).find((team: Row) => team.nome_normalizado === teamName)
    const nextPlayers = (currentTeam?.jogadores || []).map((player: Row) => player.ordem === order ? { ...player, ...patch } : player)
    const linkedTeamId = previewLinks[teamName]
    if (linkedTeamId) patchTeam(linkedTeamId, { abates: String(nextPlayers.reduce((sum: number, player: Row) => sum + number(player.abates), 0)) })
    setPreview((current: Row | null) => current ? {
      ...current,
      equipes: current.equipes.map((team: Row) => team.nome_normalizado !== teamName ? team : {
        ...team,
        jogadores: team.jogadores.map((player: Row) => player.ordem === order ? { ...player, ...patch } : player),
      }),
    } : current)
  }

  async function confirmMatch() {
    if (!preview) return
    const missing = preview.equipes.find((team: Row) => !previewLinks[team.nome_normalizado])
    if (missing) return setError(`Vincule "${missing.nome}" antes de confirmar.`)
    setSaving(true); setError('')
    try {
      await request(`/api/campeonatos/${params.id}/sumula/matchresult/confirmar`, { method: 'POST', body: JSON.stringify({ partida_id: selectedDropId, nome_arquivo: matchName, conteudo_bruto: matchContent, equipes: preview.equipes.map((team: Row) => {
        const teamId = previewLinks[team.nome_normalizado]
        const edit = edits[teamId]
        return { nome: team.nome, campeonato_equipe_id: teamId, posicao: number(edit?.posicao || team.posicao), abates: number(edit?.abates || team.abates), punicao_pontos: Math.min(number(edit?.punicao), 0), punicao_motivo: edit?.motivo || '', jogadores: team.jogadores.map((player: Row) => ({ ordem: player.ordem, nick: player.nick, id_jogo: player.id_jogo, abates: player.abates })) }
      }) }) })
      setPreview(null); setMatchContent(''); setMatchName(''); setNotice('Match Result confirmado e queda pontuada.'); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro ao confirmar Match Result.') }
    finally { setSaving(false) }
  }

  if (loading && !data) return <main className="fullscreen-scorer-state"><Loader2 className="spin"/> Carregando pontuador...</main>
  if (error && !data) return <main className="fullscreen-scorer-state error"><strong>{error}</strong><button className="button secondary" onClick={() => void load()}>Tentar novamente</button></main>
  if (!data) return null

  const maps = Array.from(new Map(data.partidas.map(drop => [drop.mapa_codigo, drop.mapa_nome || drop.mapa])).entries()).filter(([code]) => code)

  return <main className="scorer-workspace scorer-sheet-workspace">
    <header className="scorer-workspace-header">
      <div className="scorer-brand"><button className="icon-button" onClick={() => router.back()} aria-label="Voltar"><ArrowLeft size={18}/></button>{data.campeonato.logo_url ? <img src={data.campeonato.logo_url} alt=""/> : null}<div><p>{data.fase?.nome || 'Fase'}</p><h1>{data.jogo.nome}</h1><small>{data.campeonato.nome} · {data.slots.length} slots</small></div></div>
      <div className="scorer-header-actions"><label className="button secondary scorer-file-button"><FileUp size={15}/> Match Result<input type="file" accept=".txt,.log,text/plain" onChange={readMatchFile}/></label><button className="button secondary" onClick={() => void load()} disabled={loading}><RefreshCcw size={15}/> Atualizar</button><button className="button" onClick={() => void saveDrop()} disabled={saving || selectedDrop?.status === 'finalizada'}>{saving ? <Loader2 className="spin" size={15}/> : <Save size={15}/>} Salvar Q{selectedDrop?.numero_partida}</button></div>
    </header>

    <section className="scorer-sheet-toolbar">
      <div className="scorer-view-switch"><button className={view === 'equipes' ? 'active' : ''} onClick={() => setView('equipes')}><Trophy size={14}/> Equipes</button><button className={view === 'mvp' ? 'active' : ''} onClick={() => setView('mvp')}><Users size={14}/> MVP</button></div>
      <div className="scorer-scope-switch"><button className={scope === 'geral' ? 'active' : ''} onClick={() => setScope('geral')}>Geral</button><button className={scope === 'jogo' ? 'active' : ''} onClick={() => setScope('jogo')}>Jogo</button><button className={scope === 'mapa' ? 'active' : ''} onClick={() => setScope('mapa')}>Mapa</button>{scope === 'mapa' ? <select value={selectedMap} onChange={event => setSelectedMap(event.target.value)}>{maps.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select> : null}</div>
      <div className="scorer-drop-tabs">{data.partidas.map(drop => <button key={drop.id} className={selectedDropId === drop.id ? 'active' : ''} onClick={() => setSelectedDropId(drop.id)}>Q{drop.numero_partida}<small>{drop.mapa_nome || drop.mapa}</small></button>)}</div>
    </section>

    {error ? <div className="scorer-feedback error">{error}<button onClick={() => setError('')}><X size={14}/></button></div> : null}
    {notice ? <div className="scorer-feedback success">{notice}<button onClick={() => setNotice('')}><X size={14}/></button></div> : null}
    {preview ? <><div className="scorer-match-strip"><span><strong>{matchName}</strong><small>{preview.equipes.length} equipes · vincule, revise os jogadores e confirme</small></span><button className="button secondary" onClick={() => { setPreview(null); setMatchContent('') }}>Cancelar</button><button className="button" onClick={() => void confirmMatch()} disabled={saving}>Confirmar Match Result</button></div><section className="match-player-review">{preview.equipes.map((team: Row) => <article key={team.nome_normalizado}><header><strong>{team.nome}</strong><span>{team.posicao}º · {team.abates} abates</span></header>{team.jogadores.map((player: Row) => { const editable = player.status_vinculo !== 'oficial'; return <div key={player.ordem}><span className={`player-link-state ${player.status_vinculo}`}>{player.status_vinculo === 'oficial' ? 'Oficial' : player.status_vinculo === 'temporario' ? 'Temporário' : 'Novo temporário'}</span><input value={player.nick} disabled={!editable} onChange={event => patchPreviewPlayer(team.nome_normalizado, player.ordem, { nick: event.target.value })}/><input value={player.id_jogo} disabled={!editable} onChange={event => patchPreviewPlayer(team.nome_normalizado, player.ordem, { id_jogo: event.target.value })}/><input className="player-kills-input" type="number" min="0" value={player.abates} onChange={event => patchPreviewPlayer(team.nome_normalizado, player.ordem, { abates: number(event.target.value) })}/></div>})}</article>)}</section></> : null}

    {view === 'equipes' ? <div className="scorer-edit-table-wrap scorer-sheet-table-wrap"><table className="scorer-edit-table scorer-sheet-table"><thead><tr><th>#</th><th>Equipe</th><th>Grupo</th><th>Q</th><th>B</th><th>K</th><th>Pts</th><th>Vínculo</th><th>Pos.</th><th>Abates</th><th>Pts Q</th><th>Punição</th></tr></thead><tbody>{data.slots.filter(slot => !slot.slot_vazio).map(slot => {
      const id = slot.campeonato_equipe_id; const stats = ranking.find(row => row.campeonato_equipe_id === id); const edit = edits[id]; const savedLinks = data.vinculos_matchresult.filter(link => link.campeonato_equipe_id === id)
      return <tr key={`${slot.grupo_id}:${slot.slot_numero}`}><td className="rank-cell">{stats?.colocacao || '—'}</td><td><div className="scorer-team">{slot.equipe_logo_url ? <img src={slot.equipe_logo_url} alt=""/> : <span/>}<div><strong>{slot.equipe_nome}</strong><small>{slot.equipe_tag}</small></div></div></td><td>{slot.grupo_nome}</td><td>{stats?.quedas || stats?.quedas_jogadas || 0}</td><td>{stats?.booyahs || 0}</td><td>{stats?.abates || 0}</td><td className="score-total">{stats?.pontos_total || 0}</td><td>{preview ? <select className="inline-link-select" value={linkForTeam(id)} onChange={event => setTeamLink(id, event.target.value)}><option value="">Selecionar...</option>{preview.equipes.map((team: Row) => <option key={team.nome_normalizado} value={team.nome_normalizado}>{team.nome}</option>)}</select> : savedLinks.length ? savedLinks.map(link => <span className="link-chip" key={link.id}>{link.nome_raw}</span>) : <em>Match Result</em>}</td><td><input type="number" min="1" value={edit?.posicao || ''} onChange={event => patchTeam(id, { posicao: event.target.value })}/></td><td><input type="number" min="0" value={edit?.abates || ''} onChange={event => patchTeam(id, { abates: event.target.value })}/></td><td className="drop-points-cell">{dropPoints(edit)}</td><td><div className="penalty-cell"><input className="penalty-input" type="number" max="0" value={edit?.punicao || ''} onChange={event => patchTeam(id, { punicao: String(Math.min(number(event.target.value), 0)) })} placeholder="-0"/>{number(edit?.punicao) < 0 ? <input className="penalty-reason-inline" value={edit?.motivo || ''} onChange={event => patchTeam(id, { motivo: event.target.value })} placeholder="Informar motivo"/> : null}</div></td></tr>
    })}</tbody></table></div> : null}

    {view === 'mvp' ? <div className="scorer-edit-table-wrap"><table className="scorer-edit-table"><thead><tr><th>Equipe</th><th>Jogador</th><th>ID</th><th>Abates Q{selectedDrop?.numero_partida}</th><th>Abates jogo</th><th>Abates geral</th></tr></thead><tbody>{data.slots.filter(slot => !slot.slot_vazio).flatMap(slot => (playersByTeam.get(slot.campeonato_equipe_id) || []).map(player => { const id = playerId(player); const game = data.mvp_jogo.find(row => row.campeonato_jogador_id === id); const general = data.mvp_geral.find(row => row.campeonato_jogador_id === id); return <tr key={`${slot.campeonato_equipe_id}:${id}`}><td><strong>{slot.equipe_nome}</strong></td><td><strong>{player.nick || 'Jogador'}</strong></td><td>{player.id_jogo || '—'}</td><td><input type="number" min="0" value={edits[slot.campeonato_equipe_id]?.jogadores[id] || ''} onChange={event => patchPlayer(slot.campeonato_equipe_id, id, event.target.value)}/></td><td>{game?.abates || 0}</td><td className="score-total">{general?.abates || 0}</td></tr> }))}{!data.jogadores.length ? <tr><td colSpan={6} className="empty">Nenhum jogador escalado. O Match Result pode criar jogadores temporários.</td></tr> : null}</tbody></table></div> : null}
  </main>
}
