'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Copy, ImagePlus, Link2, Loader2, Pencil, Plus, Save, ShieldCheck, Upload, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { LineRosterManager } from '@/components/equipes/LineRosterManager'
import './provisional-teams.css'

type Row = { nome: string; tag: string }
type Team = any

function parseBulk(text: string): Row[] {
  const seen = new Set<string>()
  return text.split(/\r?\n/).flatMap((raw) => {
    const line = raw.trim()
    if (!line) return []
    const parts = line.includes('\t') ? line.split('\t') : line.includes('|') ? line.split('|') : line.includes(';') ? line.split(';') : [line]
    const nome = String(parts[0] || '').trim().replace(/\s+/g, ' ')
    const tag = String(parts[1] || '').trim().toUpperCase()
    if (!nome) return []
    const key = nome.toLocaleLowerCase('pt-BR')
    if (seen.has(key)) return []
    seen.add(key)
    return [{ nome, tag }]
  }).slice(0, 100)
}

export function ProvisionalTeamsPanel({ uploadPublicFile }: { uploadPublicFile: (file: File, bucket: string) => Promise<string> }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [selectedLine, setSelectedLine] = useState<any>(null)
  const [draft, setDraft] = useState<any>({})
  const [lineDraft, setLineDraft] = useState({ nome: '', tag: '' })
  const [accessToken, setAccessToken] = useState('')

  const preview = useMemo(() => parseBulk(bulkText), [bulkText])
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
        setSelectedId(''); setSelectedLine(null)
      }
    } catch (error: any) { setMessage(error?.message || 'Erro ao carregar equipes provisórias.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])
  useEffect(() => {
    if (!selected) return
    setDraft({ nome: selected.nome || '', tag: selected.tag || '', logo_url: selected.logo_url || '', localidade: selected.localidade || '', bio: selected.bio || '' })
  }, [selectedId, teams])

  async function createBulk() {
    if (!preview.length) return
    setBusy('bulk'); setMessage('')
    try {
      const payload = await request('/api/produtora/equipes-provisorias', { method: 'POST', body: JSON.stringify({ equipes: preview }) })
      setBulkText(''); setBulkOpen(false)
      setMessage(`${payload.criadas || 0} equipe(s) criada(s).${payload.existentes ? ` ${payload.existentes} nome(s) já existiam e não foram duplicados.` : ''}`)
      await load()
    } catch (error: any) { setMessage(error?.message || 'Não foi possível criar as equipes.') }
    finally { setBusy('') }
  }

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
      await request(`/api/equipes/${selected.id}/lines`, { method: 'POST', body: JSON.stringify(lineDraft) })
      setLineDraft({ nome: '', tag: '' }); setMessage('Line criada.')
      await load()
    } catch (error: any) { setMessage(error?.message || 'Não foi possível criar a line.') }
    finally { setBusy('') }
  }

  async function copyClaim(team: Team) {
    if (!team.token) return
    const url = `${window.location.origin}/equipe/reivindicar/${team.token}`
    await navigator.clipboard.writeText(url)
    setMessage(`Link de ${team.nome} copiado.`)
  }

  if (loading) return <section className="provisional-teams"><div className="provisional-loading"><Loader2 className="spin" size={18}/> Carregando equipes provisórias...</div></section>

  return <section className="provisional-teams">
    <header className="provisional-head">
      <div><p className="eyebrow">Gestão temporária</p><h2>Equipes provisórias</h2><span>Cadastre em bloco, organize tudo e transfira o controle quando encontrar o responsável.</span></div>
      <button type="button" className="button" onClick={() => setBulkOpen((value) => !value)}><Plus size={16}/> Cadastro em bloco</button>
    </header>

    {message ? <div className="message">{message}</div> : null}

    {bulkOpen ? <div className="provisional-bulk">
      <div className="provisional-bulk-copy"><strong>Cole direto da planilha</strong><span>Use duas colunas: Nome e TAG. Também aceitamos “Nome | TAG”, ponto e vírgula ou somente o nome.</span></div>
      <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={'Fluxo\tFLX\nTropa do Pará\tTPA\nAmazon Cria\tAMZ'} rows={8}/>
      <div className="provisional-preview-head"><strong>{preview.length} equipe(s) prontas</strong><span>Nada é salvo até você confirmar.</span></div>
      {preview.length ? <div className="provisional-preview">{preview.map((row, index) => <div key={`${row.nome}-${index}`}><span>{index + 1}</span><strong>{row.nome}</strong><em>{row.tag || 'TAG automática'}</em></div>)}</div> : null}
      <div className="provisional-actions"><button type="button" className="button secondary" onClick={() => { setBulkText(''); setBulkOpen(false) }}>Cancelar</button><button type="button" className="button" disabled={!preview.length || busy === 'bulk'} onClick={() => void createBulk()}>{busy === 'bulk' ? <Loader2 className="spin" size={15}/> : <Save size={15}/>} Criar {preview.length || ''} equipes</button></div>
    </div> : null}

    {!teams.length ? <div className="provisional-empty"><ShieldCheck size={28}/><strong>Nenhuma equipe aguardando responsável</strong><span>Quando uma equipe for reivindicada ou incorporada, ela desaparece automaticamente daqui.</span></div> : null}

    <div className="provisional-list">
      {teams.map((team) => <article key={team.id} className={selectedId === team.id ? 'open' : ''}>
        <button type="button" className="provisional-team-row" onClick={() => { setSelectedId(selectedId === team.id ? '' : team.id); setSelectedLine(null) }}>
          <span className="provisional-logo">{team.logo_url ? <img src={team.logo_url} alt=""/> : String(team.tag || team.nome || 'EQ').slice(0, 2)}</span>
          <div><strong>{team.nome}</strong><span>{team.tag || 'Sem TAG'} · {team.lines?.length || 0} line(s) · {team.participacoes?.length || 0} campeonato(s)</span></div>
          <em>Aguardando responsável</em>
          {selectedId === team.id ? <ChevronDown size={17}/> : <ChevronRight size={17}/>} 
        </button>
        <button type="button" className="provisional-copy" onClick={() => void copyClaim(team)}><Copy size={14}/> Copiar link</button>

        {selectedId === team.id ? <div className="provisional-manager">
          <div className="provisional-edit-grid">
            <label><span>Nome</span><input value={draft.nome || ''} onChange={(e) => setDraft((d: any) => ({ ...d, nome: e.target.value }))}/></label>
            <label><span>TAG</span><input value={draft.tag || ''} onChange={(e) => setDraft((d: any) => ({ ...d, tag: e.target.value.toUpperCase() }))}/></label>
            <label className="wide"><span>Localidade</span><input value={draft.localidade || ''} onChange={(e) => setDraft((d: any) => ({ ...d, localidade: e.target.value }))} placeholder="Belém - PA"/></label>
            <label className="wide"><span>Bio</span><textarea value={draft.bio || ''} onChange={(e) => setDraft((d: any) => ({ ...d, bio: e.target.value }))} rows={2}/></label>
          </div>
          <div className="provisional-manager-actions">
            <label className="button secondary"><ImagePlus size={15}/>{busy === 'logo' ? 'Enviando...' : 'Adicionar logo'}<input type="file" accept="image/*" hidden onChange={(e) => void uploadLogo(e.target.files?.[0])}/></label>
            {draft.logo_url ? <span className="provisional-logo-preview"><img src={draft.logo_url} alt="Prévia da logo"/></span> : null}
            <button type="button" className="button" disabled={busy === 'team'} onClick={() => void saveTeam()}><Save size={15}/> Salvar informações</button>
          </div>

          <div className="provisional-lines">
            <div className="provisional-subhead"><div><strong>Lines e jogadores</strong><span>Use a mesma estrutura oficial da equipe. Convites podem ser gerados por line e por campeonato.</span></div><Users size={18}/></div>
            <div className="provisional-new-line"><input placeholder="Nome da nova line" value={lineDraft.nome} onChange={(e) => setLineDraft((d) => ({ ...d, nome: e.target.value }))}/><input placeholder="TAG" value={lineDraft.tag} onChange={(e) => setLineDraft((d) => ({ ...d, tag: e.target.value.toUpperCase() }))}/><button type="button" className="button secondary" disabled={!lineDraft.nome.trim() || busy === 'line'} onClick={() => void createLine()}><Plus size={14}/> Criar line</button></div>
            <div className="provisional-line-list">{(team.lines || []).map((line: any) => <button key={line.id} type="button" onClick={() => setSelectedLine(selectedLine?.id === line.id ? null : line)} className={selectedLine?.id === line.id ? 'active' : ''}><span><strong>{line.nome}</strong><small>{line.tag || team.tag || 'Sem TAG'}</small></span><ChevronRight size={15}/></button>)}</div>
            {selectedLine && accessToken ? <LineRosterManager accessToken={accessToken} equipeId={team.id} line={selectedLine} compact onChanged={() => void load()} onBack={() => setSelectedLine(null)}/> : null}
          </div>
        </div> : null}
      </article>)}
    </div>
  </section>
}
