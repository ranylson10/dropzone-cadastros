import { AppShell } from '@/components/layout'
import { DIRECTORY_CONFIG } from '../config'
import { listDirectory } from '../server'
import type { DirectoryKind } from '../types'
import { DirectoryListClient } from './DirectoryListClient'

export async function DirectoryPage({ kind }: { kind: DirectoryKind }) {
  const config = DIRECTORY_CONFIG[kind]
  const items = await listDirectory(kind)
  return (
    <AppShell
      activeLabel={config.title}
      loadSession
      mainClassName={`directory-page directory-theme-${kind} ${kind === 'campeonatos' ? 'directory-market-page' : ''} page page-authenticated`}
    >
      <div className="directory-page-body directory-page-body-with-banner directory-immersive-shell">
        {kind === 'campeonatos' ? (
          <section className="champ-directory-heading">
            <h1>Campeonatos</h1>
            <p>Encontre a competição certa e garanta sua vaga.</p>
          </section>
        ) : (
          <section className={`directory-hero directory-hero-banner directory-immersive-hero theme-${kind}`} data-theme={kind}>
            <span className="directory-hero-character" aria-hidden="true" />
            <div className="directory-hero-inner directory-immersive-content">
              <small>DIRETÓRIO PÚBLICO</small>
              <h1>{config.title}</h1>
              <p>{config.description}</p>
              {kind === 'equipes' || kind === 'jogadores' ? (
                <a
                  className="button primary directory-context-action"
                  href={`/?login=${kind === 'equipes' ? 'equipe' : 'jogador'}&returnTo=%2F%23minhas-areas`}
                >
                  {kind === 'equipes' ? 'Minha equipe' : 'Meu perfil de jogo'}
                </a>
              ) : null}
            </div>
          </section>
        )}
        <DirectoryListClient items={items} />
      </div>
    </AppShell>
  )
}
