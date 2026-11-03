import { NextRequest, NextResponse } from 'next/server'

const cache = new Map<string, string>()
const requests = new Map<string, { count: number; resetAt: number }>()
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 30
// Defesa adicional por instancia. Para limite GLOBAL entre instancias,
// configurar rate limiting na borda (WAF/Redis). Nao confiar apenas no IP.
const GLOBAL_RATE_LIMIT = 120
const MAX_ACTIVE_PROVIDER_CALLS = 3
const MAX_BODY_BYTES = 18_000
let globalWindowStart = 0
let globalWindowCount = 0
let activeProviderCalls = 0
const MAX_RATE_KEYS = 2_000

function clientKey(req: NextRequest) {
  // Em Vercel, priorizar a identificacao atribuida pela plataforma. Fora
  // dela, x-forwarded-for pode ser controlado pelo cliente, portanto nao
  // constitui sozinho um limite de custo confiavel.
  const forwarded = process.env.VERCEL
    ? req.headers.get('x-vercel-forwarded-for')
    : req.headers.get('x-forwarded-for')
  return (forwarded?.split(',')[0]?.trim() || 'local').slice(0, 96)
}

function consumeRateLimit(key: string, now: number) {
  if (requests.size >= MAX_RATE_KEYS) {
    for (const [savedKey, rate] of requests) {
      if (rate.resetAt <= now) requests.delete(savedKey)
    }
    while (requests.size >= MAX_RATE_KEYS) {
      const oldestKey = requests.keys().next().value
      if (!oldestKey) break
      requests.delete(oldestKey)
    }
  }
  const rate = requests.get(key)
  if (!rate || rate.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  rate.count += 1
  return rate.count <= RATE_LIMIT
}

function consumeGlobalRateLimit(now: number) {
  if (!globalWindowStart || now >= globalWindowStart + RATE_WINDOW_MS) {
    globalWindowStart = now
    globalWindowCount = 0
  }
  globalWindowCount += 1
  return globalWindowCount <= GLOBAL_RATE_LIMIT
}

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin')
  // Sem Origin: aplicativos e clientes nao-browser podem consultar a rota.
  // Nao e autenticacao, mas evita chamadas cross-origin triviais do navegador.
  if (!origin) return true
  try {
    return new URL(origin).origin === req.nextUrl.origin
  } catch {
    return false
  }
}

class RequestTooLargeError extends Error {}

async function readJsonLimited(req: NextRequest): Promise<any> {
  if (!req.body) return {}
  const reader = req.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let raw = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new RequestTooLargeError('Requisição muito grande.')
      }
      raw += decoder.decode(value, { stream: true })
    }
    raw += decoder.decode()
    return JSON.parse(raw)
  } catch (error) {
    if (error instanceof RequestTooLargeError) throw error
    return {}
  } finally {
    reader.releaseLock()
  }
}

function stripFence(value: string) {
  return value.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Origem não permitida.' }, { status: 403 })
  const contentLength = Number(req.headers.get('content-length') || 0)
  if (!Number.isFinite(contentLength) || contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Requisição muito grande.' }, { status: 413 })
  }
  try {
    const body = await readJsonLimited(req)
    const locale = body.locale === 'es' ? 'es' : body.locale === 'en' ? 'en' : 'pt-BR'
    const texts = Array.isArray(body.texts)
      ? body.texts.map((item: unknown) => String(item || '').trim()).filter(Boolean).slice(0, 60)
      : []
    if (locale === 'pt-BR') return NextResponse.json({ translations: texts })
    if (!texts.length || texts.some((text: string) => text.length > 500) || texts.join('').length > 6500) throw new Error('Lote de tradução inválido.')

    const now = Date.now()
    if (!consumeGlobalRateLimit(now) || !consumeRateLimit(clientKey(req), now)) {
      return NextResponse.json({ error: 'Muitas traduções. Aguarde um minuto.' }, { status: 429 })
    }

    const result = new Array<string>(texts.length)
    const missing: Array<{ index: number; text: string }> = []
    texts.forEach((text: string, index: number) => {
      const saved = cache.get(`${locale}:${text}`)
      if (saved) result[index] = saved
      else missing.push({ index, text })
    })
    if (missing.length) {
      const apiKey = String(process.env.GEMINI_API_KEY || '').trim()
      if (!apiKey) throw new Error('Serviço de tradução não configurado.')
      if (activeProviderCalls >= MAX_ACTIVE_PROVIDER_CALLS) {
        return NextResponse.json({ error: 'Serviço ocupado. Tente novamente.' }, { status: 429 })
      }
      const language = locale === 'es' ? 'Spanish (Latin America)' : 'English'
      activeProviderCalls += 1
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite')}:generateContent`, {
          method: 'POST',
          signal: AbortSignal.timeout(12_000),
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: `Translate this array of interface strings from Brazilian Portuguese to ${language}. Preserve proper names, usernames, IDs, tags, URLs, numbers, currency codes, PIX, Free Fire, DropZone and Lili. Keep placeholders such as {name} unchanged. Return only a JSON array with exactly the same number and order of strings.` }],
            },
            contents: [{ role: 'user', parts: [{ text: JSON.stringify(missing.map((item) => item.text)) }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 3000, responseMimeType: 'application/json' },
          }),
        })
        if (!response.ok) throw new Error('O serviço de tradução não respondeu.')
        const json = await response.json()
        const content = json?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || '[]'
        const translated = JSON.parse(stripFence(content))
        if (!Array.isArray(translated) || translated.length !== missing.length) throw new Error('Resposta de tradução inválida.')
        missing.forEach((item, index) => {
          const value = String(translated[index] || item.text)
          result[item.index] = value
          cache.set(`${locale}:${item.text}`, value)
        })
        while (cache.size > 5000) cache.delete(cache.keys().next().value as string)
      } finally {
        activeProviderCalls -= 1
      }
    }
    return NextResponse.json({ translations: result })
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao traduzir interface.' }, { status: 400 })
  }
}
