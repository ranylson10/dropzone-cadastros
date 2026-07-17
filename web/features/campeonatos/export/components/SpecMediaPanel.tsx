'use client'

import { useEffect, useMemo, useState } from 'react'
import { Image as ImageIcon, Loader2, Save } from 'lucide-react'
import type { CampeonatoExportPayload } from '../types/campeonato-export.types'
import {
  buildSpecLogoItems,
  buildSpecPhotoItems,
  buildSpecLogosZip,
  buildSpecPhotosZip,
  composeOnCanvas,
  downloadBlob,
  fileToDataUrl,
  LOGO_SIZE,
  PHOTO_H,
  PHOTO_W,
  type SpecLogoItem,
  type SpecPhotoItem,
} from '../utils/spec-media'

type Props = {
  data: CampeonatoExportPayload
  disabled?: boolean
}

export function SpecMediaPanel({ data, disabled }: Props) {
  const [logoBg, setLogoBg] = useState<string | null>(null)
  const [photoBg, setPhotoBg] = useState<string | null>(null)
  const [logoMargin, setLogoMargin] = useState(24)
  const [photoMargin, setPhotoMargin] = useState(30)
  const [logos, setLogos] = useState<SpecLogoItem[]>([])
  const [photos, setPhotos] = useState<SpecPhotoItem[]>([])
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    setLogos(buildSpecLogoItems(data))
    setPhotos(buildSpecPhotoItems(data))
    setMsg('')
    setErr('')
  }, [data])

  // limpa preview URL
  useEffect(() => () => {
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl)
  }, [previewBlobUrl])

  const logoPreviewItem = useMemo(
    () => logos.find((l) => l.key === previewKey) || logos[0] || null,
    [logos, previewKey],
  )

  async function onLogoBg(file: File | null) {
    if (!file) {
      setLogoBg(null)
      return
    }
    setLogoBg(await fileToDataUrl(file))
  }

  async function onPhotoBg(file: File | null) {
    if (!file) {
      setPhotoBg(null)
      return
    }
    setPhotoBg(await fileToDataUrl(file))
  }

  async function replaceLogoSource(key: string, file: File | null) {
    if (!file) return
    const url = await fileToDataUrl(file)
    setLogos((prev) => prev.map((l) => (l.key === key ? { ...l, sourceUrl: url } : l)))
  }

  async function replacePhotoSource(key: string, file: File | null) {
    if (!file) return
    const url = await fileToDataUrl(file)
    setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, sourceUrl: url } : p)))
  }

  async function refreshPreview(item: SpecLogoItem | null) {
    if (!item?.sourceUrl && !logoBg) {
      setPreviewBlobUrl(null)
      return
    }
    try {
      const blob = await composeOnCanvas({
        width: LOGO_SIZE,
        height: LOGO_SIZE,
        sourceUrl: item?.sourceUrl || null,
        backgroundUrl: logoBg,
        margin: logoMargin,
      })
      const url = URL.createObjectURL(blob)
      setPreviewBlobUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return url
      })
    } catch {
      // ignore preview errors
    }
  }

  useEffect(() => {
    void refreshPreview(logoPreviewItem)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoPreviewItem?.key, logoPreviewItem?.sourceUrl, logoBg, logoMargin])

  async function salvarLogos() {
    if (!logos.length) {
      setErr('Nenhuma logo/line com slot no escopo.')
      return
    }
    setBusy('logos')
    setErr('')
    setMsg('')
    setProgress('')
    try {
      const blob = await buildSpecLogosZip(logos, logoBg, logoMargin, (done, total) => {
        setProgress(`Logos ${done}/${total}`)
      })
      downloadBlob(blob, 'spec-logos-slots.zip')
      setMsg(`${logos.length} logos PNG 300×300 salvas (códigos de slot A/B/C…).`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao gerar logos.')
    } finally {
      setBusy('')
      setProgress('')
    }
  }

  async function salvarFotos() {
    const withId = photos.filter((p) => p.idJogo)
    if (!withId.length) {
      setErr('Nenhuma foto com id de jogo no escopo.')
      return
    }
    setBusy('fotos')
    setErr('')
    setMsg('')
    setProgress('')
    try {
      const blob = await buildSpecPhotosZip(withId, photoBg, photoMargin, (done, total) => {
        setProgress(`Fotos ${done}/${total}`)
      })
      downloadBlob(blob, 'spec-fotos-jogadores.zip')
      setMsg(`${withId.length} fotos PNG 500×600 salvas (nome = id do jogo).`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao gerar fotos.')
    } finally {
      setBusy('')
      setProgress('')
    }
  }

  return (
    <section className="export-section export-section-compact">
      <div className="section-head">
        <h4>Logos e fotos do SPEC</h4>
        <small>300×300 · 500×600 · PNG</small>
      </div>
      <p className="export-help">
        Fundo único para todas as logos e outro para as fotos. Margem evita colar na borda.
        Logos saem com código do slot (<code>902000034</code>=A, <code>902000035</code>=B…).
        Fotos saem com o <strong>id do jogo</strong>.
      </p>

      {err ? <div className="message error">{err}</div> : null}
      {msg ? <p className="export-spec-msg">{msg}</p> : null}
      {progress ? (
        <p className="export-progress">
          <Loader2 size={13} className="spin" /> {progress}
        </p>
      ) : null}

      <div className="spec-media-grid">
        {/* LOGOS */}
        <div className="spec-media-block">
          <h5>Logos das equipes / lines</h5>
          <div className="spec-media-controls">
            <label className="export-inline-field">
              <span>Fundo das logos</span>
              <input
                type="file"
                accept="image/*"
                disabled={disabled || Boolean(busy)}
                onChange={(e) => void onLogoBg(e.target.files?.[0] || null)}
              />
            </label>
            <label className="export-inline-field">
              <span>Margem (px)</span>
              <input
                type="number"
                min={0}
                max={120}
                value={logoMargin}
                disabled={disabled || Boolean(busy)}
                onChange={(e) => setLogoMargin(Number(e.target.value) || 0)}
              />
            </label>
            <div className="spec-preview-box">
              {previewBlobUrl ? (
                <img src={previewBlobUrl} alt="Prévia logo 300x300" width={120} height={120} />
              ) : (
                <span className="empty">Prévia 300×300</span>
              )}
            </div>
          </div>

          <div className="export-table-wrap">
            <table className="export-table export-table-edit">
              <thead>
                <tr>
                  <th>Slot</th>
                  <th>Código</th>
                  <th>Equipe / Line</th>
                  <th>Logo</th>
                  <th>Trocar</th>
                </tr>
              </thead>
              <tbody>
                {logos.map((item) => (
                  <tr
                    key={item.key}
                    className={previewKey === item.key || (!previewKey && logos[0]?.key === item.key) ? 'is-preview' : ''}
                    onClick={() => setPreviewKey(item.key)}
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
                        <span className="empty">sem logo</span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={disabled || Boolean(busy)}
                        onChange={(e) => void replaceLogoSource(item.key, e.target.files?.[0] || null)}
                      />
                    </td>
                  </tr>
                ))}
                {!logos.length ? (
                  <tr><td colSpan={5}>Nenhuma line/slot no escopo.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="export-actions-row">
            <button
              className="button small"
              type="button"
              disabled={disabled || Boolean(busy) || !logos.length}
              onClick={() => void salvarLogos()}
            >
              {busy === 'logos' ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
              Salvar logos (ZIP PNG 300×300)
            </button>
          </div>
        </div>

        {/* FOTOS */}
        <div className="spec-media-block">
          <h5>Fotos dos jogadores</h5>
          <div className="spec-media-controls">
            <label className="export-inline-field">
              <span>Fundo das fotos</span>
              <input
                type="file"
                accept="image/*"
                disabled={disabled || Boolean(busy)}
                onChange={(e) => void onPhotoBg(e.target.files?.[0] || null)}
              />
            </label>
            <label className="export-inline-field">
              <span>Margem (px)</span>
              <input
                type="number"
                min={0}
                max={200}
                value={photoMargin}
                disabled={disabled || Boolean(busy)}
                onChange={(e) => setPhotoMargin(Number(e.target.value) || 0)}
              />
            </label>
            <div className="spec-preview-box spec-preview-photo">
              {photoBg ? (
                <img src={photoBg} alt="Fundo foto" style={{ width: 80, height: 96, objectFit: 'cover' }} />
              ) : (
                <span className="empty">500×600</span>
              )}
            </div>
          </div>

          <div className="export-table-wrap">
            <table className="export-table export-table-edit">
              <thead>
                <tr>
                  <th>Id jogo</th>
                  <th>Nick</th>
                  <th>Equipe</th>
                  <th>Foto</th>
                  <th>Trocar</th>
                </tr>
              </thead>
              <tbody>
                {photos.map((item) => (
                  <tr key={item.key}>
                    <td><code>{item.idJogo}</code></td>
                    <td>{item.nick}</td>
                    <td>{item.equipeNome}</td>
                    <td>
                      {item.sourceUrl ? (
                        <img className="spec-thumb spec-thumb-photo" src={item.sourceUrl} alt="" />
                      ) : (
                        <span className="empty">sem foto</span>
                      )}
                    </td>
                    <td>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={disabled || Boolean(busy)}
                        onChange={(e) => void replacePhotoSource(item.key, e.target.files?.[0] || null)}
                      />
                    </td>
                  </tr>
                ))}
                {!photos.length ? (
                  <tr><td colSpan={5}>Nenhum jogador com id de jogo no escopo.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="export-actions-row">
            <button
              className="button small"
              type="button"
              disabled={disabled || Boolean(busy) || !photos.length}
              onClick={() => void salvarFotos()}
            >
              {busy === 'fotos' ? <Loader2 size={14} className="spin" /> : <ImageIcon size={14} />}
              Salvar fotos (ZIP PNG 500×600)
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
