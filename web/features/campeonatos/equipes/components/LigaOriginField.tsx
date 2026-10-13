'use client'
import { useId } from 'react'
import { Field, Select } from '@/components/ui/Field'
import { ligaOriginChoices, type LigaPlan } from '@backend/campeonatos/liga-plan'

export function LigaOriginField({ plan, groupName, groupId, slots, pending = [], value, onChange, disabled, label = 'Origem da equipe na Liga' }: {
  plan: LigaPlan | null; groupName: string; groupId: string; slots: Parameters<typeof ligaOriginChoices>[3]; pending?: Parameters<typeof ligaOriginChoices>[4]
  value: string; onChange: (value: string) => void; disabled?: boolean; label?: string
}) {
  const id = useId()
  if (!plan) return null
  let options: ReturnType<typeof ligaOriginChoices> = [], error = ''
  try { options = ligaOriginChoices(plan, groupName, groupId, slots, pending) } catch (e) { error = e instanceof Error ? e.message : 'Revise o plano da Liga.' }
  return <Field label={label} htmlFor={id} error={error} required>
    <Select id={id} value={value} onChange={e => onChange(e.target.value)} disabled={disabled || Boolean(error)} required>
      <option value="">Selecione a origem</option>
      {options.map(option => <option key={option.tipo} value={option.tipo} disabled={!option.remaining}>{option.label} · {option.used}/{option.quota}</option>)}
    </Select>
  </Field>
}
