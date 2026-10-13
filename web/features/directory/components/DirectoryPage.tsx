import Link from 'next/link'
import { AppShell } from '@/components/layout'
import { cachedStorageMediaUrl } from '@/lib/upload-public'
import { Trophy, ArrowUpRight } from 'lucide-react'
import { DIRECTORY_CONFIG } from '../config'
import { listDirectory } from '../server'
import type { DirectoryKind } from '../types'
import { DirectoryListClient } from './DirectoryListClient'
import { DirectoryAccountAction } from './DirectoryAccountAction'

export async function DirectoryPage({ kind }: { kind: DirectoryKind }) {
  const config = DIRECTORY_CONFIG[kind]
  const items = await listDirectory(kind)
  const isChampionshipDirectory = kind === 'campeonatos'
  const highlights = isChampionshipDirectory ? items.filter((item) => item.banner || item.image).slice(0, 3) : []

  return (
    <AppShell
      activeLabel={isChampionshipDirectory ? 'Competições' : undefined}
      loadSession
      headerVariant="storefront"
      withAuthOffset={false}
      mainClassName={`directory-page directory-v1-catalog directory-theme-${kind} page ${isChampionshipDirectory ? 'directory-championship-page directory-market-page' : ''}`}
    >
      <div className="directory-page-body directory-page-body-with-banner directory-immersive-shell">
        {isChampionshipDirectory ? (
          <>
            <section className="dz-market-showcase" aria-label="Explore campeonatos de Free Fire">
              <div className="dz-market-showcase-copy">
                <span className="dz-market-showcase-kicker"><Trophy size={15} aria-hidden="true" /> COMPITA NO DROPZONE</span>
                <h1><span className="dz-market-desktop-title">Seu próximo campeonato começa aqui.</span><span className="dz-market-mobile-title">Campeonatos</span></h1>
                <p>Encontre campeonatos de Free Fire, acompanhe vagas, premiações e participe com sua equipe.</p>
                <Link href="#campeonatos-lista" className="dz-market-showcase-button">Explorar campeonatos <ArrowUpRight size={17} aria-hidden="true" /></Link>
              </div>
              {highlights.length ? (
                <div className="dz-market-showcase-images" aria-label="Campeonatos em destaque">
                  {highlights.map((item) => (
                    <Link key={item.id} href={`/campeonatos/${item.id}`} title={item.name} aria-label={`Conhecer ${item.name}`}>
                      <img src={cachedStorageMediaUrl(item.banner || item.image || '')} alt={item.name} loading={item === highlights[0] ? 'eager' : 'lazy'} />
                    </Link>
                  ))}
                </div>
              ) : <Trophy className="dz-market-showcase-fallback" size={130} aria-hidden="true" />}
            </section>
            <nav className="dz-market-quicklinks" aria-label="Atalhos do catálogo">
              <Link href="/campeonatos?vagas=1"><Trophy size={16} aria-hidden="true" /> Campeonatos com vagas <ArrowUpRight size={15} aria-hidden="true" /></Link>
              <Link href="/rank"><Trophy size={16} aria-hidden="true" /> Ranking competitivo <ArrowUpRight size={15} aria-hidden="true" /></Link>
            </nav>
            <DirectoryAccountAction kind={kind} />
          </>
        ) : (
          <section className={`directory-hero directory-hero-banner directory-immersive-hero theme-${kind}`} data-theme={kind}>
            <span className="directory-hero-character" aria-hidden="true" />
            <div className="directory-hero-inner directory-immersive-content">
              <small>DIRETÓRIO PÚBLICO</small>
              <h1>{config.title}</h1>
              <p>{config.description}</p>
              <DirectoryAccountAction kind={kind} />
            </div>
          </section>
        )}

        <DirectoryListClient items={items} kind={kind} />
      </div>
    </AppShell>
  )
}
