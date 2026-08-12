'use client'

import { ArrowLeft, Copy, ImagePlus, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { uploadPublicFile } from '@/lib/upload-public'
import type { PostArtworkProject, PostArtworkSliceDirection } from '../types/artwork.types'
import '../post-artworks.css'

type ApiPayload = { campeonato?: { id: string; nome: string }; items?: PostArtworkProject[]; item?: PostArtworkProject; error?: string }

async function authFetch(url: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Entre na sua conta para editar artes deste campeonato.')
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })
  const body = await response.json().catch(() => ({})) as ApiPayload
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a operação.')
  return body
}


function EditableNumberInput(props: { value: number; min: number; max: number; onCommit: (value: number) => void }) {
  const [text, setText] = useState(String(props.value))
  useEffect(() => setText(String(props.value)), [props.value])
  function commit() {
    const parsed = Number(text.replace(',', '.'))
    if (!Number.isFinite(parsed)) { setText(String(props.value)); return }
    const next = Math.max(props.min, Math.min(props.max, Math.round(parsed)))
    props.onCommit(next)
    setText(String(next))
  }
  return <input inputMode="numeric" value={text} onChange={(event) => setText(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); (event.currentTarget as HTMLInputElement).blur() } }} />
}

function cloneDraft(item: PostArtworkProject): PostArtworkProject {
  return { ...item, blocks: item.blocks.map((block) => ({ ...block, style: { ...(block.style || {}) } })) }
}

export function PostArtworkWorkspace({ campeonatoId }: { campeonatoId: string }) {
  const [items, setItems] = useState<PostArtworkProject[]>([])
  const [activeId, setActiveId] = useState('')
  const [draft, setDraft] = useState<PostArtworkProject | null>(null)
  const [campeonatoNome, setCampeonatoNome] = useState('Campeonato')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  async function reload(preferredId?: string) {
    setLoading(true)
    setError('')
    try {
      const body = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem`)
      const next = body.items || []
      setItems(next)
      setCampeonatoNome(body.campeonato?.nome || 'Campeonato')
      const nextId = preferredId || activeId || next[0]?.id || ''
      setActiveId(nextId)
      const selected = next.find((item) => item.id === nextId) || null
      setDraft(selected ? cloneDraft(selected) : null)
    } catch (e: any) {
      setError(e?.message || 'Erro ao abrir as artes para postagem.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void reload() }, [campeonatoId])

  function selectItem(id: string) {
    setActiveId(id)
    const selected = items.find((item) => item.id === id) || null
    setDraft(selected ? cloneDraft(selected) : null)
    setFeedback('')
    setError('')
  }

  async function createProject() {
    setSaving(true)
    setError('')
    try {
      const body = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem`, {
        method: 'POST',
        body: JSON.stringify({ name: `Arte ${items.length + 1}` }),
      })
      if (body.item) await reload(body.item.id)
    } catch (e: any) {
      setError(e?.message || 'Erro ao criar arte.')
    } finally { setSaving(false) }
  }

  async function saveProject() {
    if (!draft) return
    setSaving(true)
    setError('')
    setFeedback('')
    try {
      const body = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/${encodeURIComponent(draft.id)}`, {
        method: 'PUT',
        body: JSON.stringify(draft),
      })
      if (body.item) {
        setItems((current) => current.map((item) => item.id === body.item!.id ? body.item! : item))
        setDraft(cloneDraft(body.item))
      }
      setFeedback('Arte salva. O template fica pronto para reutilizar com os dados atualizados do campeonato.')
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar arte.')
    } finally { setSaving(false) }
  }

  async function deleteProject() {
    if (!draft) return
    if (!window.confirm(`Excluir a arte “${draft.name}”?`)) return
    setSaving(true)
    setError('')
    try {
      await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/${encodeURIComponent(draft.id)}`, { method: 'DELETE' })
      setActiveId('')
      setDraft(null)
      await reload()
    } catch (e: any) {
      setError(e?.message || 'Erro ao excluir arte.')
    } finally { setSaving(false) }
  }

  async function uploadBackground(file?: File | null) {
    if (!file || !draft) return
    setUploading(true)
    setError('')
    try {
      const url = await uploadPublicFile(file, 'campeonato', 'produtora', { campeonatoId })
      setDraft({ ...draft, background_url: url })
    } catch (e: any) {
      setError(e?.message || 'Não foi possível enviar o fundo.')
    } finally { setUploading(false) }
  }

  function patchDraft(patch: Partial<PostArtworkProject>) {
    if (!draft) return
    setDraft({ ...draft, ...patch })
  }

  function patchSlices(patch: Partial<Pick<PostArtworkProject, 'slice_count' | 'slice_direction' | 'slice_width' | 'slice_height'>>) {
    if (!draft) return
    const sliceCount = Math.max(1, Math.min(10, Number(patch.slice_count ?? draft.slice_count) || 1))
    const sliceDirection = (patch.slice_direction ?? draft.slice_direction) as PostArtworkSliceDirection
    const sliceWidth = Math.max(240, Math.min(7680, Number(patch.slice_width ?? draft.slice_width) || 1080))
    const sliceHeight = Math.max(240, Math.min(7680, Number(patch.slice_height ?? draft.slice_height) || 1350))
    patchDraft({
      ...patch,
      slice_count: sliceCount,
      slice_direction: sliceDirection,
      slice_width: sliceWidth,
      slice_height: sliceHeight,
      width: sliceDirection === 'horizontal' ? sliceWidth * sliceCount : sliceWidth,
      height: sliceDirection === 'vertical' ? sliceHeight * sliceCount : sliceHeight,
    })
  }

  const previewScale = useMemo(() => draft ? Math.min(1, 820 / draft.width, 620 / draft.height) : 1, [draft])

  if (loading) return <div className="post-artworks-state"><Loader2 className="spin" /> Carregando artes…</div>

  return (
    <div className="post-artworks-page">
      <header className="post-artworks-header">
        <div>
          <a href={`/campeonatos/${campeonatoId}`}><ArrowLeft size={15} /> Voltar ao campeonato</a>
          <small>ESTATÍSTICAS PARA POSTAR</small>
          <h1>{campeonatoNome}</h1>
          <p>Crie templates independentes da transmissão. Configure a arte uma vez e depois gere novamente com os dados atualizados.</p>
        </div>
        <button type="button" className="post-artworks-primary" onClick={() => void createProject()} disabled={saving}><Plus size={15} /> Nova arte</button>
      </header>

      {error ? <div className="post-artworks-alert error">{error}</div> : null}
      {feedback ? <div className="post-artworks-alert success">{feedback}</div> : null}

      <div className="post-artworks-workspace">
        <aside className="post-artworks-list-panel">
          <div className="post-artworks-panel-title"><strong>Artes salvas</strong><small>{items.length} template(s)</small></div>
          <div className="post-artworks-list">
            {items.map((item) => <button type="button" key={item.id} className={item.id === activeId ? 'active' : ''} onClick={() => selectItem(item.id)}><b>{item.name}</b><span>{item.width} × {item.height}</span><small>{item.slice_count} fatia(s) · {item.output_format.toUpperCase()}</small></button>)}
            {!items.length ? <div className="post-artworks-empty"><strong>Nenhuma arte criada</strong><span>Crie a primeira prancha para tabela, MVP, classificados ou outro conteúdo.</span></div> : null}
          </div>
        </aside>

        {draft ? <>
          <section className="post-artworks-controls">
            <div className="post-artworks-panel-title"><strong>Projeto</strong><small>Canvas e exportação</small></div>
            <label>Nome da arte<input value={draft.name} onChange={(event) => patchDraft({ name: event.target.value })} /></label>
            <div className="post-artworks-grid2">
              <label>Largura da fatia<EditableNumberInput value={draft.slice_width} min={240} max={7680} onCommit={(value) => patchSlices({ slice_width: value })} /></label>
              <label>Altura da fatia<EditableNumberInput value={draft.slice_height} min={240} max={7680} onCommit={(value) => patchSlices({ slice_height: value })} /></label>
              <label>Quantidade de fatias<EditableNumberInput value={draft.slice_count} min={1} max={10} onCommit={(value) => patchSlices({ slice_count: value })} /></label>
              <label>Direção<select value={draft.slice_direction} onChange={(event) => patchSlices({ slice_direction: event.target.value as PostArtworkSliceDirection })}><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label>
            </div>
            <div className="post-artworks-summary"><span>Área total</span><strong>{draft.width} × {draft.height}</strong><small>{draft.slice_count} fatia(s) de {draft.slice_width} × {draft.slice_height}</small></div>
            <label>Formato<select value={draft.output_format} onChange={(event) => patchDraft({ output_format: event.target.value as PostArtworkProject['output_format'] })}><option value="png">PNG</option><option value="jpg">JPG</option></select></label>
            <label>Cor base<input type="color" value={draft.background_color} onChange={(event) => patchDraft({ background_color: event.target.value })} /></label>
            <label className="post-artworks-upload">{uploading ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />} {draft.background_url ? 'Trocar fundo da arte' : 'Enviar fundo da arte'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadBackground(event.target.files?.[0])} /></label>
            {draft.background_url ? <button type="button" className="post-artworks-secondary" onClick={() => patchDraft({ background_url: null })}>Remover fundo</button> : null}
            <div className="post-artworks-actions"><button type="button" className="post-artworks-primary" onClick={() => void saveProject()} disabled={saving}>{saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Salvar template</button><button type="button" className="post-artworks-danger" onClick={() => void deleteProject()} disabled={saving}><Trash2 size={14} /> Excluir</button></div>
          </section>

          <main className="post-artworks-preview-panel">
            <div className="post-artworks-panel-title"><strong>Área de trabalho</strong><small>O fundo é da arte; os blocos estatísticos serão independentes da live.</small></div>
            <div className="post-artworks-preview-shell">
              <div className="post-artworks-preview" style={{ width: draft.width * previewScale, height: draft.height * previewScale, backgroundColor: draft.background_color, backgroundImage: draft.background_url ? `url(${JSON.stringify(draft.background_url)})` : undefined }}>
                {Array.from({ length: Math.max(0, draft.slice_count - 1) }, (_, index) => <span key={index} className={`post-artworks-slice-line ${draft.slice_direction}`} style={draft.slice_direction === 'horizontal' ? { left: draft.slice_width * (index + 1) * previewScale } : { top: draft.slice_height * (index + 1) * previewScale }} />)}
                {Array.from({ length: draft.slice_count }, (_, index) => <b key={`label-${index}`} className="post-artworks-slice-label" style={draft.slice_direction === 'horizontal' ? { left: (draft.slice_width * index + 16) * previewScale, top: 16 * previewScale } : { left: 16 * previewScale, top: (draft.slice_height * index + 16) * previewScale }}>FATIA {index + 1}</b>)}
                {!draft.blocks.length ? <div className="post-artworks-canvas-empty"><strong>Canvas pronto</strong><span>Na próxima etapa entram os blocos independentes: Tabela Geral, Tabela do Dia, MVP, Booyahs e outros.</span></div> : null}
              </div>
            </div>
          </main>

          <aside className="post-artworks-blocks-panel">
            <div className="post-artworks-panel-title"><strong>Blocos da arte</strong><small>Independentes da transmissão</small></div>
            <div className="post-artworks-block-placeholder"><Copy size={18} /><strong>Tabela Geral será o primeiro bloco</strong><span>Faixa 1–12, duplicação para 13–24, linhas, colunas e fundos próprios entram na próxima rodada sem reutilizar layout da live.</span></div>
          </aside>
        </> : <section className="post-artworks-welcome"><strong>Crie ou selecione uma arte</strong><span>O editor de redes sociais agora vive fora do módulo de transmissão.</span></section>}
      </div>
    </div>
  )
}
