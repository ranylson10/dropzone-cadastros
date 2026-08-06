'use client'

import { AppShell } from '@/components/layout'
import { LiliRankHub } from '@/components/lili/LiliRankHub'

export default function RankPage() {
  return <AppShell activeLabel="Rank" loadSession mainClassName="page directory-page directory-theme-rank page-authenticated">
    <main className="directory-shell">
      <div className="directory-page-body directory-page-body-with-banner">
      <section className="directory-hero directory-hero-banner directory-rank-hero theme-rank" data-theme="rank">
        <div className="directory-rank-hero-inner">
          <small>DIRETÓRIO COMPETITIVO</small>
          <h1>Ranking DropZone</h1>
          <p>Resultados oficiais de equipes e jogadores registrados no sistema.</p>
        </div>
      </section>
      <div className="directory-rank-content">
        <LiliRankHub />
      </div>
      </div>
    </main>
  </AppShell>
}
