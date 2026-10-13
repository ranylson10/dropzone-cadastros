import { unstable_cache } from 'next/cache'
import { readPublicProfileBase } from '@backend/directory/public-profile-base'
import { buildChampionshipDirectoryItems } from './championship-directory'
import { buildTeamDirectoryItems } from './team-directory'
import { buildPlayerDirectoryItems } from './player-directory'
import { buildManagerDirectoryItems } from './manager-directory'
import { buildProducerDirectoryItems } from './producer-directory'
import type { DirectoryItem, DirectoryKind } from './types'

export const getPublicDirectoryBase = unstable_cache(
  async (kind: DirectoryKind, id: string): Promise<DirectoryItem | null> => {
    const data = await readPublicProfileBase(kind, id)
    if (!data) return null
    const { row } = data
    if (kind === 'campeonatos') return buildChampionshipDirectoryItems({ championships: [row], configs: data.configs || [], phases: data.phases || [], slots: data.slots || [], games: data.games || [], producers: data.producers || [] })[0]
    if (kind === 'equipes') return buildTeamDirectoryItems({ teams: [row], lines: data.lines || [], participations: data.participations || [] })[0]
    if (kind === 'jogadores') return buildPlayerDirectoryItems({ players: [row], registrations: data.registrations || [] })[0]
    if (kind === 'managers') return buildManagerDirectoryItems({ managers: [row], links: data.links || [] })[0]
    return buildProducerDirectoryItems({ producers: [row], championships: data.championships || [] })[0]
  },
  ['public-directory-profile-base-v1'],
  { revalidate: 30, tags: ['directory:campeonatos', 'directory:equipes', 'directory:jogadores', 'directory:managers', 'directory:produtoras'] },
)
