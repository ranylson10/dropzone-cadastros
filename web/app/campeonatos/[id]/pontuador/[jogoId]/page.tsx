'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Loader2, RefreshCcw, Trophy, Users } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'

type PontuadorData = {
  campeonato: { id: string; nome: string; logo_url?: string | null }
  fase?: { id: string; nome: string } | null
  rodada?: { id: string; nome: string; numero: number } | null
  jogo: { id: string; nome: string; data_jogo?: string | null; horario?: string | null; numero_partidas: number }
  partidas: Array<{ id: string; numero_partida: number; mapa_nome?: string | null; mapa?: string | null; status: string }>
  slots: Array<Record<string, any>>
  matriz: Array<Record<string, any>>
  jogadores: Array<Record<string, any>>
  classificacao_geral: Array<Record<string, any>>
  classificacao_jogo: Array<Record<string, any>>
  mvp_geral: Array<Record<string, any>>
  mvp_jogo: Array<Record<string, any>>
  vinculos_matchresult: Array<Record<string, any>>
}

type ViewMode = 'equipes' | 'mvp' | 'vinculos'

async function authenticatedRequest<T>(url: string): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada. Entre novamente.')
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar o pontuador.')
  return payload as T
}

function number(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function PontuadorJogoPage() {
  const params = useParams<{ id: string; jogoId: string }>()
  const router = useRouter()
  const [data, setData] = useState<PontuadorData | null>(null)
  const [view, setView] = useState<ViewMode>('equipes')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await authenticatedRequest<PontuadorData>(`/api/campeonatos/${params.id}/pontuador/${params.jogoId}`)
      setData(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao carregar pontuador.')
    } finally {
      setLoading(false)
    }
  }, [params.id, params.jogoId])

  useEffect(() => { void load() }, [load])

  const matrixBySlot = useMemo(() => {
    const map = new Map<string, Map<string, Record<string, any>>>()
    for (const row of data?.matriz || []) {
      const slotKey = `${row.grupo_id}:${row.slot_numero}`
      const drops = map.get(slotKey) || new Map<string, Record<string, any>>()
      drops.set(row.partida_id, row)
      map.set(slotKey, drops)
    }
    return map
  }, [data?.matriz])

  if (loading) return <main className="fullscreen-scorer-state"><Loader2 className="button-spinner" /> Carregando pontuador...</main>
  if (error || !data) return <main className="fullscreen-scorer-state error"><strong>{error || 'Pontuador não encontrado.'}</strong><button className="button secondary" onClick={() => void load()}>Tentar novamente</button></main>

  return (
    <main className="fullscreen-scorer-page">
      <header className="fullscreen-scorer-header">
        <div className="fullscreen-scorer-title">
          <button className="icon-button" onClick={() => router.back()} aria-label="Voltar"><ArrowLeft size={18} /></button>
          {data.campeonato.logo_url ? <img src={data.campeonato.logo_url} alt="" /> : null}
          <div>
            <p>{data.fase?.nome || 'Fase'}{data.rodada?.nome ? ` · ${data.rodada.nome}` : ''}</p>
            <h1>{data.jogo.nome}</h1>
            <small>{data.campeonato.nome} · {data.jogo.numero_partidas} quedas · {data.slots.length} slots</small>
          </div>
        </div>
        <button className="button secondary" onClick={() => void load()}><RefreshCcw size={15} /> Atualizar</button>
      </header>

      <nav className="fullscreen-scorer-tabs">
        <button className={view === 'equipes' ? 'active' : ''} onClick={() => setView('equipes')}><Trophy size={16} /> Equipes</button>
        <button className={view === 'mvp' ? 'active' : ''} onClick={() => setView('mvp')}><Users size={16} /> MVP</button>
        <button className={view === 'vinculos' ? 'active' : ''} onClick={() => setView('vinculos')}>Vínculos MatchResult</button>
      </nav>

      {view === 'equipes' ? (
        <section className="fullscreen-scorer-table-wrap">
          <table className="fullscreen-scorer-table">
            <thead>
              <tr>
                <th rowSpan={2}>Slot</th><th rowSpan={2}>Grupo</th><th rowSpan={2}>Equipe</th><th rowSpan={2}>Tag</th>
                {data.partidas.map((drop) => <th key={drop.id} colSpan={2}>Q{drop.numero_partida}<small>{drop.mapa_nome || drop.mapa || 'Mapa'}</small></th>)}
                <th rowSpan={2}>Quedas</th><th rowSpan={2}>Faltas</th><th rowSpan={2}>Booyah</th><th rowSpan={2}>Kills</th><th rowSpan={2}>Pontos</th>
              </tr>
              <tr>{data.partidas.map((drop) => <FragmentPair key={drop.id} />)}</tr>
            </thead>
            <tbody>
              {data.slots.map((slot) => {
                const key = `${slot.grupo_id}:${slot.slot_numero}`
                const cells = matrixBySlot.get(key)
                const score = data.classificacao_jogo.find((row) => row.campeonato_equipe_id === slot.campeonato_equipe_id)
                return (
                  <tr key={key} className={slot.slot_vazio ? 'slot-empty' : ''}>
                    <td>{slot.slot_numero}</td><td>{slot.grupo_nome}</td>
                    <td><div className="scorer-team-cell">{slot.equipe_logo_url ? <img src={slot.equipe_logo_url} alt="" /> : <span /> }<strong>{slot.equipe_nome || 'Slot vazio'}</strong></div></td>
                    <td>{slot.equipe_tag || '—'}</td>
                    {data.partidas.map((drop) => {
                      const cell = cells?.get(drop.id)
                      const missing = slot.campeonato_equipe_id && !cell?.resultado_id && cell?.status_presenca !== 'falta'
                      return (
                        <FragmentPair key={drop.id} values={[cell?.status_presenca === 'falta' ? 'F' : (cell?.posicao ?? '—'), cell?.status_presenca === 'falta' ? 0 : (cell?.abates ?? '—')]} warning={Boolean(missing)} />
                      )
                    })}
                    <td>{score?.quedas_jogadas || 0}</td><td>{score?.faltas || 0}</td><td>{score?.booyahs || 0}</td><td>{score?.abates || 0}</td><td className="score-total">{score?.pontos_total || 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {view === 'mvp' ? (
        <section className="fullscreen-scorer-table-wrap"><table className="fullscreen-scorer-table mvp"><thead><tr><th>#</th><th>Jogador</th><th>ID</th><th>Tipo</th><th>Equipe</th><th>Quedas</th><th>Kills</th></tr></thead><tbody>
          {data.mvp_jogo.map((row, index) => <tr key={row.campeonato_jogador_id}><td>{index + 1}</td><td><strong>{row.nick}</strong></td><td>{row.id_jogo || '—'}</td><td>{row.tipo_jogador || '—'}</td><td>{row.equipe_nome || row.nome_exibicao || '—'}</td><td>{row.quedas || 0}</td><td className="score-total">{row.abates || 0}</td></tr>)}
          {!data.mvp_jogo.length ? <tr><td colSpan={7} className="empty">Nenhuma pontuação de jogador registrada.</td></tr> : null}
        </tbody></table></section>
      ) : null}

      {view === 'vinculos' ? (
        <section className="fullscreen-link-grid">
          {data.slots.filter((slot) => !slot.slot_vazio).map((slot) => {
            const links = data.vinculos_matchresult.filter((link) => link.campeonato_equipe_id === slot.campeonato_equipe_id)
            return <article key={slot.campeonato_equipe_id}><div className="scorer-team-cell">{slot.equipe_logo_url ? <img src={slot.equipe_logo_url} alt="" /> : <span />}<div><strong>{slot.equipe_nome}</strong><small>{slot.grupo_nome} · Slot {slot.slot_numero}</small></div></div><div className="fullscreen-link-names">{links.length ? links.map((link) => <span key={link.id}>{link.nome_raw}</span>) : <em>Nenhum nome vinculado</em>}</div></article>
          })}
        </section>
      ) : null}
    </main>
  )
}

function FragmentPair({ values, warning }: { values?: [unknown, unknown]; warning?: boolean }) {
  if (!values) return <><th>Pos.</th><th>Kills</th></>
  return <><td className={warning ? 'missing-link' : ''}>{String(values[0])}</td><td className={warning ? 'missing-link' : ''}>{String(values[1])}</td></>
}
