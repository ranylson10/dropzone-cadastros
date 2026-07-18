'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Copy,
  KeyRound,
  LayoutTemplate,
  Loader2,
  Plus,
  ShoppingBag,
  Sparkles,
  Globe2,
  Lock,
  Pencil,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  createOverlayFromCatalog,
  generatePurchaseCode,
  listCatalog,
  listPurchaseCodes,
  redeemPurchaseCode,
  saveOverlayAsCatalogModel,
  updateCatalogModel,
} from '../services/stream-catalog.service'
import { listOverlays } from '../services/stream-data.service'
import type { StreamCatalogModel, StreamCatalogVisibility, StreamOverlay, StreamPurchaseCode } from '../types/stream.types'
import '../stream.css'

type Tab = 'campeonato' | 'meus' | 'publicos' | 'resgatar'

export function StreamOverlayCatalog(props: { campeonatoId: string }) {
  const router = useRouter()
  const base = `/campeonatos/${props.campeonatoId}/stream`
  const [tab, setTab] = useState<Tab>('meus')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [missingTable, setMissingTable] = useState(false)

  const [champOverlays, setChampOverlays] = useState<StreamOverlay[]>([])
  const [mine, setMine] = useState<StreamCatalogModel[]>([])
  const [publics, setPublics] = useState<StreamCatalogModel[]>([])
  const [redeemCode, setRedeemCode] = useState('')
  const [codesFor, setCodesFor] = useState<string | null>(null)
  const [codes, setCodes] = useState<StreamPurchaseCode[]>([])

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [ov, m, p] = await Promise.all([
        listOverlays(props.campeonatoId),
        listCatalog('mine'),
        listCatalog('public'),
      ])
      setChampOverlays(ov.overlays)
      setMine(m.models)
      setPublics(p.models)
      setMissingTable(Boolean(m.missing_table || p.missing_table || ov.missing_table))
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar catálogo.')
    } finally {
      setLoading(false)
    }
  }, [props.campeonatoId])

  useEffect(() => {
    void reload()
  }, [reload])

  async function useModel(model: StreamCatalogModel) {
    setBusyId(model.id)
    setError('')
    setFeedback('')
    try {
      const overlay = await createOverlayFromCatalog(props.campeonatoId, model.id, model.name)
      setFeedback(`Overlay “${overlay.name}” criada neste campeonato.`)
      router.push(`${base}/overlays/${overlay.id}`)
    } catch (e: any) {
      setError(e?.message || 'Falha ao usar modelo.')
    } finally {
      setBusyId(null)
    }
  }

  async function blankNew() {
    setBusyId('blank')
    try {
      router.push(`${base}/overlays/blank`)
    } finally {
      setBusyId(null)
    }
  }

  async function saveChampAsModel(ov: StreamOverlay) {
    setBusyId(ov.id)
    setError('')
    try {
      if (ov.license_kind === 'purchased') {
        await saveOverlayAsCatalogModel({
          name: `${ov.name} (cópia)`,
          blocks: ov.blocks,
          frameW: ov.frameW,
          frameH: ov.frameH,
          visibility: 'private',
          is_purchased_copy: true,
          source_catalog_id: ov.catalog_source_id,
          license_kind: 'purchased',
        })
        setFeedback('Salvo nos seus modelos como privado (comprado — sem publicar/vender).')
      } else {
        await saveOverlayAsCatalogModel({
          name: ov.name,
          blocks: ov.blocks,
          frameW: ov.frameW,
          frameH: ov.frameH,
          visibility: 'private',
          license_kind: ov.license_kind || 'own',
          source_catalog_id: ov.catalog_source_id,
        })
        setFeedback(`“${ov.name}” salvo em Meus modelos.`)
      }
      await reload()
      setTab('meus')
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar modelo.')
    } finally {
      setBusyId(null)
    }
  }

  async function setVisibility(model: StreamCatalogModel, visibility: StreamCatalogVisibility) {
    if (model.is_purchased_copy && visibility !== 'private') {
      setError('Modelo comprado não pode ser público nem à venda.')
      return
    }
    setBusyId(model.id)
    try {
      await updateCatalogModel(model.id, { visibility })
      setFeedback(
        visibility === 'public'
          ? 'Modelo público no catálogo.'
          : visibility === 'for_sale'
            ? 'Modelo marcado para venda (gere códigos).'
            : 'Modelo privado.',
      )
      await reload()
    } catch (e: any) {
      setError(e?.message || 'Falha ao alterar visibilidade.')
    } finally {
      setBusyId(null)
    }
  }

  async function genCode(model: StreamCatalogModel) {
    if (model.is_purchased_copy) {
      setError('Modelo comprado não pode gerar códigos de venda.')
      return
    }
    setBusyId(model.id)
    try {
      const c = await generatePurchaseCode(model.id)
      setCodesFor(model.id)
      const list = await listPurchaseCodes(model.id)
      setCodes(list)
      setFeedback(`Código gerado: ${c.code} — envie ao comprador.`)
      await navigator.clipboard.writeText(c.code).catch(() => undefined)
      await reload()
    } catch (e: any) {
      setError(e?.message || 'Falha ao gerar código.')
    } finally {
      setBusyId(null)
    }
  }

  async function showCodes(modelId: string) {
    setCodesFor(modelId)
    try {
      setCodes(await listPurchaseCodes(modelId))
    } catch {
      setCodes([])
    }
  }

  async function redeem() {
    setBusyId('redeem')
    setError('')
    try {
      const model = await redeemPurchaseCode(redeemCode)
      setFeedback(model.name + ' liberado. Use em “Meus modelos” (privado — sem revenda).')
      setRedeemCode('')
      await reload()
      setTab('meus')
    } catch (e: any) {
      setError(e?.message || 'Código inválido.')
    } finally {
      setBusyId(null)
    }
  }

  function visBadge(v: StreamCatalogVisibility, purchased?: boolean) {
    if (purchased) return <span className="stream-badge">comprado · privado</span>
    if (v === 'public') return <span className="stream-badge">público</span>
    if (v === 'for_sale') return <span className="stream-badge">à venda</span>
    return <span className="stream-badge">privado</span>
  }

  function ModelCard(propsCard: {
    model: StreamCatalogModel
    actions: 'mine' | 'public'
  }) {
    const m = propsCard.model
    const busy = busyId === m.id
    return (
      <article className="stream-catalog-card">
        <div className="stream-catalog-card-top">
          <LayoutTemplate size={18} />
          <div>
            <strong>{m.name}</strong>
            <p className="stream-hint">
              {m.block_count ?? m.blocks?.length ?? 0} bloco(s) · {m.frameW}×{m.frameH}
              {m.description ? ` · ${m.description}` : ''}
            </p>
          </div>
          {visBadge(m.visibility, m.is_purchased_copy)}
        </div>
        <div className="stream-catalog-card-actions">
          <button
            type="button"
            className="stream-primary-btn"
            disabled={busy}
            onClick={() => void useModel(m)}
          >
            {busy ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
            Usar neste campeonato
          </button>
          {propsCard.actions === 'mine' && !m.is_purchased_copy ? (
            <>
              <button type="button" className="stream-secondary-btn" disabled={busy} onClick={() => void setVisibility(m, 'public')}>
                <Globe2 size={14} /> Público
              </button>
              <button type="button" className="stream-secondary-btn" disabled={busy} onClick={() => void setVisibility(m, 'private')}>
                <Lock size={14} /> Privado
              </button>
              <button type="button" className="stream-secondary-btn" disabled={busy} onClick={() => void genCode(m)}>
                <KeyRound size={14} /> Gerar código venda
              </button>
              <button type="button" className="stream-icon-btn" onClick={() => void showCodes(m.id)}>
                Ver códigos
              </button>
            </>
          ) : null}
          {propsCard.actions === 'mine' && m.is_purchased_copy ? (
            <span className="stream-hint">Comprado: uso próprio apenas (sem publicar / revender).</span>
          ) : null}
        </div>
        {codesFor === m.id && codes.length > 0 ? (
          <ul className="stream-catalog-codes">
            {codes.map((c) => (
              <li key={c.id}>
                <code>{c.code}</code>
                <span>
                  {c.redemption_count}/{c.max_redemptions} usos
                </span>
                <button
                  type="button"
                  className="stream-icon-btn"
                  title="Copiar"
                  onClick={() => void navigator.clipboard.writeText(c.code)}
                >
                  <Copy size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    )
  }

  return (
    <div className="stream-editor stream-catalog-page">
      <header className="stream-workspace-header">
        <div className="stream-workspace-brand">
          <button type="button" className="stream-icon-btn" onClick={() => router.push(base)}>
            <ArrowLeft size={16} /> Voltar
          </button>
          <div>
            <p className="eyebrow">Stream · catálogo</p>
            <h1>Escolha um modelo de overlay</h1>
            <p className="stream-hint">
              Seus modelos, catálogo público, ou resgate de compra por código. Depois edita no canvas.
            </p>
          </div>
        </div>
        <div className="stream-panel-actions">
          <button type="button" className="stream-secondary-btn" onClick={() => void blankNew()} disabled={busyId === 'blank'}>
            <Sparkles size={15} /> Começar do zero
          </button>
        </div>
      </header>

      {missingTable ? (
        <div className="stream-error">
          Rode no Supabase: <code>DOWNLOAD_stream_overlay_catalog.sql</code> (e o SQL de overlays se ainda não rodou).
        </div>
      ) : null}
      {error ? <div className="stream-error">{error}</div> : null}
      {feedback ? <p className="stream-hint">{feedback}</p> : null}

      <nav className="stream-sheet-tabs stream-catalog-tabs" aria-label="Abas do catálogo">
        <button type="button" className={tab === 'meus' ? 'active' : ''} onClick={() => setTab('meus')}>
          Meus modelos
        </button>
        <button type="button" className={tab === 'campeonato' ? 'active' : ''} onClick={() => setTab('campeonato')}>
          Neste campeonato
        </button>
        <button type="button" className={tab === 'publicos' ? 'active' : ''} onClick={() => setTab('publicos')}>
          Públicos
        </button>
        <button type="button" className={tab === 'resgatar' ? 'active' : ''} onClick={() => setTab('resgatar')}>
          <ShoppingBag size={14} /> Resgatar compra
        </button>
      </nav>

      {loading ? (
        <p className="stream-hint" style={{ padding: 16 }}>
          <Loader2 size={16} className="spin" /> Carregando catálogo…
        </p>
      ) : null}

      {!loading && tab === 'meus' ? (
        <section className="stream-catalog-grid">
          {!mine.length ? (
            <div className="stream-empty-list">
              <strong>Nenhum modelo na sua biblioteca</strong>
              <p>Salve uma overlay do campeonato como modelo, ou resgate um código de compra.</p>
            </div>
          ) : (
            mine.map((m) => <ModelCard key={m.id} model={m} actions="mine" />)
          )}
        </section>
      ) : null}

      {!loading && tab === 'campeonato' ? (
        <section className="stream-catalog-grid">
          {!champOverlays.length ? (
            <div className="stream-empty-list">
              <strong>Nenhuma overlay neste campeonato</strong>
              <p>Use um modelo ou comece do zero.</p>
            </div>
          ) : (
            champOverlays.map((ov) => (
              <article key={ov.id} className="stream-catalog-card">
                <div className="stream-catalog-card-top">
                  <Pencil size={18} />
                  <div>
                    <strong>{ov.name}</strong>
                    <p className="stream-hint">
                      {ov.blocks?.length || 0} bloco(s)
                      {ov.license_kind === 'purchased' ? ' · licença comprada' : ''}
                    </p>
                  </div>
                </div>
                <div className="stream-catalog-card-actions">
                  <button
                    type="button"
                    className="stream-primary-btn"
                    onClick={() => router.push(`${base}/overlays/${ov.id}`)}
                  >
                    <Pencil size={14} /> Editar
                  </button>
                  <button
                    type="button"
                    className="stream-secondary-btn"
                    disabled={busyId === ov.id}
                    onClick={() => void saveChampAsModel(ov)}
                  >
                    <Copy size={14} /> Salvar como modelo
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      ) : null}

      {!loading && tab === 'publicos' ? (
        <section className="stream-catalog-grid">
          {!publics.length ? (
            <div className="stream-empty-list">
              <strong>Nenhum modelo público ainda</strong>
              <p>Quando alguém publicar um modelo, ele aparece aqui para copiar.</p>
            </div>
          ) : (
            publics.map((m) => <ModelCard key={m.id} model={m} actions="public" />)
          )}
        </section>
      ) : null}

      {!loading && tab === 'resgatar' ? (
        <section className="stream-panel stream-catalog-redeem">
          <h4>Resgatar código de compra</h4>
          <p className="stream-hint">
            O vendedor gera um código (ex.: <code>DZ-AB12-CD34</code>). Ao resgatar, o modelo fica na sua biblioteca
            como <strong>comprado</strong>: você pode usar e editar no campeonato, mas <strong>não pode publicar nem
            revender</strong>.
          </p>
          <label className="stream-field">
            <span>Código</span>
            <input
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              placeholder="DZ-XXXX-XXXX"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            className="stream-primary-btn"
            disabled={!redeemCode.trim() || busyId === 'redeem'}
            onClick={() => void redeem()}
          >
            {busyId === 'redeem' ? <Loader2 size={15} className="spin" /> : <KeyRound size={15} />}
            Confirmar compra
          </button>
        </section>
      ) : null}
    </div>
  )
}
