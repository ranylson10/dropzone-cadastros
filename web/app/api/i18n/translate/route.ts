import { NextRequest, NextResponse } from 'next/server'

const cache = new Map<string, string>()
const requests = new Map<string, { count: number; resetAt: number }>()

function stripFence(value: string) {
  return value.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const locale = body.locale === 'es' ? 'es' : body.locale === 'en' ? 'en' : 'pt-BR'
    const texts = Array.isArray(body.texts)
      ? body.texts.map((item: unknown) => String(item || '').trim()).filter(Boolean).slice(0, 60)
      : []
    if (locale === 'pt-BR') return NextResponse.json({ translations: texts })
    if (!texts.length || texts.join('').length > 6500) throw new Error('Lote de tradução inválido.')

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
    const now = Date.now()
    const rate = requests.get(ip)
    if (!rate || rate.resetAt <= now) requests.set(ip, { count: 1, resetAt: now + 60_000 })
    else {
      rate.count += 1
      if (rate.count > 30) return NextResponse.json({ error: 'Muitas traduções. Aguarde um minuto.' }, { status: 429 })
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
      const language = locale === 'es' ? 'Spanish (Latin America)' : 'English'
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite')}:generateContent`, {
        method: 'POST',
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
    }
    return NextResponse.json({ translations: result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao traduzir interface.' }, { status: 400 })
  }
}
