import type { LiliAction, LiliCard, LiliChatResponse, LiliLocale } from '@backend/lili/types'

function stripFence(value: string) {
  return value.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
}

function safeAction(action: LiliAction, translated: Partial<LiliAction>): LiliAction {
  return {
    ...action,
    label: String(translated.label || action.label),
    message: translated.message == null ? action.message : String(translated.message),
  }
}

function safeCard(card: LiliCard, translated: Partial<LiliCard>): LiliCard {
  const translatedDetails = Array.isArray(translated.details) ? translated.details : []
  const translatedActions = Array.isArray(translated.actions) ? translated.actions : []
  return {
    ...card,
    title: String(translated.title || card.title),
    subtitle: translated.subtitle == null ? card.subtitle : String(translated.subtitle),
    badges: Array.isArray(translated.badges) ? translated.badges.map(String) : card.badges,
    details: card.details?.map((detail, index) => ({
      label: String(translatedDetails[index]?.label || detail.label),
      value: String(translatedDetails[index]?.value || detail.value),
    })),
    actions: card.actions?.map((action, index) => safeAction(action, translatedActions[index] || {})),
  }
}

export async function localizeLiliResponse(response: LiliChatResponse, locale: LiliLocale): Promise<LiliChatResponse> {
  if (locale === 'pt-BR') return { ...response, locale }
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) return { ...response, locale }
  const model = String(process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite').trim()
  const language = locale === 'es' ? 'Spanish (Latin America)' : 'English'
  const payload = {
    reply: response.reply,
    actions: response.actions?.map(({ label, message }) => ({ label, message })),
    cards: response.cards?.map((card) => ({
      title: card.title,
      subtitle: card.subtitle,
      badges: card.badges,
      details: card.details,
      actions: card.actions?.map(({ label, message }) => ({ label, message })),
    })),
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `Translate every user-facing string in the JSON to ${language}. Keep names, IDs, tags, URLs, numbers, currency codes, PIX and proper nouns unchanged. Return only valid JSON with exactly the same structure. Do not add or remove fields.` }],
        },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 1400, responseMimeType: 'application/json' },
      }),
    })
    if (!result.ok) return { ...response, locale }
    const json = await result.json()
    const text = json?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || ''
    const translated = JSON.parse(stripFence(text))
    return {
      ...response,
      locale,
      reply: String(translated.reply || response.reply),
      actions: response.actions?.map((action, index) => safeAction(action, translated.actions?.[index] || {})),
      cards: response.cards?.map((card, index) => safeCard(card, translated.cards?.[index] || {})),
    }
  } catch {
    return { ...response, locale }
  } finally {
    clearTimeout(timer)
  }
}
