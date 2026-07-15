'use client'

import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
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
  const [referenciaEquipe, setReferenciaEquipe] = useState('')
  const [referenciaLine, setReferenciaLine] = useState('')
  /** Convite: por padrão o convidado escolhe qualquer slot livre do grupo. */
  const [fixarSlot, setFixarSlot] = useState(false)
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
    setReferenciaEquipe('')
    setReferenciaLine('')
    setFixarSlot(false)
    setFeedback('')
  }

  function abrirModal(vaga: CampeonatoVaga, proximoModo: 'adicionar' | 'convite') {
    setVagaAlvo(vaga)
    setModo(proximoModo)
    setFixarSlot(false)
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
    if (!referenciaEquipe.trim() || !referenciaLine.trim()) {
      setFeedback('Preencha as referências da reserva e da line.')
      return
    }
    setProcessando(true)
    setFeedback('')
    try {
      // Padrão: convite de GRUPO (convidado escolhe letra). Opcional: fixar este slot.
      const body = fixarSlot
        ? {
            slot_id: vagaAlvo.id,
            vaga_id: vagaAlvo.id,
            fixar_slot: true,
            referencia_equipe: referenciaEquipe,
            referencia_line: referenciaLine,
          }
        : {
            grupo_id: vagaAlvo.grupo_id || vagaAlvo.grupo?.id || null,
            fixar_slot: false,
            referencia_equipe: referenciaEquipe,
            referencia_line: referenciaLine,
          }
      if (!fixarSlot && !body.grupo_id) {
        // Sem grupo na vaga: cai no slot fixo
        body.slot_id = vagaAlvo.id
        body.vaga_id = vagaAlvo.id
        body.fixar_slot = true
      }
      const result = await campeonatoEquipesService.criarConvite(campeonatoId, body) as {
        link: string
        modo?: string
      }
      await navigator.clipboard.writeText(result.link)
      setFeedback(
        result.modo === 'grupo'
          ? 'Convite de grupo criado e link copiado. O convidado escolhe o slot livre.'
          : 'Convite do slot criado e link copiado.',
      )
      await reload()
      setTimeout(fechar, 1200)
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
    const slotLabel = vaga.slot_letra || String(vaga.numero_vaga).padStart(2, '0')
    const texto = `Você recebeu um convite para o campeonato ${data?.campeonato.nome}.

Slot: ${slotLabel}${vaga.grupo?.nome ? ` (${vaga.grupo.nome})` : ''}
Referência: ${vaga.nome_equipe_reservada || '-'}
Line informada: ${vaga.nome_line_reservada || '-'}
Validade: 24 horas.

A line é quem joga e pontua. Entre e confirme a line real da sua equipe.

Acesse: ${link}`
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
    if (!vaga.convite || !window.confirm(`Liberar o slot ${vaga.slot_letra || vaga.numero_vaga} e cancelar o convite?`)) return
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
    const label = vaga.line_nome || vaga.campeonato_equipe?.line_nome || vaga.campeonato_equipe?.nome_exibicao || 'esta line'
    if (!id || !window.confirm(`Remover ${label} e liberar o slot ${vaga.slot_letra || vaga.numero_vaga}?`)) return
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
          const letra = vaga.slot_letra || String(vaga.numero_vaga).padStart(2, '0')
          // Unidade competitiva = line; pasta = equipe
          const logoUrl =
            vaga.line_logo_url
            || vaga.campeonato_equipe?.line_logo_url
            || vaga.campeonato_equipe?.line?.logo_url
            || vaga.campeonato_equipe?.equipe?.logo_url
            || null
          const nomePrincipal = vaga.status === 'reservada'
            ? vaga.nome_line_reservada || vaga.nome_equipe_reservada || 'Convite reservado'
            : vaga.status === 'ocupada'
              ? vaga.line_nome
                || vaga.campeonato_equipe?.line_nome
                || vaga.campeonato_equipe?.nome_exibicao
                || vaga.campeonato_equipe?.line?.nome
                || 'Line inscrita'
              : `Slot ${letra}`
          const detalhe = vaga.status === 'reservada'
            ? [
                vaga.nome_equipe_reservada,
                vaga.grupo?.nome,
                `Expira ${formatDate(vaga.reserva_expira_em)}`,
              ].filter(Boolean).join(' · ') || 'Aguardando aceite do convite'
            : vaga.status === 'ocupada'
              ? [
                  vaga.equipe_nome || vaga.campeonato_equipe?.equipe_nome || vaga.campeonato_equipe?.equipe?.nome,
                  vaga.grupo?.nome,
                  vaga.campeonato_equipe?.origem_entrada
                    ? `via ${vaga.campeonato_equipe.origem_entrada}`
                    : null,
                ].filter(Boolean).join(' · ') || 'Line no campeonato'
              : [vaga.fase?.nome, vaga.grupo?.nome].filter(Boolean).join(' · ') || 'Disponível'

          return (
            <article className={`championship-vaga-row status-${vaga.status} ${aberta ? 'is-open' : ''}`} key={vaga.id}>
              <button
                type="button"
                className="vaga-row-summary"
                onClick={() => setVagaAbertaId(aberta ? null : vaga.id)}
                aria-expanded={aberta}
              >
                <span className="vaga-row-number">{letra}</span>

                <span className={`vaga-row-avatar status-${vaga.status}`} aria-hidden>
                  {vaga.status === 'ocupada' && logoUrl ? (
                    <img src={logoUrl} alt="" />
                  ) : vaga.status === 'ocupada' ? (
                    <Users size={18} />
                  ) : vaga.status === 'reservada' ? (
                    <Link2 size={16} />
                  ) : (
                    <span className="vaga-avatar-dot" />
                  )}
                </span>

                <span className="vaga-row-identity">
                  <strong>{nomePrincipal}</strong>
                  <small>{detalhe}</small>
                </span>

                <span className="vaga-row-meta">
                  {vaga.status === 'reservada' ? (
                    <span className="vaga-status-pill status-reservada">Reservada</span>
                  ) : null}
                </span>

                <span className="vaga-row-chevron">{aberta ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</span>
              </button>

              {aberta ? (
                <div className="vaga-row-details">
                  {vaga.status === 'livre' ? (
                    <div className="vaga-detail-copy">
                      <strong>Slot {letra} livre</strong>
                      <span>Pesquise a equipe (pasta), escolha uma line livre ou crie uma nova line para este lugar no grupo.</span>
                    </div>
                  ) : null}

                  {vaga.status === 'reservada' ? (
                    <div className="vaga-detail-grid">
                      <span><small>Referência da reserva</small><strong>{vaga.nome_equipe_reservada || '-'}</strong></span>
                      <span><small>Referência da line</small><strong>{vaga.nome_line_reservada || '-'}</strong></span>
                      <span><small>Validade</small><strong>{formatDate(vaga.reserva_expira_em)}</strong></span>
                    </div>
                  ) : null}

                  {vaga.status === 'ocupada' ? (
                    <div className="vaga-detail-copy">
                      <strong>{nomePrincipal}</strong>
                      <span>{detalhe}</span>
                    </div>
                  ) : null}

                  {data.permission.canManage ? (
                    <div className="vaga-row-actions">
                      {vaga.status === 'livre' ? (
                        <>
                          <button type="button" onClick={() => abrirModal(vaga, 'adicionar')}><Search size={14} /> Adicionar line</button>
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
                        <button type="button" className="danger" onClick={() => void remover(vaga)}><Trash2 size={14} /> Remover line e liberar slot</button>
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
        title={
          modo === 'adicionar'
            ? `Adicionar line ao slot ${vagaAlvo?.slot_letra || vagaAlvo?.numero_vaga}`
            : `Convite · ${vagaAlvo?.grupo?.nome || 'grupo'} · slot ${vagaAlvo?.slot_letra || vagaAlvo?.numero_vaga}`
        }
        description={
          modo === 'adicionar'
            ? 'A equipe é só a pasta. Pesquise a equipe, escolha uma line livre ou crie uma nova (herda logo da equipe).'
            : 'Quem receber o link entra no campeonato e escolhe o slot no grupo (ou o slot fixo, se você travar).'
        }
        onClose={fechar}
        size="wide"
      >
        <div className="team-slot-modal">
          {modo === 'adicionar' ? (
            <>
              <div className="team-search-row">
                <input
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void pesquisar() }}
                  placeholder="Buscar pasta/equipe por nome ou tag"
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
                        const livre = item.lines.find((line) => !line.ja_inscrita)
                        setLineId(livre?.id || '')
                        setNomeLine('')
                      }}
                    >
                      <span>{item.logo_url ? <img src={item.logo_url} alt="" /> : <Users size={18} />}</span>
                      <strong>{item.nome}</strong>
                      <small>{item.tag || 'Sem tag'} · {item.lines.filter((l) => !l.ja_inscrita).length} line(s) livre(s)</small>
                    </button>
                  ))}
                </div>
              ) : null}

              {equipe ? (
                <div className="selected-team-box">
                  <strong>Pasta: {equipe.nome}</strong>
                  {equipe.lines.some((line) => !line.ja_inscrita) ? (
                    <label className="field">
                      <span>Line livre (unidade no campeonato)</span>
                      <select value={lineId} onChange={(event) => { setLineId(event.target.value); setNomeLine('') }}>
                        {equipe.lines.filter((line) => !line.ja_inscrita).map((line) => (
                          <option key={line.id} value={line.id}>
                            {line.nome}
                          </option>
                        ))}
                        <option value="">+ Criar nova line para este slot</option>
                      </select>
                    </label>
                  ) : (
                    <p>Todas as lines desta pasta já estão no campeonato. Crie uma nova line abaixo (ex.: ALOE ELITE 2).</p>
                  )}
                  {equipe.lines.some((line) => line.ja_inscrita) ? (
                    <p className="invite-empty">
                      Já no campeonato: {equipe.lines.filter((l) => l.ja_inscrita).map((l) => l.nome).join(', ')}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {equipe && !lineId ? (
                <label className="field">
                  <span>Nome da nova line (herda logo da pasta; o líder pode trocar depois)</span>
                  <input value={nomeLine} onChange={(event) => setNomeLine(event.target.value)} placeholder="Ex.: ALOE ELITE" />
                </label>
              ) : null}
            </>
          ) : (
            <>
              <div className="invite-reference-note">
                <Shield size={17} />
                <p>
                  Grupo: <strong>{vagaAlvo?.grupo?.nome || '—'}</strong>
                  {vagaAlvo?.fase?.nome ? ` · ${vagaAlvo.fase.nome}` : ''}. Referências são só internas; o convidado confirma line real da conta.
                </p>
              </div>

              <div className="invite-scope-options" role="radiogroup" aria-label="Escopo do convite">
                <label className={`invite-scope-card ${!fixarSlot ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="escopo-convite"
                    checked={!fixarSlot}
                    onChange={() => setFixarSlot(false)}
                  />
                  <span>
                    <strong>Qualquer slot livre do grupo</strong>
                    <small>Tela igual ao link de grupo: o convidado escolhe a letra e já entra no assento.</small>
                  </span>
                </label>
                <label className={`invite-scope-card ${fixarSlot ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="escopo-convite"
                    checked={fixarSlot}
                    onChange={() => setFixarSlot(true)}
                  />
                  <span>
                    <strong>Só o slot {vagaAlvo?.slot_letra || vagaAlvo?.numero_vaga}</strong>
                    <small>Reserva fixa nesta letra (como antes).</small>
                  </span>
                </label>
              </div>

              <label className="field">
                <span>Identificação da reserva</span>
                <input value={referenciaEquipe} onChange={(event) => setReferenciaEquipe(event.target.value)} placeholder="Ex.: Vaga do Lucas" />
              </label>
              <label className="field">
                <span>Identificação da line</span>
                <input value={referenciaLine} onChange={(event) => setReferenciaLine(event.target.value)} placeholder="Ex.: Line Elite" />
              </label>
            </>
          )}

          {feedback ? <div className="teams-feedback">{feedback}</div> : null}
          <div className="modal-form-actions">
            <button className="button secondary" onClick={fechar}>Cancelar</button>
            <button className="button" onClick={modo === 'adicionar' ? adicionar : criarConvite} disabled={processando}>
              {processando ? <Loader2 className="spin" size={15} /> : null}
              {modo === 'adicionar'
                ? 'Adicionar line no slot'
                : fixarSlot
                  ? 'Gerar convite deste slot'
                  : 'Gerar convite do grupo'}
            </button>
          </div>
        </div>
      </SystemModal>
    </section>
  )
}
