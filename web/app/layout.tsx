import type { Metadata } from 'next'
import './globals.css'
import './compact.css'
import { LiliGlobalLauncher } from '@/components/lili/LiliGlobalLauncher'
import { GlobalLanguageRuntime } from '@/features/i18n/GlobalLanguageRuntime'

export const metadata: Metadata = {
  title: 'DropZone Cadastros',
  description: 'Painel de campeonatos, equipes, managers e jogadores.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}<LiliGlobalLauncher /><GlobalLanguageRuntime /></body>
    </html>
  )
}
