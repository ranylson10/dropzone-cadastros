'use client'
import { useState } from 'react'
import { confirmAction } from '@/components/feedback'
import type { useStructureGroupMutation } from '@/hooks/useStructureGroupMutation'

export function StructureGroupRecovery({ mutation, onConfirmed }: { mutation: ReturnType<typeof useStructureGroupMutation>; onConfirmed: () => void | Promise<void> }) {
  const [feedback, setFeedback] = useState<{ key: string; text: string }>({ key: '', text: '' })
  const pending = mutation.pending
  const note = feedback.key === mutation.scope.key ? feedback.text : ''
  return <div className="notice" aria-live="polite">
    {mutation.error ? <p role="alert">{mutation.error}</p> : null}
    {note ? <p>{note}</p> : null}
    {pending ? <>
      <p>Há uma criação de grupo pendente neste navegador. Repita a tentativa original para consultar o resultado.</p>
      <button className="button secondary" disabled={mutation.busy || !mutation.ready} onClick={async () => {
        try {
          await mutation.retry()
          if (!mutation.scope.isCurrent()) return
          setFeedback({ key: mutation.scope.key, text: 'Grupo e slots confirmados.' })
          try { await onConfirmed() } catch { if (mutation.scope.isCurrent()) setFeedback({ key: mutation.scope.key, text: 'Grupo e slots confirmados. Não foi possível atualizar a estrutura.' }) }
        } catch { /* The scoped mutation presents the error and retains the original attempt. */ }
      }}>Repetir criação original</button>
      <button className="button secondary" disabled={mutation.busy || !mutation.ready} onClick={async () => {
        if (!await confirmAction('A criação pode já ter sido confirmada no servidor. Confira a estrutura antes de encerrar a tentativa deste navegador.')) return
        if (!mutation.scope.isCurrent()) return
        if (await mutation.discard()) setFeedback({ key: mutation.scope.key, text: 'Tentativa local encerrada.' })
      }}>Encerrar tentativa local de grupo</button>
    </> : null}
  </div>
}
