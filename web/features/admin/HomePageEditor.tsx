'use client'

import { useEffect, useState } from 'react'
import { Input as UiInput, Select as UiSelect, Textarea as UiTextarea } from '@/components/ui/Field'
import { ImagePlus, Loader2, Save, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { uploadPublicFile } from '@/lib/upload-public'
import {
  DEFAULT_HOME_CONFIG,
  normalizeHomeConfig,
  type HomeCategory,
  type HomeConfig,
  type HomeHeroSlide,
  type HomePromo,
} from '@/features/home/home-config'
import './home-page-editor.css'

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada.')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

function cloneConfig(config: HomeConfig): HomeConfig {
  return JSON.parse(JSON.stringify(config)) as HomeConfig
}

export function HomePageEditor() {
  const [config, setConfig] = useState<HomeConfig>(() => cloneConfig(DEFAULT_HOME_CONFIG))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/site/home', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => {
        if (active) setConfig(normalizeHomeConfig(payload.config))
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  function patchHero(index: number, patch: Partial<HomeHeroSlide>) {
    setConfig((current) => {
      const next = cloneConfig(current)
      next.hero_slides[index] = { ...next.hero_slides[index], ...patch }
      return next
    })
  }

  function patchCategory(index: number, patch: Partial<HomeCategory>) {
    setConfig((current) => {
      const next = cloneConfig(current)
      next.categories[index] = { ...next.categories[index], ...patch }
      return next
    })
  }

  function patchPromo(index: number, patch: Partial<HomePromo>) {
    setConfig((current) => {
      const next = cloneConfig(current)
      next.promos[index] = { ...next.promos[index], ...patch }
      return next
    })
  }

  async function uploadImage(key: string, file: File | undefined, onDone: (url: string) => void) {
    if (!file) return
    setUploading(key)
    setError('')
    setNotice('')
    try {
      const url = await uploadPublicFile(file, 'site')
      onDone(url)
      setNotice('Imagem enviada. Clique em “Salvar página inicial” para publicar a alteração.')
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Não foi possível enviar a imagem.')
    } finally {
      setUploading('')
    }
  }

  async function save() {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/site/home', {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify({ config }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar a página inicial.')
      setConfig(normalizeHomeConfig(payload.config))
      setNotice('Página inicial atualizada.')
    } catch (saveError: any) {
      setError(saveError?.message || 'Não foi possível salvar a página inicial.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <section className="admin-section home-editor-loading"><Loader2 className="spin" size={20} /> Carregando página inicial…</section>
  }

  return (
    <section className="admin-section home-editor">
      <header className="home-editor-main-head">
        <div><p>VITRINE PÚBLICA</p><h2>Página inicial</h2><small>Edite somente as imagens e textos exibidos na Home.</small></div>
        <button type="button" onClick={() => void save()} disabled={saving || Boolean(uploading)}><Save size={16} /> {saving ? 'Salvando…' : 'Salvar página inicial'}</button>
      </header>

      {error ? <div className="admin-feedback error">{error}</div> : null}
      {notice ? <div className="admin-feedback">{notice}</div> : null}

      <div className="home-editor-block">
        <div className="home-editor-block-head"><div><strong>Banner principal</strong><small>3 destaques, como no carrossel da referência.</small></div></div>
        <div className="home-editor-hero-grid">
          {config.hero_slides.map((slide, index) => (
            <article className="home-editor-card" key={index}>
              <div className="home-editor-preview wide">
                {slide.image_url ? <img src={slide.image_url} alt="" /> : <span>SEM IMAGEM</span>}
                <label className="home-editor-upload"><ImagePlus size={15} /> {uploading === `hero-${index}` ? 'Enviando…' : 'Trocar imagem'}<UiInput type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(uploading)} onChange={(event) => void uploadImage(`hero-${index}`, event.target.files?.[0], (url) => patchHero(index, { image_url: url }))} /></label>
                {slide.image_url ? <button type="button" className="home-editor-remove" onClick={() => patchHero(index, { image_url: '' })} aria-label="Remover imagem"><Trash2 size={14} /></button> : null}
              </div>
              <div className="home-editor-fields">
                <label><span>Chamada pequena</span><UiInput value={slide.eyebrow} onChange={(event) => patchHero(index, { eyebrow: event.target.value })} /></label>
                <div className="home-editor-two"><label><span>Título</span><UiInput value={slide.title} onChange={(event) => patchHero(index, { title: event.target.value })} /></label><label><span>Título verde</span><UiInput value={slide.accent} onChange={(event) => patchHero(index, { accent: event.target.value })} /></label></div>
                <label><span>Descrição</span><UiTextarea value={slide.description} onChange={(event) => patchHero(index, { description: event.target.value })} /></label>
                <div className="home-editor-two"><label><span>Botão principal</span><UiInput value={slide.primary_label} onChange={(event) => patchHero(index, { primary_label: event.target.value })} /></label><label><span>Link principal</span><UiInput value={slide.primary_href} onChange={(event) => patchHero(index, { primary_href: event.target.value })} /></label></div>
                <div className="home-editor-two"><label><span>Botão secundário</span><UiInput value={slide.secondary_label} onChange={(event) => patchHero(index, { secondary_label: event.target.value })} /></label><label><span>Link secundário</span><UiInput value={slide.secondary_href} onChange={(event) => patchHero(index, { secondary_href: event.target.value })} /></label></div>
                <div className="home-editor-two"><label><span>Texto lateral</span><UiInput value={slide.side_title} onChange={(event) => patchHero(index, { side_title: event.target.value })} /></label><label><span>Descrição lateral</span><UiInput value={slide.side_text} onChange={(event) => patchHero(index, { side_text: event.target.value })} /></label></div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="home-editor-block">
        <div className="home-editor-block-head"><div><strong>Categorias</strong><small>Os 6 cards logo abaixo da faixa de benefícios.</small></div></div>
        <div className="home-editor-category-grid">
          {config.categories.map((category, index) => (
            <article className="home-editor-card compact" key={index}>
              <div className="home-editor-preview portrait">
                {category.image_url ? <img src={category.image_url} alt="" /> : <span>SEM IMAGEM</span>}
                <label className="home-editor-upload"><ImagePlus size={14} /> {uploading === `category-${index}` ? 'Enviando…' : 'Imagem'}<UiInput type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(uploading)} onChange={(event) => void uploadImage(`category-${index}`, event.target.files?.[0], (url) => patchCategory(index, { image_url: url }))} /></label>
              </div>
              <div className="home-editor-fields"><label><span>Nome</span><UiInput value={category.title} onChange={(event) => patchCategory(index, { title: event.target.value })} /></label><label><span>Link</span><UiInput value={category.href} onChange={(event) => patchCategory(index, { href: event.target.value })} /></label></div>
            </article>
          ))}
        </div>
      </div>

      <div className="home-editor-block">
        <div className="home-editor-block-head"><div><strong>Banners inferiores</strong><small>Os dois banners grandes antes da faixa de novidades.</small></div></div>
        <div className="home-editor-promo-grid">
          {config.promos.map((promo, index) => (
            <article className="home-editor-card" key={index}>
              <div className="home-editor-preview promo">
                {promo.image_url ? <img src={promo.image_url} alt="" /> : <span>SEM IMAGEM</span>}
                <label className="home-editor-upload"><ImagePlus size={15} /> {uploading === `promo-${index}` ? 'Enviando…' : 'Trocar imagem'}<UiInput type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(uploading)} onChange={(event) => void uploadImage(`promo-${index}`, event.target.files?.[0], (url) => patchPromo(index, { image_url: url }))} /></label>
              </div>
              <div className="home-editor-fields">
                <div className="home-editor-two"><label><span>Chamada</span><UiInput value={promo.eyebrow} onChange={(event) => patchPromo(index, { eyebrow: event.target.value })} /></label><label><span>Tema</span><UiSelect value={promo.theme} onChange={(event) => patchPromo(index, { theme: event.target.value === 'light' ? 'light' : 'dark' })}><option value="dark">Escuro</option><option value="light">Claro</option></UiSelect></label></div>
                <label><span>Título</span><UiInput value={promo.title} onChange={(event) => patchPromo(index, { title: event.target.value })} /></label>
                <label><span>Descrição</span><UiTextarea value={promo.description} onChange={(event) => patchPromo(index, { description: event.target.value })} /></label>
                <div className="home-editor-two"><label><span>Botão</span><UiInput value={promo.cta_label} onChange={(event) => patchPromo(index, { cta_label: event.target.value })} /></label><label><span>Link</span><UiInput value={promo.href} onChange={(event) => patchPromo(index, { href: event.target.value })} /></label></div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="home-editor-block home-editor-newsletter-settings">
        <div className="home-editor-block-head"><div><strong>Faixa de novidades</strong><small>Texto da faixa clara acima do rodapé.</small></div></div>
        <div className="home-editor-two"><label><span>Título</span><UiInput value={config.newsletter_title} onChange={(event) => setConfig((current) => ({ ...current, newsletter_title: event.target.value }))} /></label><label><span>Descrição</span><UiInput value={config.newsletter_text} onChange={(event) => setConfig((current) => ({ ...current, newsletter_text: event.target.value }))} /></label></div>
      </div>
    </section>
  )
}
