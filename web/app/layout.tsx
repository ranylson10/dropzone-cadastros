import type { Metadata, Viewport } from 'next'
import './globals.css'
import '@/styles/dz-layout-tokens.css'
import '@/styles/ui-foundation.css'
import '@/styles/data-display.css'
import '@/styles/feedback.css'
import '@/styles/championship-card.css'
import '@/styles/entity-components.css'
import './header.css'
import './directory-hero.css'
import './system.css'
import './dropzone-refresh.css'
import '@/features/campeonatos/championship-page-refresh.css'
import '@/features/directory/directory-page-refresh.css'
import '@/features/commerce/commerce-page-refresh.css'
import '@/features/dropzone/panels/profile-panels-page-refresh.css'
import '@/styles/workspace.css'
import '@/features/token-flow/token-flow.css'
import './utility-page-refresh.css'
import '@/styles/page-loading.css'
import '@/styles/directory-density-r03.css'
import '@/styles/public-profiles-r04.css'
import '@/styles/workspace-density-r05.css'
import '@/styles/championship-operations-r06.css'
import '@/features/broadcast/broadcast-page-refresh.css'
import '@/styles/commerce-density-r07.css'
import '@/styles/auth-invites-density-r08.css'
import '@/styles/admin-broadcast-density-r09.css'
import '@/styles/unified-platform-r14.css'
import { ApplicationRuntime } from '@/components/layout/ApplicationRuntime'


export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: 'DropZone — Campeonatos de Free Fire',
  description: 'Campeonatos, vagas, equipes, jogadores, ranking e gestão competitiva de Free Fire.',
  icons: { icon: '/dropzone-icon.png', apple: '/dropzone-icon.png' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><ApplicationRuntime>{children}</ApplicationRuntime></body>
    </html>
  )
}
