'use client'

import { StreamDashboard } from './StreamDashboard'
import type { DropZoneRow } from '@/lib/types'

/**
 * Shell do perfil Broadcast.
 * MVP: só o papel "stream" tem painel completo.
 */
export function BroadcastPanel(props: {
  account: DropZoneRow
  accounts?: DropZoneRow[]
}) {
  const papel = String(props.account.data?.papel || 'stream').toLowerCase()

  if (papel === 'stream') {
    return <StreamDashboard profileName={props.account.name || props.account.username || 'Stream'} />
  }

  return (
    <div className="broadcast-page">
      <header>
        <p className="eyebrow" style={{ margin: 0, color: 'var(--brand)', fontSize: 10, fontWeight: 900, letterSpacing: '0.12em' }}>
          BROADCAST · {papel.toUpperCase()}
        </p>
        <h1>{props.account.name || 'Broadcast'}</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Painel de <strong>{papel}</strong> em breve. Por enquanto o fluxo completo está no papel{' '}
          <strong>Stream</strong> (chave do campeonato, lives, controlador e OBS).
        </p>
      </header>
    </div>
  )
}
