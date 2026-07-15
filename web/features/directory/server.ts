import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { listarEstatisticasEquipes, listarEstatisticasMvp } from '@backend/campeonatos/estatisticas/estatisticas.service'
import type { DirectoryItem, DirectoryKind, DirectoryProfile } from './types'

function text(value: unknown, fallback = '') { return String(value ?? fallback).trim() }
function first(...values: unknown[]) { return values.map((value) => text(value)).find(Boolean) || '' }
function statusLabel(value: unknown) {
  const raw = text(value, 'ativo').replaceAll('_', ' ')
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}
function money(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 'Sem premiação informada'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
}
function location(row: any) { return first(row.localidade, [row.cidade, row.estado, row.pais].filter(Boolean).join(' · ')) }

async function rows(table: string) {
  const { data, error } = await supabaseAdmin.from(table).select('*').order('created_at', { ascending: false }).limit(500)
  if (error) {
    if (['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error.code || '')) return []
    throw error
  }
  return (data || []).filter((row: any) => !['suspenso', 'banido', 'excluido'].includes(String(row.status || 'ativo')))
}

export async function listDirectory(kind: DirectoryKind): Promise<DirectoryItem[]> {
  if (kind === 'campeonatos') {
    const [items, configs] = await Promise.all([rows('campeonatos'), rows('campeonato_configuracoes')])
    const configByChamp = new Map(configs.map((row: any) => [row.campeonato_id, row]))
    return items.map((row: any) => {
      const config: any = configByChamp.get(row.id) || {}
      const name = first(row.nome, 'Campeonato')
      const tipo = statusLabel(row.tipo || config.formato || 'campeonato')
      return {
        id: row.id, kind, name, image: first(row.logo_url), eyebrow: tipo,
        description: first(config.formato, `${tipo} competitivo`),
        meta: [
          { label: 'Premiação', value: money(config.premiacao) },
          { label: 'Limite de vagas', value: text(config.numero_vagas, 'Sem teto') },
          { label: 'Status', value: statusLabel(row.status) },
        ],
        searchText: [name, tipo, config.formato, config.plataforma, config.servidor].join(' ').toLowerCase(),
      }
    })
  }

  if (kind === 'equipes') {
    const [items, lines, participations] = await Promise.all([rows('equipes'), rows('equipe_lines'), rows('campeonato_equipes')])
    return items.map((row: any) => {
      const teamLines = lines.filter((line: any) => line.equipe_id === row.id)
      const championships = participations.filter((item: any) => item.equipe_id === row.id)
      const name = first(row.nome, 'Equipe')
      return {
        id: row.id, kind, name, username: text(row.username), image: first(row.logo_url), eyebrow: first(row.tag, 'Equipe'),
        description: first(row.bio, location(row), 'Equipe competitiva cadastrada na DropZone.'),
        meta: [
          { label: 'Lines', value: String(teamLines.length) },
          { label: 'Campeonatos', value: String(championships.length) },
          { label: 'Status', value: statusLabel(row.status) },
        ],
        searchText: [name, row.tag, row.username, location(row), ...teamLines.map((line: any) => line.nome)].join(' ').toLowerCase(),
      }
    })
  }

  if (kind === 'jogadores') {
    const [items, registrations] = await Promise.all([rows('jogadores'), rows('campeonato_jogadores')])
    return items.map((row: any) => {
      const playerRegs = registrations.filter((item: any) => item.jogador_id === row.id && item.status !== 'deletado')
      const name = first(row.nick, row.nome, row.username, 'Jogador')
      return {
        id: row.id, kind, name, username: text(row.username), image: first(row.avatar_url, row.foto_url), eyebrow: first(row.funcao, 'Jogador'),
        description: first(location(row), row.bio, 'Perfil competitivo cadastrado na DropZone.'),
        meta: [
          { label: 'ID de jogo', value: first(row.id_jogo, 'Não informado') },
          { label: 'Campeonatos', value: String(playerRegs.length) },
          { label: 'Status', value: statusLabel(row.status) },
        ],
        searchText: [name, row.username, row.id_jogo, row.funcao, location(row)].join(' ').toLowerCase(),
      }
    })
  }

  if (kind === 'managers') {
    const [items, teamLinks, producerLinks, playerLinks] = await Promise.all([rows('managers'), rows('manager_equipe'), rows('manager_produtora'), rows('manager_jogador')])
    return items.map((row: any) => {
      const name = first(row.nome, row.username, 'Manager')
      const total = teamLinks.filter((x: any) => x.manager_id === row.id).length + producerLinks.filter((x: any) => x.manager_id === row.id).length + playerLinks.filter((x: any) => x.manager_id === row.id).length
      return {
        id: row.id, kind, name, username: text(row.username), image: first(row.avatar_url, row.foto_url), eyebrow: 'Manager',
        description: first(location(row), row.bio, 'Gestor de perfis competitivos.'),
        meta: [
          { label: 'Vínculos', value: String(total) },
          { label: 'Localidade', value: first(location(row), 'Não informada') },
          { label: 'Status', value: statusLabel(row.status) },
        ],
        searchText: [name, row.username, location(row)].join(' ').toLowerCase(),
      }
    })
  }

  const [items, championships] = await Promise.all([rows('produtoras'), rows('campeonatos')])
  return items.map((row: any) => {
    const produced = championships.filter((item: any) => item.criado_por === row.auth_user_id || item.produtora_id === row.id)
    const name = first(row.nome, row.username, 'Produtora')
    return {
      id: row.id, kind, name, username: text(row.username), image: first(row.logo_url, row.avatar_url), eyebrow: 'Produtora',
      description: first(location(row), row.bio, 'Produtora de eventos competitivos.'),
      meta: [
        { label: 'Campeonatos', value: String(produced.length) },
        { label: 'Localidade', value: first(location(row), 'Não informada') },
        { label: 'Status', value: statusLabel(row.status) },
      ],
      searchText: [name, row.username, location(row)].join(' ').toLowerCase(),
    }
  })
}

export async function getDirectoryProfile(kind: DirectoryKind, id: string): Promise<DirectoryProfile | null> {
  const list = await listDirectory(kind)
  const base = list.find((item) => item.id === id)
  if (!base) return null
  const sections: DirectoryProfile['sections'] = []
  const details = [...base.meta]
  const actions: DirectoryProfile['actions'] = []

  if (kind === 'campeonatos') {
    const [phases, groups, slots, games, participations, teams, teamLines, teamStats, mvpStats] = await Promise.all([
      rows('campeonato_fases'),
      rows('campeonato_grupos'),
      rows('campeonato_slots'),
      rows('campeonato_jogos'),
      rows('campeonato_equipes'),
      rows('equipes'),
      rows('equipe_lines'),
      listarEstatisticasEquipes(id, {}).catch(() => []),
      listarEstatisticasMvp(id, {}).catch(() => []),
    ])
    const teamById = new Map(teams.map((row: any) => [row.id, row]))
    const lineById = new Map(teamLines.map((row: any) => [row.id, row]))
    const champPhases = phases
      .filter((row: any) => row.campeonato_id === id)
      .sort((a: any, b: any) => Number(a.ordem || 0) - Number(b.ordem || 0))
    const champGroups = groups.filter((row: any) => row.campeonato_id === id)
    const champSlots = slots.filter((row: any) => row.campeonato_id === id)
    const champGames = games.filter((row: any) => row.campeonato_id === id)
    const champParts = participations.filter((row: any) => row.campeonato_id === id && String(row.status || 'ativo') === 'ativo')

    actions.push(
      { label: 'Ver tabela', href: '#tabela', variant: 'primary' },
      { label: 'Grupos', href: '#fases-e-grupos' },
      { label: 'Jogos', href: '#jogos' },
    )
    sections.push({
      title: 'Tabela',
      layout: 'stats',
      items: teamStats.slice(0, 30).map((row: any) => ({
        id: row.campeonato_equipe_id,
        title: `${row.colocacao}º · ${row.nome}`,
        subtitle: `${row.pontos_total} pts · ${row.abates} abates · ${row.booyahs} booyah(s)`,
        image: first(row.logo_url),
        meta: [
          { label: 'Quedas', value: String(row.quedas) },
          { label: 'P. posição', value: String(row.pontos_posicao) },
          { label: 'P. abates', value: String(row.pontos_abates) },
        ],
      })),
    })
    sections.push({
      title: 'MVP',
      layout: 'stats',
      items: mvpStats.slice(0, 30).map((row: any) => ({
        id: row.campeonato_jogador_id,
        title: `${row.colocacao}º · ${row.nick}`,
        subtitle: `${row.abates} abates · ${row.quedas} quedas`,
        image: first(row.foto_url),
        meta: [
          { label: 'Dano', value: String(row.dano) },
          { label: 'Assist.', value: String(row.assistencias) },
          { label: 'Revives', value: String(row.revives) },
        ],
      })),
    })

    // Leitura pública: fases → grupos → slots (sem ações de editar)
    sections.push({
      title: 'Fases e grupos',
      layout: 'structure',
      items: champPhases.map((phase: any) => {
        const phaseGroups = champGroups
          .filter((group: any) => group.fase_id === phase.id)
          .sort((a: any, b: any) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
        const totalSlots = phaseGroups.reduce((sum: number, group: any) => {
          const groupSlotCount = champSlots.filter((s: any) => s.grupo_id === group.id).length
          return sum + (groupSlotCount || Number(group.slots || 0))
        }, 0)

        return {
          id: phase.id,
          title: phase.nome,
          subtitle: `${phaseGroups.length} grupo(s) · ${totalSlots} slot(s)`,
          children: phaseGroups.map((group: any) => {
            const groupSlots = champSlots
              .filter((s: any) => s.grupo_id === group.id)
              .sort((a: any, b: any) => Number(a.slot_numero || 0) - Number(b.slot_numero || 0))
            const occupied = groupSlots.filter((s: any) => s.line_id || s.equipe_id).length

            return {
              id: group.id,
              title: group.nome,
              subtitle: `${occupied}/${groupSlots.length || Number(group.slots || 0)} slots preenchidos`,
              children: (groupSlots.length
                ? groupSlots
                : Array.from({ length: Number(group.slots || 0) }, (_, index) => ({
                    id: `${group.id}-ghost-${index + 1}`,
                    slot_numero: index + 1,
                    slot_letra: String.fromCharCode(65 + (index % 26)),
                    line_id: null,
                    equipe_id: null,
                  }))
              ).map((slot: any) => {
                const slotNum = Number(slot.slot_numero || 0)
                const letter = first(
                  slot.slot_letra,
                  slotNum > 0 ? String.fromCharCode(64 + Math.min(slotNum, 26)) : '?',
                )
                const line = slot.line_id ? lineById.get(slot.line_id) : null
                const team = slot.equipe_id ? teamById.get(slot.equipe_id) : null
                const part = champParts.find(
                  (p: any) =>
                    p.slot_id === slot.id
                    || (p.grupo_id === group.id && Number(p.slot_numero) === slotNum && p.line_id === slot.line_id),
                )
                const filled = Boolean(slot.line_id || slot.equipe_id || part)
                const lineName = first(
                  line?.nome,
                  part?.nome_exibicao,
                  part?.line_nome,
                  filled ? 'Line inscrita' : `Slot ${letter}`,
                )
                const teamName = first(team?.nome, part?.equipe_nome)
                const logo = first(line?.logo_url, team?.logo_url)

                return {
                  id: String(slot.id || `${group.id}-${letter}`),
                  badge: letter,
                  title: lineName,
                  subtitle: filled
                    ? [teamName, group.nome].filter(Boolean).join(' · ') || 'Ocupado'
                    : 'Disponível',
                  image: logo || undefined,
                  status: filled ? 'ocupada' : 'livre',
                }
              }),
            }
          }),
        }
      }),
    })
    sections.push({
      title: 'Jogos',
      items: champGames.map((game: any) => ({
        id: game.id,
        title: game.nome,
        subtitle: [game.data_jogo, game.horario ? String(game.horario).slice(0, 5) : '', `${game.numero_partidas || 0} quedas`].filter(Boolean).join(' · ') || 'Data a definir',
        meta: Array.isArray(game.grupos_ids) ? game.grupos_ids.slice(0, 6).map((groupId: string) => ({ label: 'Grupo', value: first(champGroups.find((group: any) => group.id === groupId)?.nome, groupId) })) : [],
      })),
    })
    sections.push({
      title: 'Equipes participantes',
      items: champParts.map((entry: any) => {
        const team: any = teamById.get(entry.equipe_id)
        const line: any = entry.line_id ? lineById.get(entry.line_id) : null
        return {
          id: entry.id,
          title: first(line?.nome, entry.nome_exibicao, team?.nome, 'Line'),
          image: first(line?.logo_url, team?.logo_url),
          href: team ? `/equipes/${team.id}` : undefined,
          subtitle: [
            team?.nome,
            entry.slot_letra || (entry.slot_numero ? `Slot ${entry.slot_numero}` : null),
            entry.origem_entrada ? `via ${entry.origem_entrada}` : null,
          ].filter(Boolean).join(' · ') || 'Participação confirmada',
        }
      }),
    })
  } else if (kind === 'equipes') {
    const [lines, participations, championships] = await Promise.all([rows('equipe_lines'), rows('campeonato_equipes'), rows('campeonatos')])
    const championshipById = new Map(championships.map((row: any) => [row.id, row]))
    sections.push({ title: 'Lines', items: lines.filter((x: any) => x.equipe_id === id).map((line: any) => ({ id: line.id, title: line.nome, subtitle: first(line.tag, statusLabel(line.status)), image: first(line.logo_url) })) })
    sections.push({ title: 'Campeonatos', items: participations.filter((x: any) => x.equipe_id === id).map((entry: any) => { const champ: any = championshipById.get(entry.campeonato_id); return { id: entry.id, title: first(champ?.nome, 'Campeonato'), subtitle: entry.slot_numero ? `Slot ${entry.slot_numero}` : statusLabel(entry.status), image: first(champ?.logo_url), href: champ ? `/campeonatos/${champ.id}` : undefined } }) })
  } else if (kind === 'jogadores') {
    const [regs, championships, teams] = await Promise.all([rows('campeonato_jogadores'), rows('campeonatos'), rows('equipes')])
    const champById = new Map(championships.map((row: any) => [row.id, row]))
    const teamById = new Map(teams.map((row: any) => [row.id, row]))
    sections.push({ title: 'Participações', items: regs.filter((x: any) => x.jogador_id === id && x.status !== 'deletado').map((reg: any) => { const champ: any = champById.get(reg.campeonato_id); const team: any = teamById.get(reg.equipe_id); return { id: reg.id, title: first(champ?.nome, 'Campeonato'), subtitle: [team?.nome, reg.funcao].filter(Boolean).join(' · '), image: first(champ?.logo_url), href: champ ? `/campeonatos/${champ.id}` : undefined } }) })
  } else if (kind === 'produtoras') {
    const items = await rows('campeonatos')
    const producerRow = (await rows('produtoras')).find((row: any) => row.id === id)
    sections.push({ title: 'Campeonatos produzidos', items: items.filter((x: any) => x.produtora_id === id || x.criado_por === producerRow?.auth_user_id).map((champ: any) => ({ id: champ.id, title: champ.nome, subtitle: statusLabel(champ.status), image: first(champ.logo_url), href: `/campeonatos/${champ.id}` })) })
  } else {
    const [teamLinks, producerLinks, playerLinks, teams, producers, players] = await Promise.all([rows('manager_equipe'), rows('manager_produtora'), rows('manager_jogador'), rows('equipes'), rows('produtoras'), rows('jogadores')])
    const mapItems = (links: any[], collection: any[], key: string, href: string) => links.filter((x: any) => x.manager_id === id).map((link: any) => { const target = collection.find((x: any) => x.id === link[key]); return target ? { id: link.id, title: first(target.nome, target.nick, target.username), image: first(target.logo_url, target.avatar_url), href: `/${href}/${target.id}`, subtitle: statusLabel(link.status) } : null }).filter(Boolean) as any[]
    sections.push({ title: 'Equipes administradas', items: mapItems(teamLinks, teams, 'equipe_id', 'equipes') })
    sections.push({ title: 'Produtoras vinculadas', items: mapItems(producerLinks, producers, 'produtora_id', 'produtoras') })
    sections.push({ title: 'Jogadores vinculados', items: mapItems(playerLinks, players, 'jogador_id', 'jogadores') })
  }

  return { ...base, details, actions, sections }
}
