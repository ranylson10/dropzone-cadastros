import type { ReactNode } from 'react'
import type { ProfileType } from '@/lib/types'

function ProducerIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" fill="none">
      <path d="M15 48h34l-3-19-8 6-6-15-6 15-8-6-3 19Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="miter" />
      <path d="M23 48v5m18-5v5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" />
      <path d="M21 16h0m22 0h0" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

function TeamIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" fill="none">
      <path d="M32 12 47 18v12c0 11-7 18-15 22-8-4-15-11-15-22V18l15-6Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="miter" />
      <path d="M32 20v22M22 30h20" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" />
    </svg>
  )
}

function PlayerIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" fill="none">
      <path d="M18 23 32 16l14 7v16L32 48 18 39V23Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="miter" />
      <path d="m24 28-7 8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" />
      <circle cx="26" cy="28" r="2.5" fill="currentColor" />
      <circle cx="38" cy="36" r="2.5" fill="currentColor" />
    </svg>
  )
}

function ManagerIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" fill="none">
      <circle cx="22" cy="26" r="6" stroke="currentColor" strokeWidth="3.5" />
      <path d="M12 46c2.8-6 7.4-9 14-9" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" />
      <circle cx="42" cy="22" r="5" stroke="currentColor" strokeWidth="3.5" />
      <path d="M42 31v15m-7-7h15" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" />
    </svg>
  )
}

export const profileIcons: Record<ProfileType, ReactNode> = {
  produtora: <ProducerIcon />,
  equipe: <TeamIcon />,
  jogador: <PlayerIcon />,
  manager: <ManagerIcon />,
}
