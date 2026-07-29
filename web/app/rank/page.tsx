'use client'

import { AppShell } from '@/components/layout'
import { LiliRankHub } from '@/components/lili/LiliRankHub'

export default function RankPage() {
  return <AppShell activeLabel="Rank" loadSession mainClassName="page directory-page">
    <main className="directory-shell">
      <LiliRankHub />
    </main>
  </AppShell>
}
