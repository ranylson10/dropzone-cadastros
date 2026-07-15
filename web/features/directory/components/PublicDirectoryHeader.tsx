'use client'

/**
 * @deprecated Use AppShell from @/components/layout — mantido como alias
 * para não quebrar imports antigos. O layout real é o AppHeader global.
 */
import { AppShell } from '@/components/layout'

/** Só o header (sem children). Preferir <AppShell> com conteúdo. */
export function PublicDirectoryHeader({ active }: { active?: string }) {
  return (
    <AppShell
      activeLabel={active}
      loadSession
      header="always"
      mainClassName="app-shell-header-only"
      withAuthOffset={false}
    >
      {null}
    </AppShell>
  )
}
