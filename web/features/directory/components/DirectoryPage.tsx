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
      mainClassName={`directory-page directory-theme-${kind} page page-authenticated`}
    >
      <section className={`directory-hero directory-hero-banner theme-${kind}`}>
        <div className="directory-hero-inner">
          <small>DIRETÓRIO PÚBLICO</small>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
      </section>
      <div className="directory-page-body">
        <DirectoryListClient items={items} />
      </div>
    </AppShell>
  )
}
