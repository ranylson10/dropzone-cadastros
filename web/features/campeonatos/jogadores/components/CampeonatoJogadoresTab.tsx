'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Shield, UserRound, Users } from 'lucide-react'
import { useCampeonatoJogadores } from '../hooks/useCampeonatoJogadores'
import type { StatusEscalacao } from '../types/campeonato-jogadores.types'

type Filtro = 'todas' | StatusEscalacao

const FILTROS: Array<{ value: Filtro; label: string }> = [
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
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [abertaId, setAbertaId] = useState<string | null>(null)

  const resumo = useMemo(() => {
    const itens = data?.participacoes || []
    return {
      total: itens.length,
      pendente: itens.filter((item) => item.status_escalacao === 'pendente').length,
      parcial: itens.filter((item) => item.status_escalacao === 'parcial').length,
      completa: itens.filter((item) => item.status_escalacao === 'completa').length,
      jogadores: itens.reduce((total, item) => total + item.quantidade_jogadores, 0),
    }
  }, [data])

  const participacoes = useMemo(() => {
    const itens = data?.participacoes || []
    return filtro === 'todas' ? itens : itens.filter((item) => item.status_escalacao === filtro)
  }, [data, filtro])

  if (loading) return <div className="teams-tab-loading"><Loader2 className="spin" /> Carregando escalações...</div>
  if (error) return <div className="teams-tab-error">{error}<button className="button secondary" onClick={reload}>Tentar novamente</button></div>
  if (!data) return null

  return (
    <section className="championship-players-tab compact">
      <div className="teams-compact-toolbar">
        <div className="teams-status-filters" role="tablist" aria-label="Filtrar escalações">
          {FILTROS.map((item) => {
            const quantidade = item.value === 'todas' ? resumo.total : resumo[item.value]
            return (
              <button key={item.value} type="button" className={filtro === item.value ? 'active' : ''} onClick={() => setFiltro(item.value)}>
                {item.label}<span>{quantidade}</span>
              </button>
            )
          })}
        </div>
        <div className="teams-toolbar-right">
          <div className="teams-mini-stats">
            <span><strong>{resumo.total}</strong> lines</span>
            <span><strong>{resumo.jogadores}</strong> jogadores</span>
          </div>
          <button className="teams-refresh-button" type="button" onClick={reload} title="Atualizar escalações"><RefreshCw size={15} /></button>
        </div>
      </div>

      <div className="championship-vagas-list">
        {participacoes.length === 0 ? <div className="vagas-empty-filter">Nenhuma line encontrada neste filtro.</div> : participacoes.map((participacao) => {
          const aberta = abertaId === participacao.id
          const logo = participacao.line.logo_url || participacao.equipe.logo_url
          return (
            <article className={`championship-vaga-row player-line-row status-${participacao.status_escalacao} ${aberta ? 'is-open' : ''}`} key={participacao.id}>
              <button type="button" className="vaga-row-summary" onClick={() => setAbertaId(aberta ? null : participacao.id)} aria-expanded={aberta}>
                <span className="vaga-row-number">{String(participacao.vaga.numero_vaga).padStart(2, '0')}</span>
                <span className={`vaga-status-pill status-${participacao.status_escalacao}`}>{statusLabel(participacao.status_escalacao)}</span>
                <span className="vaga-row-identity player-line-identity">
                  <span className="tiny-logo">{logo ? <img src={logo} alt="" /> : <Shield size={15} />}</span>
                  <span><strong>{participacao.line.nome}</strong><small>{participacao.equipe.nome}</small></span>
                </span>
                <span className="vaga-row-meta">{participacao.quantidade_jogadores}{participacao.limite_jogadores ? `/${participacao.limite_jogadores}` : ''} jogadores</span>
                <span className="vaga-row-chevron">{aberta ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</span>
              </button>

              {aberta ? (
                <div className="vaga-row-details players-row-details">
                  <div className="vaga-detail-grid">
                    <span><small>Equipe principal</small><strong>{participacao.equipe.nome}</strong></span>
                    <span><small>Line competitiva</small><strong>{participacao.line.nome}</strong></span>
                    <span><small>Vaga</small><strong>{String(participacao.vaga.numero_vaga).padStart(2, '0')}</strong></span>
                    <span><small>Escalação</small><strong>{statusLabel(participacao.status_escalacao)}</strong></span>
                  </div>

                  {participacao.jogadores.length ? (
                    <div className="lineup-player-list">
                      {participacao.jogadores.map((jogador) => (
                        <div className="lineup-player-row" key={`${jogador.origem}-${jogador.id}`}>
                          <span className="lineup-player-avatar">{jogador.foto_url ? <img src={jogador.foto_url} alt="" /> : <UserRound size={16} />}</span>
                          <span><strong>{jogador.nick}</strong><small>{jogador.id_jogo}</small></span>
                          <span>{jogador.funcao}</span>
                          <span>{jogador.localidade || '-'}</span>
                          <span className="vaga-status-pill status-ocupada">{jogador.status}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="vaga-detail-copy"><Users size={17} /><span>Line confirmada, mas ainda sem jogadores escalados. A escalação poderá ser preenchida dentro do prazo do campeonato.</span></div>
                  )}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
