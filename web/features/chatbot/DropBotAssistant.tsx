'use client'

import { useMemo, useState } from 'react'
import { DropBotChat, type DropBotMessage, type DropBotOption } from './DropBotChat'
import {
  buildIntentAnswer,
  buildHelp,
  defaultSuggestions,
  resolveDropBotQuestion,
  type DropBotIntent,
  type DropBotResolution,
  type DropBotSystemContext,
} from './dropbot-engine'

type DropBotLanguage = 'pt' | 'es' | 'en'

type DropBotAssistantProps = {
  title?: string
  context?: DropBotSystemContext
  placeholder?: string
  aiEnabled?: boolean
  className?: string
}

type ChatItem = Omit<DropBotMessage, 'options'> & { options?: DropBotOption[] }

const LANG_KEY = 'dropbot_language'

const UI: Record<DropBotLanguage, {
  choose: string
  changed: string
  placeholder: string
  send: string
  checking: string
  aiOff: string
  quick: Record<DropBotIntent, string>
}> = {
  pt: {
    choose: 'Antes de começar: em qual idioma você prefere conversar?',
    changed: 'Pronto. Vou responder em português. Você pode trocar o idioma quando quiser.',
    placeholder: 'Digite sua dúvida...',
    send: 'Enviar',
    checking: 'Vou verificar isso nos dados do sistema. Só um instante...',
    aiOff: 'Hoje estou usando respostas automáticas do sistema. Quando a IA estiver ativada, vou entender perguntas mais livres com mais precisão.',
    quick: {
      agenda: 'Ver próximos jogos', jogadores: 'Ver jogadores escalados', pontuacao: 'Ver pontuação', inscricao: 'Status da inscrição', pagamento: 'Pagamentos', link_escala: 'Link de escalação', slots: 'Ver slots', ajuda: 'Ajuda', ambigua: 'Escolher opção', desconhecida: 'Outra dúvida',
    },
  },
  es: {
    choose: 'Antes de empezar: ¿en qué idioma prefieres hablar?',
    changed: 'Listo. Voy a responder en español. Puedes cambiar el idioma cuando quieras.',
    placeholder: 'Escribe tu duda...',
    send: 'Enviar',
    checking: 'Voy a revisar eso en los datos del sistema. Un momento...',
    aiOff: 'Hoy estoy usando respuestas automáticas del sistema. Cuando la IA esté activada, entenderé preguntas libres con más precisión.',
    quick: {
      agenda: 'Ver próximos partidos', jogadores: 'Ver jugadores registrados', pontuacao: 'Ver puntuación', inscricao: 'Estado de inscripción', pagamento: 'Pagos', link_escala: 'Link de alineación', slots: 'Ver slots', ajuda: 'Ayuda', ambigua: 'Elegir opción', desconhecida: 'Otra duda',
    },
  },
  en: {
    choose: 'Before we start: which language do you prefer?',
    changed: 'Done. I’ll answer in English. You can change the language anytime.',
    placeholder: 'Type your question...',
    send: 'Send',
    checking: 'I’ll check that in the system data. One moment...',
    aiOff: 'Today I’m using automatic system replies. When AI is enabled, I’ll understand open questions more accurately.',
    quick: {
      agenda: 'Upcoming matches', jogadores: 'Registered players', pontuacao: 'Group score', inscricao: 'Registration status', pagamento: 'Payments', link_escala: 'Roster link', slots: 'Slots', ajuda: 'Help', ambigua: 'Choose option', desconhecida: 'Another question',
    },
  },
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function initialLanguage(): DropBotLanguage | null {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(LANG_KEY)
  return stored === 'pt' || stored === 'es' || stored === 'en' ? stored : null
}

function languageName(lang: DropBotLanguage) {
  return lang === 'pt' ? 'Português' : lang === 'es' ? 'Español' : 'English'
}

function translateResolution(resolution: DropBotResolution, context: DropBotSystemContext, lang: DropBotLanguage): DropBotResolution {
  if (lang === 'pt') return resolution
  const equipe = context.equipeNome || (lang === 'es' ? 'tu equipo' : 'your team')
  const grupo = context.grupoNome || 'grupo'
  const participacoes = context.participacoes || []

  if (resolution.intent === 'ajuda') {
    return {
      ...resolution,
      answer: lang === 'es'
        ? `Puedo consultar información de ${equipe}. Por ejemplo:\n• ¿Qué días juega mi equipo?\n• ¿Cuántos jugadores tengo registrados?\n• ¿Cuál es la puntuación del grupo?\n• ¿Mi inscripción está confirmada?\n• ¿Tengo pagos pendientes?`
        : `I can check information for ${equipe}. For example:\n• What days does my team play?\n• How many players are registered?\n• What is the group score?\n• Is my registration confirmed?\n• Do I have pending payments?`,
    }
  }

  if (resolution.intent === 'jogadores') {
    if (!participacoes.length) return { ...resolution, answer: lang === 'es' ? 'Aún no encontré una line inscrita vinculada a tu cuenta en este grupo.' : 'I could not find a registered lineup linked to your account in this group yet.' }
    const lines = participacoes.map((part) => `• ${part.lineNome || part.nome || 'Line'}${part.slot ? ` · slot ${part.slot}` : ''}: ${part.quantidadeJogadores ?? 0}/${part.limiteJogadores || '?'} ${lang === 'es' ? 'jugadores registrados' : 'players registered'}`)
    return { ...resolution, answer: `${lang === 'es' ? 'Aquí está la alineación actual' : 'Here is the current roster'}:\n${lines.join('\n')}` }
  }

  if (resolution.intent === 'inscricao') {
    if (!participacoes.length) return { ...resolution, answer: lang === 'es' ? 'No encontré inscripción de tu equipo en este grupo todavía.' : 'I could not find your team registration in this group yet.' }
    return { ...resolution, answer: `${lang === 'es' ? 'Tu inscripción aparece así' : 'Your registration looks like this'}:\n${participacoes.map((part) => `• ${part.lineNome || part.nome || 'Line'}${part.slot ? ` ${lang === 'es' ? 'en el slot' : 'in slot'} ${part.slot}` : ''}`).join('\n')}` }
  }

  if (resolution.intent === 'slots' && context.resumoGrupo) {
    const r = context.resumoGrupo
    return { ...resolution, answer: lang === 'es' ? `Resumen de slots del grupo ${grupo}: ${r.ocupadas ?? 0} ocupados, ${r.livres ?? 0} libres, ${r.total ?? 0} en total.` : `Slot summary for group ${grupo}: ${r.ocupadas ?? 0} occupied, ${r.livres ?? 0} free, ${r.total ?? 0} total.` }
  }

  if (resolution.intent === 'agenda') return { ...resolution, answer: lang === 'es' ? `Revisé aquí, pero todavía no encontré partidos con fecha definida para ${equipe}.` : `I checked here, but I could not find scheduled matches for ${equipe} yet.` }
  if (resolution.intent === 'pontuacao') return { ...resolution, answer: lang === 'es' ? 'Aún no encontré puntuación registrada para este grupo/campeonato.' : 'I could not find scores for this group/championship yet.' }
  if (resolution.intent === 'pagamento') return { ...resolution, answer: lang === 'es' ? 'No encontré pagos pendientes vinculados a esta inscripción ahora.' : 'I could not find pending payments linked to this registration right now.' }
  if (resolution.intent === 'link_escala') return { ...resolution, answer: resolution.answer.replace('Achei o link de escalação da', lang === 'es' ? 'Encontré el link de alineación de' : 'I found the roster link for').replace('Ainda não encontrei link de escalação ativo. Você pode gerar um novo na opção “Escalar elenco”.', lang === 'es' ? 'Aún no encontré un link de alineación activo. Puedes generar uno nuevo en “Escalar elenco”.' : 'I could not find an active roster link yet. You can generate a new one in “Escalar elenco”.') }

  return { ...resolution, answer: lang === 'es' ? 'No entendí con seguridad. ¿Quieres elegir una de estas opciones?' : 'I’m not fully sure what you meant. Would you like to choose one of these options?' }
}

export function DropBotAssistant({
  title = 'DropBot',
  context = {},
  placeholder,
  aiEnabled = false,
  className = '',
}: DropBotAssistantProps) {
  const [language, setLanguage] = useState<DropBotLanguage | null>(() => initialLanguage())
  const currentLanguage: DropBotLanguage = language || 'pt'
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [messages, setMessages] = useState<ChatItem[]>(() => [
    language
      ? { id: 'welcome', role: 'bot', typing: true, text: translateResolution(buildHelp(context), context, language).answer }
      : { id: 'language', role: 'bot', typing: true, text: UI.pt.choose },
  ])

  const quickOptions = useMemo(
    () => defaultSuggestions().map((suggestion) => optionFromIntent(suggestion.id, UI[currentLanguage].quick[suggestion.id])),
    [context, currentLanguage],
  )

  function selectLanguage(nextLanguage: DropBotLanguage) {
    window.localStorage.setItem(LANG_KEY, nextLanguage)
    setLanguage(nextLanguage)
    setMessages((current) => [
      ...current,
      { id: createId('user'), role: 'user', text: languageName(nextLanguage) },
      { id: createId('bot'), role: 'bot', typing: true, text: UI[nextLanguage].changed },
      { id: createId('bot-help'), role: 'bot', typing: true, text: translateResolution(buildHelp(context), context, nextLanguage).answer },
    ])
  }

  function optionFromIntent(intent: DropBotIntent, label: string): DropBotOption {
    return { id: intent, label, onSelect: () => void answerIntent(intent, label) }
  }

  async function answerIntent(intent: DropBotIntent, label: string) {
    appendUser(label)
    await replyWithDelay(() => buildIntentAnswer(intent, context))
  }

  function appendUser(text: string) {
    setMessages((current) => [...current, { id: createId('user'), role: 'user', text }])
  }

  async function replyWithDelay(resolve: () => ReturnType<typeof resolveDropBotQuestion>) {
    setIsTyping(true)
    await new Promise((done) => window.setTimeout(done, 650))
    const resolution = translateResolution(resolve(), context, currentLanguage)
    setIsTyping(false)
    const options = resolution.suggestions?.map((suggestion) => optionFromIntent(suggestion.id, UI[currentLanguage].quick[suggestion.id]))
    const aiNote = resolution.needsAi && !aiEnabled ? `\n\n${UI[currentLanguage].aiOff}` : ''
    setMessages((current) => [...current, { id: createId('bot'), role: 'bot', typing: true, text: `${resolution.answer}${aiNote}`, options }])
  }

  async function submitQuestion() {
    const question = input.trim()
    if (!question) return
    setInput('')
    appendUser(question)
    setIsTyping(true)
    await new Promise((done) => window.setTimeout(done, 450))
    setMessages((current) => [...current, { id: createId('bot-search'), role: 'bot', typing: true, text: UI[currentLanguage].checking }])
    await new Promise((done) => window.setTimeout(done, 700))
    setIsTyping(false)
    await replyWithDelay(() => resolveDropBotQuestion(question, context))
  }

  return (
    <div className={`dropbot-assistant ${className}`.trim()}>
      <DropBotChat
        title={title}
        messages={language ? messages : [
          ...messages,
          {
            id: 'language-options',
            role: 'bot',
            options: [
              { id: 'pt', label: 'Português', primary: true, onSelect: () => selectLanguage('pt') },
              { id: 'es', label: 'Español', onSelect: () => selectLanguage('es') },
              { id: 'en', label: 'English', onSelect: () => selectLanguage('en') },
            ],
          },
        ]}
        isTyping={isTyping}
      />
      <form
        className="dropbot-composer"
        onSubmit={(event) => {
          event.preventDefault()
          void submitQuestion()
        }}
      >
        <div className="dropbot-language-switch" aria-label="Idioma do DropBot">
          {(['pt', 'es', 'en'] as DropBotLanguage[]).map((lang) => (
            <button key={lang} type="button" className={currentLanguage === lang ? 'active' : ''} onClick={() => selectLanguage(lang)}>
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="dropbot-quickbar">
          {quickOptions.slice(0, 4).map((option) => (
            <button key={option.id} type="button" onClick={option.onSelect} disabled={!language}>
              {option.label}
            </button>
          ))}
        </div>
        <div className="dropbot-input-row">
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={placeholder || UI[currentLanguage].placeholder} disabled={!language} />
          <button type="submit" disabled={!language || !input.trim() || isTyping}>{UI[currentLanguage].send}</button>
        </div>
      </form>
    </div>
  )
}
