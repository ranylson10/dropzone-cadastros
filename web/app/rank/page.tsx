'use client'

import { AppShell } from '@/components/layout'
import { LiliRankHub } from '@/components/lili/LiliRankHub'

export default function RankPage() {
  return <AppShell activeLabel="Perfis" loadSession headerVariant="storefront" withAuthOffset={false} mainClassName="page directory-page directory-v1-catalog directory-theme-rank">
    <div className="directory-shell">
      <div className="directory-page-body directory-page-body-with-banner">
      <section className="directory-hero directory-hero-banner directory-rank-hero theme-rank" data-theme="rank">
        <div className="directory-rank-hero-inner">
          <small>DIRETÓRIO COMPETITIVO</small>
          <h1>Ranking DropZone</h1>
          <p>Ranking baseado em resultados oficiais. Compare equipes, jogadores e campeonatos com um score competitivo separado dos pontos de cada torneio.</p>
        </div>
      </section>
      <div className="directory-rank-content">
        <LiliRankHub />
      </div>
      </div>
    </div>
  </AppShell>
}
