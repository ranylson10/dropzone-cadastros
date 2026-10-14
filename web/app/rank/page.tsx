'use client'

import { AppShell } from '@/components/layout'
import { LiliRankHub } from '@/components/lili/LiliRankHub'

export default function RankPage() {
  return <AppShell activeLabel="Perfis" loadSession headerVariant="storefront" withAuthOffset={false} mainClassName="page directory-page directory-v1-catalog directory-theme-rank">
    <div className="directory-shell">
      <div className="directory-page-body directory-page-body-with-banner">
        <LiliRankHub />
      </div>
    </div>
  </AppShell>
}
