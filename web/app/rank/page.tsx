'use client'

import { AppShell } from '@/components/layout'
import { LiliRankHub } from '@/components/lili/LiliRankHub'

export default function RankPage() {
  return <AppShell activeLabel="Rank" loadSession mainClassName="page directory-page">
    <main className="directory-shell">
      <section className="directory-rank-hero">
        <div className="directory-rank-hero-inner">
          <small>DIRETÓRIO COMPETITIVO</small>
          <h1>Ranking DropZone</h1>
          <p>Resultados oficiais de equipes e jogadores registrados no sistema.</p>
        </div>
      </section>
      <div className="directory-rank-content">
        <LiliRankHub />
      </div>
    </main>
  </AppShell>
}
