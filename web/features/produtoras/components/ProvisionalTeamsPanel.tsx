'use client'

import { useEffect, useState } from 'react'
import { Archive, ChevronDown, ChevronRight, Copy, ImagePlus, Loader2, Pencil, Plus, Save, ShieldCheck, Trash2, Trophy, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { LineRosterManager } from '@/components/equipes/LineRosterManager'
import './provisional-teams.css'

type Row = { nome: string; tag: string }
type Team = any
type ManagerTab = 'dados' | 'lines' | 'campeonatos'

function parseBulk(text: string): Row[] {
  const seen = new Set<string>()
  const rows = text.split(/\r?\n/).flatMap((raw) => {
    const line = raw.trim()
    if (!line) return []
    const parts = line.includes('\t') ? line.split('\t') : line.includes('|') ? line.split('|') : line.includes(';') ? line.split(';') : [line]
    const nome = String(parts[0] || '').trim().replace(/\s+/g, ' ')
    const tag = String(parts[1] || '').trim().toUpperCase()
    if (!nome) return []
    const normalizedName = nome.toLocaleLowerCase('pt-BR')
    const normalizedTag = tag.toLocaleLowerCase('pt-BR')
    if ((normalizedName === 'nome' || normalizedName === 'equipe' || normalizedName === 'nome da equipe') && (!tag || normalizedTag === 'tag')) return []
    const key = normalizedName
    if (seen.has(key)) return []
    seen.add(key)
    return [{ nome, tag }]
  })
  return rows.slice(0, 100)
}

export function ProvisionalTeamsPanel({ uploadPublicFile }: { uploadPublicFile: (file: File, bucket: string) => Promise<string> }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkRows, setBulkRows] = useState<Row[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [managerTab, setManagerTab] = useState<ManagerTab>('dados')
  const [selectedLine, setSelectedLine] = useState<any>(null)
  const [draft, setDraft] = useState<any>({})
  const [lineDraft, setLineDraft] = useState({ nome: '', tag: '' })
  const [lineEdit, setLineEdit] = useState<any>({})
  const [accessToken, setAccessToken] = useState('')

  const selected = teams.find((team) => team.id === selectedId) || null

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
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options?.headers || {}),
      },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.error || 'Não foi possível concluir a operação.')
    return payload
  }

  async function load() {
    setLoading(true); setMessage('')
    try {
      const payload = await request('/api/produtora/equipes-provisorias')
      setTeams(payload.equipes || [])
      if (selectedId && !(payload.equipes || []).some((team: Team) => team.id === selectedId)) {
        setSelectedId(''); setSelectedLine(null); setManagerTab('dados')
      } else if (selectedLine) {
        const currentTeam = (payload.equipes || []).find((team: Team) => team.id === selectedId)
        const currentLine = currentTeam?.lines?.find((line: any) => line.id === selectedLine.id)
        if (currentLine) setSelectedLine(currentLine)
        else setSelectedLine(null)
      }
    } catch (error: any) { setMessage(error?.message || 'Erro ao carregar equipes provisórias.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])
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
      const payload = await request('/api/produtora/equipes-provisorias', { method: 'POST', body: JSON.stringify({ equipes: bulkRows }) })
      setBulkText(''); setBulkRows([]); setBulkOpen(false)
      setMessage(`${payload.criadas || 0} equipe(s) criada(s).${payload.existentes ? ` ${payload.existentes} nome(s) já existiam e não foram duplicados.` : ''}`)
      await load()
    } catch (error: any) { setMessage(error?.message || 'Não foi possível criar as equipes.') }
    finally { setBusy('') }
  }

  function changeBulkText(value: string) { setBulkText(value); setBulkRows(parseBulk(value)) }
  function updateBulkRow(index: number, patch: Partial<Row>) { setBulkRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row)) }
  function removeBulkRow(index: number) { setBulkRows((current) => current.filter((_, rowIndex) => rowIndex !== index)) }

  async function saveTeam() {
    if (!selected) return
    setBusy('team'); setMessage('')
    try {
      await request('/api/produtora/equipes-provisorias', { method: 'PATCH', body: JSON.stringify({ equipe_id: selected.id, ...draft }) })
      setMessage('Equipe atualizada.')
      await load()
    } catch (error: any) { setMessage(error?.message || 'Não foi possível atualizar a equipe.') }
    finally { setBusy('') }
  }

  async function uploadLogo(file?: File) {
    if (!file) return
    setBusy('logo'); setMessage('')
    try {
      const url = await uploadPublicFile(file, 'equipe')
      setDraft((current: any) => ({ ...current, logo_url: url }))
    } catch (error: any) { setMessage(error?.message || 'Não foi possível enviar a logo.') }
    finally { setBusy('') }
  }

  async function createLine() {
    if (!selected || !lineDraft.nome.trim()) return
    setBusy('line'); setMessage('')
    try {
      const payload = await request(`/api/equipes/${selected.id}/lines`, { method: 'POST', body: JSON.stringify(lineDraft) })
      setLineDraft({ nome: '', tag: '' }); setMessage('Line criada.')
      await load()
      if (payload.line) setSelectedLine(payload.line)
    } catch (error: any) { setMessage(error?.message || 'Não foi possível criar a line.') }
    finally { setBusy('') }
  }

  async function saveLine() {
    if (!selected || !selectedLine) return
    setBusy('line-edit'); setMessage('')
    try {
      const payload = await request(`/api/equipes/${selected.id}/lines`, { method: 'PATCH', body: JSON.stringify({ line_id: selectedLine.id, ...lineEdit }) })
      setSelectedLine(payload.line || selectedLine)
      setMessage('Line atualizada.')
      await load()
    } catch (error: any) { setMessage(error?.message || 'Não foi possível atualizar a line.') }
    finally { setBusy('') }
  }

  async function uploadLineLogo(file?: File) {
    if (!file) return
    setBusy('line-logo'); setMessage('')
    try {
      const url = await uploadPublicFile(file, 'equipe')
      setLineEdit((current: any) => ({ ...current, logo_url: url }))
    } catch (error: any) { setMessage(error?.message || 'Não foi possível enviar a logo da line.') }
    finally { setBusy('') }
  }

  async function archiveLine() {
    if (!selected || !selectedLine) return
    setBusy('line-archive'); setMessage('')
    try {
      await request(`/api/equipes/${selected.id}/lines?line_id=${encodeURIComponent(selectedLine.id)}`, { method: 'DELETE' })
      setMessage('Line arquivada.')
      setSelectedLine(null)
      await load()
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
    if (selectedId === teamId) { setSelectedId(''); setSelectedLine(null); return }
    setSelectedId(teamId); setSelectedLine(null); setManagerTab('dados')
  }

  function openLine(line: any) { setSelectedLine(line); setManagerTab('lines') }

  if (loading) return <section className="provisional-teams"><div className="provisional-loading"><Loader2 className="spin" size={18}/> Carregando equipes provisórias...</div></section>

  return <section className="provisional-teams">
    <header className="provisional-head">
      <div><p className="eyebrow">Gestão temporária</p><h2>Equipes provisórias</h2><span>Cadastre em bloco, organize tudo e transfira o controle quando encontrar o responsável.</span></div>
      <button type="button" className="button" onClick={() => setBulkOpen((value) => !value)}><Plus size={16}/> Cadastro em bloco</button>
    </header>

    {message ? <div className="message">{message}</div> : null}

    {bulkOpen ? <div className="provisional-bulk">
      <div className="provisional-bulk-copy"><strong>Cole direto da planilha</strong><span>Use duas colunas: Nome e TAG. Também aceitamos “Nome | TAG”, ponto e vírgula ou somente o nome.</span></div>
      <textarea value={bulkText} onChange={(e) => changeBulkText(e.target.value)} placeholder={'Nome\tTAG\nFluxo\tFLX\nTropa do Pará\tTPA\nAmazon Cria\tAMZ'} rows={8}/>
      <div className="provisional-preview-head"><strong>{bulkRows.length} equipe(s) prontas</strong><span>Nada é salvo até você confirmar. Edite a prévia se a planilha precisar de correção.</span></div>
      {bulkRows.length ? <div className="provisional-preview editable">{bulkRows.map((row, index) => <div key={`${index}-${row.nome}`}>
        <span>{index + 1}</span>
        <input aria-label={`Nome da equipe ${index + 1}`} value={row.nome} onChange={(event) => updateBulkRow(index, { nome: event.target.value })}/>
        <input aria-label={`TAG da equipe ${index + 1}`} value={row.tag} placeholder="Automática" onChange={(event) => updateBulkRow(index, { tag: event.target.value.toUpperCase() })}/>
        <button type="button" className="provisional-remove-row" aria-label={`Remover equipe ${index + 1}`} onClick={() => removeBulkRow(index)}><Trash2 size={14}/></button>
      </div>)}</div> : null}
      <div className="provisional-actions"><button type="button" className="button secondary" onClick={() => { setBulkText(''); setBulkRows([]); setBulkOpen(false) }}>Cancelar</button><button type="button" className="button" disabled={!bulkRows.length || busy === 'bulk' || bulkRows.some((row) => !row.nome.trim())} onClick={() => void createBulk()}>{busy === 'bulk' ? <Loader2 className="spin" size={15}/> : <Save size={15}/>} Criar {bulkRows.length || ''} equipes</button></div>
    </div> : null}

    {!teams.length ? <div className="provisional-empty"><ShieldCheck size={28}/><strong>Nenhuma equipe aguardando responsável</strong><span>Quando uma equipe for reivindicada ou incorporada, ela desaparece automaticamente daqui.</span></div> : null}

    <div className="provisional-list">
      {teams.map((team) => <article key={team.id} className={selectedId === team.id ? 'open' : ''}>
        <button type="button" className="provisional-team-row" onClick={() => openTeam(team.id)}>
          <span className="provisional-logo">{team.logo_url ? <img src={team.logo_url} alt=""/> : String(team.tag || team.nome || 'EQ').slice(0, 2)}</span>
          <div><strong>{team.nome}</strong><span>{team.tag || 'Sem TAG'} · {team.lines?.length || 0} line(s) · {team.participacoes?.length || 0} campeonato(s)</span></div>
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
              <label><span>Cidade</span><input value={draft.cidade || ''} onChange={(e) => setDraft((d: any) => ({ ...d, cidade: e.target.value }))}/></label>
              <label><span>Estado</span><input value={draft.estado || ''} onChange={(e) => setDraft((d: any) => ({ ...d, estado: e.target.value }))}/></label>
              <label><span>País</span><input value={draft.pais || ''} onChange={(e) => setDraft((d: any) => ({ ...d, pais: e.target.value }))}/></label>
              <label><span>Localidade de exibição</span><input value={draft.localidade || ''} onChange={(e) => setDraft((d: any) => ({ ...d, localidade: e.target.value }))} placeholder="Belém - PA"/></label>
              <label className="wide"><span>Bio</span><textarea value={draft.bio || ''} onChange={(e) => setDraft((d: any) => ({ ...d, bio: e.target.value }))} rows={3}/></label>
            </div>
            <div className="provisional-manager-actions">
              <label className="button secondary"><ImagePlus size={15}/>{busy === 'logo' ? 'Enviando...' : 'Adicionar logo'}<input type="file" accept="image/*" hidden onChange={(e) => void uploadLogo(e.target.files?.[0])}/></label>
              {draft.logo_url ? <span className="provisional-logo-preview"><img src={draft.logo_url} alt="Prévia da logo"/></span> : null}
              <button type="button" className="button" disabled={busy === 'team' || !String(draft.nome || '').trim() || !String(draft.tag || '').trim()} onClick={() => void saveTeam()}><Save size={15}/> Salvar informações</button>
            </div>
          </div> : null}

          {managerTab === 'lines' ? <div className="provisional-lines provisional-manager-section">
            <div className="provisional-subhead"><div><strong>Lines e jogadores</strong><span>Crie, edite e organize as lines. Convites podem ser gerados por line e por campeonato.</span></div><Users size={18}/></div>
            <div className="provisional-new-line"><input placeholder="Nome da nova line" value={lineDraft.nome} onChange={(e) => setLineDraft((d) => ({ ...d, nome: e.target.value }))}/><input placeholder="TAG" value={lineDraft.tag} onChange={(e) => setLineDraft((d) => ({ ...d, tag: e.target.value.toUpperCase() }))}/><button type="button" className="button secondary" disabled={!lineDraft.nome.trim() || busy === 'line'} onClick={() => void createLine()}><Plus size={14}/> Criar line</button></div>
            <div className="provisional-line-list">{(team.lines || []).map((line: any) => <button key={line.id} type="button" onClick={() => openLine(line)} className={selectedLine?.id === line.id ? 'active' : ''}><span className="provisional-line-logo">{line.logo_url ? <img src={line.logo_url} alt=""/> : String(line.tag || line.nome || 'L').slice(0, 2)}</span><span><strong>{line.nome}</strong><small>{line.tag || team.tag || 'Sem TAG'}</small></span><ChevronRight size={15}/></button>)}</div>

            {selectedLine ? <div className="provisional-line-editor">
              <div className="provisional-subhead"><div><strong>Editar line</strong><span>Nome, TAG e logo são da própria line e não alteram o histórico.</span></div></div>
              <div className="provisional-line-edit-fields"><input value={lineEdit.nome || ''} placeholder="Nome da line" onChange={(e) => setLineEdit((d: any) => ({ ...d, nome: e.target.value }))}/><input value={lineEdit.tag || ''} placeholder="TAG" onChange={(e) => setLineEdit((d: any) => ({ ...d, tag: e.target.value.toUpperCase() }))}/></div>
              <div className="provisional-manager-actions">
                <label className="button secondary"><ImagePlus size={14}/>{busy === 'line-logo' ? 'Enviando...' : 'Logo da line'}<input type="file" accept="image/*" hidden onChange={(e) => void uploadLineLogo(e.target.files?.[0])}/></label>
                {lineEdit.logo_url ? <span className="provisional-logo-preview"><img src={lineEdit.logo_url} alt="Prévia da logo da line"/></span> : null}
                <button type="button" className="button secondary" disabled={busy === 'line-edit' || !String(lineEdit.nome || '').trim()} onClick={() => void saveLine()}><Save size={14}/> Salvar line</button>
                <button type="button" className="button secondary provisional-danger" disabled={busy === 'line-archive'} onClick={() => void archiveLine()}><Archive size={14}/> Arquivar</button>
              </div>
            </div> : null}

            {selectedLine && accessToken ? <LineRosterManager accessToken={accessToken} equipeId={team.id} line={selectedLine} compact onChanged={() => void load()} onBack={() => setSelectedLine(null)}/> : null}
          </div> : null}

          {managerTab === 'campeonatos' ? <div className="provisional-championships provisional-manager-section">
            <div className="provisional-subhead"><div><strong>Participações da equipe</strong><span>Abra a line participante para organizar formação e gerar convite de jogador diretamente para o campeonato.</span></div><Trophy size={18}/></div>
            {(team.participacoes || []).length ? <div className="provisional-championship-list">{(team.participacoes || []).map((participacao: any) => {
              const line = (team.lines || []).find((item: any) => item.id === participacao.line_id)
              return <article key={participacao.id}>
                <span className="provisional-championship-logo">{participacao.campeonato?.logo_url ? <img src={participacao.campeonato.logo_url} alt=""/> : 'C'}</span>
                <div><strong>{participacao.campeonato?.nome || 'Campeonato'}</strong><small>{line ? `${line.nome}${line.tag ? ` · ${line.tag}` : ''}` : 'Line não identificada'}</small></div>
                {line ? <button type="button" className="button secondary" onClick={() => openLine(line)}><Users size={14}/> Jogadores e convites</button> : null}
              </article>
            })}</div> : <div className="provisional-empty compact"><Trophy size={22}/><strong>Sem participação vinculada</strong><span>Quando uma line desta equipe entrar em campeonato, ela aparecerá aqui.</span></div>}
          </div> : null}
        </div> : null}
      </article>)}
    </div>
  </section>
}
