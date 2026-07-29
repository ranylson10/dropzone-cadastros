'use client'

import { useMemo, useState } from 'react'
import { Copy, Download, ImageDown, Loader2, Share2 } from 'lucide-react'

type RankingRow = {
  colocacao: number
  nome: string
  logo_url?: string | null
  quedas: number
  booyahs: number
  abates: number
  pontos_total: number
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function fitText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (ctx.measureText(value).width <= maxWidth) return value
  let result = value
  while (result.length > 2 && ctx.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1)
  return `${result}…`
}

async function loadImage(url?: string | null) {
  if (!url) return null
  return await new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível gerar a imagem.')), 'image/png')
  })
}

export function ResultadoWhatsappCard(props: {
  campeonatoId: string
  campeonatoNome: string
  campeonatoLogo?: string | null
  recorte: string
  ranking: RankingRow[]
}) {
  const [imageUrl, setImageUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const links = useMemo(() => {
    if (typeof window === 'undefined') return { vagas: '', stats: '' }
    const base = `${window.location.origin}/campeonatos/${props.campeonatoId}`
    return { vagas: base, stats: `${base}?aba=estatisticas` }
  }, [props.campeonatoId])
  const message = useMemo(() => [
    `🏆 *${props.campeonatoNome}*`,
    `📊 ${props.recorte}`,
    '',
    'Veja quem está dominando a competição!',
    '',
    `🎟️ *Garanta sua vaga:* ${links.vagas}`,
    `📈 *Estatísticas completas:* ${links.stats}`,
  ].join('\n'), [links, props.campeonatoNome, props.recorte])

  async function generate() {
    if (!props.ranking.length) return setNotice('Registre a pontuação antes de gerar o card.')
    setBusy(true)
    setNotice('')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1080
      canvas.height = 1350
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Seu navegador não permite gerar a imagem.')
      const gradient = ctx.createLinearGradient(0, 0, 1080, 1350)
      gradient.addColorStop(0, '#181d28')
      gradient.addColorStop(.55, '#090b10')
      gradient.addColorStop(1, '#261d05')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 1080, 1350)
      ctx.fillStyle = '#d8ae28'
      ctx.fillRect(0, 0, 1080, 16)
      ctx.globalAlpha = .12
      for (let x = -200; x < 1200; x += 130) {
        ctx.save()
        ctx.translate(x, 0)
        ctx.rotate(-.28)
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, 2, 1500)
        ctx.restore()
      }
      ctx.globalAlpha = 1

      const logo = await loadImage(props.campeonatoLogo)
      if (logo) {
        ctx.save()
        roundedRect(ctx, 68, 70, 142, 142, 28)
        ctx.clip()
        ctx.drawImage(logo, 68, 70, 142, 142)
        ctx.restore()
      } else {
        ctx.fillStyle = '#d8ae28'
        roundedRect(ctx, 68, 70, 142, 142, 28)
        ctx.fill()
        ctx.fillStyle = '#151923'
        ctx.font = '900 54px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(props.campeonatoNome.slice(0, 2).toUpperCase(), 139, 160)
      }
      ctx.textAlign = 'left'
      ctx.fillStyle = '#d8ae28'
      ctx.font = '800 24px Arial'
      ctx.fillText('RESULTADO OFICIAL', 244, 98)
      ctx.fillStyle = '#fff'
      ctx.font = '900 50px Arial'
      ctx.fillText(fitText(ctx, props.campeonatoNome.toUpperCase(), 760), 244, 158)
      ctx.fillStyle = '#c7cad1'
      ctx.font = '600 25px Arial'
      ctx.fillText(fitText(ctx, props.recorte, 760), 244, 202)

      ctx.fillStyle = 'rgba(255,255,255,.07)'
      roundedRect(ctx, 54, 258, 972, 775, 30)
      ctx.fill()
      ctx.strokeStyle = 'rgba(216,174,40,.45)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#d8ae28'
      ctx.font = '800 21px Arial'
      ctx.fillText('CLASSIFICAÇÃO', 88, 306)
      ctx.fillStyle = '#8f95a1'
      ctx.textAlign = 'right'
      ctx.fillText('Q   BOOYAH   ABATES   PTS', 984, 306)

      for (let index = 0; index < props.ranking.slice(0, 8).length; index += 1) {
        const row = props.ranking[index]
        const y = 332 + index * 82
        ctx.fillStyle = index < 3 ? 'rgba(216,174,40,.12)' : 'rgba(255,255,255,.035)'
        roundedRect(ctx, 76, y, 928, 68, 16)
        ctx.fill()
        ctx.textAlign = 'center'
        ctx.fillStyle = index < 3 ? '#d8ae28' : '#d8dbe2'
        ctx.font = '900 29px Arial'
        ctx.fillText(`${row.colocacao}º`, 112, y + 44)
        const teamLogo = await loadImage(row.logo_url)
        if (teamLogo) {
          ctx.save()
          roundedRect(ctx, 150, y + 8, 52, 52, 12)
          ctx.clip()
          ctx.drawImage(teamLogo, 150, y + 8, 52, 52)
          ctx.restore()
        } else {
          ctx.fillStyle = '#303642'
          roundedRect(ctx, 150, y + 8, 52, 52, 12)
          ctx.fill()
        }
        ctx.textAlign = 'left'
        ctx.fillStyle = '#fff'
        ctx.font = '800 25px Arial'
        ctx.fillText(fitText(ctx, row.nome, 390), 222, y + 42)
        ctx.textAlign = 'right'
        ctx.fillStyle = '#d8dbe2'
        ctx.font = '700 23px Arial'
        ctx.fillText(`${row.quedas}     ${row.booyahs}          ${row.abates}`, 878, y + 42)
        ctx.fillStyle = '#d8ae28'
        ctx.font = '900 27px Arial'
        ctx.fillText(String(row.pontos_total), 982, y + 43)
      }

      ctx.textAlign = 'center'
      ctx.fillStyle = '#d8ae28'
      ctx.font = '900 29px Arial'
      ctx.fillText('SUA EQUIPE PODE SER A PRÓXIMA CAMPEÃ', 540, 1095)
      ctx.fillStyle = '#c7cad1'
      ctx.font = '600 21px Arial'
      ctx.fillText('Acompanhe a classificação e entre na disputa.', 540, 1132)
      ctx.fillStyle = '#d8ae28'
      roundedRect(ctx, 76, 1180, 440, 82, 18)
      ctx.fill()
      ctx.fillStyle = '#11141b'
      ctx.font = '900 24px Arial'
      ctx.fillText('GARANTA SUA VAGA', 296, 1231)
      ctx.fillStyle = '#fff'
      roundedRect(ctx, 538, 1180, 466, 82, 18)
      ctx.fill()
      ctx.fillStyle = '#11141b'
      ctx.fillText('CONFIRA AS ESTATÍSTICAS', 771, 1231)
      ctx.fillStyle = '#8f95a1'
      ctx.font = '700 18px Arial'
      ctx.fillText('DROPZONE COMPETITIVE SYSTEM', 540, 1312)

      const blob = await canvasBlob(canvas)
      if (imageUrl) URL.revokeObjectURL(imageUrl)
      const result = new File([blob], `resultado-${props.campeonatoId}.png`, { type: 'image/png' })
      setFile(result)
      setImageUrl(URL.createObjectURL(blob))
      setNotice('Card gerado. Agora compartilhe ou baixe a imagem.')
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Não foi possível gerar o card.')
    } finally {
      setBusy(false)
    }
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(message)
    setNotice('Texto com links copiado.')
  }
  function download() {
    if (!imageUrl) return
    const anchor = document.createElement('a')
    anchor.href = imageUrl
    anchor.download = `resultado-${props.campeonatoId}.png`
    anchor.click()
  }
  async function share() {
    if (!file) return
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: message, title: props.campeonatoNome })
    } else {
      download()
      await copyMessage()
      setNotice('Imagem baixada e texto copiado. Envie os dois no WhatsApp.')
    }
  }

  return <section className="result-share-card">
    <div className="result-share-copy"><p className="eyebrow">Divulgação pós-jogo</p><h4>Card para WhatsApp</h4><p>Gere uma arte com a classificação filtrada e uma mensagem pronta para vender vagas.</p></div>
    <div className="result-share-actions">
      <button className="button" type="button" onClick={() => void generate()} disabled={busy || !props.ranking.length}>{busy ? <Loader2 className="button-spinner" size={16}/> : <ImageDown size={16}/>} Gerar card</button>
      <button className="button secondary" type="button" onClick={() => void copyMessage()}><Copy size={16}/> Copiar texto</button>
    </div>
    {notice ? <p className="result-share-notice">{notice}</p> : null}
    {imageUrl ? <div className="result-share-preview"><img src={imageUrl} alt={`Card de resultado de ${props.campeonatoNome}`}/><div><button className="button" type="button" onClick={() => void share()}><Share2 size={16}/> Compartilhar</button><button className="button secondary" type="button" onClick={download}><Download size={16}/> Baixar PNG</button></div></div> : null}
  </section>
}
