'use client'

import { useId } from 'react'
import type { DropZoneRow } from '@/lib/types'

export function workspaceHref(account: DropZoneRow, section?: string) {
  const query = new URLSearchParams({ painel: '1', perfil: account.profile_type || '', perfil_id: account.id })
  if (section) query.set('section', section)
  return `/?${query}`
}

export function WorkspaceContextSwitcher({ account, contexts, onChange, busy }: {
  account: DropZoneRow; contexts: DropZoneRow[]; onChange: (account: DropZoneRow) => void; busy?: boolean
}) {
  const id = useId()
  const choices = contexts.filter(item => item.profile_type === account.profile_type)
  return <div className="dz-context-switcher">
    {choices.length > 1 ? <>
      <label htmlFor={id}>Trocar {account.profile_type === 'equipe' ? 'equipe' : account.profile_type === 'jogador' ? 'jogador' : 'produtora'}</label>
      <select id={id} value={account.id} disabled={busy} onChange={event => {
        const next = choices.find(item => item.id === event.target.value)
        if (next) onChange(next)
      }}>{choices.map(item => <option key={item.id} value={item.id}>{item.name || item.username}{item.data?.delegated_access ? ' · Vice-líder' : ' · Líder'}</option>)}</select>
    </> : null}
    <span className="dz-context-role">{account.data?.delegated_access ? 'Vice-líder · Funções liberadas pelo líder' : 'Líder · Controle da conta'}</span>
  </div>
}
