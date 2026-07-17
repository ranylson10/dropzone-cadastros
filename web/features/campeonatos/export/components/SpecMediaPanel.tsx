'use client'

import { useEffect, useMemo, useState } from 'react'
import { Image as ImageIcon, Loader2, Save, Upload } from 'lucide-react'
import type { CampeonatoExportPayload } from '../types/campeonato-export.types'
import {
  buildSpecLogoItems,
  buildSpecPhotoItems,
  buildSpecLogosZip,
  buildSpecPhotosZip,
  composeOnCanvas,
  DEFAULT_LOGO_MARGIN,
  DEFAULT_PHOTO_MARGIN,
  downloadBlob,
  fileToDataUrl,
  LOGO_SIZE,
  PHOTO_H,
  PHOTO_W,
  type BoxMargin,
  type SpecLogoItem,
  type SpecPhotoItem,
} from '../utils/spec-media'

type Props = {
  data: CampeonatoExportPayload
  disabled?: boolean
}

type MediaTab = 'logos' | 'fotos'

function MarginFields({
  value,
  onChange,
  disabled,
  max = 140,
}: {
  value: BoxMargin
  onChange: (next: BoxMargin) => void
  disabled?: boolean
  max?: number
}) {
  function set(side: keyof BoxMargin, n: number) {
    onChange({ ...value, [side]: Math.max(0, Math.min(max, n || 0)) })
  }
  return (
    <div className="spec-margin-grid">
      <label>
        <span>Cima</span>
        <input type="number" min={0} max={max} value={value.top} disabled={disabled} onChange={(e) => set('top', Number(e.target.value))} />
      </label>
      <label>
        <span>Baixo</span>
        <input type="number" min={0} max={max} value={value.bottom} disabled={disabled} onChange={(e) => set('bottom', Number(e.target.value))} />
      </label>
      <label>
        <span>Esquerda</span>
        <input type="number" min={0} max={max} value={value.left} disabled={disabled} onChange={(e) => set('left', Number(e.target.value))} />
      </label>
      <label>
        <span>Direita</span>
        <input type="number" min={0} max={max} value={value.right} disabled={disabled} onChange={(e) => set('right', Number(e.target.value))} />
      </label>
      <button
        type="button"
        className="button secondary small"
        disabled={disabled}
        onClick={() => {
          const v = value.top
          onChange({ top: v, bottom: v, left: v, right: v })
        }}
      >
        Igualar à cima
      </button>
    </div>
  )
}

export function SpecMediaPanel({ data, disabled }: Props) {
  const [tab, setTab] = useState<MediaTab>('logos')

  const [logoBg, setLogoBg] = useState<string | null>(null)
  const [photoBg, setPhotoBg] = useState<string | null>(null)
  const [logoMargin, setLogoMargin] = useState<BoxMargin>({ ...DEFAULT_LOGO_MARGIN })
  const [photoMargin, setPhotoMargin] = useState<BoxMargin>({ ...DEFAULT_PHOTO_MARGIN })
  const [logoTintEnabled, setLogoTintEnabled] = useState(false)
  const [logoTint, setLogoTint] = useState('#FFFFFF')

  const [logos, setLogos] = useState<SpecLogoItem[]>([])
  const [photos, setPhotos] = useState<SpecPhotoItem[]>([])
  const [logoKey, setLogoKey] = useState<string | null>(null)
  const [photoKey, setPhotoKey] = useState<string | null>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    const nextLogos = buildSpecLogoItems(data)
    const nextPhotos = buildSpecPhotoItems(data)
    setLogos(nextLogos)
    setPhotos(nextPhotos)
    setLogoKey((k) => (k && nextLogos.some((l) => l.key === k) ? k : nextLogos[0]?.key || null))
    setPhotoKey((k) => (k && nextPhotos.some((p) => p.key === k) ? k : nextPhotos[0]?.key || null))
    setMsg('')
    setErr('')
  }, [data])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const activeLogo = useMemo(
    () => logos.find((l) => l.key === logoKey) || logos[0] || null,
    [logos, logoKey],
  )
  const activePhoto = useMemo(
    () => photos.find((p) => p.key === photoKey) || photos[0] || null,
    [photos, photoKey],
  )

  // prévia grande no canvas de trabalho
  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        if (tab === 'logos') {
          const blob = await composeOnCanvas({
            width: LOGO_SIZE,
            height: LOGO_SIZE,
            sourceUrl: activeLogo?.sourceUrl || null,
            backgroundUrl: logoBg,
            margin: logoMargin,
            tintColor: logoTintEnabled ? logoTint : null,
            fallbackColor: '#1a1a1a',
          })
          if (cancelled) return
          const url = URL.createObjectURL(blob)
          setPreviewUrl((old) => {
            if (old) URL.revokeObjectURL(old)
            return url
          })
        } else {
          const blob = await composeOnCanvas({
            width: PHOTO_W,
            height: PHOTO_H,
            sourceUrl: activePhoto?.sourceUrl || null,
            backgroundUrl: photoBg,
            margin: photoMargin,
            fallbackColor: '#1a1a1a',
          })
          if (cancelled) return
          const url = URL.createObjectURL(blob)
          setPreviewUrl((old) => {
            if (old) URL.revokeObjectURL(old)
            return url
          })
        }
      } catch {
        if (!cancelled) {
          setPreviewUrl((old) => {
            if (old) URL.revokeObjectURL(old)
            return null
          })
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [
    tab,
    activeLogo?.key,
    activeLogo?.sourceUrl,
    activePhoto?.key,
    activePhoto?.sourceUrl,
    logoBg,
    photoBg,
    logoMargin,
    photoMargin,
    logoTintEnabled,
    logoTint,
  ])

  async function onBg(kind: 'logo' | 'photo', file: File | null) {
    if (!file) {
      if (kind === 'logo') setLogoBg(null)
      else setPhotoBg(null)
      return
    }
    const url = await fileToDataUrl(file)
    if (kind === 'logo') setLogoBg(url)
    else setPhotoBg(url)
  }

  async function replaceSource(kind: 'logo' | 'photo', key: string, file: File | null) {
    if (!file) return
    const url = await fileToDataUrl(file)
    if (kind === 'logo') {
      setLogos((prev) => prev.map((l) => (l.key === key ? { ...l, sourceUrl: url } : l)))
    } else {
      setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, sourceUrl: url } : p)))
    }
  }

  async function salvarLogos() {
    if (!logos.length) {
      setErr('Nenhuma logo no escopo.')
      return
    }
    setBusy('logos')
    setErr('')
    setMsg('')
    try {
      const blob = await buildSpecLogosZip(
        logos,
        logoBg,
        logoMargin,
        logoTintEnabled ? logoTint : null,
        (done, total) => setProgress(`Logos ${done}/${total}`),
      )
      downloadBlob(blob, 'spec-logos-slots.zip')
      setMsg(`${logos.length} logos PNG 300×300 geradas.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao salvar logos.')
    } finally {
      setBusy('')
      setProgress('')
    }
  }

  async function salvarFotos() {
    const list = photos.filter((p) => p.idJogo)
    if (!list.length) {
      setErr('Nenhuma foto com id de jogo.')
      return
    }
    setBusy('fotos')
    setErr('')
    setMsg('')
    try {
      const blob = await buildSpecPhotosZip(
        list,
        photoBg,
        photoMargin,
        (done, total) => setProgress(`Fotos ${done}/${total}`),
      )
      downloadBlob(blob, 'spec-fotos-jogadores.zip')
      setMsg(`${list.length} fotos PNG 500×600 geradas.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao salvar fotos.')
    } finally {
      setBusy('')
      setProgress('')
    }
  }

  const isLogo = tab === 'logos'

  return (
    <section className="export-section export-section-compact spec-workspace-section">
      <div className="section-head">
        <h4>Estúdio SPEC · logos e fotos</h4>
        <small>área de trabalho · proporção real</small>
      </div>

      <div className="spec-tabs">
        <button
          type="button"
          className={tab === 'logos' ? 'active' : ''}
          onClick={() => setTab('logos')}
          disabled={disabled || Boolean(busy)}
        >
          1. Logos 300×300
        </button>
        <button
          type="button"
          className={tab === 'fotos' ? 'active' : ''}
          onClick={() => setTab('fotos')}
          disabled={disabled || Boolean(busy)}
        >
          2. Fotos 500×600
        </button>
      </div>

      {err ? <div className="message error">{err}</div> : null}
      {msg ? <p className="export-spec-msg">{msg}</p> : null}
      {progress ? (
        <p className="export-progress">
          <Loader2 size={13} className="spin" /> {progress}
        </p>
      ) : null}

      <div className="spec-workspace">
        {/* CANVAS / ÁREA DE TRABALHO */}
        <div className="spec-canvas-col">
          <div
            className={`spec-canvas-frame ${isLogo ? 'is-logo' : 'is-photo'}`}
            style={
              isLogo
                ? { aspectRatio: '1 / 1', maxWidth: 360 }
                : { aspectRatio: `${PHOTO_W} / ${PHOTO_H}`, maxWidth: 300 }
            }
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Prévia composição" />
            ) : (
              <div className="spec-canvas-empty">
                <Upload size={28} />
                <p>Adicione o fundo e selecione um item na lista</p>
                <small>{isLogo ? 'Proporção 1:1 · 300×300' : 'Proporção 5:6 · 500×600'}</small>
              </div>
            )}
          </div>
          <div className="spec-canvas-meta">
            {isLogo && activeLogo ? (
              <span>
                Slot <strong>{activeLogo.slotLetra}</strong> · código <code>{activeLogo.codigo}</code>
                {' · '}{activeLogo.equipeNome}
              </span>
            ) : null}
            {!isLogo && activePhoto ? (
              <span>
                <strong>{activePhoto.nick}</strong> · id <code>{activePhoto.idJogo}</code>
                {' · '}{activePhoto.equipeNome}
              </span>
            ) : null}
          </div>
        </div>

        {/* CONTROLES GERAIS */}
        <div className="spec-tools-col">
          <div className="spec-tool-block">
            <h5>{isLogo ? 'Fundo das logos' : 'Fundo das fotos'}</h5>
            <p className="export-help">Mesmo fundo para todas. Clique para enviar.</p>
            <label className="spec-upload-btn">
              <Upload size={14} />
              {isLogo
                ? (logoBg ? 'Trocar fundo das logos' : 'Adicionar fundo das logos')
                : (photoBg ? 'Trocar fundo das fotos' : 'Adicionar fundo das fotos')}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={disabled || Boolean(busy)}
                onChange={(e) => void onBg(isLogo ? 'logo' : 'photo', e.target.files?.[0] || null)}
              />
            </label>
            {(isLogo ? logoBg : photoBg) ? (
              <button
                type="button"
                className="link-button"
                style={{ minHeight: 28, fontSize: 11 }}
                onClick={() => (isLogo ? setLogoBg(null) : setPhotoBg(null))}
              >
                Remover fundo
              </button>
            ) : null}
          </div>

          <div className="spec-tool-block">
            <h5>Margens (geral)</h5>
            <p className="export-help">Cima, baixo e laterais — vale para todas.</p>
            {isLogo ? (
              <MarginFields value={logoMargin} onChange={setLogoMargin} disabled={disabled || Boolean(busy)} max={120} />
            ) : (
              <MarginFields value={photoMargin} onChange={setPhotoMargin} disabled={disabled || Boolean(busy)} max={180} />
            )}
          </div>

          {isLogo ? (
            <div className="spec-tool-block">
              <h5>Cor da logo</h5>
              <p className="export-help">
                Se a logo for preta e o fundo também, ative e escolha uma cor clara.
              </p>
              <label className="spec-check">
                <input
                  type="checkbox"
                  checked={logoTintEnabled}
                  disabled={disabled || Boolean(busy)}
                  onChange={(e) => setLogoTintEnabled(e.target.checked)}
                />
                Recolorir logos
              </label>
              {logoTintEnabled ? (
                <div className="export-color-row" style={{ marginTop: 8 }}>
                  <label className="export-color-field">
                    <span>Cor</span>
                    <input
                      type="color"
                      value={logoTint}
                      disabled={disabled || Boolean(busy)}
                      onChange={(e) => setLogoTint(e.target.value)}
                    />
                  </label>
                  <input
                    className="export-cell-input export-cell-input-sm"
                    value={logoTint}
                    disabled={disabled || Boolean(busy)}
                    onChange={(e) => setLogoTint(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="export-actions-row">
            {isLogo ? (
              <button
                className="button"
                type="button"
                disabled={disabled || Boolean(busy) || !logos.length}
                onClick={() => void salvarLogos()}
              >
                {busy === 'logos' ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                Salvar logos ZIP (300×300)
              </button>
            ) : (
              <button
                className="button"
                type="button"
                disabled={disabled || Boolean(busy) || !photos.length}
                onClick={() => void salvarFotos()}
              >
                {busy === 'fotos' ? <Loader2 size={15} className="spin" /> : <ImageIcon size={15} />}
                Salvar fotos ZIP (500×600)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* LISTA DE TESTE */}
      <div className="spec-list-block">
        <h5>{isLogo ? 'Testar logos (clique para ver no canvas)' : 'Testar fotos (clique para ver no canvas)'}</h5>
        <div className="export-table-wrap">
          {isLogo ? (
            <table className="export-table export-table-edit">
              <thead>
                <tr>
                  <th>Slot</th>
                  <th>Código</th>
                  <th>Equipe / Line</th>
                  <th>Origem</th>
                  <th>Trocar</th>
                </tr>
              </thead>
              <tbody>
                {logos.map((item) => (
                  <tr
                    key={item.key}
                    className={activeLogo?.key === item.key ? 'is-preview' : ''}
                    onClick={() => setLogoKey(item.key)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td><strong>{item.slotLetra}</strong></td>
                    <td><code>{item.codigo}</code></td>
                    <td>
                      {item.equipeNome}
                      <small style={{ display: 'block', color: 'var(--muted)' }}>{item.lineNome}</small>
                    </td>
                    <td>
                      {item.sourceUrl ? (
                        <img className="spec-thumb" src={item.sourceUrl} alt="" />
                      ) : (
                        <span className="empty">sem</span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={disabled || Boolean(busy)}
                        onChange={(e) => void replaceSource('logo', item.key, e.target.files?.[0] || null)}
                      />
                    </td>
                  </tr>
                ))}
                {!logos.length ? <tr><td colSpan={5}>Nenhuma logo no escopo.</td></tr> : null}
              </tbody>
            </table>
          ) : (
            <table className="export-table export-table-edit">
              <thead>
                <tr>
                  <th>Id jogo</th>
                  <th>Nick</th>
                  <th>Equipe</th>
                  <th>Origem</th>
                  <th>Trocar</th>
                </tr>
              </thead>
              <tbody>
                {photos.map((item) => (
                  <tr
                    key={item.key}
                    className={activePhoto?.key === item.key ? 'is-preview' : ''}
                    onClick={() => setPhotoKey(item.key)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td><code>{item.idJogo}</code></td>
                    <td>{item.nick}</td>
                    <td>{item.equipeNome}</td>
                    <td>
                      {item.sourceUrl ? (
                        <img className="spec-thumb spec-thumb-photo" src={item.sourceUrl} alt="" />
                      ) : (
                        <span className="empty">sem</span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={disabled || Boolean(busy)}
                        onChange={(e) => void replaceSource('photo', item.key, e.target.files?.[0] || null)}
                      />
                    </td>
                  </tr>
                ))}
                {!photos.length ? <tr><td colSpan={5}>Nenhuma foto no escopo.</td></tr> : null}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  )
}
