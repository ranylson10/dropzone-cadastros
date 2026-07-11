'use client'

import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Users,
} from 'lucide-react'
import { SystemModal } from '@/components/layout/SystemModal'
import { useCampeonatoEquipes } from '../hooks/useCampeonatoEquipes'
import { campeonatoEquipesService } from '../services/campeonato-equipes.service'
import type { CampeonatoVaga, EquipeBusca } from '../types/campeonato-equipes.types'

type FiltroVaga = 'todas' | 'livre' | 'reservada' | 'ocupada'

const FILTROS: Array<{ value: FiltroVaga; label: string }> = [
  { value: 'todas', label: 'Todas' },
  { value: 'livre', label: 'Livres' },
  { value: 'reservada', label: 'Reservadas' },
  { value: 'ocupada', label: 'Preenchidas' },
]

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function statusLabel(status: CampeonatoVaga['status']) {
  if (status === 'reservada') return 'Reservada'
  if (status === 'ocupada') return 'Preenchida'
  return 'Livre'
}

export function CampeonatoEquipesTab({ campeonatoId }: { campeonatoId: string }) {
  const { data, loading, error, reload } = useCampeonatoEquipes(campeonatoId)
  const [filtro, setFiltro] = useState<FiltroVaga>('todas')
  const [vagaAbertaId, setVagaAbertaId] = useState<string | null>(null)
  const [vagaAlvo, setVagaAlvo] = useState<CampeonatoVaga | null>(null)
  const [modo, setModo] = useState<'adicionar' | 'convite' | null>(null)
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<EquipeBusca[]>([])
  const [equipe, setEquipe] = useState<EquipeBusca | null>(null)
  const [lineId, setLineId] = useState('')
  const [nomeLine, setNomeLine] = useState('')
  const [nomeEquipeConvite, setNomeEquipeConvite] = useState('')
  const [nomeLineConvite, setNomeLineConvite] = useState('')
  const [processando, setProcessando] = useState(false)
  const [feedback, setFeedback] = useState('')

  const stats = useMemo(() => {
    const vagas = data?.vagas || []
    return {
      total: vagas.length,
      livres: vagas.filter((v) => v.status === 'livre').length,
      reservadas: vagas.filter((v) => v.status === 'reservada').length,
      ocupadas: vagas.filter((v) => v.status === 'ocupada').length,
    }
  }, [data])

  const vagasFiltradas = useMemo(() => {
    const vagas = data?.vagas || []
    if (filtro === 'todas') return vagas
    return vagas.filter((vaga) => vaga.status === filtro)
  }, [data, filtro])

  function fechar() {
    setVagaAlvo(null)
    setModo(null)
    setBusca('')
    setResultados([])
    setEquipe(null)
    setLineId('')
    setNomeLine('')
    setNomeEquipeConvite('')
    setNomeLineConvite('')
    setFeedback('')
  }

  function abrirModal(vaga: CampeonatoVaga, proximoModo: 'adicionar' | 'convite') {
    setVagaAlvo(vaga)
    setModo(proximoModo)
    setFeedback('')
  }

  async function pesquisar() {
    if (busca.trim().length < 2) return
    setProcessando(true)
    setFeedback('')
    try {
      const result = await campeonatoEquipesService.buscarEquipes(campeonatoId, busca) as { equipes: EquipeBusca[] }
      setResultados(result.equipes)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro na busca.')
    } finally {
      setProcessando(false)
    }
  }

  async function adicionar() {
    if (!vagaAlvo || !equipe) return
    setProcessando(true)
    setFeedback('')
    try {
      await campeonatoEquipesService.adicionar(campeonatoId, {
        vaga_id: vagaAlvo.id,
        equipe_id: equipe.id,
        line_id: lineId || null,
        nome_line: nomeLine,
      })
      await reload()
      fechar()
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao adicionar.')
    } finally {
      setProcessando(false)
    }
  }

  async function criarConvite() {
    if (!vagaAlvo) return
    setProcessando(true)
    setFeedback('')
    try {
      const result = await campeonatoEquipesService.criarConvite(campeonatoId, {
        vaga_id: vagaAlvo.id,
        equipe_destino_id: equipe?.id || null,
        line_destino_id: lineId || null,
        nome_equipe_reservada: equipe?.nome || nomeEquipeConvite,
        nome_line_reservada: lineId
          ? equipe?.lines.find((line) => line.id === lineId)?.nome
          : nomeLineConvite,
      }) as { link: string }
      await navigator.clipboard.writeText(result.link)
      setFeedback('Convite criado e link copiado.')
      await reload()
      setTimeout(fechar, 900)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao criar convite.')
    } finally {
      setProcessando(false)
    }
  }

  async function copiarConvite(vaga: CampeonatoVaga) {
    const convite = vaga.convite
    if (!convite) return
    const link = `${window.location.origin}/convite/equipe/${convite.token}`
    const texto = `Você recebeu um convite para participar do campeonato ${data?.campeonato.nome}.\n\nVaga reservada: ${String(vaga.numero_vaga).padStart(2, '0')}\nEquipe: ${vaga.nome_equipe_reservada}\nLine: ${vaga.nome_line_reservada}\nValidade: 24 horas.\n\nAcesse: ${link}`
    await navigator.clipboard.writeText(texto)
    setFeedback('Mensagem completa copiada.')
  }

  async function renovar(vaga: CampeonatoVaga) {
    if (!vaga.convite) return
    setProcessando(true)
    try {
      await campeonatoEquipesService.renovarConvite(campeonatoId, vaga.convite.id)
      await reload()
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao renovar.')
    } finally {
      setProcessando(false)
    }
  }

  async function cancelar(vaga: CampeonatoVaga) {
    if (!vaga.convite || !window.confirm(`Liberar a vaga ${vaga.numero_vaga} e cancelar o convite?`)) return
    setProcessando(true)
    try {
      await campeonatoEquipesService.cancelarConvite(campeonatoId, vaga.convite.id)
      setVagaAbertaId(null)
      await reload()
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao cancelar.')
    } finally {
      setProcessando(false)
    }
  }

  async function remover(vaga: CampeonatoVaga) {
    const id = vaga.campeonato_equipe?.id
    if (!id || !window.confirm(`Remover ${vaga.campeonato_equipe?.nome_exibicao || 'esta equipe'} e liberar a vaga?`)) return
    setProcessando(true)
    try {
      await campeonatoEquipesService.remover(campeonatoId, id)
      setVagaAbertaId(null)
      await reload()
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao remover.')
    } finally {
      setProcessando(false)
    }
  }

  if (loading) {
    return <div className="teams-tab-loading"><Loader2 className="spin" /> Carregando vagas...</div>
  }

  if (error) {
    return (
      <div className="teams-tab-error">
        {error}
        <button className="button secondary" onClick={reload}>Tentar novamente</button>
      </div>
    )
  }

  if (!data) return null

  return (
    <section className="championship-teams-tab compact">
      <div className="teams-compact-toolbar">
        <div className="teams-status-filters" role="tablist" aria-label="Filtrar vagas">
          {FILTROS.map((item) => {
            const quantidade = item.value === 'todas'
              ? stats.total
              : item.value === 'livre'
                ? stats.livres
                : item.value === 'reservada'
                  ? stats.reservadas
                  : stats.ocupadas

            return (
              <button
                key={item.value}
                type="button"
                className={filtro === item.value ? 'active' : ''}
                onClick={() => setFiltro(item.value)}
                role="tab"
                aria-selected={filtro === item.value}
              >
                {item.label}
                <span>{quantidade}</span>
              </button>
            )
          })}
        </div>

        <div className="teams-toolbar-right">
          <div className="teams-mini-stats" aria-label="Resumo das vagas">
            <span><strong>{stats.total}</strong> total</span>
            <span className="is-free"><strong>{stats.livres}</strong> livres</span>
            <span className="is-reserved"><strong>{stats.reservadas}</strong> reservadas</span>
            <span className="is-filled"><strong>{stats.ocupadas}</strong> preenchidas</span>
          </div>
          <button className="teams-refresh-button" type="button" onClick={reload} title="Atualizar vagas" aria-label="Atualizar vagas">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {!data.permission.canManage ? (
        <div className="permission-note compact-note">
          <Shield size={16} />
          <div>
            <strong>Modo de visualização</strong>
            <p>Somente o dono e managers autorizados podem alterar as vagas.</p>
          </div>
        </div>
      ) : null}

      {feedback ? <div className="teams-feedback">{feedback}</div> : null}

      <div className="championship-vagas-list">
        {vagasFiltradas.length === 0 ? (
          <div className="vagas-empty-filter">Nenhuma vaga encontrada neste filtro.</div>
        ) : vagasFiltradas.map((vaga) => {
          const aberta = vagaAbertaId === vaga.id
          const nomePrincipal = vaga.status === 'reservada'
            ? vaga.nome_line_reservada || vaga.nome_equipe_reservada || 'Convite reservado'
            : vaga.status === 'ocupada'
              ? vaga.campeonato_equipe?.nome_exibicao || vaga.campeonato_equipe?.line?.nome || vaga.campeonato_equipe?.equipe?.nome || 'Equipe inscrita'
              : 'Sem equipe'
          const detalhe = vaga.status === 'reservada'
            ? vaga.nome_equipe_reservada || 'Equipe não vinculada'
            : vaga.status === 'ocupada'
              ? vaga.campeonato_equipe?.equipe?.nome || 'Equipe principal'
              : 'Disponível para equipe ou convite'

          return (
            <article className={`championship-vaga-row status-${vaga.status} ${aberta ? 'is-open' : ''}`} key={vaga.id}>
              <button
                type="button"
                className="vaga-row-summary"
                onClick={() => setVagaAbertaId(aberta ? null : vaga.id)}
                aria-expanded={aberta}
              >
                <span className="vaga-row-number">{String(vaga.numero_vaga).padStart(2, '0')}</span>
                <span className={`vaga-status-pill status-${vaga.status}`}>{statusLabel(vaga.status)}</span>
                <span className="vaga-row-identity">
                  <strong>{nomePrincipal}</strong>
                  <small>{detalhe}</small>
                </span>
                <span className="vaga-row-meta">
                  {vaga.status === 'reservada' ? `Expira ${formatDate(vaga.reserva_expira_em)}` : null}
                  {vaga.status === 'ocupada' ? `Entrada: ${vaga.campeonato_equipe?.origem_entrada || '-'}` : null}
                  {vaga.status === 'livre' ? 'Disponível' : null}
                </span>
                <span className="vaga-row-chevron">{aberta ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</span>
              </button>

              {aberta ? (
                <div className="vaga-row-details">
                  {vaga.status === 'livre' ? (
                    <div className="vaga-detail-copy">
                      <strong>Vaga disponível</strong>
                      <span>Adicione uma equipe cadastrada ou reserve a vaga por convite.</span>
                    </div>
                  ) : null}

                  {vaga.status === 'reservada' ? (
                    <div className="vaga-detail-grid">
                      <span><small>Equipe prevista</small><strong>{vaga.nome_equipe_reservada || '-'}</strong></span>
                      <span><small>Line prevista</small><strong>{vaga.nome_line_reservada || '-'}</strong></span>
                      <span><small>Validade</small><strong>{formatDate(vaga.reserva_expira_em)}</strong></span>
                    </div>
                  ) : null}

                  {vaga.status === 'ocupada' ? (
                    <div className="vaga-detail-team">
                      <span className="vaga-team-logo compact-logo">
                        {vaga.campeonato_equipe?.line?.logo_url || vaga.campeonato_equipe?.equipe?.logo_url
                          ? <img src={vaga.campeonato_equipe.line?.logo_url || vaga.campeonato_equipe.equipe?.logo_url || ''} alt="" />
                          : <Users size={18} />}
                      </span>
                      <div>
                        <small>Participação competitiva</small>
                        <strong>{nomePrincipal}</strong>
                        <span>{detalhe}</span>
                      </div>
                    </div>
                  ) : null}

                  {data.permission.canManage ? (
                    <div className="vaga-row-actions">
                      {vaga.status === 'livre' ? (
                        <>
                          <button type="button" onClick={() => abrirModal(vaga, 'adicionar')}><Search size={14} /> Adicionar equipe</button>
                          {data.permission.canGenerateToken ? (
                            <button type="button" onClick={() => abrirModal(vaga, 'convite')}><Link2 size={14} /> Criar convite</button>
                          ) : null}
                        </>
                      ) : null}

                      {vaga.status === 'reservada' && data.permission.canGenerateToken ? (
                        <>
                          <button type="button" onClick={() => void copiarConvite(vaga)}><Copy size={14} /> Copiar convite</button>
                          <button type="button" onClick={() => void renovar(vaga)}><RefreshCw size={14} /> Renovar 24h</button>
                          <button type="button" className="danger" onClick={() => void cancelar(vaga)}><Trash2 size={14} /> Cancelar reserva</button>
                        </>
                      ) : null}

                      {vaga.status === 'ocupada' ? (
                        <button type="button" className="danger" onClick={() => void remover(vaga)}><Trash2 size={14} /> Remover e liberar vaga</button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>

      <SystemModal
        open={Boolean(vagaAlvo && modo)}
        title={modo === 'adicionar' ? `Adicionar equipe à vaga ${vagaAlvo?.numero_vaga}` : `Reservar vaga ${vagaAlvo?.numero_vaga} por convite`}
        description={modo === 'adicionar' ? 'Pesquise uma equipe e escolha ou crie uma line.' : 'Identifique a equipe e a line para impedir confusão entre managers.'}
        onClose={fechar}
        size="wide"
      >
        <div className="team-slot-modal">
          <div className="team-search-row">
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void pesquisar() }}
              placeholder="Buscar equipe por nome ou tag"
            />
            <button className="button secondary" onClick={pesquisar} disabled={processando}>
              <Search size={15} /> Pesquisar
            </button>
          </div>

          {resultados.length ? (
            <div className="team-search-results">
              {resultados.map((item) => (
                <button
                  className={equipe?.id === item.id ? 'selected' : ''}
                  key={item.id}
                  onClick={() => {
                    setEquipe(item)
                    setNomeEquipeConvite(item.nome)
                    setLineId('')
                    setNomeLine('')
                    setNomeLineConvite('')
                  }}
                >
                  <span>{item.logo_url ? <img src={item.logo_url} alt="" /> : <Users size={18} />}</span>
                  <strong>{item.nome}</strong>
                  <small>{item.tag || 'Sem tag'}</small>
                </button>
              ))}
            </div>
          ) : null}

          {modo === 'convite' && !equipe ? (
            <label className="field">
              <span>Nome da equipe reservada</span>
              <input value={nomeEquipeConvite} onChange={(event) => setNomeEquipeConvite(event.target.value)} placeholder="Ex.: ALOE GAMING" />
            </label>
          ) : null}

          {equipe ? (
            <div className="selected-team-box">
              <strong>Equipe selecionada: {equipe.nome}</strong>
              {equipe.lines.length ? (
                <label className="field">
                  <span>Line existente</span>
                  <select
                    value={lineId}
                    onChange={(event) => {
                      setLineId(event.target.value)
                      setNomeLine('')
                      setNomeLineConvite('')
                    }}
                  >
                    <option value="">Criar/identificar nova line</option>
                    {equipe.lines.map((line) => (
                      <option key={line.id} value={line.id} disabled={line.ja_inscrita}>
                        {line.nome}{line.ja_inscrita ? ` — já inscrita${line.vaga_numero ? ` na vaga ${String(line.vaga_numero).padStart(2, '0')}` : ''}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              ) : <p>Esta equipe ainda não possui lines. Informe abaixo o nome da primeira line para continuar.</p>}
            </div>
          ) : null}

          {!lineId ? (
            <label className="field">
              <span>{modo === 'adicionar' ? 'Nome da nova line' : 'Nome da line reservada'}</span>
              <input
                value={modo === 'adicionar' ? nomeLine : nomeLineConvite}
                onChange={(event) => modo === 'adicionar' ? setNomeLine(event.target.value) : setNomeLineConvite(event.target.value)}
                placeholder="Ex.: ALOE ELITE"
              />
            </label>
          ) : null}

          {feedback ? <div className="teams-feedback">{feedback}</div> : null}
          <div className="modal-form-actions">
            <button className="button secondary" onClick={fechar}>Cancelar</button>
            <button className="button" onClick={modo === 'adicionar' ? adicionar : criarConvite} disabled={processando}>
              {processando ? <Loader2 className="spin" size={15} /> : null}
              {modo === 'adicionar' ? 'Adicionar equipe' : 'Gerar e copiar convite'}
            </button>
          </div>
        </div>
      </SystemModal>
    </section>
  )
}
