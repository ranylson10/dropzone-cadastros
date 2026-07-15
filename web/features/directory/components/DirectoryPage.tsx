import { AppShell } from '@/components/layout'
import { DIRECTORY_CONFIG } from '../config'
import { listDirectory } from '../server'
import type { DirectoryKind } from '../types'
import { DirectoryListClient } from './DirectoryListClient'

export async function DirectoryPage({ kind }: { kind: DirectoryKind }) {
  const config = DIRECTORY_CONFIG[kind]
  const items = await listDirectory(kind)
  return (
    <AppShell activeLabel={config.title} loadSession mainClassName="directory-page page">
      <section className="directory-hero">
        <small>DIRETÓRIO PÚBLICO</small>
        <h1>{config.title}</h1>
        <p>{config.description}</p>
      </section>
      <DirectoryListClient items={items} />
    </AppShell>
  )
}
