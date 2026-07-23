import type { LiliAction, LiliCard, LiliChatResponse, LiliLocale } from './types'

export const SUPPORTED_LOCALES: LiliLocale[] = ['pt-BR', 'es', 'en']

export function normalizeLocale(value?: string | null): LiliLocale {
  const normalized = String(value || '').toLowerCase()
  if (normalized.startsWith('es')) return 'es'
  if (normalized.startsWith('en')) return 'en'
  return 'pt-BR'
}

export function localeLabel(locale: LiliLocale) {
  if (locale === 'es') return 'Español'
  if (locale === 'en') return 'English'
  return 'Português'
}

export const clientText = {
  'pt-BR': {
    connected: 'Conectado como',
    subtitle: 'Atendimento inteligente DropZone',
    placeholder: 'Digite sua mensagem...',
    send: 'Enviar',
    reset: 'Reiniciar conversa',
    login: 'Entrar com Google',
    pixCopied: 'Código PIX copiado. Agora é só colar no aplicativo do seu banco.',
    pixCopyError: 'Não consegui copiar automaticamente. Selecione o código PIX exibido e copie manualmente.',
    requestError: 'Não foi possível concluir a consulta.',
    genericError: 'Tive um problema ao consultar o DropZone. Tente novamente.',
  },
  es: {
    connected: 'Conectado como',
    subtitle: 'Atención inteligente de DropZone',
    placeholder: 'Escribe tu mensaje...',
    send: 'Enviar',
    reset: 'Reiniciar conversación',
    login: 'Entrar con Google',
    pixCopied: 'Código PIX copiado. Ahora pégalo en la aplicación de tu banco.',
    pixCopyError: 'No pude copiarlo automáticamente. Selecciona el código PIX y cópialo manualmente.',
    requestError: 'No fue posible completar la consulta.',
    genericError: 'Tuve un problema al consultar DropZone. Inténtalo de nuevo.',
  },
  en: {
    connected: 'Connected as',
    subtitle: 'DropZone smart support',
    placeholder: 'Type your message...',
    send: 'Send',
    reset: 'Restart conversation',
    login: 'Continue with Google',
    pixCopied: 'PIX code copied. Paste it into your banking app.',
    pixCopyError: 'I could not copy it automatically. Select the PIX code and copy it manually.',
    requestError: 'The request could not be completed.',
    genericError: 'I had a problem checking DropZone. Please try again.',
  },
} as const

const FALLBACK_MENU: Record<LiliLocale, LiliChatResponse> = {
  'pt-BR': {
    reply: 'Olá! Sou a Lili, assistente do DropZone. Como posso ajudar?',
    intent: 'menu',
    actions: [],
  },
  es: {
    reply: '¡Hola! Soy Lili, la asistente de DropZone. ¿Cómo puedo ayudarte?',
    intent: 'menu',
    actions: [],
  },
  en: {
    reply: 'Hi! I’m Lili, the DropZone assistant. How can I help?',
    intent: 'menu',
    actions: [],
  },
}

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

export function initialLocalizedMessage(locale: LiliLocale): LiliChatResponse {
  return { ...FALLBACK_MENU[locale], locale }
}
