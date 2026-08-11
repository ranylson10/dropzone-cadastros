import { supabase } from '@/lib/supabase-browser'

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Falha ao incorporar imagem.'))
    reader.readAsDataURL(blob)
  })
}

async function fetchAsDataUrl(url: string) {
  if (!url || url.startsWith('data:')) return url
  if (url.startsWith('blob:')) return blobToDataUrl(await (await fetch(url)).blob())
  const { data } = await supabase.auth.getSession()
  const response = await fetch('/api/stream/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}) },
    body: JSON.stringify({ url }),
  })
  if (!response.ok) throw new Error(`Não foi possível carregar um recurso visual (${response.status}).`)
  return blobToDataUrl(await response.blob())
}

async function inlineCssUrls(value: string) {
  if (!value || value === 'none' || !value.includes('url(')) return value
  const matches = [...value.matchAll(/url\((['"]?)(.*?)\1\)/g)]
  let next = value
  for (const match of matches) {
    const raw = match[2]
    if (!raw || raw.startsWith('data:')) continue
    const embedded = await fetchAsDataUrl(raw)
    next = next.replace(match[0], `url("${embedded}")`)
  }
  return next
}

async function cloneWithComputedStyles(source: HTMLElement) {
  const clone = source.cloneNode(true) as HTMLElement
  const sourceElements = [source, ...Array.from(source.querySelectorAll<HTMLElement>('*'))]
  const cloneElements = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))]

  await Promise.all(sourceElements.map(async (element, index) => {
    const target = cloneElements[index]
    if (!target) return
    const computed = window.getComputedStyle(element)
    let cssText = ''
    for (const property of Array.from(computed)) {
      let value = computed.getPropertyValue(property)
      if (value.includes('url(')) value = await inlineCssUrls(value)
      cssText += `${property}:${value};`
    }
    target.setAttribute('style', cssText)

    if (element instanceof HTMLImageElement && target instanceof HTMLImageElement) {
      target.src = await fetchAsDataUrl(element.currentSrc || element.src)
    }
  }))

  clone.querySelectorAll('[data-stream-export-ignore="true"]').forEach((node) => node.remove())
  return clone
}

async function embedRemainingImageUrls(html: string) {
  const urls = Array.from(new Set(html.match(/https?:\/\/[^\s"')<>]+/g) || []))
  let output = html
  for (const url of urls) {
    if (url.includes('www.w3.org/')) continue
    try {
      output = output.split(url).join(await fetchAsDataUrl(url))
    } catch {
      throw new Error('Uma imagem da prancha não pôde ser preparada para exportação. Verifique a arte e tente novamente.')
    }
  }
  return output
}

async function waitForExportAreas(root: HTMLElement) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 30000) {
    const areas = Array.from(root.querySelectorAll<HTMLElement>('[data-stream-export-area]'))
    if (areas.every((area) => area.dataset.ready === 'true')) return
    await sleep(80)
  }
  throw new Error('A prancha ainda está carregando todas as áreas. Aguarde alguns segundos e tente novamente.')
}

function svgFromHtml(html: string, width: number, height: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden">${html}</div></foreignObject></svg>`
}

export async function renderStreamOutputElement(root: HTMLElement, width: number, height: number) {
  if (width <= 0 || height <= 0) throw new Error('Dimensões inválidas para exportação.')
  if (width * height > 80_000_000) throw new Error('A prancha ultrapassa o limite seguro de exportação. Reduza as dimensões ou a quantidade de fatias.')

  await waitForExportAreas(root)
  if (document.fonts?.ready) await document.fonts.ready
  await sleep(60)

  const clone = await cloneWithComputedStyles(root)
  const serializedClone = await embedRemainingImageUrls(new XMLSerializer().serializeToString(clone))
  const svg = svgFromHtml(serializedClone, width, height)
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image()
      next.onload = () => resolve(next)
      next.onerror = () => reject(new Error('O navegador não conseguiu renderizar a prancha final.'))
      next.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas indisponível para exportação.')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, width, height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function cropStreamOutputCanvas(source: HTMLCanvasElement, x: number, y: number, width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas indisponível para fatiamento.')
  context.drawImage(source, x, y, width, height, 0, 0, width, height)
  return canvas
}

export async function streamOutputCanvasToBlob(canvas: HTMLCanvasElement, format: 'png' | 'jpg') {
  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar o arquivo final.')), mime, format === 'jpg' ? 0.96 : undefined)
  })
}

export function downloadStreamOutputBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function sanitizeStreamOutputFilename(value: string) {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return normalized.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'saida'
}
