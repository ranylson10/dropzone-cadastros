'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type LiliConversationAction<TId extends string = string> = {
  id: TId
  label: string
  primary?: boolean
}

export type LiliConversationState<
  TStep extends string = string,
  TActionId extends string = string,
  TKind extends string = string,
> = {
  step: TStep
  eyebrow: string
  chatEnabled: boolean
  kind: TKind
  messages: string[]
  actions: Array<LiliConversationAction<TActionId>>
}

type StepVisit = {
  step: string
  visitedAt: string
}

type ActionVisit = {
  id: string
  label: string
  step: string | null
  selectedAt: string
}

type PersistedConversation = {
  steps: StepVisit[]
  actions: ActionVisit[]
}

type LiliConversationContextValue = {
  activeState: LiliConversationState | null
  visitedSteps: StepVisit[]
  selectedActions: ActionVisit[]
  setActiveState: (state: LiliConversationState) => void
  recordAction: (action: LiliConversationAction) => void
  resetConversation: () => void
}

const LiliConversationContext = createContext<LiliConversationContextValue | null>(null)
const MAX_HISTORY = 30

function storageKey(flowId: string) {
  return `dropzone:lili:${flowId}`
}

function readPersisted(flowId: string): PersistedConversation {
  if (typeof window === 'undefined') return { steps: [], actions: [] }

  try {
    const raw = window.sessionStorage.getItem(storageKey(flowId))
    if (!raw) return { steps: [], actions: [] }
    const parsed = JSON.parse(raw) as Partial<PersistedConversation>
    return {
      steps: Array.isArray(parsed.steps) ? parsed.steps.slice(-MAX_HISTORY) : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions.slice(-MAX_HISTORY) : [],
    }
  } catch {
    return { steps: [], actions: [] }
  }
}

export function LiliConversationProvider({
  flowId,
  children,
}: {
  flowId: string
  children: ReactNode
}) {
  const [activeState, setActiveStateValue] = useState<LiliConversationState | null>(null)
  const [visitedSteps, setVisitedSteps] = useState<StepVisit[]>([])
  const [selectedActions, setSelectedActions] = useState<ActionVisit[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const persisted = readPersisted(flowId)
    setVisitedSteps(persisted.steps)
    setSelectedActions(persisted.actions)
    setHydrated(true)
  }, [flowId])

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(
        storageKey(flowId),
        JSON.stringify({ steps: visitedSteps, actions: selectedActions }),
      )
    } catch {
      // O histórico é auxiliar; falhas de storage não podem interromper o fluxo.
    }
  }, [flowId, hydrated, selectedActions, visitedSteps])

  const setActiveState = useCallback((state: LiliConversationState) => {
    setActiveStateValue(state)
    setVisitedSteps((current) => {
      if (current.at(-1)?.step === state.step) return current
      return [...current, { step: state.step, visitedAt: new Date().toISOString() }].slice(-MAX_HISTORY)
    })
  }, [])

  const recordAction = useCallback((action: LiliConversationAction) => {
    setSelectedActions((current) => [
      ...current,
      {
        id: action.id,
        label: action.label,
        step: activeState?.step || null,
        selectedAt: new Date().toISOString(),
      },
    ].slice(-MAX_HISTORY))
  }, [activeState?.step])

  const resetConversation = useCallback(() => {
    setActiveStateValue(null)
    setVisitedSteps([])
    setSelectedActions([])
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(storageKey(flowId))
      } catch {
        // ignore
      }
    }
  }, [flowId])

  const value = useMemo<LiliConversationContextValue>(() => ({
    activeState,
    visitedSteps,
    selectedActions,
    setActiveState,
    recordAction,
    resetConversation,
  }), [activeState, recordAction, resetConversation, selectedActions, setActiveState, visitedSteps])

  return (
    <LiliConversationContext.Provider value={value}>
      {children}
    </LiliConversationContext.Provider>
  )
}

export function useLiliConversation<
  TState extends LiliConversationState = LiliConversationState,
>() {
  const context = useContext(LiliConversationContext)
  if (!context) {
    throw new Error('useLiliConversation deve ser usado dentro de LiliConversationProvider.')
  }

  return {
    ...context,
    activeState: context.activeState as TState | null,
    setActiveState: context.setActiveState as (state: TState) => void,
  }
}
