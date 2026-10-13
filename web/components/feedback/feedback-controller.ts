'use client'

export type FeedbackTone = 'default' | 'danger'

export type ConfirmActionOptions = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: FeedbackTone
}

export type PromptActionOptions = {
  title?: string
  message: string
  defaultValue?: string
  label?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: FeedbackTone
  required?: boolean
}

export type NoticeActionOptions = {
  title?: string
  message: string
  confirmLabel?: string
  tone?: FeedbackTone
}

type FeedbackRequest =
  | ({ id: number; kind: 'confirm' } & Required<Pick<ConfirmActionOptions, 'message'>> & Omit<ConfirmActionOptions, 'message'> & { resolve: (value: boolean) => void })
  | ({ id: number; kind: 'prompt' } & Required<Pick<PromptActionOptions, 'message'>> & Omit<PromptActionOptions, 'message'> & { resolve: (value: string | null) => void })
  | ({ id: number; kind: 'notice' } & Required<Pick<NoticeActionOptions, 'message'>> & Omit<NoticeActionOptions, 'message'> & { resolve: () => void })

let nextId = 1
let current: FeedbackRequest | null = null
const queue: FeedbackRequest[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function enqueue(request: FeedbackRequest) {
  if (current) queue.push(request)
  else current = request
  emit()
}

function advance() {
  current = queue.shift() || null
  emit()
}

export function subscribeSystemFeedback(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getSystemFeedbackSnapshot() {
  return current
}

export function getSystemFeedbackServerSnapshot() {
  return null
}

export function settleSystemFeedback(value?: boolean | string | null) {
  const request = current
  if (!request) return
  if (request.kind === 'confirm') request.resolve(Boolean(value))
  else if (request.kind === 'prompt') request.resolve(typeof value === 'string' ? value : null)
  else request.resolve()
  advance()
}

export function confirmAction(messageOrOptions: string | ConfirmActionOptions): Promise<boolean> {
  const options = typeof messageOrOptions === 'string' ? { message: messageOrOptions } : messageOrOptions
  return new Promise((resolve) => enqueue({ id: nextId++, kind: 'confirm', ...options, resolve }))
}

export function promptAction(messageOrOptions: string | PromptActionOptions, defaultValue = ''): Promise<string | null> {
  const options = typeof messageOrOptions === 'string'
    ? { message: messageOrOptions, defaultValue }
    : messageOrOptions
  return new Promise((resolve) => enqueue({ id: nextId++, kind: 'prompt', ...options, resolve }))
}

export function noticeAction(messageOrOptions: string | NoticeActionOptions): Promise<void> {
  const options = typeof messageOrOptions === 'string' ? { message: messageOrOptions } : messageOrOptions
  return new Promise((resolve) => enqueue({ id: nextId++, kind: 'notice', ...options, resolve }))
}
