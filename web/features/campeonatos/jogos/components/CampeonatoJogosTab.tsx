'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronRight, Clock3, Pencil, Plus, Trash2, Trophy, Users } from 'lucide-react'
import { Field } from '@/features/dropzone/components/form-fields'
import { dataText, rowTitle } from '@/features/dropzone/utils'
import type { CampeonatoJogoForm, CampeonatoJogosTabProps } from '../types/campeonato-jogos.types'

const MAPAS = ['Bermuda', 'PurgatÃ³rio', 'Kalahari', 'Alpine', 'NexTerra', 'Solara']

function phaseName(fases: CampeonatoJogosTabProps['fases'], id: unknown) {
  return rowTitle(fases.find((fase) => fase.id === id)) || 'Sem fase'
}

function formatDate(value: unknown) {
  if (!value) return 'Data nÃ£o definida'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : String(value)
}

function mapsArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String)
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean)
}

function groupOrder(group: CampeonatoJogosTabProps['grupos'][number]) {
  const name = rowTitle(group)
  return String(name.match(/\bgrupo\s+([a-z]+)/i)?.[1] || name)
}

function sortGroups(a: CampeonatoJogosTabProps['grupos'][number], b: CampeonatoJogosTabProps['grupos'][number]) {
  return groupOrder(a).localeCompare(groupOrder(b), 'pt-BR', {
    numeric: true,
    sensitivity: 'base',
  })
}

export function CampeonatoJogosTab(props: CampeonatoJogosTabProps) {
  const canManageGames = props.canManageGames !== false
  const [showForm, setShowForm] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [phaseFilter, setPhaseFilter] = useState('')

  const phaseGroups = useMemo(
    () => props.grupos.filter((grupo) => grupo.data?.fase_id === props.value.fase_id).sort(sortGroups),
    [props.grupos, props.value.fase_id],
  )
  const filteredGames = phaseFilter ? props.jogos.filter((jogo) => jogo.data?.fase_id === phaseFilter) : props.jogos
  const mapList = mapsArray(props.value.mapas)
  const count = Math.max(1, Number(props.value.numero_partidas || 1))
  const selectedPhase = props.fases.find((fase) => fase.id === props.value.fase_id)
  const isFinalPhase = String(selectedPhase?.data?.tipo || (selectedPhase as any)?.tipo || '') === 'grande_final'
  const effectiveGameType: 'normal' | 'final' = isFinalPhase ? 'final' : props.value.tipo_jogo

  function patch(patchValue: Partial<CampeonatoJogoForm>) {
    props.setValue({ ...props.value, ...patchValue })
  }

  function setMap(index: number, map: string) {
    const next = Array.from({ length: count }, (_, position) => mapList[position] || '')
    next[index] = map
    patch({ mapas: next.join(', ') })
  }

  function reset(keepPhase = true) {
    props.setValue({
      nome: '', campeonato_id: props.campeonato.id,
      fase_id: keepPhase ? props.value.fase_id : '', rodada: '', data_jogo: '', horario: '',
      numero_partidas: '3', intervalo_minutos: '25', mapas: '', grupos_ids: [], status: 'agendado',
      classificam_quantidade: '', tipo_jogo: 'normal', dia_final: '1', define_campeao: false, permite_troca_jogadores: true,
      prazo_troca_minutos: '60', prazo_escalacao_minutos: '120',
      escalacao_abre_horas_antes: '24', escalacao_fecha_horas_antes: '2',
      minimo_partidas_jogadas_jogador: '0',
    })
    setEditingId(null)
  }

  function startEdit(game: CampeonatoJogosTabProps['jogos'][number]) {
    props.setValue({
      nome: rowTitle(game), campeonato_id: props.campeonato.id,
      fase_id: String(game.data?.fase_id || ''), rodada: String(game.data?.rodada || ''),
      data_jogo: String(game.data?.data_jogo || ''), horario: String(game.data?.horario || '').slice(0, 5),
      numero_partidas: String(game.data?.numero_partidas || 3), intervalo_minutos: String(game.data?.intervalo_minutos || 25),
      mapas: mapsArray(game.data?.mapas).join(', '), grupos_ids: Array.isArray(game.data?.grupos_ids) ? game.data.grupos_ids.map(String) : [],
      status: String(game.data?.status || game.status || 'agendado'), classificam_quantidade: String(game.data?.classificam_quantidade || ''),
      tipo_jogo: String(game.data?.tipo_jogo || 'normal') === 'final' ? 'final' : 'normal',
      dia_final: String(game.data?.dia_final || 1),
      define_campeao: Boolean(game.data?.define_campeao), permite_troca_jogadores: game.data?.permite_troca_jogadores !== false,
      prazo_troca_minutos: String(game.data?.prazo_troca_minutos || game.data?.limite_troca_minutos || 60),
      prazo_escalacao_minutos: String(game.data?.prazo_escalacao_minutos || game.data?.limite_escalacao_minutos || 120),
      escalacao_abre_horas_antes: String(game.data?.escalacao_abre_horas_antes ?? 24),
      escalacao_fecha_horas_antes: String(game.data?.escalacao_fecha_horas_antes ?? Math.ceil(Number(game.data?.prazo_escalacao_minutos || game.data?.limite_escalacao_minutos || 120) / 60)),
      minimo_partidas_jogadas_jogador: String(game.data?.minimo_partidas_jogadas_jogador || 0),
    })
    setEditingId(game.id)
    setShowForm(true)
  }

  async function save() {
    if (editingId) {
      await props.updateGame(editingId, props.value)
      reset()
      setShowForm(false)
      return
    }
    props.createGame()
  }

  return (
    <section className="games-tab">
      <div className="games-toolbar">
        <div><p className="eyebrow">Jogos</p><h3>CalendÃ¡rio, grupos e quedas</h3><small>Os grupos disponÃ­veis sÃ£o sempre limitados Ã  fase selecionada.</small></div>
        <div className="games-toolbar-actions">
          <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} aria-label="Filtrar por fase">
            <option value="">Todas as fases</option>
            {props.fases.map((fase) => <option key={fase.id} value={fase.id}>{rowTitle(fase)}</option>)}
          </select>
          {canManageGames ? (
            <button className="button" onClick={() => { reset(false); setShowForm((current) => !current) }}><Plus size={16} /> Novo jogo</button>
          ) : null}
        </div>
      </div>

      {showForm && canManageGames ? (
        <div className="game-form-panel">
          <div className="game-form-heading"><div><p className="eyebrow">{editingId ? 'Editar jogo' : 'Novo jogo'}</p><h4>{editingId ? props.value.nome : 'ConfiguraÃ§Ã£o do jogo'}</h4></div><button className="button secondary" onClick={() => { setShowForm(false); reset(false) }}>Fechar</button></div>
          <div className="mini-grid three">
            <Field label="Fase"><select value={props.value.fase_id} onChange={(e) => { const next = props.fases.find((fase) => fase.id === e.target.value); const final = String(next?.data?.tipo || (next as any)?.tipo || '') === 'grande_final'; patch({ fase_id: e.target.value, grupos_ids: [], tipo_jogo: final ? 'final' : 'normal', dia_final: final ? (props.value.dia_final || '1') : '1', define_campeao: final ? props.value.define_campeao : false }) }}><option value="">Selecione a fase</option>{props.fases.map((fase) => <option key={fase.id} value={fase.id}>{rowTitle(fase)}{String(fase.data?.tipo || (fase as any)?.tipo || '') === 'grande_final' ? ' · Grande Final' : ''}</option>)}</select></Field>
            <Field label="Rodada"><input type="number" min="1" value={props.value.rodada} onChange={(e) => patch({ rodada: e.target.value })} placeholder="Ex.: 1" /></Field>
            <Field label="Nome do jogo"><input value={props.value.nome} onChange={(e) => patch({ nome: e.target.value })} placeholder="Ex.: Jogo 1 â€” A x B" /></Field>
          </div>

          <div className="game-groups-field">
            <span>Grupos participantes</span>
            {!props.value.fase_id ? <p className="empty compact">Selecione uma fase para liberar os grupos.</p> : null}
            {props.value.fase_id && phaseGroups.length === 0 ? <p className="empty compact">Essa fase ainda nÃ£o possui grupos.</p> : null}
            <div className="game-group-options">
              {phaseGroups.map((grupo) => {
                const checked = props.value.grupos_ids.includes(grupo.id)
                return <label key={grupo.id} className={checked ? 'game-group-chip selected' : 'game-group-chip'}><input type="checkbox" checked={checked} onChange={() => patch({ grupos_ids: checked ? props.value.grupos_ids.filter((id) => id !== grupo.id) : [...props.value.grupos_ids, grupo.id] })} /><Users size={15} />{rowTitle(grupo)}</label>
              })}
            </div>
          </div>

          <div className="mini-grid three">
            <Field label="Data"><input type="date" value={props.value.data_jogo} onChange={(e) => patch({ data_jogo: e.target.value })} /></Field>
            <Field label="HorÃ¡rio inicial"><input type="time" value={props.value.horario} onChange={(e) => patch({ horario: e.target.value })} /></Field>
            <Field label="Status"><select value={props.value.status} onChange={(e) => patch({ status: e.target.value })}><option value="rascunho">Rascunho</option><option value="agendado">Agendado</option><option value="escalacao_aberta">EscalaÃ§Ã£o aberta</option><option value="escalacao_encerrada">EscalaÃ§Ã£o encerrada</option><option value="em_andamento">Em andamento</option><option value="finalizado">Finalizado</option><option value="cancelado">Cancelado</option></select></Field>
          </div>

          <div className="mini-grid three">
            <Field label="NÃºmero de quedas"><input type="number" min="1" max="20" value={props.value.numero_partidas} onChange={(e) => patch({ numero_partidas: e.target.value })} /></Field>
            <Field label="Intervalo estimado (min)"><input type="number" min="1" value={props.value.intervalo_minutos} onChange={(e) => patch({ intervalo_minutos: e.target.value })} /></Field>
            {effectiveGameType === 'final'
              ? <Field label="Dia da Grande Final"><input type="number" min="1" value={props.value.dia_final} onChange={(e) => patch({ dia_final: e.target.value })} /></Field>
              : <Field label="Equipes que avanÃ§am"><input type="number" min="0" value={props.value.classificam_quantidade} onChange={(e) => patch({ classificam_quantidade: e.target.value })} placeholder="Opcional" /></Field>}
          </div>
          <div className="mini-grid three">
            <Field label="Tipo do jogo"><select value={effectiveGameType} disabled={isFinalPhase} onChange={(e) => patch({ tipo_jogo: e.target.value === 'final' ? 'final' : 'normal', dia_final: e.target.value === 'final' ? (props.value.dia_final || '1') : '1', define_campeao: e.target.value === 'final' ? props.value.define_campeao : false })}><option value="normal">Jogo da fase</option><option value="final" disabled={!isFinalPhase}>Jogo de final</option></select></Field>
            {effectiveGameType === 'final' ? <Field label="Decisão do título"><select value={props.value.define_campeao ? 'sim' : 'nao'} onChange={(e) => patch({ define_campeao: e.target.value === 'sim' })}><option value="nao">Acumula na Grande Final</option><option value="sim">Jogo decisivo do título</option></select></Field> : null}
            {effectiveGameType === 'final' ? <Field label="Formato"><input value={isFinalPhase ? 'Grande Final · multi-dia compatível' : 'Final'} disabled /></Field> : null}
          </div>

          <div className="game-map-grid">
            {Array.from({ length: count }, (_, index) => <Field key={index} label={`Queda ${index + 1}`}><select value={mapList[index] || ''} onChange={(e) => setMap(index, e.target.value)}><option value="">Selecione o mapa</option>{MAPAS.map((mapa) => <option key={mapa} value={mapa}>{mapa}</option>)}</select></Field>)}
          </div>

          <div className="game-rules-panel">
            <h4>Controle de escalaÃ§Ã£o</h4>
            <div className="mini-grid three">
              <Field label="Trocas de jogadores"><select value={props.value.permite_troca_jogadores ? 'sim' : 'nao'} onChange={(e) => patch({ permite_troca_jogadores: e.target.value === 'sim' })}><option value="sim">Permitidas</option><option value="nao">Bloqueadas</option></select></Field>
              <Field label="Abre escalação (h antes)"><input type="number" min="0" value={props.value.escalacao_abre_horas_antes} onChange={(e) => patch({ escalacao_abre_horas_antes: e.target.value })} /></Field>
              <Field label="Fecha escalação (h antes)"><input type="number" min="0" value={props.value.escalacao_fecha_horas_antes} onChange={(e) => patch({ escalacao_fecha_horas_antes: e.target.value, prazo_escalacao_minutos: String(Math.max(0, Number(e.target.value || 0) * 60)) })} /></Field>
            </div>
            <div className="mini-grid three">
              <Field label="Limite para troca (min antes)"><input type="number" min="0" disabled={!props.value.permite_troca_jogadores} value={props.value.prazo_troca_minutos} onChange={(e) => patch({ prazo_troca_minutos: e.target.value })} /></Field>
              <Field label="MÃ­nimo de quedas anteriores do jogador"><input type="number" min="0" value={props.value.minimo_partidas_jogadas_jogador} onChange={(e) => patch({ minimo_partidas_jogadas_jogador: e.target.value })} /></Field>
              <Field label="Etapa competitiva"><input value={effectiveGameType === 'final' ? `Grande Final · Dia ${props.value.dia_final || 1}` : 'Classificação da fase'} disabled /></Field>
            </div>
          </div>
          <button className="button" disabled={props.loading} onClick={save}>{props.loading ? 'Salvando...' : editingId ? 'Salvar alteraÃ§Ãµes' : 'Criar jogo e quedas'}</button>
        </div>
      ) : null}

      <div className="games-list">
        {filteredGames.map((game) => {
          const open = openId === game.id
          const groupNames = props.grupos.filter((grupo) => Array.isArray(game.data?.grupos_ids) && game.data.grupos_ids.includes(grupo.id)).sort(sortGroups).map(rowTitle)
          return <article className="game-card" key={game.id}>
            <button className="game-card-summary" onClick={() => setOpenId(open ? null : game.id)}>
              <span className="game-card-chevron">{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
              <span className="game-card-main"><strong>{rowTitle(game)}</strong><small>{phaseName(props.fases, game.data?.fase_id)}{game.data?.rodada ? ` Â· Rodada ${game.data.rodada}` : ''}</small></span>
              <span className="game-card-meta"><span><CalendarDays size={14} />{formatDate(game.data?.data_jogo)}</span><span><Clock3 size={14} />{String(game.data?.horario || '--:--').slice(0, 5)}</span></span>
              <span className={`game-status ${String(game.data?.status || game.status || 'agendado')}`}>{String(game.data?.status || game.status || 'agendado').replaceAll('_', ' ')}</span>
            </button>
            {open ? <div className="game-card-details">
              <div className="game-detail-grid"><div><span>Grupos</span><strong>{groupNames.join(' Ã— ') || 'NÃ£o definidos'}</strong></div><div><span>Quedas</span><strong>{game.data?.numero_partidas || 1}</strong></div><div><span>Mapas</span><strong>{mapsArray(game.data?.mapas).join(', ') || 'NÃ£o definidos'}</strong></div><div><span>Etapa</span><strong>{game.data?.tipo_jogo === 'final' ? `Grande Final · Dia ${game.data?.dia_final || 1}${game.data?.define_campeao ? ' · decisivo' : ''}` : game.data?.classificam_quantidade ? `${game.data.classificam_quantidade} avançam` : 'Regra da fase'}</strong></div></div>
              <div className="game-card-actions">
                {canManageGames ? (
                  <>
                    <button className="button secondary" onClick={() => startEdit(game)}><Pencil size={15} /> Editar</button>
                    <button className="button secondary danger" onClick={() => props.deleteGame(game.id)}><Trash2 size={15} /> Excluir</button>
                  </>
                ) : null}
                <button className="button secondary" disabled><Trophy size={15} /> SÃºmula</button>
              </div>
            </div> : null}
          </article>
        })}
        {filteredGames.length === 0 ? <p className="empty">Nenhum jogo encontrado para este filtro.</p> : null}
      </div>
    </section>
  )
}
