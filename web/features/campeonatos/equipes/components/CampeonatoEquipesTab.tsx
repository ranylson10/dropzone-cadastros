'use client'

import {LeagueSeasonPanel} from './LeagueSeasonPanel'
import { confirmAction, promptAction } from '@/components/feedback'
import { Input as UiInput, Select as UiSelect, Textarea as UiTextarea } from '@/components/ui/Field'
import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Link2,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Users,
} from 'lucide-react'
import { SystemModal } from '@/components/layout/SystemModal'
import { useCampeonatoEquipes } from '../hooks/useCampeonatoEquipes'
import { campeonatoEquipesService } from '../services/campeonato-equipes.service'
import type { CampeonatoVaga, EquipeBusca, LigaEntradaTipo } from '../types/campeonato-equipes.types'
import '../campeonato-equipes.css'
import { usePagedSearch } from '@/hooks/usePagedSearch'
import { ParticipationRecovery } from './ParticipationRecovery'

type FiltroVaga = 'todas' | 'livre' | 'reservada' | 'ocupada'


const LIGA_ENTRY_LABELS: Record<LigaEntradaTipo, string> = {
  mantida: 'Mantida',
  promovida: 'Promovida',
  rebaixada: 'Rebaixada',
  classificatoria_aberta: 'Classificatória aberta',
  vaga_paga: 'Vaga paga',
  convite_direto: 'Convite direto',
}

const FILTROS: Array<{ value: FiltroVaga; label: string }> = [
  { value: 'todas', label: 'Todas' },
  { value: 'livre', label: 'Livres' },
  { value: 'reservada', label: 'Reservadas' },
  { value: 'ocupada', label: 'Preenchidas' },
]

function groupOrder(nome?: string | null) {
  const text = String(nome || '')
  const match = text.match(/\bgrupo\s+([a-z]+)/i)
  const token = match?.[1] || text
  return token.toUpperCase()
}

function sortVagasByStructure(a: CampeonatoVaga, b: CampeonatoVaga) {
  const faseDiff = Number(a.fase?.ordem ?? 9999) - Number(b.fase?.ordem ?? 9999)
  if (faseDiff) return faseDiff
  const faseNameDiff = String(a.fase?.nome || '').localeCompare(String(b.fase?.nome || ''), 'pt-BR', {
    numeric: true,
    sensitivity: 'base',
  })
  if (faseNameDiff) return faseNameDiff
  const groupDiff = groupOrder(a.grupo?.nome).localeCompare(groupOrder(b.grupo?.nome), 'pt-BR', {
    numeric: true,
    sensitivity: 'base',
  })
  if (groupDiff) return groupDiff
  return Number(a.slot_numero ?? a.numero_vaga ?? 0) - Number(b.slot_numero ?? b.numero_vaga ?? 0)
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function CampeonatoEquipesTab({ campeonatoId, readOnly = false }: { campeonatoId: string; readOnly?: boolean }) {
  const { data, loading, error, reload } = useCampeonatoEquipes(campeonatoId)
  const [filtro, setFiltro] = useState<FiltroVaga>('todas')
  const [vagaAbertaId, setVagaAbertaId] = useState<string | null>(null)
  const [vagaAlvo, setVagaAlvo] = useState<CampeonatoVaga | null>(null)
  const [modo, setModo] = useState<'adicionar' | 'convite' | null>(null)
  const [busca, setBusca] = useState('')
  const directory = usePagedSearch<EquipeBusca>(`/api/campeonatos/${campeonatoId}/equipes/busca`, { authenticated: true, itemsKey: 'equipes' })
  const resultados = directory.items
  const [equipe, setEquipe] = useState<EquipeBusca | null>(null)
  const [lineId, setLineId] = useState('')
  const [nomeLine, setNomeLine] = useState('')
  const [referenciaEquipe, setReferenciaEquipe] = useState('')
  const [referenciaLine, setReferenciaLine] = useState('')
  /** Convite: por padrão o convidado escolhe qualquer slot livre do grupo. */
  /** Default: reserva o slot clicado (visível na lista). Opcional: qualquer letra do grupo. */
  const [fixarSlot, setFixarSlot] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [linkGerado, setLinkGerado] = useState('')
  const [origemEntrada, setOrigemEntrada] = useState<LigaEntradaTipo | ''>('')
  const [preparandoLiga, setPreparandoLiga] = useState(false)
  const [historicasOpen, setHistoricasOpen] = useState(false)
  const [historicasTexto, setHistoricasTexto] = useState('')
  const [historicasResultado, setHistoricasResultado] = useState<any[]>([])

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
    const vagas = [...(data?.vagas || [])].sort(sortVagasByStructure)
    const porStatus = filtro === 'todas' ? vagas : vagas.filter((vaga) => vaga.status === filtro)
    if (!readOnly || !busca.trim()) return porStatus
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return porStatus.filter((vaga) => [
      vaga.line_nome,
      vaga.equipe_nome,
      vaga.campeonato_equipe?.line_nome,
      vaga.campeonato_equipe?.equipe_nome,
      vaga.grupo?.nome,
    ].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(termo)))
  }, [busca, data, filtro, readOnly])

  const gruposOperacionais = useMemo(() => {
    const groups = new Map<string, {
      key: string
      faseNome: string
      grupoNome: string
      vagas: CampeonatoVaga[]
      total: number
      ocupadas: number
      reservadas: number
      livres: number
    }>()

    for (const vaga of vagasFiltradas) {
      const faseNome = String(vaga.fase?.nome || 'Fase de entrada')
      const grupoNome = String(vaga.grupo?.nome || 'Sem grupo')
      const key = `${vaga.fase?.id || faseNome}::${vaga.grupo_id || vaga.grupo?.id || grupoNome}`
      const current = groups.get(key) || {
        key,
        faseNome,
        grupoNome,
        vagas: [],
        total: 0,
        ocupadas: 0,
        reservadas: 0,
        livres: 0,
      }
      current.vagas.push(vaga)
      current.total += 1
      if (vaga.status === 'ocupada') current.ocupadas += 1
      if (vaga.status === 'reservada') current.reservadas += 1
      if (vaga.status === 'livre') current.livres += 1
      groups.set(key, current)
    }

    return [...groups.values()]
  }, [vagasFiltradas])

  const ligaDivisaoAlvo = useMemo(() => {
    if (!data?.liga || !vagaAlvo?.grupo?.nome) return null
    const target = vagaAlvo.grupo.nome.trim().toLocaleLowerCase('pt-BR')
    return data.liga.divisoes.find((item) => item.nome.trim().toLocaleLowerCase('pt-BR') === target) || null
  }, [data?.liga, vagaAlvo?.grupo?.nome])

  function ligaDivisionForGroup(groupName: string) {
    const target = groupName.trim().toLocaleLowerCase('pt-BR')
    return data?.liga?.divisoes.find((item) => item.nome.trim().toLocaleLowerCase('pt-BR') === target) || null
  }

  function origemBase(value?: string | null) {
    return String(value || '').replace(/^liga_/, '') as LigaEntradaTipo
  }

  function origemLabel(value?: string | null) {
    const base = origemBase(value)
    return LIGA_ENTRY_LABELS[base] || String(value || '').replace(/^liga_/, '').replaceAll('_', ' ')
  }

  function ligaOriginUsed(tipo: LigaEntradaTipo) {
    if (!vagaAlvo?.grupo_id) return 0
    return (data?.vagas || []).filter((vaga) => vaga.grupo_id === vagaAlvo.grupo_id && vaga.status === 'ocupada' && origemBase(vaga.campeonato_equipe?.origem_entrada) === tipo).length
  }

  async function prepararEstruturaLiga() {
    if (!data?.liga?.divisoes.length) return
    setPreparandoLiga(true)
    setFeedback('')
    try {
      await campeonatoEquipesService.prepararLiga(campeonatoId, {
        action: 'create_bulk',
        fases: [{
          nome: 'Liga',
          ordem: 1,
          grupos: data.liga.divisoes.map((division) => ({ nome: division.nome, slots: Number(division.equipes || 0) })),
        }],
      })
      await reload()
      setFeedback('Agrupamentos da Liga preparados. Agora escolha as equipes de cada origem.')
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao preparar agrupamentos da Liga.')
    } finally {
      setPreparandoLiga(false)
    }
  }

  async function abrirHistoricas() {
    setHistoricasOpen(true)
    setHistoricasResultado([])
    setFeedback('')
    try {
      const result = await campeonatoEquipesService.listarHistoricas(campeonatoId) as { resultados?: any[] }
      setHistoricasResultado(result.resultados || [])
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao carregar equipes históricas.')
    }
  }

  async function criarHistoricasEmBloco() {
    const equipes = historicasTexto
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [nome, tag] = line.split('|').map((part) => part.trim())
        return { nome, ...(tag ? { tag } : {}) }
      })
      .filter((item) => item.nome)

    if (!equipes.length) {
      setFeedback('Cole ao menos um nome de equipe, uma por linha.')
      return
    }

    setProcessando(true)
    setFeedback('')
    try {
      const result = await campeonatoEquipesService.criarHistoricasEmBloco(campeonatoId, { equipes }) as {
        criadas?: number
        existentes?: number
        resultados?: any[]
      }
      setHistoricasResultado(result.resultados || [])
      setFeedback(`${result.criadas || 0} equipe(s) histórica(s) criada(s). ${result.existentes || 0} nome(s) já existiam e não foram duplicados.`)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao cadastrar equipes históricas.')
    } finally {
      setProcessando(false)
    }
  }

  async function copiarLinkHistorico(row: any) {
    if (!row?.token) return
    const link = `${window.location.origin}/equipe/reivindicar/${row.token}`
    const copiou = await copiarTexto(link)
    setFeedback(copiou ? `Link de ${row.nome} copiado.` : 'Não foi possível copiar automaticamente.')
  }

  function fechar() {
    setVagaAlvo(null)
    setModo(null)
    setBusca('')
    directory.clear()
    setEquipe(null)
    setLineId('')
    setNomeLine('')
    setReferenciaEquipe('')
    setReferenciaLine('')
    setFixarSlot(true)
    setFeedback('')
    setLinkGerado('')
    setOrigemEntrada('')
  }

  function abrirModal(vaga: CampeonatoVaga, proximoModo: 'adicionar' | 'convite') {
    setVagaAlvo(vaga)
    setModo(proximoModo)
    setFixarSlot(true)
    setFeedback('')
    setLinkGerado('')
    if (proximoModo === 'adicionar' && data?.liga) {
      const target = vaga.grupo?.nome?.trim().toLocaleLowerCase('pt-BR') || ''
      const division = data.liga.divisoes.find((item) => item.nome.trim().toLocaleLowerCase('pt-BR') === target)
      const available = division?.entradas.find((entry) => {
        const used = (data.vagas || []).filter((item) => item.grupo_id === vaga.grupo_id && item.status === 'ocupada' && origemBase(item.campeonato_equipe?.origem_entrada) === entry.tipo).length
        return used < Number(entry.quantidade || 0)
      })
      setOrigemEntrada(available?.tipo || division?.entradas[0]?.tipo || '')
    } else {
      setOrigemEntrada('')
    }
  }

  async function copiarTexto(texto: string) {
    try {
      await navigator.clipboard.writeText(texto)
      return true
    } catch {
      return false
    }
  }

  async function pesquisar() {
    if (busca.trim().length < 2) return
    setFeedback('')
    await directory.search(busca)
  }

  async function adicionar() {
    if (!vagaAlvo || !equipe) return
    setProcessando(true)
    setFeedback('')
    try {
      await campeonatoEquipesService.adicionar(campeonatoId, {
        slot_id: vagaAlvo.id,
        equipe_id: equipe.id,
        line_id: lineId || null,
        nome_line: nomeLine,
        ...(origemEntrada ? { origem_entrada: origemEntrada } : {}),
      }, data || {})
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
    setLinkGerado('')
    try {
      // Padrão: reserva o slot clicado (visível). Opcional: qualquer letra do grupo.
      const body: Record<string, unknown> = fixarSlot
        ? {
            slot_id: vagaAlvo.id,
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
        // Sem grupo: convite fixo no slot
        body.slot_id = vagaAlvo.id
        body.fixar_slot = true
      }
      const result = await campeonatoEquipesService.criarConvite(campeonatoId, body) as {
        link: string
        modo?: string
      }
      setLinkGerado(result.link)
      const copiou = await copiarTexto(result.link)
      setFeedback(
        result.modo === 'grupo'
          ? copiou
            ? 'Convite de grupo criado e link copiado. O convidado escolhe o slot livre.'
            : 'Convite de grupo criado. Copie o link abaixo (o navegador bloqueou a cópia automática).'
          : copiou
            ? 'Convite do slot criado e link copiado.'
            : 'Convite do slot criado. Copie o link abaixo (o navegador bloqueou a cópia automática).',
      )
      await reload()
      // Mantém o modal aberto com o link — antes fechava e o convite de grupo sumia da lista
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao criar convite.')
    } finally {
      setProcessando(false)
    }
  }

  async function copiarConvite(vaga: CampeonatoVaga) {
    const convite = vaga.convite
    if (!convite?.token) {
      setFeedback('Token do convite indisponível para esta sessão. Renove o convite se você for o organizador.')
      return
    }
    const link = `${window.location.origin}/convite/equipe/${convite.token}`
    const slotLabel = vaga.slot_letra || String(vaga.numero_vaga).padStart(2, '0')
    const texto = `Você recebeu um convite para o campeonato ${data?.campeonato.nome}.

Slot: ${slotLabel}${vaga.grupo?.nome ? ` (${vaga.grupo.nome})` : ''}
Referência: ${vaga.nome_equipe_reservada || '-'}
Line informada: ${vaga.nome_line_reservada || '-'}
Validade: 24 horas.

A line é quem joga e pontua. Entre e confirme a line real da sua equipe.

Acesse: ${link}`
    const copiou = await copiarTexto(texto)
    setFeedback(copiou ? 'Mensagem completa copiada.' : 'Não foi possível copiar automaticamente. Selecione e copie o texto manualmente.')
  }

  async function copiarConviteGrupo(convite: NonNullable<CampeonatoVaga['convite']>) {
    if (!convite.token) {
      setFeedback('Token do convite indisponível para esta sessão. Renove o convite se você for o organizador.')
      return
    }
    const link = `${window.location.origin}/convite/equipe/${convite.token}`
    const grupoNome =
      data?.vagas.find((v) => v.grupo_id === convite.grupo_id)?.grupo?.nome
      || 'grupo'
    const texto = `Você recebeu um convite para o campeonato ${data?.campeonato.nome}.

Grupo: ${grupoNome}
Referência: ${convite.nome_equipe_reservada || '-'}
Line informada: ${convite.nome_line_reservada || '-'}
Validade: 24 horas.

Escolha um slot livre do grupo e confirme a line real da sua equipe.

Acesse: ${link}`
    const copiou = await copiarTexto(texto)
    setFeedback(copiou ? 'Convite de grupo copiado.' : 'Não foi possível copiar automaticamente.')
  }

  async function editarConvite(
    tokenId: string,
    referenciaAtualEquipe?: string | null,
    referenciaAtualLine?: string | null,
  ) {
    if (!tokenId) return
    const referenciaEquipe = await promptAction('Identificação da reserva:', referenciaAtualEquipe || '')
    if (referenciaEquipe === null) return
    const referenciaLine = await promptAction('Identificação da line:', referenciaAtualLine || '')
    if (referenciaLine === null) return
    if (!referenciaEquipe.trim() || !referenciaLine.trim()) {
      setFeedback('As duas identificações são obrigatórias.')
      return
    }
    setProcessando(true)
    try {
      await campeonatoEquipesService.editarConvite(campeonatoId, tokenId, {
        referencia_equipe: referenciaEquipe.trim(),
        referencia_line: referenciaLine.trim(),
      })
      await reload()
      setFeedback('Identificações do convite atualizadas.')
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao editar convite.')
    } finally {
      setProcessando(false)
    }
  }

  async function renovar(tokenId: string) {
    if (!tokenId) return
    setProcessando(true)
    try {
      await campeonatoEquipesService.renovarConvite(campeonatoId, tokenId)
      await reload()
      setFeedback('Convite renovado por mais 24 horas.')
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao renovar.')
    } finally {
      setProcessando(false)
    }
  }

  async function cancelar(tokenId: string, label?: string) {
    if (!tokenId) return
    const confirmLabel = label || 'este convite'
    if (!await confirmAction(`Cancelar ${confirmLabel}?`)) return
    setProcessando(true)
    try {
      await campeonatoEquipesService.cancelarConvite(campeonatoId, tokenId)
      setVagaAbertaId(null)
      await reload()
      setFeedback('Convite cancelado.')
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao cancelar.')
    } finally {
      setProcessando(false)
    }
  }

  async function remover(vaga: CampeonatoVaga) {
    const id = vaga.campeonato_equipe?.id
    const label = vaga.line_nome || vaga.campeonato_equipe?.line_nome || vaga.campeonato_equipe?.nome_exibicao || 'esta line'
    if (!id || !await confirmAction(`Remover ${label} e liberar o slot ${vaga.slot_letra || vaga.numero_vaga}?`)) return
    setProcessando(true)
    try {
      await campeonatoEquipesService.remover(campeonatoId, id, data || {}, vaga.participation_expected)
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

  const capacidade = data.capacidade
  const metaLabel =
    capacidade?.limite_vagas != null
      ? `${capacidade.slots_ocupados}/${capacidade.limite_vagas}`
      : `${capacidade?.slots_ocupados ?? stats.ocupadas} preenchidas`

  return (
    <section className="champ-registration">
      {!readOnly && (data.permission.canManage || data.permission.canRemove) ? <ParticipationRecovery championshipId={campeonatoId} contract={data} onConfirmed={async () => { await reload() }} /> : null}
      <header className="champ-registration-head">
        <div>
          <p>Equipes e inscrições</p>
          <h2>Grupos e slots</h2>
        </div>
        <div className="champ-registration-head-actions">
          {data.permission.role === 'owner' ? (
            <button className="champ-registration-bulk" type="button" onClick={() => void abrirHistoricas()}>
              <Users size={15} /> Cadastro em bloco
            </button>
          ) : null}
          <button className="champ-registration-refresh" type="button" onClick={reload} title="Atualizar inscrições" aria-label="Atualizar inscrições">
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <div className="champ-registration-summary" aria-label="Resumo das inscrições">
        <span><strong>{stats.ocupadas}</strong><small>inscritas</small></span>
        <span><strong>{stats.reservadas}</strong><small>reservadas</small></span>
        <span><strong>{stats.livres}</strong><small>livres</small></span>
        {capacidade?.limite_vagas != null ? (
          <span><strong>{capacidade.slots_ocupados}/{capacidade.limite_vagas}</strong><small>meta da entrada</small></span>
        ) : (
          <span><strong>{stats.total}</strong><small>slots</small></span>
        )}
      </div>

      <nav className="champ-registration-filters" aria-label="Filtrar inscrições">
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
              aria-pressed={filtro === item.value}
            >
              {item.label}<span>{quantidade}</span>
            </button>
          )
        })}
      </nav>

      {feedback ? <div className="champ-registration-feedback">{feedback}</div> : null}

      {readOnly ? <><div className="teams-tab-info">Consulta de equipes inscritas. Para adicionar ou remover uma line, abra <strong>Grupos e slots</strong> e selecione o slot desejado.</div><div className="team-search-row"><UiInput value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Pesquisar equipe, line ou grupo" /><Search size={16} /></div></> : null}

      {!readOnly && (data.convites_grupo || []).length > 0 ? (
        <details className="champ-registration-group-invites">
          <summary>
            <span>Convites de grupo</span>
            <strong>{(data.convites_grupo || []).length}</strong>
          </summary>
          <div className="champ-registration-invite-list">
            {(data.convites_grupo || []).map((convite) => {
              const grupoNome = data.vagas.find((v) => v.grupo_id === convite.grupo_id)?.grupo?.nome || 'Grupo'
              return (
                <article key={convite.id}>
                  <div>
                    <strong>{grupoNome}</strong>
                    <span>{convite.nome_equipe_reservada || 'Reserva'} · {convite.nome_line_reservada || 'Line'}</span>
                    <small>Expira {formatDate(convite.expira_em)}</small>
                  </div>
                  <div className="champ-registration-invite-actions">
                    <button type="button" onClick={() => void copiarConviteGrupo(convite)} title="Copiar convite" aria-label="Copiar convite"><Copy size={15} /></button>
                    <button type="button" onClick={() => void editarConvite(convite.id, convite.nome_equipe_reservada, convite.nome_line_reservada)} title="Editar identificações" aria-label="Editar identificações"><Pencil size={15} /></button>
                    <button type="button" onClick={() => void renovar(convite.id)} title="Renovar 24h" aria-label="Renovar convite"><RefreshCw size={15} /></button>
                    <button type="button" className="danger" onClick={() => void cancelar(convite.id, `o convite de grupo (${convite.nome_equipe_reservada || 'reserva'})`)} title="Cancelar convite" aria-label="Cancelar convite"><Trash2 size={15} /></button>
                  </div>
                </article>
              )
            })}
          </div>
        </details>
      ) : null}

      {data.liga && data.vagas.length === 0 && data.permission.canManage ? (
        <div className="champ-league-setup">
          <div>
            <small>Formação operacional</small>
            <strong>Preparar {data.liga.nome_agrupamento.toLocaleLowerCase('pt-BR')}</strong>
            <span>{data.liga.divisoes.map((item) => `${item.nome} · ${item.equipes} vagas`).join(' · ')}</span>
          </div>
          <button className="button" type="button" onClick={() => void prepararEstruturaLiga()} disabled={preparandoLiga}>
            {preparandoLiga ? <Loader2 className="spin" size={15} /> : null} Preparar agrupamentos
          </button>
        </div>
      ) : null}

      <LeagueSeasonPanel championshipId={campeonatoId} contract={data} initialPreview={data.liga?.season||null} availableSlots={data.vagas.length}
        occupied={stats.ocupadas} canManage={data.permission.canManage&&!readOnly} onRefresh={async()=>Boolean(await reload())}/>

      <div className="champ-registration-groups">
        {gruposOperacionais.length === 0 ? (
          <div className="champ-registration-empty">{data.liga && data.vagas.length === 0 ? 'Prepare os agrupamentos para liberar os slots da Liga.' : 'Nenhum slot encontrado neste filtro.'}</div>
        ) : gruposOperacionais.map((group) => (
          <section className="champ-registration-group" key={group.key}>
            <header>
              <div>
                <small>{group.faseNome}</small>
                <h3>{group.grupoNome}</h3>
              </div>
              <span><strong>{group.ocupadas}</strong>/{group.total} preenchidos</span>
            </header>
            {(() => {
              const division = ligaDivisionForGroup(group.grupoNome)
              if (!division?.entradas.length) return null
              const occupied = group.vagas.filter((vaga) => vaga.status === 'ocupada')
              return (
                <div className="champ-league-entry-progress" aria-label={`Formação de ${group.grupoNome}`}>
                  {division.entradas.map((entry) => {
                    const used = occupied.filter((vaga) => origemBase(vaga.campeonato_equipe?.origem_entrada) === entry.tipo).length
                    return <span key={entry.id}><small>{LIGA_ENTRY_LABELS[entry.tipo]}</small><strong>{used}/{entry.quantidade}</strong></span>
                  })}
                </div>
              )
            })()}

            <div className="champ-registration-slots">
              {group.vagas.map((vaga) => {
                const aberta = vagaAbertaId === vaga.id
                const letra = vaga.slot_letra || String(vaga.numero_vaga).padStart(2, '0')
                const logoUrl = vaga.line_logo_url || vaga.campeonato_equipe?.line_logo_url || vaga.campeonato_equipe?.line?.logo_url || vaga.campeonato_equipe?.equipe?.logo_url || null
                const nomePrincipal = vaga.status === 'reservada'
                  ? vaga.nome_line_reservada || vaga.nome_equipe_reservada || 'Convite reservado'
                  : vaga.status === 'ocupada'
                    ? vaga.line_nome || vaga.campeonato_equipe?.line_nome || vaga.campeonato_equipe?.nome_exibicao || vaga.campeonato_equipe?.line?.nome || 'Line inscrita'
                    : 'Livre'
                const equipeNome = vaga.equipe_nome || vaga.campeonato_equipe?.equipe_nome || vaga.campeonato_equipe?.equipe?.nome || vaga.nome_equipe_reservada || ''
                const statusLabel = vaga.status === 'ocupada' ? 'Inscrita' : vaga.status === 'reservada' ? 'Reservada' : 'Livre'

                return (
                  <article className={`champ-registration-slot is-${vaga.status}${aberta ? ' is-open' : ''}`} key={vaga.id}>
                    <button type="button" className="champ-registration-slot-main" onClick={() => setVagaAbertaId(aberta ? null : vaga.id)} aria-expanded={aberta}>
                      <span className="champ-registration-slot-number">{letra}</span>
                      <span className="champ-registration-slot-avatar" aria-hidden>
                        {vaga.status === 'ocupada' && logoUrl ? <img src={logoUrl} alt="" /> : vaga.status === 'ocupada' ? <Users size={17} /> : vaga.status === 'reservada' ? <Link2 size={16} /> : <span />}
                      </span>
                      <span className="champ-registration-slot-copy">
                        <strong>{nomePrincipal}</strong>
                        <small>{equipeNome || (vaga.status === 'livre' ? 'Disponível para inscrição' : 'Aguardando confirmação')}</small>
                      </span>
                      <span className={`champ-registration-status is-${vaga.status}`}>{statusLabel}</span>
                      <span className="champ-registration-chevron">{aberta ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</span>
                    </button>

                    {aberta ? (
                      <div className="champ-registration-slot-details">
                        {vaga.status === 'livre' ? <p>Adicione uma line diretamente ou gere um convite para este slot.</p> : null}

                        {vaga.status === 'reservada' ? (
                          <div className="champ-registration-detail-data">
                            <span><small>Reserva</small><strong>{vaga.nome_equipe_reservada || '-'}</strong></span>
                            <span><small>Line</small><strong>{vaga.nome_line_reservada || '-'}</strong></span>
                            <span><small>Validade</small><strong>{formatDate(vaga.reserva_expira_em)}</strong></span>
                          </div>
                        ) : null}

                        {vaga.status === 'ocupada' ? <p>{equipeNome ? `${equipeNome} · ` : ''}{vaga.campeonato_equipe?.origem_entrada ? `Entrada via ${origemLabel(vaga.campeonato_equipe.origem_entrada)}` : 'Inscrição confirmada'}</p> : null}

                        {!readOnly && (data.permission.canManage || data.permission.canGenerateToken || data.permission.canRemove) ? (
                          <div className="champ-registration-actions">
                            {vaga.status === 'livre' ? (
                              <>
                                {data.permission.canManage ? <button type="button" onClick={() => abrirModal(vaga, 'adicionar')}><Search size={14} /> Adicionar line</button> : null}
                                {data.permission.canGenerateToken ? <button type="button" onClick={() => abrirModal(vaga, 'convite')}><Link2 size={14} /> Criar convite</button> : null}
                              </>
                            ) : null}

                            {vaga.status === 'reservada' && data.permission.canGenerateToken && vaga.convite ? (
                              <>
                                <button type="button" onClick={() => void copiarConvite(vaga)}><Copy size={14} /> Copiar</button>
                                <button type="button" onClick={() => void editarConvite(vaga.convite!.id, vaga.nome_equipe_reservada, vaga.nome_line_reservada)}><Pencil size={14} /> Editar</button>
                                <button type="button" onClick={() => void renovar(vaga.convite!.id)}><RefreshCw size={14} /> Renovar</button>
                                <button type="button" className="danger" onClick={() => void cancelar(vaga.convite!.id, `a reserva do slot ${vaga.slot_letra || vaga.numero_vaga}`)}><Trash2 size={14} /> Cancelar</button>
                              </>
                            ) : null}

                            {vaga.status === 'ocupada' && (data.permission.canRemove || data.permission.canManage) ? <button type="button" className="danger" onClick={() => void remover(vaga)}><Trash2 size={14} /> Remover line</button> : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <SystemModal
        open={historicasOpen}
        title="Cadastrar equipes históricas em bloco"
        description="Crie equipes sem dono para campeonatos antigos. Cada equipe recebe uma line principal e um link exclusivo para o responsável reivindicar depois."
        onClose={() => setHistoricasOpen(false)}
        size="wide"
      >
        <div className="historical-team-bulk">
          <label>
            <span>Equipes</span>
            <UiTextarea
              rows={10}
              value={historicasTexto}
              onChange={(event) => setHistoricasTexto(event.target.value)}
              placeholder={'Tropa do Pará | TDP\nFênix Esports | FNX\nAmazon Cria'}
            />
            <small>Uma por linha. A tag é opcional: Nome da equipe | TAG. Nomes já existentes não são duplicados.</small>
          </label>
          <div className="historical-team-bulk-actions">
            <button className="button" type="button" disabled={processando || !historicasTexto.trim()} onClick={() => void criarHistoricasEmBloco()}>
              {processando ? <Loader2 className="spin" size={15} /> : <Users size={15} />} Criar equipes e links
            </button>
          </div>
          {historicasResultado.length ? (
            <div className="historical-team-bulk-results">
              {historicasResultado.map((row) => (
                <article key={`${row.status}-${row.equipe_id}`}>
                  <div>
                    <strong>{row.nome}</strong>
                    <small>{row.status !== 'criada' ? (row.tem_dono ? 'Equipe já existe e possui responsável' : 'Equipe já existe') : row.incorporada ? 'Histórico incorporado a outra equipe' : row.reivindicada ? 'Reivindicada' : 'Aguardando responsável'}</small>
                  </div>
                  {row.status === 'criada' && row.token && !row.reivindicada ? (
                    <button type="button" onClick={() => void copiarLinkHistorico(row)}><Copy size={14} /> Copiar link</button>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </SystemModal>

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
              {data.liga && ligaDivisaoAlvo ? (
                <label className="field champ-league-origin-field">
                  <span>Origem desta vaga · {ligaDivisaoAlvo.nome}</span>
                  <UiSelect value={origemEntrada} onChange={(event) => setOrigemEntrada(event.target.value as LigaEntradaTipo)}>
                    {ligaDivisaoAlvo.entradas.map((entry) => {
                      const used = ligaOriginUsed(entry.tipo)
                      return <option key={entry.id} value={entry.tipo} disabled={used >= Number(entry.quantidade || 0)}>{LIGA_ENTRY_LABELS[entry.tipo]} · {used}/{entry.quantidade}</option>
                    })}
                  </UiSelect>
                </label>
              ) : null}
              <div className="team-search-row">
                <UiInput
                  value={busca}
                  onChange={(event) => { directory.clear(); setEquipe(null); setLineId(''); setBusca(event.target.value) }}
                  onKeyDown={(event) => { if (event.key === 'Enter') void pesquisar() }}
                  placeholder="Buscar pasta/equipe por nome ou tag"
                  aria-label="Buscar pasta ou equipe"
                />
                <button className="button secondary" onClick={pesquisar} disabled={processando || directory.loading}>
                  <Search size={15} /> Pesquisar
                </button>
              </div>

              {directory.loading ? <p role="status">Buscando equipes...</p> : null}
              {directory.error ? <p role="alert">{directory.error}</p> : null}
              {directory.term && !directory.loading && !directory.error && !resultados.length ? <p role="status">Nenhuma equipe encontrada.</p> : null}
              {directory.nextCursor ? <button className="button secondary" type="button" disabled={directory.loading || processando} onClick={() => void directory.more()}>Carregar mais equipes</button> : null}
              {resultados.length ? (
                <div className="team-search-results">
                  {resultados.map((item) => (
                    <button
                      className={equipe?.id === item.id ? 'selected' : ''}
                      key={item.id}
                      disabled={Boolean(data.liga && item.lines.some((line) => line.ja_inscrita))}
                      onClick={() => {
                        setEquipe(item)
                        const livre = item.lines.find((line) => !line.ja_inscrita)
                        setLineId(livre?.id || '')
                        setNomeLine('')
                      }}
                    >
                      <span>{item.logo_url ? <img src={item.logo_url} alt="" /> : <Users size={18} />}</span>
                      <strong>{item.nome}</strong>
                      <small>{data.liga && item.lines.some((line) => line.ja_inscrita) ? 'Já ocupa um agrupamento desta Liga' : `${item.tag || 'Sem tag'} · ${item.lines.filter((l) => !l.ja_inscrita).length} line(s) livre(s)`}</small>
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
                      <UiSelect value={lineId} onChange={(event) => { setLineId(event.target.value); setNomeLine('') }}>
                        {equipe.lines.filter((line) => !line.ja_inscrita).map((line) => (
                          <option key={line.id} value={line.id}>
                            {line.nome}
                          </option>
                        ))}
                        <option value="">+ Criar nova line para este slot</option>
                      </UiSelect>
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
                  <UiInput value={nomeLine} onChange={(event) => setNomeLine(event.target.value)} placeholder="Ex.: ALOE ELITE" />
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
                <label className={`invite-scope-card ${fixarSlot ? 'selected' : ''}`}>
                  <UiInput
                    type="radio"
                    name="escopo-convite"
                    checked={fixarSlot}
                    onChange={() => setFixarSlot(true)}
                  />
                  <span>
                    <strong>Só o slot {vagaAlvo?.slot_letra || vagaAlvo?.numero_vaga}</strong>
                    <small>Reserva fixa nesta letra — aparece como Reservada na lista.</small>
                  </span>
                </label>
                <label className={`invite-scope-card ${!fixarSlot ? 'selected' : ''}`}>
                  <UiInput
                    type="radio"
                    name="escopo-convite"
                    checked={!fixarSlot}
                    onChange={() => setFixarSlot(false)}
                  />
                  <span>
                    <strong>Qualquer slot livre do grupo</strong>
                    <small>O convidado escolhe a letra. O link fica na lista de convites de grupo.</small>
                  </span>
                </label>
              </div>

              <label className="field">
                <span>Identificação da reserva</span>
                <UiInput value={referenciaEquipe} onChange={(event) => setReferenciaEquipe(event.target.value)} placeholder="Ex.: Vaga do Lucas" />
              </label>
              <label className="field">
                <span>Identificação da line</span>
                <UiInput value={referenciaLine} onChange={(event) => setReferenciaLine(event.target.value)} placeholder="Ex.: Line Elite" />
              </label>

              {linkGerado ? (
                <div className="invite-link-result">
                  <small>Link gerado (válido 24h)</small>
                  <code>{linkGerado}</code>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={async () => {
                      const ok = await copiarTexto(linkGerado)
                      setFeedback(ok ? 'Link copiado.' : 'Não foi possível copiar automaticamente.')
                    }}
                  >
                    <Copy size={14} /> Copiar link
                  </button>
                </div>
              ) : null}
            </>
          )}

          {feedback ? <div className="teams-feedback">{feedback}</div> : null}
          <div className="modal-form-actions">
            <button className="button secondary" onClick={fechar}>{linkGerado ? 'Fechar' : 'Cancelar'}</button>
            {!linkGerado ? (
              <button className="button" onClick={modo === 'adicionar' ? adicionar : criarConvite} disabled={processando}>
                {processando ? <Loader2 className="spin" size={15} /> : null}
                {modo === 'adicionar'
                  ? 'Adicionar line no slot'
                  : fixarSlot
                    ? 'Gerar convite deste slot'
                    : 'Gerar convite do grupo'}
              </button>
            ) : null}
          </div>
        </div>
      </SystemModal>
    </section>
  )
}
