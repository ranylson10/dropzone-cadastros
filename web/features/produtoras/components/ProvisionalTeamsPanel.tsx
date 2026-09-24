'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Archive, ChevronDown, ChevronRight, Copy, ImagePlus, Loader2, Pencil, Plus, Save, Search, ShieldCheck, Trash2, Trophy, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { LineRosterManager } from '@/components/equipes/LineRosterManager'
import { LocationSearch, UploadField, resolvePendingImageUpload } from '@/features/dropzone/components/form-fields'
import { normalizeTeamName, type TeamNameMatch } from '@/features/produtoras/lib/team-name-similarity'
import './provisional-teams.css'

type Row = { nome: string; tag: string; logoFile?: File; logoPreview?: string }
type Team = any
type ManagerTab = 'dados' | 'lines' | 'campeonatos'
type UploadContext = { entityId?: string | null; campeonatoId?: string | null; uploadIntent?: 'create_profile' | 'create_campeonato' | null }

function columnLines(text: string, headerNames: string[]) {
  const lines = text.split(/\r?\n/).map((value) => value.trim())
  if (headerNames.includes(String(lines[0] || '').toLocaleLowerCase('pt-BR'))) lines.shift()
  while (lines.length && !lines.at(-1)) lines.pop()
  return lines
}

function buildBulkRows(namesText: string, tagsText: string, current: Row[]): Row[] {
  const names = columnLines(namesText, ['nome', 'equipe', 'nome da equipe'])
  const tags = columnLines(tagsText, ['tag'])
  return names.slice(0, 100).map((rawName, index) => ({
    nome: rawName.replace(/\s+/g, ' '),
    tag: String(tags[index] || '').replace(/\s+/g, '').toUpperCase(),
    logoFile: current[index]?.logoFile,
    logoPreview: current[index]?.logoPreview,
  }))
}

export function ProvisionalTeamsPanel({ producerId, uploadPublicFile }: { producerId: string; uploadPublicFile: (file: File, bucket: string, context?: UploadContext) => Promise<string> }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkNamesText, setBulkNamesText] = useState('')
  const [bulkTagsText, setBulkTagsText] = useState('')
  const [bulkRows, setBulkRows] = useState<Row[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [managerTab, setManagerTab] = useState<ManagerTab>('dados')
  const [selectedLine, setSelectedLine] = useState<any>(null)
  const [draft, setDraft] = useState<any>({})
  const [lineDraft, setLineDraft] = useState({ nome: '', tag: '' })
  const [lineEdit, setLineEdit] = useState<any>({})
  const [accessToken, setAccessToken] = useState('')
  const [query, setQuery] = useState('')
  const [rosterOpen, setRosterOpen] = useState(false)
  const [archiveId, setArchiveId] = useState('')
  const [bulkNameMatches, setBulkNameMatches] = useState<Record<string, TeamNameMatch[]>>({})
  const [checkingBulkNames, setCheckingBulkNames] = useState(false)
  const [bulkCheckError, setBulkCheckError] = useState('')

  const selected = teams.find((team) => team.id === selectedId) || null
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
  const visibleTeams = normalizedQuery
    ? teams.filter((team) => {
        const publicId = team.public_id ? `eq${team.public_id}` : ''
        return [team.nome, team.tag, team.localidade, team.cidade, team.estado, publicId, team.public_id]
          .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(normalizedQuery))
      })
    : teams
  const bulkNamesKey = useMemo(
    () => bulkRows.map((row) => normalizeTeamName(row.nome)).filter(Boolean).join('\n'),
    [bulkRows],
  )

  async function auth() {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token || ''
    if (!token) throw new Error('Sessão expirada. Entre novamente.')
    setAccessToken(token)
    return token
  }

  async function request(path: string, options?: RequestInit) {
    const token = await auth()
    const response = await fetch(path, {
      cache: 'no-store',
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Produtora-Id': producerId,
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options?.headers || {}),
      },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.error || 'Não foi possível concluir a operação.')
    return payload
  }

  async function load(options?: { preserveMessage?: boolean }) {
    setLoading(true)
    if (!options?.preserveMessage) setMessage('')
    try {
      const payload = await request('/api/produtora/equipes-provisorias')
      setTeams(payload.equipes || [])
      if (selectedId && !(payload.equipes || []).some((team: Team) => team.id === selectedId)) {
        setSelectedId(''); setSelectedLine(null); setRosterOpen(false); setManagerTab('dados')
      } else if (selectedLine) {
        const currentTeam = (payload.equipes || []).find((team: Team) => team.id === selectedId)
        const currentLine = currentTeam?.lines?.find((line: any) => line.id === selectedLine.id)
        if (currentLine) setSelectedLine(currentLine)
        else { setSelectedLine(null); setRosterOpen(false) }
      }
    } catch (error: any) { setMessage(error?.message || 'Erro ao carregar equipes provisórias.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])
  useEffect(() => {
    if (!bulkOpen || !bulkNamesKey) {
      setBulkNameMatches({})
      setCheckingBulkNames(false)
      setBulkCheckError('')
      return
    }

    let cancelled = false
    setCheckingBulkNames(true)
    const timer = window.setTimeout(async () => {
      setBulkCheckError('')
      try {
        const payload = await request('/api/produtora/equipes-provisorias', {
          method: 'POST',
          body: JSON.stringify({ action: 'check_names', nomes: bulkRows.map((row) => row.nome) }),
        })
        if (cancelled) return
        setBulkNameMatches(Object.fromEntries((payload.resultados || []).map((result: any) => [result.key, result.matches || []])))
      } catch {
        if (!cancelled) setBulkCheckError('Não foi possível conferir nomes existentes agora. Você ainda pode criar as equipes normalmente.')
      } finally {
        if (!cancelled) setCheckingBulkNames(false)
      }
    }, 450)

    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [bulkOpen, bulkNamesKey])
  useEffect(() => {
    if (!selected) return
    setDraft({
      nome: selected.nome || '', tag: selected.tag || '', logo_url: selected.logo_url || '',
      email_contato: selected.email_contato || '', localidade: selected.localidade || '',
      cidade: selected.cidade || '', estado: selected.estado || '', pais: selected.pais || '', bio: selected.bio || '',
    })
  }, [selectedId, teams])
  useEffect(() => {
    if (!selectedLine) { setLineEdit({}); return }
    setLineEdit({ nome: selectedLine.nome || '', tag: selectedLine.tag || '', logo_url: selectedLine.logo_url || '' })
  }, [selectedLine?.id, selectedLine?.updated_at])

  async function createBulk() {
    if (!bulkRows.length) return
    setBusy('bulk'); setMessage('')
    try {
      const equipes = await Promise.all(bulkRows.map(async (row) => ({
        nome: row.nome,
        tag: row.tag,
        logo_url: row.logoFile ? await uploadPublicFile(row.logoFile, 'equipe', { uploadIntent: 'create_profile' }) : undefined,
      })))
      const payload = await request('/api/produtora/equipes-provisorias', { method: 'POST', body: JSON.stringify({ equipes }) })
      bulkRows.forEach((row) => { if (row.logoPreview) URL.revokeObjectURL(row.logoPreview) })
      setBulkNamesText(''); setBulkTagsText(''); setBulkRows([]); setBulkOpen(false)
      setMessage(`${payload.criadas || 0} equipe(s) criada(s). Cada cadastro recebe um ID público próprio, mesmo quando nome ou TAG se repetem.`)
      await load({ preserveMessage: true })
    } catch (error: any) { setMessage(error?.message || 'Não foi possível criar as equipes.') }
    finally { setBusy('') }
  }

  function changeBulkColumn(kind: 'names' | 'tags', value: string) {
    const names = kind === 'names' ? value : bulkNamesText
    const tags = kind === 'tags' ? value : bulkTagsText
    if (kind === 'names') setBulkNamesText(value)
    else setBulkTagsText(value)
    setBulkRows((current) => buildBulkRows(names, tags, current))
  }
  function updateBulkRow(index: number, patch: Partial<Row>) { setBulkRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row)) }
  function updateBulkLogo(index: number, file?: File) {
    if (!file) return
    setBulkRows((current) => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row
      if (row.logoPreview) URL.revokeObjectURL(row.logoPreview)
      return { ...row, logoFile: file, logoPreview: URL.createObjectURL(file) }
    }))
  }
  function removeBulkRow(index: number) {
    setBulkRows((current) => {
      const removed = current[index]
      if (removed?.logoPreview) URL.revokeObjectURL(removed.logoPreview)
      return current.filter((_, rowIndex) => rowIndex !== index)
    })
  }
  function cancelBulk() {
    bulkRows.forEach((row) => { if (row.logoPreview) URL.revokeObjectURL(row.logoPreview) })
    setBulkNamesText(''); setBulkTagsText(''); setBulkRows([]); setBulkOpen(false)
    setBulkNameMatches({}); setBulkCheckError('')
  }

  async function saveTeam() {
    if (!selected) return
    setBusy('team'); setMessage('')
    try {
      const logoUrl = draft.logo_url
        ? await resolvePendingImageUpload(
            draft.logo_url,
            (file, bucket) => uploadPublicFile(file, bucket, { entityId: selected.id, uploadIntent: 'create_profile' }),
          )
        : ''
      await request('/api/produtora/equipes-provisorias', { method: 'PATCH', body: JSON.stringify({ equipe_id: selected.id, ...draft, logo_url: logoUrl }) })
      setMessage('Equipe atualizada.')
      setSelectedId(''); setSelectedLine(null); setRosterOpen(false); setManagerTab('dados')
      await load({ preserveMessage: true })
    } catch (error: any) { setMessage(error?.message || 'Não foi possível atualizar a equipe.') }
    finally { setBusy('') }
  }

  async function archiveTeam() {
    if (!selected) return
    setBusy('team-archive'); setMessage('')
    try {
      await request(`/api/produtora/equipes-provisorias?equipe_id=${encodeURIComponent(selected.id)}`, { method: 'DELETE' })
      setMessage('Equipe provisória arquivada.')
      setArchiveId(''); setSelectedId(''); setSelectedLine(null); setRosterOpen(false)
      await load({ preserveMessage: true })
    } catch (error: any) { setMessage(error?.message || 'Não foi possível arquivar a equipe.') }
    finally { setBusy('') }
  }

  async function createLine() {
    if (!selected || !lineDraft.nome.trim()) return
    setBusy('line'); setMessage('')
    try {
      const payload = await request(`/api/equipes/${selected.id}/lines`, { method: 'POST', body: JSON.stringify(lineDraft) })
      setLineDraft({ nome: '', tag: '' }); setMessage('Line criada.')
      await load({ preserveMessage: true })
      if (payload.line) setSelectedLine(payload.line)
    } catch (error: any) { setMessage(error?.message || 'Não foi possível criar a line.') }
    finally { setBusy('') }
  }

  async function saveLine() {
    if (!selected || !selectedLine) return
    setBusy('line-edit'); setMessage('')
    try {
      const logoUrl = lineEdit.logo_url
        ? await resolvePendingImageUpload(
            lineEdit.logo_url,
            (file, bucket) => uploadPublicFile(file, bucket, { entityId: selected.id, uploadIntent: 'create_profile' }),
          )
        : ''
      const payload = await request(`/api/equipes/${selected.id}/lines`, { method: 'PATCH', body: JSON.stringify({ line_id: selectedLine.id, ...lineEdit, logo_url: logoUrl }) })
      setSelectedLine(payload.line || selectedLine)
      setMessage('Line atualizada.')
      await load({ preserveMessage: true })
    } catch (error: any) { setMessage(error?.message || 'Não foi possível atualizar a line.') }
    finally { setBusy('') }
  }

  async function archiveLine() {
    if (!selected || !selectedLine) return
    setBusy('line-archive'); setMessage('')
    try {
      await request(`/api/equipes/${selected.id}/lines?line_id=${encodeURIComponent(selectedLine.id)}`, { method: 'DELETE' })
      setMessage('Line arquivada.')
      setSelectedLine(null)
      setRosterOpen(false)
      await load({ preserveMessage: true })
    } catch (error: any) { setMessage(error?.message || 'Não foi possível arquivar a line.') }
    finally { setBusy('') }
  }

  async function copyClaim(team: Team) {
    if (!team.token) return
    const url = `${window.location.origin}/equipe/reivindicar/${team.token}`
    await navigator.clipboard.writeText(url)
    setMessage(`Link de ${team.nome} copiado.`)
  }

  function openTeam(teamId: string) {
    setArchiveId('')
    if (selectedId === teamId) { setSelectedId(''); setSelectedLine(null); setRosterOpen(false); return }
    setSelectedId(teamId); setSelectedLine(null); setRosterOpen(false); setManagerTab('dados')
  }

  function openLine(line: any, openRoster = false) { setSelectedLine(line); setRosterOpen(openRoster); setManagerTab('lines') }

  if (loading) return <section className="provisional-teams"><div className="provisional-loading"><Loader2 className="spin" size={18}/> Carregando equipes provisórias...</div></section>

  return <section className="provisional-teams">
    <header className="provisional-head">
      <div><p className="eyebrow">Gestão temporária</p><h2>Equipes provisórias</h2><span>Cadastre em bloco, organize tudo e transfira o controle quando encontrar o responsável.</span></div>
      <button type="button" className="button" onClick={() => setBulkOpen((value) => !value)}><Plus size={16}/> Cadastro em bloco</button>
    </header>

    {message ? <div className="message">{message}</div> : null}

    {bulkOpen ? <div className="provisional-bulk">
      <div className="provisional-bulk-copy"><strong>Cadastro em tabela</strong><span>Cole a lista de nomes na primeira coluna e a lista de TAGs na segunda. Cada linha forma uma equipe.</span></div>
      <div className="provisional-bulk-columns">
        <label><span>Nomes das equipes</span><textarea value={bulkNamesText} onChange={(e) => changeBulkColumn('names', e.target.value)} placeholder={'Fluxo\nTropa do Pará\nAmazon Cria'} rows={7}/></label>
        <label><span>TAGs</span><textarea value={bulkTagsText} onChange={(e) => changeBulkColumn('tags', e.target.value)} placeholder={'FLX\nTPA\nAMZ'} rows={7}/></label>
      </div>
      <div className="provisional-preview-head"><strong>{bulkRows.length} equipe(s) prontas</strong><span>Nada é salvo até você confirmar. Edite a prévia se a planilha precisar de correção.</span></div>
      {checkingBulkNames ? <div className="provisional-name-check-status"><Loader2 className="spin" size={14}/> Conferindo nomes já cadastrados...</div> : null}
      {bulkCheckError ? <div className="provisional-name-check-error">{bulkCheckError}</div> : null}
      {bulkRows.length ? <div className="provisional-preview editable"><div className="provisional-preview-labels"><span>#</span><strong>Nome</strong><strong>TAG</strong><strong>Logo</strong><strong>Verificação</strong><span/></div>{bulkRows.map((row, index) => {
        const matches = bulkNameMatches[normalizeTeamName(row.nome)] || []
        return <div key={`${index}-${row.nome}`}>
        <span>{index + 1}</span>
        <input aria-label={`Nome da equipe ${index + 1}`} value={row.nome} onChange={(event) => updateBulkRow(index, { nome: event.target.value })}/>
        <input aria-label={`TAG da equipe ${index + 1}`} value={row.tag} placeholder="Automática" onChange={(event) => updateBulkRow(index, { tag: event.target.value.toUpperCase() })}/>
        <label className="provisional-bulk-logo" title={`Logo da equipe ${index + 1}`}>
          {row.logoPreview ? <img src={row.logoPreview} alt=""/> : <ImagePlus size={16}/>}<span>{row.logoFile ? 'Trocar' : 'Adicionar'}</span>
          <input type="file" accept="image/*" hidden onChange={(event) => updateBulkLogo(index, event.target.files?.[0])}/>
        </label>
        <div className={`provisional-name-warning${matches.some((match) => match.kind === 'exact') ? ' exact' : ''}`}>
          {matches.length ? <><AlertTriangle size={14}/><div><strong>{matches.some((match) => match.kind === 'exact') ? 'Nome já cadastrado' : 'Nome parecido encontrado'}</strong>{matches.map((match) => <span key={match.id}>{match.nome}{match.tag ? ` · ${match.tag}` : ''}{match.public_id ? ` · EQ${match.public_id}` : ''}</span>)}<small>É apenas um aviso. Você pode manter ou remover esta linha.</small></div></> : <span className="provisional-name-clear">{checkingBulkNames ? 'Conferindo...' : 'Nenhuma semelhante'}</span>}
        </div>
        <button type="button" className="provisional-remove-row" aria-label={`Remover equipe ${index + 1}`} onClick={() => removeBulkRow(index)}><Trash2 size={14}/></button>
      </div>})}</div> : null}
      <div className="provisional-actions"><button type="button" className="button secondary" disabled={busy === 'bulk'} onClick={cancelBulk}>Cancelar</button><button type="button" className="button" disabled={!bulkRows.length || busy === 'bulk' || bulkRows.some((row) => !row.nome.trim())} onClick={() => void createBulk()}>{busy === 'bulk' ? <Loader2 className="spin" size={15}/> : <Save size={15}/>} {busy === 'bulk' ? 'Enviando logos e salvando...' : `Criar ${bulkRows.length || ''} equipes`}</button></div>
    </div> : null}

    {teams.length ? <div className="provisional-toolbar">
      <label className="provisional-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por ID, equipe, TAG ou localidade"/>{query ? <button type="button" aria-label="Limpar busca" onClick={() => setQuery('')}><X size={14}/></button> : null}</label>
      <span>{visibleTeams.length === teams.length ? `${teams.length} aguardando responsável` : `${visibleTeams.length} de ${teams.length} equipes`}</span>
    </div> : null}

    {!teams.length ? <div className="provisional-empty"><ShieldCheck size={28}/><strong>Nenhuma equipe aguardando responsável</strong><span>Quando uma equipe for reivindicada ou incorporada, ela desaparece automaticamente daqui.</span></div> : null}
    {teams.length && !visibleTeams.length ? <div className="provisional-empty compact"><Search size={22}/><strong>Nenhuma equipe encontrada</strong><span>Tente buscar pelo nome, TAG ou localidade.</span></div> : null}

    <div className="provisional-list">
      {visibleTeams.map((team) => <article key={team.id} className={selectedId === team.id ? 'open' : ''}>
        <button type="button" className="provisional-team-row" onClick={() => openTeam(team.id)}>
          <span className="provisional-logo">{team.logo_url ? <img src={team.logo_url} alt=""/> : String(team.tag || team.nome || 'EQ').slice(0, 2)}</span>
          <div><strong>{team.nome}</strong><span>{team.tag || 'Sem TAG'} · {team.public_id ? `EQ${team.public_id} · ` : ''}{team.lines?.length || 0} line(s) · {team.participacoes?.length || 0} campeonato(s)</span></div>
          <em>Aguardando responsável</em>
          {selectedId === team.id ? <ChevronDown size={17}/> : <ChevronRight size={17}/>} 
        </button>
        <button type="button" className="provisional-copy" onClick={() => void copyClaim(team)}><Copy size={14}/> Copiar link</button>

        {selectedId === team.id ? <div className="provisional-manager">
          <nav className="provisional-manager-tabs" aria-label="Gestão da equipe provisória">
            <button type="button" className={managerTab === 'dados' ? 'active' : ''} onClick={() => setManagerTab('dados')}><Pencil size={14}/> Informações</button>
            <button type="button" className={managerTab === 'lines' ? 'active' : ''} onClick={() => setManagerTab('lines')}><Users size={14}/> Lines</button>
            <button type="button" className={managerTab === 'campeonatos' ? 'active' : ''} onClick={() => setManagerTab('campeonatos')}><Trophy size={14}/> Campeonatos</button>
          </nav>

          {managerTab === 'dados' ? <div className="provisional-manager-section">
            <div className="provisional-edit-grid">
              <label><span>Nome *</span><input value={draft.nome || ''} onChange={(e) => setDraft((d: any) => ({ ...d, nome: e.target.value }))}/></label>
              <label><span>TAG *</span><input value={draft.tag || ''} onChange={(e) => setDraft((d: any) => ({ ...d, tag: e.target.value.toUpperCase() }))}/></label>
              <label className="wide"><span>E-mail de contato</span><input type="email" value={draft.email_contato || ''} onChange={(e) => setDraft((d: any) => ({ ...d, email_contato: e.target.value }))}/></label>
              <div className="wide provisional-location-field">
                <LocationSearch
                  label="Localidade"
                  value={{ pais: draft.pais || '', estado: draft.estado || '', cidade: draft.cidade || '' }}
                  placeholder="Digite cidade, estado ou país. Ex.: Belém"
                  onSelect={(location) => setDraft((d: any) => ({
                    ...d,
                    pais: location.pais,
                    estado: location.estado,
                    cidade: location.cidade,
                    localidade: `${location.cidade} - ${location.estado}`,
                  }))}
                />
              </div>
              <label className="wide"><span>Bio</span><textarea value={draft.bio || ''} onChange={(e) => setDraft((d: any) => ({ ...d, bio: e.target.value }))} rows={3}/></label>
            </div>
            <div className="provisional-manager-actions">
              <div className="provisional-upload-field">
                <UploadField
                  label="Logo"
                  value={draft.logo_url || ''}
                  bucket="equipe"
                  uploadContext={{ entityId: selected.id, uploadIntent: 'create_profile' }}
                  onChange={(url) => setDraft((current: any) => ({ ...current, logo_url: url }))}
                  onUpload={(file, bucket) => uploadPublicFile(file, bucket, { entityId: selected.id, uploadIntent: 'create_profile' })}
                />
              </div>
              {archiveId === selected.id ? <>
                <span className="provisional-archive-confirm">Arquivar esta equipe sem participação?</span>
                <button type="button" className="button secondary" disabled={busy === 'team-archive'} onClick={() => setArchiveId('')}>Cancelar</button>
                <button type="button" className="button secondary provisional-danger" disabled={busy === 'team-archive'} onClick={() => void archiveTeam()}>{busy === 'team-archive' ? <Loader2 className="spin" size={15}/> : <Archive size={15}/>} Confirmar arquivamento</button>
              </> : <button type="button" className="button secondary provisional-danger" disabled={busy === 'team'} onClick={() => setArchiveId(selected.id)}><Archive size={15}/> Arquivar equipe</button>}
              <button type="button" className="button" disabled={busy === 'team' || !String(draft.nome || '').trim() || !String(draft.tag || '').trim()} onClick={() => void saveTeam()}><Save size={15}/> Salvar informações</button>
            </div>
          </div> : null}

          {managerTab === 'lines' ? <div className="provisional-lines provisional-manager-section">
            <div className="provisional-subhead"><div><strong>Lines e jogadores</strong><span>Crie, edite e organize as lines. Convites podem ser gerados por line e por campeonato.</span></div><Users size={18}/></div>
            <div className="provisional-new-line"><input placeholder="Nome da nova line" value={lineDraft.nome} onChange={(e) => setLineDraft((d) => ({ ...d, nome: e.target.value }))}/><input placeholder="TAG" value={lineDraft.tag} onChange={(e) => setLineDraft((d) => ({ ...d, tag: e.target.value.toUpperCase() }))}/><button type="button" className="button secondary" disabled={!lineDraft.nome.trim() || busy === 'line'} onClick={() => void createLine()}><Plus size={14}/> Criar line</button></div>
            <div className="provisional-line-list">{(team.lines || []).map((line: any) => <button key={line.id} type="button" onClick={() => openLine(line, false)} className={selectedLine?.id === line.id ? 'active' : ''}><span className="provisional-line-logo">{line.logo_url ? <img src={line.logo_url} alt=""/> : String(line.tag || line.nome || 'L').slice(0, 2)}</span><span><strong>{line.nome}</strong><small>{line.tag || team.tag || 'Sem TAG'}{line.public_id ? ` · LN${line.public_id}` : ''}</small></span><ChevronRight size={15}/></button>)}</div>

            {selectedLine ? <div className="provisional-line-editor">
              <div className="provisional-subhead"><div><strong>Editar line</strong><span>Nome, TAG e logo são da própria line e não alteram o histórico.</span></div></div>
              <div className="provisional-line-edit-fields"><input value={lineEdit.nome || ''} placeholder="Nome da line" onChange={(e) => setLineEdit((d: any) => ({ ...d, nome: e.target.value }))}/><input value={lineEdit.tag || ''} placeholder="TAG" onChange={(e) => setLineEdit((d: any) => ({ ...d, tag: e.target.value.toUpperCase() }))}/></div>
              <div className="provisional-manager-actions">
                <div className="provisional-upload-field">
                  <UploadField
                    label="Logo da line"
                    value={lineEdit.logo_url || ''}
                    bucket="equipe"
                    uploadContext={{ entityId: selected.id, uploadIntent: 'create_profile' }}
                    onChange={(url) => setLineEdit((current: any) => ({ ...current, logo_url: url }))}
                    onUpload={(file, bucket) => uploadPublicFile(file, bucket, { entityId: selected.id, uploadIntent: 'create_profile' })}
                  />
                </div>
                <button type="button" className="button secondary" disabled={busy === 'line-edit' || !String(lineEdit.nome || '').trim()} onClick={() => void saveLine()}><Save size={14}/> Salvar line</button>
                <button type="button" className="button secondary" onClick={() => setRosterOpen((value) => !value)}><Users size={14}/> {rosterOpen ? 'Fechar jogadores' : 'Jogadores e convites'}</button>
                <button type="button" className="button secondary provisional-danger" disabled={busy === 'line-archive'} onClick={() => void archiveLine()}><Archive size={14}/> Arquivar</button>
              </div>
            </div> : null}

            {selectedLine && rosterOpen && accessToken ? <div className="provisional-roster-wrap"><LineRosterManager accessToken={accessToken} equipeId={team.id} line={selectedLine} compact onChanged={() => void load()} onBack={() => setRosterOpen(false)}/></div> : null}
          </div> : null}

          {managerTab === 'campeonatos' ? <div className="provisional-championships provisional-manager-section">
            <div className="provisional-subhead"><div><strong>Participações da equipe</strong><span>Abra a line participante para organizar formação e gerar convite de jogador diretamente para o campeonato.</span></div><Trophy size={18}/></div>
            {(team.participacoes || []).length ? <div className="provisional-championship-list">{(team.participacoes || []).map((participacao: any) => {
              const line = (team.lines || []).find((item: any) => item.id === participacao.line_id)
              return <article key={participacao.id}>
                <span className="provisional-championship-logo">{participacao.campeonato?.logo_url ? <img src={participacao.campeonato.logo_url} alt=""/> : 'C'}</span>
                <div><strong>{participacao.campeonato?.nome || 'Campeonato'}</strong><small>{line ? `${line.nome}${line.tag ? ` · ${line.tag}` : ''}` : 'Line não identificada'}</small></div>
                {line ? <button type="button" className="button secondary" onClick={() => openLine(line, true)}><Users size={14}/> Jogadores e convites</button> : null}
              </article>
            })}</div> : <div className="provisional-empty compact"><Trophy size={22}/><strong>Sem participação vinculada</strong><span>Quando uma line desta equipe entrar em campeonato, ela aparecerá aqui.</span></div>}
          </div> : null}
        </div> : null}
      </article>)}
    </div>
  </section>
}
