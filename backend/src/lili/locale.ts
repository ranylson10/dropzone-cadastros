import type { LiliChatResponse, LiliLocale } from '@backend/lili/types'

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

export function initialLocalizedMessage(locale: LiliLocale): LiliChatResponse {
  return { ...FALLBACK_MENU[locale], locale }
}
