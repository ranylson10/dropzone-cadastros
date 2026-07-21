'use client'

import { useMemo, useState } from 'react'
import { DropBotChat, type DropBotMessage, type DropBotOption } from './DropBotChat'
import {
  buildIntentAnswer,
  buildHelp,
  defaultSuggestions,
  resolveDropBotQuestion,
  type DropBotIntent,
  type DropBotSystemContext,
} from './dropbot-engine'

type DropBotAssistantProps = {
  title?: string
  context?: DropBotSystemContext
  placeholder?: string
  aiEnabled?: boolean
  className?: string
}

type ChatItem = Omit<DropBotMessage, 'options'> & { options?: DropBotOption[] }

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function DropBotAssistant({
  title = 'DropBot',
  context = {},
  placeholder = 'Digite sua dúvida...',
  aiEnabled = false,
  className = '',
}: DropBotAssistantProps) {
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [messages, setMessages] = useState<ChatItem[]>(() => [
    {
      id: 'welcome',
      role: 'bot',
      typing: true,
      text: buildHelp(context).answer,
    },
  ])

  const quickOptions = useMemo(
    () => defaultSuggestions().map((suggestion) => optionFromIntent(suggestion.id, suggestion.label)),
    [context],
  )

  function optionFromIntent(intent: DropBotIntent, label: string): DropBotOption {
    return {
      id: intent,
      label,
      onSelect: () => void answerIntent(intent, label),
    }
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
    const resolution = resolve()
    setIsTyping(false)

    const options = resolution.suggestions?.map((suggestion) => optionFromIntent(suggestion.id, suggestion.label))
    const aiNote = resolution.needsAi && !aiEnabled
      ? '\n\nHoje estou usando respostas automáticas do sistema. Quando a IA estiver ativada, eu vou conseguir entender perguntas mais livres como essa com mais precisão.'
      : ''

    setMessages((current) => [
      ...current,
      {
        id: createId('bot'),
        role: 'bot',
        typing: true,
        text: `${resolution.answer}${aiNote}`,
        options,
      },
    ])
  }

  async function submitQuestion() {
    const question = input.trim()
    if (!question) return
    setInput('')
    appendUser(question)
    setIsTyping(true)
    await new Promise((done) => window.setTimeout(done, 450))
    setMessages((current) => [
      ...current,
      { id: createId('bot-search'), role: 'bot', typing: true, text: 'Vou verificar isso nos dados do sistema. Só um instante...' },
    ])
    await new Promise((done) => window.setTimeout(done, 700))
    setIsTyping(false)
    await replyWithDelay(() => resolveDropBotQuestion(question, context))
  }

  return (
    <div className={`dropbot-assistant ${className}`.trim()}>
      <DropBotChat title={title} messages={messages} isTyping={isTyping} />
      <form
        className="dropbot-composer"
        onSubmit={(event) => {
          event.preventDefault()
          void submitQuestion()
        }}
      >
        <div className="dropbot-quickbar">
          {quickOptions.slice(0, 4).map((option) => (
            <button key={option.id} type="button" onClick={option.onSelect}>
              {option.label}
            </button>
          ))}
        </div>
        <div className="dropbot-input-row">
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={placeholder} />
          <button type="submit" disabled={!input.trim() || isTyping}>Enviar</button>
        </div>
      </form>
    </div>
  )
}
