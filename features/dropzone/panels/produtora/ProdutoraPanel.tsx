'use client'

import { useState } from 'react'
import { CalendarDays, Copy, Shield, Trophy } from 'lucide-react'
import type { DropZoneRow } from '@/lib/types'
import { CHAMPIONSHIP_TYPE_LABELS, CHAMPIONSHIP_TYPES, DAILY_HOURS, GROUP_LETTERS } from '@/lib/dropzone-constants'
import { Field, UploadField } from '../../components/form-fields'
import { dataText, rowTitle } from '../../utils'
import { producerTabs, type ProducerTab } from './producer-tabs'

export function ProdutoraPanel(props: {
  championships: DropZoneRow[]
  teams: DropZoneRow[]
  phases: DropZoneRow[]
  groups: DropZoneRow[]
  groupSlots: DropZoneRow[]
  games: DropZoneRow[]
  tokens: DropZoneRow[]
  registrationLinks: DropZoneRow[]
  lineupRules: DropZoneRow[]
  registrationLink: { grupo_id: string; vagas_por_equipe: string; abre_em: string; encerra_em: string; permite_substituicao: boolean; max_substituicoes_por_equipe: string; substituicao_encerra_em: string; descricao: string }
  setRegistrationLink: (value: any) => void
  createRegistrationLink: () => void
  selectedChamp?: DropZoneRow
  selectedChampTeams: DropZoneRow[]
  selectedChampId: string
  setSelectedChampId: (value: string) => void
  selectedTeamId: string
  setSelectedTeamId: (value: string) => void
  championship: { nome: string; tipo: string; logo_url: string; premiacao: string; divisao_premiacao: string; regras_url: string }
  setChampionship: (value: any) => void
  team: { nome: string; tag: string; logo_url: string; senha_dono: string }
  setTeam: (value: any) => void
  phase: { nome: string; campeonato_id: string; ordem: string }
  setPhase: (value: any) => void
  group: { nome: string; campeonato_id: string; fase_id: string; slots: string }
  setGroup: (value: any) => void
  slotAssignment: { grupo_id: string; equipe_id: string; slot_numero: string }
  setSlotAssignment: (value: any) => void
  game: { nome: string; campeonato_id: string; fase_id: string; data_jogo: string; horario: string; numero_partidas: string; mapas: string; grupos_ids: string[] }
  setGame: (value: any) => void
  createChampionship: () => void
  createTeam: () => void
  createPhase: () => void
  createGroup: () => void
  assignTeamToSlot: () => void
  createGame: () => void
  addTeamToChamp: () => void
  generateTeamInvite: () => void
  copyToken: (value: string | null) => void
  loading: boolean
  uploadPublicFile: (file: File, bucket: string) => Promise<string>
}) {
  const [showCreateChamp, setShowCreateChamp] = useState(false)
  const [tab, setTab] = useState<ProducerTab>('equipes')
  const [selectedTeamDetailId, setSelectedTeamDetailId] = useState('')
  const [openAction, setOpenAction] = useState<'team_add' | 'team_token' | 'phase' | 'group' | 'slot' | 'game' | 'link' | ''>('')

  const selectedChamp = props.selectedChamp
  const selectedChampType = String(dataText(selectedChamp, 'tipo') || 'copa')
  const isDailyChamp = selectedChampType === 'diario'
  const champPhases = props.phases.filter((row) => row.parent_id === selectedChamp?.id)
  const champGroups = props.groups.filter((row) => row.parent_id === selectedChamp?.id)
  const champGames = props.games.filter((row) => row.parent_id === selectedChamp?.id)
  const champSlots = props.groupSlots.filter((row) => row.parent_id === selectedChamp?.id)
  const champRegistrationLinks = props.registrationLinks.filter((row) => row.parent_id === selectedChamp?.id)
  const teamInvites = props.tokens.filter((row) => row.data?.token_kind === 'team_invite' && row.parent_id === selectedChamp?.id)
  const selectedTeamDetail = props.selectedChampTeams.find((team) => team.id === selectedTeamDetailId) || props.selectedChampTeams[0]
  const selectedTeamSlot = selectedTeamDetail ? champSlots.find((slot) => slot.ref_id === selectedTeamDetail.id) : null

  function toggleAction(value: typeof openAction) {
    setOpenAction((current) => current === value ? '' : value)
  }

  function groupName(id?: string | null) {
    return rowTitle(champGroups.find((row) => row.id === id)) || 'Sem grupo'
  }

  function phaseName(id?: string | null) {
    return rowTitle(champPhases.find((row) => row.id === id)) || 'Sem fase'
  }

  function teamLogo(team?: DropZoneRow) {
    return dataText(team, 'logo_url') || ''
  }

  const totalPlayers = 0
  const stats = [
    { label: 'Equipes', value: props.selectedChampTeams.length },
    { label: 'Jogadores', value: totalPlayers },
    { label: 'Fases', value: champPhases.length },
    { label: 'Grupos', value: champGroups.length },
    { label: 'Jogos', value: champGames.length },
  ]

  return (
    <div className="producer-layout-ref">
      <aside className="championship-nav-card panel">
        <div className="section-head compact-head">
          <div>
            <p className="eyebrow">Produtora</p>
            <h2>Campeonatos</h2>
          </div>
          <Trophy />
        </div>

        <div className="championship-list ref-list">
          {props.championships.length === 0 ? <p className="empty">Nenhum campeonato criado ainda.</p> : null}
          {props.championships.map((champ) => {
            const logo = dataText(champ, 'logo_url')
            return (
              <button
                key={champ.id}
                className={`champ-list-item ref-champ-item ${selectedChamp?.id === champ.id ? 'active' : ''}`}
                onClick={() => {
                  props.setSelectedChampId(champ.id)
                  setShowCreateChamp(false)
                }}
              >
                <span className="champ-thumb">{logo ? <img src={logo} alt="" /> : <Trophy size={18} />}</span>
                <span>
                  <strong>{rowTitle(champ)}</strong>
                  <small>{dataText(champ, 'premiacao') || 'Premiação não informada'}</small>
                </span>
              </button>
            )
          })}
        </div>

        <button className="button full" onClick={() => setShowCreateChamp((value) => !value)}>
          {showCreateChamp ? 'Fechar novo campeonato' : 'Novo campeonato'}
        </button>

        {showCreateChamp ? (
          <div className="floating-create-panel">
            <div className="section-head tiny-head">
              <div>
                <p className="eyebrow">Criar</p>
                <h3>Novo campeonato</h3>
              </div>
              <CalendarDays size={18} />
            </div>
            <Field label="Nome"><input value={props.championship.nome} onChange={(e) => props.setChampionship({ ...props.championship, nome: e.target.value })} /></Field>
            <Field label="Tipo">
              <select value={props.championship.tipo} onChange={(e) => props.setChampionship({ ...props.championship, tipo: e.target.value })}>
                {CHAMPIONSHIP_TYPES.map((type) => <option key={type} value={type}>{CHAMPIONSHIP_TYPE_LABELS[type]}</option>)}
              </select>
            </Field>
            <UploadField label="Logo do campeonato" value={props.championship.logo_url} bucket="campeonato" onChange={(url) => props.setChampionship({ ...props.championship, logo_url: url })} onUpload={props.uploadPublicFile} />
            <Field label="Premiação"><input value={props.championship.premiacao} onChange={(e) => props.setChampionship({ ...props.championship, premiacao: e.target.value })} /></Field>
            <Field label="Link das regras"><input value={props.championship.regras_url} onChange={(e) => props.setChampionship({ ...props.championship, regras_url: e.target.value })} /></Field>
            <Field label="Divisão da premiação"><textarea value={props.championship.divisao_premiacao} onChange={(e) => props.setChampionship({ ...props.championship, divisao_premiacao: e.target.value })} /></Field>
            <button className="button full" onClick={props.createChampionship} disabled={props.loading}>Salvar campeonato</button>
          </div>
        ) : null}
      </aside>

      <section className="championship-detail-card panel">
        {selectedChamp ? (
          <>
            <header className="detail-hero-ref">
              <div className="detail-logo-ref">
                {dataText(selectedChamp, 'logo_url') ? <img src={dataText(selectedChamp, 'logo_url')} alt="" /> : <Trophy size={28} />}
              </div>
              <div className="detail-title-ref">
                <p className="eyebrow">Campeonato selecionado</p>
                <h2>{rowTitle(selectedChamp)}</h2>
                <p>{CHAMPIONSHIP_TYPE_LABELS[selectedChampType as keyof typeof CHAMPIONSHIP_TYPE_LABELS] || 'Copa'} · {dataText(selectedChamp, 'premiacao') ? `Premiação: ${dataText(selectedChamp, 'premiacao')}` : 'Premiação não informada'}</p>
                {dataText(selectedChamp, 'regras_url') ? <small>Regulamento: {dataText(selectedChamp, 'regras_url')}</small> : null}
              </div>
              <div className="detail-stats-ref">
                {stats.map((item) => (
                  <div className="detail-stat" key={item.label}>
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </header>

            <nav className="champ-subtabs-ref" aria-label="Abas do campeonato">
              {producerTabs.map((item) => (
                <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>
              ))}
            </nav>

            <div className="champ-tab-body-ref">
              {tab === 'equipes' ? (
                <div className="ref-section-stack">
                  <div className="subtab-actionbar">
                    <div>
                      <p className="eyebrow">Equipes</p>
                      <h3>Equipes do campeonato</h3>
                    </div>
                    <div className="button-row compact-actions">
                      <button className="button secondary" onClick={() => toggleAction('team_add')}>Adicionar equipe</button>
                      <button className="button" onClick={() => toggleAction('team_token')}>Gerar token</button>
                    </div>
                  </div>

                  {openAction === 'team_add' ? (
                    <div className="inline-action-panel">
                      <Field label="Equipe existente">
                        <select value={props.selectedTeamId} onChange={(e) => props.setSelectedTeamId(e.target.value)}>
                          <option value="">Selecione</option>
                          {props.teams.map((team) => <option key={team.id} value={team.id}>[{dataText(team, 'tag') || '--'}] {rowTitle(team)}</option>)}
                        </select>
                      </Field>
                      <button className="button" onClick={props.addTeamToChamp}>Adicionar equipe selecionada</button>
                    </div>
                  ) : null}

                  {openAction === 'team_token' ? (
                    <div className="inline-action-panel compact-token-panel">
                      <p>Gere um token aberto para o líder da equipe colar no painel dele.</p>
                      <button className="button" onClick={props.generateTeamInvite}>Gerar token de equipe</button>
                    </div>
                  ) : null}

                  <div className="ref-card-grid two">
                    <div className="panel-soft">
                      <h3>Lista de equipes</h3>
                      {props.selectedChampTeams.length === 0 ? <p className="empty">Nenhuma equipe adicionada ainda.</p> : null}
                      {props.selectedChampTeams.map((team) => {
                        const slot = champSlots.find((item) => item.ref_id === team.id)
                        return (
                          <button className={`compact-row with-logo selectable-row ${selectedTeamDetail?.id === team.id ? 'active' : ''}`} key={team.id} onClick={() => setSelectedTeamDetailId(team.id)}>
                            <span className="tiny-logo">{teamLogo(team) ? <img src={teamLogo(team)} alt="" /> : <Shield size={15} />}</span>
                            <strong>[{dataText(team, 'tag') || '--'}] {rowTitle(team)}</strong>
                            <small>{slot ? `${groupName(slot.data?.grupo_id)} · Slot ${slot.data?.slot_numero}` : 'Sem slot definido'}</small>
                          </button>
                        )
                      })}
                    </div>
                    <div className="panel-soft">
                      <h3>Tokens de equipe</h3>
                      {teamInvites.length === 0 ? <p className="empty">Nenhum convite gerado.</p> : null}
                      {teamInvites.map((token) => (
                        <button className="token-card" key={token.id} onClick={() => props.copyToken(token.token)}>
                          <span>Convite aberto</span>
                          <strong>{token.token}</strong>
                          <Copy size={15} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {tab === 'jogadores' ? (
                <div className="ref-section-stack">
                  <div className="subtab-actionbar">
                    <div>
                      <p className="eyebrow">Jogadores</p>
                      <h3>Escalação por equipe</h3>
                    </div>
                  </div>
                  <div className="ref-card-grid two">
                    <div className="panel-soft">
                      <h3>Equipes</h3>
                      {props.selectedChampTeams.map((team) => (
                        <button className={`compact-row with-logo selectable-row ${selectedTeamDetail?.id === team.id ? 'active' : ''}`} key={team.id} onClick={() => setSelectedTeamDetailId(team.id)}>
                          <span className="tiny-logo">{teamLogo(team) ? <img src={teamLogo(team)} alt="" /> : <Shield size={15} />}</span>
                          <strong>[{dataText(team, 'tag') || '--'}] {rowTitle(team)}</strong>
                          <small>Clique para ver vagas e jogadores.</small>
                        </button>
                      ))}
                      {props.selectedChampTeams.length === 0 ? <p className="empty">Adicione equipes ao campeonato primeiro.</p> : null}
                    </div>
                    <div className="panel-soft detail-mini-panel">
                      <h3>{selectedTeamDetail ? rowTitle(selectedTeamDetail) : 'Nenhuma equipe selecionada'}</h3>
                      <div className="metric-row"><span>Grupo</span><strong>{groupName(selectedTeamSlot?.data?.grupo_id)}</strong></div>
                      <div className="metric-row"><span>Slot</span><strong>{selectedTeamSlot?.data?.slot_numero || '-'}</strong></div>
                      <div className="metric-row"><span>Vagas usadas</span><strong>0</strong></div>
                      <p className="empty">A lista de jogadores aparece aqui quando houver inscrições neste campeonato.</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {tab === 'grupos' ? (
                <div className="ref-section-stack">
                  <div className="subtab-actionbar">
                    <div>
                      <p className="eyebrow">Organização</p>
                      <h3>Fases, grupos e slots</h3>
                    </div>
                    <div className="button-row compact-actions">
                      <button className="button secondary" onClick={() => toggleAction('phase')}>Criar fase</button>
                      <button className="button secondary" onClick={() => toggleAction('group')}>Criar grupo</button>
                      <button className="button" onClick={() => toggleAction('slot')}>Distribuir slot</button>
                    </div>
                  </div>

                  {openAction === 'phase' ? (
                    <div className="inline-action-panel mini-grid">
                      <Field label="Nome da fase"><input value={props.phase.nome} onChange={(e) => props.setPhase({ ...props.phase, nome: e.target.value, campeonato_id: selectedChamp.id })} placeholder="Fase de grupos" /></Field>
                      <Field label="Ordem"><input type="number" value={props.phase.ordem} onChange={(e) => props.setPhase({ ...props.phase, ordem: e.target.value, campeonato_id: selectedChamp.id })} /></Field>
                      <button className="button" onClick={props.createPhase}>Criar fase</button>
                    </div>
                  ) : null}

                  {openAction === 'group' ? (
                    <div className="inline-action-panel mini-grid three">
                      <Field label="Fase">
                        <select value={props.group.fase_id} onChange={(e) => props.setGroup({ ...props.group, fase_id: e.target.value, campeonato_id: selectedChamp.id })}>
                          <option value="">Sem fase</option>
                          {champPhases.map((phase) => <option key={phase.id} value={phase.id}>{rowTitle(phase)}</option>)}
                        </select>
                      </Field>
                      <Field label={isDailyChamp ? 'Horario' : 'Letra do grupo'}>
                        {isDailyChamp ? (
                          <select value={props.group.nome} onChange={(e) => props.setGroup({ ...props.group, nome: e.target.value, campeonato_id: selectedChamp.id })}>
                            {DAILY_HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                          </select>
                        ) : (
                          <select value={props.group.nome.replace(/^Grupo\s+/i, '').trim() || 'A'} onChange={(e) => props.setGroup({ ...props.group, nome: `Grupo ${e.target.value}`, campeonato_id: selectedChamp.id })}>
                            {GROUP_LETTERS.map((letter) => <option key={letter} value={letter}>Grupo {letter}</option>)}
                          </select>
                        )}
                      </Field>
                      <Field label="Slots"><input type="number" value={props.group.slots} onChange={(e) => props.setGroup({ ...props.group, slots: e.target.value, campeonato_id: selectedChamp.id })} placeholder="12" /></Field>
                      <button className="button" onClick={props.createGroup}>Criar grupo</button>
                    </div>
                  ) : null}

                  {openAction === 'slot' ? (
                    <div className="inline-action-panel mini-grid three">
                      <Field label="Grupo">
                        <select value={props.slotAssignment.grupo_id} onChange={(e) => props.setSlotAssignment({ ...props.slotAssignment, grupo_id: e.target.value })}>
                          <option value="">Selecione</option>
                          {champGroups.map((group) => <option key={group.id} value={group.id}>{rowTitle(group)}</option>)}
                        </select>
                      </Field>
                      <Field label="Equipe inscrita">
                        <select value={props.slotAssignment.equipe_id} onChange={(e) => props.setSlotAssignment({ ...props.slotAssignment, equipe_id: e.target.value })}>
                          <option value="">Selecione</option>
                          {props.selectedChampTeams.map((team) => <option key={team.id} value={team.id}>[{dataText(team, 'tag') || '--'}] {rowTitle(team)}</option>)}
                        </select>
                      </Field>
                      <Field label="Número do slot"><input type="number" value={props.slotAssignment.slot_numero} onChange={(e) => props.setSlotAssignment({ ...props.slotAssignment, slot_numero: e.target.value })} /></Field>
                      <button className="button" onClick={props.assignTeamToSlot}>Salvar slot</button>
                    </div>
                  ) : null}

                  <div className="phase-board">
                    {(champPhases.length ? champPhases : [{ id: 'sem-fase', name: 'Sem fase', data: {} } as DropZoneRow]).map((phase) => {
                      const groupsOfPhase = phase.id === 'sem-fase'
                        ? champGroups.filter((group) => !group.data?.fase_id)
                        : champGroups.filter((group) => group.data?.fase_id === phase.id)
                      if (phase.id === 'sem-fase' && groupsOfPhase.length === 0 && champPhases.length > 0) return null
                      return (
                        <section className="phase-card" key={phase.id}>
                          <header>
                            <div>
                              <p className="eyebrow">Fase</p>
                              <h3>{rowTitle(phase)}</h3>
                            </div>
                            <strong>{groupsOfPhase.length} grupos</strong>
                          </header>
                          <div className="group-card-grid">
                            {groupsOfPhase.map((group) => {
                              const slotsOfGroup = champSlots.filter((slot) => slot.data?.grupo_id === group.id)
                              return (
                                <div className="group-mini-card" key={group.id}>
                                  <div className="group-mini-head">
                                    <strong>{rowTitle(group)}</strong>
                                    <small>{dataText(group, 'slots') || group.data?.slots || 12} slots</small>
                                  </div>
                                  <div className="slot-pills">
                                    {Array.from({ length: Number(group.data?.slots || 12) }).slice(0, 24).map((_, index) => {
                                      const slotNumber = index + 1
                                      const slot = slotsOfGroup.find((item) => Number(item.data?.slot_numero) === slotNumber)
                                      const team = props.selectedChampTeams.find((item) => item.id === slot?.ref_id)
                                      return <span key={slotNumber} className={team ? 'filled' : ''}>{slotNumber}{team ? ` · ${dataText(team, 'tag') || rowTitle(team)}` : ''}</span>
                                    })}
                                  </div>
                                </div>
                              )
                            })}
                            {groupsOfPhase.length === 0 ? <p className="empty">Nenhum grupo nesta fase.</p> : null}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {tab === 'jogos' ? (
                <div className="ref-section-stack">
                  <div className="subtab-actionbar">
                    <div>
                      <p className="eyebrow">Jogos</p>
                      <h3>Rodadas do campeonato</h3>
                    </div>
                    <button className="button" onClick={() => toggleAction('game')}>Novo jogo</button>
                  </div>
                  {openAction === 'game' ? (
                    <div className="inline-action-panel">
                      <div className="mini-grid three">
                        <Field label="Fase">
                          <select value={props.game.fase_id} onChange={(e) => props.setGame({ ...props.game, fase_id: e.target.value, campeonato_id: selectedChamp.id, grupos_ids: [] })}>
                            <option value="">Selecione</option>
                            {champPhases.map((phase) => <option key={phase.id} value={phase.id}>{rowTitle(phase)}</option>)}
                          </select>
                        </Field>
                        <Field label="Nome do jogo"><input value={props.game.nome} onChange={(e) => props.setGame({ ...props.game, nome: e.target.value, campeonato_id: selectedChamp.id })} placeholder="Rodada 1" /></Field>
                        <Field label="Número de partidas"><input type="number" value={props.game.numero_partidas} onChange={(e) => props.setGame({ ...props.game, numero_partidas: e.target.value, campeonato_id: selectedChamp.id })} /></Field>
                      </div>
                      <div className="mini-grid three">
                        <Field label="Data"><input type="date" value={props.game.data_jogo} onChange={(e) => props.setGame({ ...props.game, data_jogo: e.target.value, campeonato_id: selectedChamp.id })} /></Field>
                        <Field label="Horário"><input type="time" value={props.game.horario} onChange={(e) => props.setGame({ ...props.game, horario: e.target.value, campeonato_id: selectedChamp.id })} /></Field>
                        <Field label="Mapas"><input value={props.game.mapas} onChange={(e) => props.setGame({ ...props.game, mapas: e.target.value, campeonato_id: selectedChamp.id })} placeholder="Bermuda, Purgatório, Alpine" /></Field>
                      </div>
                      <Field label="Grupos participantes da fase">
                        <select multiple value={props.game.grupos_ids} onChange={(e) => props.setGame({ ...props.game, grupos_ids: Array.from(e.target.selectedOptions).map((option) => option.value), campeonato_id: selectedChamp.id })}>
                          {champGroups.filter((group) => !props.game.fase_id || group.data?.fase_id === props.game.fase_id).map((group) => <option key={group.id} value={group.id}>{rowTitle(group)}</option>)}
                        </select>
                      </Field>
                      <button className="button" onClick={props.createGame}>Criar jogo</button>
                    </div>
                  ) : null}
                  <div className="ref-card-grid two">
                    {champGames.map((game) => <div className="compact-row event-row" key={game.id}><strong>{rowTitle(game)}</strong><small>{phaseName(game.data?.fase_id)} · {dataText(game, 'data_jogo') || 'sem data'} · {dataText(game, 'numero_partidas') || game.data?.numero_partidas || 1} partidas</small></div>)}
                    {champGames.length === 0 ? <p className="empty">Nenhum jogo criado.</p> : null}
                  </div>
                </div>
              ) : null}

              {tab === 'links' ? (
                <div className="ref-section-stack">
                  <div className="subtab-actionbar">
                    <div>
                      <p className="eyebrow">Links</p>
                      <h3>Inscrição pública</h3>
                    </div>
                    <button className="button" onClick={() => toggleAction('link')}>Gerar link</button>
                  </div>
                  {openAction === 'link' ? (
                    <div className="inline-action-panel">
                      <div className="mini-grid three">
                        <Field label="Grupo do link">
                          <select value={props.registrationLink.grupo_id} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, grupo_id: e.target.value })}>
                            <option value="">Selecione</option>
                            {champGroups.map((group) => <option key={group.id} value={group.id}>{rowTitle(group)}</option>)}
                          </select>
                        </Field>
                        <Field label="Vagas por equipe"><input type="number" value={props.registrationLink.vagas_por_equipe} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, vagas_por_equipe: e.target.value })} /></Field>
                        <Field label="Encerrar escalação"><input type="datetime-local" value={props.registrationLink.encerra_em} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, encerra_em: e.target.value })} /></Field>
                      </div>
                      <div className="mini-grid three">
                        <Field label="Permite substituição">
                          <select value={props.registrationLink.permite_substituicao ? 'sim' : 'nao'} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, permite_substituicao: e.target.value === 'sim' })}>
                            <option value="nao">Não</option>
                            <option value="sim">Sim</option>
                          </select>
                        </Field>
                        <Field label="Máximo de substituições"><input type="number" value={props.registrationLink.max_substituicoes_por_equipe} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, max_substituicoes_por_equipe: e.target.value })} /></Field>
                        <Field label="Prazo de substituição"><input type="datetime-local" value={props.registrationLink.substituicao_encerra_em} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, substituicao_encerra_em: e.target.value })} /></Field>
                      </div>
                      <button className="button" onClick={props.createRegistrationLink}>Gerar link público</button>
                    </div>
                  ) : null}
                  <div className="ref-card-grid two">
                    {champRegistrationLinks.map((link) => (
                      <button key={link.id} className="token-card" onClick={() => props.copyToken(`${window.location.origin}/i/${link.token}`)}>
                        <span>{groupName(link.data?.group_id)}</span>
                        <strong>{`/i/${link.token}`}</strong>
                        <Copy size={15} />
                      </button>
                    ))}
                    {champRegistrationLinks.length === 0 ? <p className="empty">Nenhum link gerado.</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="empty-state-big">
            <Trophy size={36} />
            <h2>Selecione ou crie um campeonato</h2>
            <p>Ao selecionar, as abas de equipes, jogadores, fases, grupos e jogos aparecem aqui.</p>
          </div>
        )}
      </section>
    </div>
  )
}
