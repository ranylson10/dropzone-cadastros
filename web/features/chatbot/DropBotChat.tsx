'use client'

import { Bot } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

export type DropBotRole = 'bot' | 'user'

export type DropBotOption = {
  id: string
  label: string
  description?: string
  primary?: boolean
  disabled?: boolean
  onSelect: () => void
}

export type DropBotMessage = {
  id: string
  role: DropBotRole
  author?: string
  text?: string
  content?: ReactNode
  typing?: boolean
  typingSpeedMs?: number
  options?: DropBotOption[]
}

type DropBotChatProps = {
  title?: string
  messages: DropBotMessage[]
  isTyping?: boolean
  className?: string
}

type TypingTextProps = {
  text: string
  speedMs?: number
}

export function TypingText({ text, speedMs = 18 }: TypingTextProps) {
  const [visible, setVisible] = useState('')

  useEffect(() => {
    setVisible('')
    if (!text) return
    let index = 0
    const interval = window.setInterval(() => {
      index += 1
      setVisible(text.slice(0, index))
      if (index >= text.length) window.clearInterval(interval)
    }, speedMs)
    return () => window.clearInterval(interval)
  }, [speedMs, text])

  return <>{visible}</>
}

export function DropBotTypingIndicator({ label = 'Lili digitando...' }: { label?: string }) {
  return (
    <div className="dropbot-row bot">
      <span className="dropbot-avatar"><Bot size={18} /></span>
      <div className="dropbot-typing" aria-label={label}>
        <span />
        <span />
        <span />
        <em>{label}</em>
      </div>
    </div>
  )
}

export function DropBotChat({ title = 'Lili', messages, isTyping = false, className = '' }: DropBotChatProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const renderedMessages = useMemo(() => messages.filter(Boolean), [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [renderedMessages.length, isTyping])

  return (
    <section className={`dropbot-chat ${className}`.trim()} aria-label={title}>
      <header className="dropbot-header">
        <span className="dropbot-header-avatar"><Bot size={16} /></span>
        <div>
          <strong>{title}</strong>
          <small>atendimento automático</small>
        </div>
      </header>

      <div className="dropbot-thread">
        {renderedMessages.map((message) => (
          <div className={`dropbot-row ${message.role}`} key={message.id}>
            {message.role === 'bot' ? <span className="dropbot-avatar"><Bot size={18} /></span> : null}
            <div className={`dropbot-bubble ${message.role}`}>
              {message.role === 'bot' ? <strong>{message.author || title}</strong> : null}
              {message.text ? (
                <p>{message.typing ? <TypingText text={message.text} speedMs={message.typingSpeedMs} /> : message.text}</p>
              ) : null}
              {message.content ? <div className="dropbot-content">{message.content}</div> : null}
              {message.options?.length ? (
                <div className="dropbot-options">
                  {message.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`dropbot-option ${option.primary ? 'primary' : ''}`}
                      disabled={option.disabled}
                      onClick={option.onSelect}
                    >
                      <span>{option.label}</span>
                      {option.description ? <small>{option.description}</small> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {isTyping ? <DropBotTypingIndicator label={`${title} digitando...`} /> : null}
        <div ref={bottomRef} />
      </div>
    </section>
  )
}
