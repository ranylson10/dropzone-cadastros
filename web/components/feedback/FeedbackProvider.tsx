'use client'

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { Button, Dialog, Field, Input } from '@/components/ui'
import {
  getSystemFeedbackServerSnapshot,
  getSystemFeedbackSnapshot,
  settleSystemFeedback,
  subscribeSystemFeedback,
} from './feedback-controller'

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const request = useSyncExternalStore(
    subscribeSystemFeedback,
    getSystemFeedbackSnapshot,
    getSystemFeedbackServerSnapshot,
  )
  const [promptValue, setPromptValue] = useState('')

  useEffect(() => {
    if (request?.kind === 'prompt') setPromptValue(request.defaultValue || '')
  }, [request?.id, request?.kind])

  const cancelValue = request?.kind === 'confirm' ? false : request?.kind === 'prompt' ? null : undefined
  const title = request?.title || (request?.kind === 'confirm' ? 'Confirmar ação' : request?.kind === 'prompt' ? 'Informação necessária' : 'Aviso')
  const tone = request?.tone || (request?.kind === 'confirm' ? 'danger' : 'default')

  return (
    <>
      {children}
      <span data-dz-feedback-root hidden />
      {request ? (
        <Dialog
          open
          title={title}
          description={request.message}
          size="medium"
          closeOnBackdrop={request.kind !== 'notice'}
          onClose={() => settleSystemFeedback(cancelValue)}
          className={`dz-feedback-dialog dz-feedback-dialog--${tone}`}
          footer={
            request.kind === 'notice' ? (
              <Button data-autofocus onClick={() => settleSystemFeedback()}>{request.confirmLabel || 'Entendi'}</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => settleSystemFeedback(cancelValue)}>{request.cancelLabel || 'Cancelar'}</Button>
                <Button
                  data-autofocus={request.kind !== 'prompt' ? true : undefined}
                  variant={tone === 'danger' ? 'danger' : 'primary'}
                  disabled={request.kind === 'prompt' && request.required && !promptValue.trim()}
                  onClick={() => settleSystemFeedback(request.kind === 'prompt' ? promptValue : true)}
                >
                  {request.confirmLabel || 'Confirmar'}
                </Button>
              </>
            )
          }
        >
          <div className="dz-feedback-dialog__body">
            <div className="dz-feedback-dialog__icon" aria-hidden="true">
              {tone === 'danger' ? <AlertTriangle size={24} /> : <Info size={24} />}
            </div>
            {request.kind === 'prompt' ? (
              <Field label={request.label || 'Resposta'}>
                <Input
                  data-autofocus
                  value={promptValue}
                  placeholder={request.placeholder}
                  onChange={(event) => setPromptValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !(request.required && !promptValue.trim())) {
                      event.preventDefault()
                      settleSystemFeedback(promptValue)
                    }
                  }}
                />
              </Field>
            ) : null}
          </div>
        </Dialog>
      ) : null}
    </>
  )
}
