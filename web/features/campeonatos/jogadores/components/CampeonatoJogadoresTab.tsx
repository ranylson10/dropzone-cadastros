'use client'

import { useMemo, useState } from 'react'
import { Loader2, RefreshCw, UserRound, Users } from 'lucide-react'
import { useCampeonatoJogadores } from '../hooks/useCampeonatoJogadores'
import type { JogadorEscalado, ParticipacaoJogadores, StatusEscalacao } from '../types/campeonato-jogadores.types'

type ViewMode = 'jogadores' | 'lines'
type FiltroStatus = 'todas' | StatusEscalacao

type FlatPlayer = JogadorEscalado & {
  key: string
  line_nome: string
  line_id: string
  equipe_nome: string
  equipe_id: string
  vaga_numero: number
  status_escalacao: StatusEscalacao
  participacao_id: string
}

const STATUS_FILTROS: Array<{ value: FiltroStatus; label: string }> = [
  { value: 'todas', label: 'Todas' },
  { value: 'pendente', label: 'Pendentes' },
  { value: 'parcial', label: 'Parciais' },
  { value: 'completa', label: 'Completas' },
]

function statusLabel(status: StatusEscalacao) {
  if (status === 'completa') return 'Completa'
  if (status === 'parcial') return 'Parcial'
  return 'Pendente'
}

export function CampeonatoJogadoresTab({ campeonatoId }: { campeonatoId: string }) {
  const { data, loading, error, reload } = useCampeonatoJogadores(campeonatoId)
  const [view, setView] = useState<ViewMode>('jogadores')
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todas')
  const [filtroEquipeId, setFiltroEquipeId] = useState('')
  const [filtroLineId, setFiltroLineId] = useState('')
  const [abertaId, setAbertaId] = useState<string | null>(null)

  const participacoesBase = data?.participacoes || []

  const equipesOpts = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of participacoesBase) {
      if (p.equipe?.id) map.set(p.equipe.id, p.equipe.nome)
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [participacoesBase])

  const linesOpts = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of participacoesBase) {
      if (filtroEquipeId && p.equipe?.id !== filtroEquipeId) continue
      if (p.line?.id) map.set(p.line.id, p.line.nome)
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [participacoesBase, filtroEquipeId])

  const participacoes = useMemo(() => {
    return participacoesBase.filter((p) => {
      if (filtroStatus !== 'todas' && p.status_escalacao !== filtroStatus) return false
      if (filtroEquipeId && p.equipe?.id !== filtroEquipeId) return false
      if (filtroLineId && p.line?.id !== filtroLineId) return false
      return true
    })
  }, [participacoesBase, filtroStatus, filtroEquipeId, filtroLineId])

  const players = useMemo(() => {
    const list: FlatPlayer[] = []
    for (const p of participacoes) {
      for (const j of p.jogadores || []) {
        list.push({
          ...j,
          key: `${p.id}-${j.origem}-${j.id}`,
          line_nome: p.line.nome,
          line_id: p.line.id,
          equipe_nome: p.equipe.nome,
          equipe_id: p.equipe.id,
          vaga_numero: p.vaga.numero_vaga,
          status_escalacao: p.status_escalacao,
          participacao_id: p.id,
        })
      }
    }
    return list.sort((a, b) => a.nick.localeCompare(b.nick, 'pt-BR'))
  }, [participacoes])

  const resumo = useMemo(() => {
    const itens = participacoesBase
    return {
      lines: itens.length,
      jogadores: itens.reduce((t, item) => t + item.quantidade_jogadores, 0),
      pendente: itens.filter((i) => i.status_escalacao === 'pendente').length,
      parcial: itens.filter((i) => i.status_escalacao === 'parcial').length,
      completa: itens.filter((i) => i.status_escalacao === 'completa').length,
    }
  }, [participacoesBase])

  if (loading) {
    return (
      <div className="teams-tab-loading">
        <Loader2 className="spin" /> Carregando jogadores...
      </div>
    )
  }
  if (error) {
    return (
      <div className="teams-tab-error">
        {error}
        <button className="button secondary" type="button" onClick={reload}>Tentar novamente</button>
      </div>
    )
  }
  if (!data) return null

  return (
    <section className="championship-players-tab compact">
      <div className="teams-compact-toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="teams-status-filters" role="tablist" aria-label="Visão">
          <button type="button" className={view === 'jogadores' ? 'active' : ''} onClick={() => setView('jogadores')}>
            Jogadores <span>{resumo.jogadores}</span>
          </button>
          <button type="button" className={view === 'lines' ? 'active' : ''} onClick={() => setView('lines')}>
            Lines <span>{resumo.lines}</span>
          </button>
        </div>

        <div className="teams-status-filters" role="tablist" aria-label="Status escalação">
          {STATUS_FILTROS.map((item) => {
            const quantidade =
              item.value === 'todas'
                ? resumo.lines
                : item.value === 'pendente'
                  ? resumo.pendente
                  : item.value === 'parcial'
                    ? resumo.parcial
                    : resumo.completa
            return (
              <button
                key={item.value}
                type="button"
                className={filtroStatus === item.value ? 'active' : ''}
                onClick={() => setFiltroStatus(item.value)}
              >
                {item.label}
                <span>{quantidade}</span>
              </button>
            )
          })}
        </div>

        <div className="teams-toolbar-right" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select
            value={filtroEquipeId}
            onChange={(e) => {
              setFiltroEquipeId(e.target.value)
              setFiltroLineId('')
            }}
            aria-label="Filtrar por equipe"
            style={{ minHeight: 34, border: '1px solid #dfe2e7', padding: '0 10px', background: '#fff' }}
          >
            <option value="">Todas as equipes</option>
            {equipesOpts.map(([id, nome]) => (
              <option key={id} value={id}>{nome}</option>
            ))}
          </select>
          <select
            value={filtroLineId}
            onChange={(e) => setFiltroLineId(e.target.value)}
            aria-label="Filtrar por line"
            style={{ minHeight: 34, border: '1px solid #dfe2e7', padding: '0 10px', background: '#fff' }}
          >
            <option value="">Todas as lines</option>
            {linesOpts.map(([id, nome]) => (
              <option key={id} value={id}>{nome}</option>
            ))}
          </select>
          <button className="teams-refresh-button" type="button" onClick={reload} title="Atualizar">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {view === 'jogadores' ? (
        <div className="championship-vagas-list">
          {players.length === 0 ? (
            <div className="vagas-empty-filter">Nenhum jogador neste filtro.</div>
          ) : (
            players.map((jogador) => (
              <article key={jogador.key} className="championship-vaga-row status-ocupada">
                <div className="vaga-row-summary" style={{ cursor: 'default', gridTemplateColumns: '42px minmax(160px,1fr) minmax(120px,auto) minmax(90px,auto)' }}>
                  <span className="vaga-row-avatar status-ocupada" aria-hidden>
                    {jogador.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={jogador.foto_url} alt="" />
                    ) : (
                      <UserRound size={18} />
                    )}
                  </span>
                  <span className="vaga-row-identity">
                    <strong>{jogador.nick}</strong>
                    <small>
                      {jogador.id_jogo || '—'}
                      {jogador.funcao ? ` · ${jogador.funcao}` : ''}
                    </small>
                  </span>
                  <span className="vaga-row-identity" style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: 12 }}>{jogador.line_nome}</strong>
                    <small>{jogador.equipe_nome}</small>
                  </span>
                  <span className="vaga-row-meta">
                    <span className={`vaga-status-pill status-${jogador.status_escalacao}`}>
                      {statusLabel(jogador.status_escalacao)}
                    </span>
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="championship-vagas-list">
          {participacoes.length === 0 ? (
            <div className="vagas-empty-filter">Nenhuma line neste filtro.</div>
          ) : (
            participacoes.map((participacao: ParticipacaoJogadores) => {
              const aberta = abertaId === participacao.id
              const logo = participacao.line.logo_url || participacao.equipe.logo_url
              return (
                <article
                  key={participacao.id}
                  className={`championship-vaga-row status-${participacao.status_escalacao === 'completa' ? 'ocupada' : participacao.status_escalacao === 'parcial' ? 'reservada' : 'livre'} ${aberta ? 'is-open' : ''}`}
                >
                  <button
                    type="button"
                    className="vaga-row-summary"
                    onClick={() => setAbertaId(aberta ? null : participacao.id)}
                    aria-expanded={aberta}
                  >
                    <span className="vaga-row-number">{String(participacao.vaga.numero_vaga).padStart(2, '0')}</span>
                    <span className="vaga-row-avatar status-ocupada" aria-hidden>
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt="" />
                      ) : (
                        <Users size={18} />
                      )}
                    </span>
                    <span className="vaga-row-identity">
                      <strong>{participacao.line.nome}</strong>
                      <small>{participacao.equipe.nome}</small>
                    </span>
                    <span className="vaga-row-meta">
                      <span className={`vaga-status-pill status-${participacao.status_escalacao}`}>
                        {statusLabel(participacao.status_escalacao)}
                      </span>
                      {' '}
                      {participacao.quantidade_jogadores}
                      {participacao.limite_jogadores ? `/${participacao.limite_jogadores}` : ''} jog.
                    </span>
                    <span className="vaga-row-chevron" aria-hidden />
                  </button>
                  {aberta ? (
                    <div className="vaga-row-details players-row-details">
                      {participacao.jogadores.length ? (
                        <div className="lineup-player-list">
                          {participacao.jogadores.map((jogador) => (
                            <div className="lineup-player-row" key={`${jogador.origem}-${jogador.id}`}>
                              <span className="lineup-player-avatar">
                                {jogador.foto_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={jogador.foto_url} alt="" />
                                ) : (
                                  <UserRound size={16} />
                                )}
                              </span>
                              <span>
                                <strong>{jogador.nick}</strong>
                                <small>{jogador.id_jogo}</small>
                              </span>
                              <span>{jogador.funcao}</span>
                              <span>{jogador.localidade || '—'}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="vaga-detail-copy">
                          <Users size={17} />
                          <span>Sem jogadores escalados nesta line.</span>
                        </div>
                      )}
                    </div>
                  ) : null}
                </article>
              )
            })
          )}
        </div>
      )}
    </section>
  )
}
