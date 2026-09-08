import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { buildChampionshipDirectoryItems } from '../../web/features/directory/championship-directory'
import { buildManagerDirectoryItems } from '../../web/features/directory/manager-directory'
import { buildPlayerDirectoryItems } from '../../web/features/directory/player-directory'
import { buildProducerDirectoryItems } from '../../web/features/directory/producer-directory'
import { buildTeamDirectoryItems } from '../../web/features/directory/team-directory'

const serverSource = fs.readFileSync(path.join(process.cwd(), 'web/features/directory/server.ts'), 'utf8')
const publicViewSource = fs.readFileSync(path.join(process.cwd(), 'web/features/directory/components/ChampionshipPublicView.tsx'), 'utf8')

test('diretório calcula vagas e próxima partida sem misturar campeonatos', () => {
  const items = buildChampionshipDirectoryItems({
    championships: [
      { id: 'a', nome: 'Liga Aloe', tipo: 'liga', logo_url: 'aloe.png' },
      { id: 'b', nome: 'Copa B', tipo: 'copa' },
    ],
    configs: [
      { campeonato_id: 'a', numero_vagas: 4, formato: 'Pontos corridos', valor_inscricao: 25 },
      { campeonato_id: 'b', numero_vagas: 2 },
    ],
    phases: [
      { id: 'fase-a-2', campeonato_id: 'a', ordem: 2 },
      { id: 'fase-a-1', campeonato_id: 'a', ordem: 1 },
      { id: 'fase-b-1', campeonato_id: 'b', ordem: 1 },
    ],
    slots: [
      { campeonato_id: 'a', fase_id: 'fase-a-1', equipe_id: 'equipe-1', status: 'ocupado' },
      { campeonato_id: 'a', fase_id: 'fase-a-1', status: 'livre' },
      { campeonato_id: 'a', fase_id: 'fase-a-2', equipe_id: 'nao-conta', status: 'ocupado' },
      { campeonato_id: 'b', fase_id: 'fase-b-1', line_id: 'line-1', status: 'ocupado' },
    ],
    games: [
      { campeonato_id: 'a', status: 'ativo', data_jogo: '2026-09-12', horario: '20:00' },
      { campeonato_id: 'a', status: 'ativo', data_jogo: '2026-09-10', horario: '19:00' },
      { campeonato_id: 'b', status: 'ativo', data_jogo: '2026-09-11', horario: '18:00' },
    ],
  }, '2026-09-08')

  expect(items).toHaveLength(2)
  expect(items[0].name).toBe('Liga Aloe')
  expect(items[0].commercial?.vagas_livres).toBe(3)
  expect(items[0].commercial?.data_jogo).toBe('2026-09-10')
  expect(items[0].meta[0].value).toBe('R$\u00a025,00')
  expect(items[1].commercial?.vagas_livres).toBe(1)
  expect(items[1].commercial?.data_jogo).toBe('2026-09-11')
})

test('diretório usa capacidade física quando não há limite comercial', () => {
  const [item] = buildChampionshipDirectoryItems({
    championships: [{ id: 'a', nome: 'Sem teto' }],
    configs: [],
    phases: [],
    slots: [
      { campeonato_id: 'a', status: 'livre' },
      { campeonato_id: 'a', equipe_id: 'equipe-1', status: 'ocupado' },
      { campeonato_id: 'a', status: 'excluido' },
    ],
    games: [],
  }, '2026-09-08')

  expect(item.commercial?.total_vagas).toBe(2)
  expect(item.commercial?.vagas_livres).toBe(1)
})

test('perfil público restringe leituras ao campeonato e às entidades referenciadas', () => {
  const championshipBranch = serverSource.slice(
    serverSource.indexOf("if (kind === 'campeonatos')", serverSource.indexOf('export async function getDirectoryProfile')),
    serverSource.indexOf("} else if (kind === 'equipes')", serverSource.indexOf('export async function getDirectoryProfile')),
  )

  for (const table of [
    'campeonato_fases',
    'campeonato_grupos',
    'campeonato_slots',
    'campeonato_jogos',
    'campeonato_equipes',
    'campeonato_jogadores',
    'campeonato_configuracoes',
  ]) {
    expect(championshipBranch).toContain(`scopedRows('${table}', { column: 'campeonato_id', value: id })`)
    expect(championshipBranch).not.toContain(`rows('${table}')`)
  }

  for (const table of ['equipes', 'equipe_lines', 'jogadores', 'jogadores_temporarios']) {
    expect(championshipBranch).toContain(`scopedRows('${table}', { column: 'id', values:`)
    expect(championshipBranch).not.toContain(`rows('${table}')`)
  }
})

test('perfil de produtora restringe leituras à produtora solicitada', () => {
  const profileStart = serverSource.indexOf('export async function getDirectoryProfile')
  const producerStart = serverSource.indexOf("} else if (kind === 'produtoras')", profileStart)
  const producerEnd = serverSource.indexOf('} else {', producerStart)
  const producerBranch = serverSource.slice(producerStart, producerEnd)
  const dataStart = serverSource.indexOf('const getPublicProducerProfileData')
  const dataEnd = serverSource.indexOf('export async function listDirectory', dataStart)
  const producerData = serverSource.slice(dataStart, dataEnd)

  expect(producerBranch).toContain('getPublicProducerProfileData(id)')
  expect(producerBranch).not.toContain("rows('produtoras')")
  expect(producerBranch).not.toContain("rows('campeonatos')")
  expect(producerData).toContain("selectedRows('produtoras', PUBLIC_PRODUCER_COLUMNS, [id], 'id')")
  expect(producerData).toContain('selectedProducerChampionships(')
})

test('perfil de equipe não carrega tabelas públicas inteiras', () => {
  const profileStart = serverSource.indexOf('export async function getDirectoryProfile')
  const teamStart = serverSource.indexOf("} else if (kind === 'equipes')", profileStart)
  const teamEnd = serverSource.indexOf("} else if (kind === 'jogadores')", teamStart)
  const teamBranch = serverSource.slice(teamStart, teamEnd)
  expect(teamBranch).toContain('PUBLIC_TEAM_PROFILE_LINE_COLUMNS')
  expect(teamBranch).not.toContain("rows('equipe_lines')")
  expect(teamBranch).not.toContain("rows('campeonato_equipes')")
  expect(teamBranch).not.toContain("rows('campeonatos')")
})

test('perfil de jogador não carrega inscrições, campeonatos e equipes inteiros', () => {
  const profileStart = serverSource.indexOf('export async function getDirectoryProfile')
  const playerStart = serverSource.indexOf("} else if (kind === 'jogadores')", profileStart)
  const playerEnd = serverSource.indexOf("} else if (kind === 'produtoras')", playerStart)
  const playerBranch = serverSource.slice(playerStart, playerEnd)
  const dataStart = serverSource.indexOf('const getPublicPlayerProfileData')
  const dataEnd = serverSource.indexOf('const PUBLIC_MANAGER_COLUMNS', dataStart)
  const playerData = serverSource.slice(dataStart, dataEnd)

  expect(playerBranch).toContain('getPublicPlayerProfileData(id)')
  expect(playerBranch).not.toContain("rows('campeonato_jogadores')")
  expect(playerBranch).not.toContain("rows('campeonatos')")
  expect(playerBranch).not.toContain("rows('equipes')")
  expect(playerData).toContain('PUBLIC_PLAYER_PROFILE_REGISTRATION_COLUMNS')
})

test('perfil de manager não carrega vínculos nem diretórios inteiros', () => {
  const profileStart = serverSource.indexOf('export async function getDirectoryProfile')
  const managerStart = serverSource.indexOf('const managerData = await getPublicManagerProfileData(id)', profileStart)
  const managerBranch = serverSource.slice(managerStart, serverSource.indexOf('\n  }\n\n  return {', managerStart))
  const dataStart = serverSource.indexOf('const getPublicManagerProfileData')
  const dataEnd = serverSource.indexOf('export async function listDirectory', dataStart)
  const managerData = serverSource.slice(dataStart, dataEnd)

  expect(managerStart).toBeGreaterThan(profileStart)
  expect(managerBranch).not.toContain("rows('manager_equipe')")
  expect(managerBranch).not.toContain("rows('manager_produtora')")
  expect(managerBranch).not.toContain("rows('manager_jogador')")
  expect(managerData).toContain('PUBLIC_MANAGER_TEAM_LINK_COLUMNS')
  expect(managerData).toContain("selectedRows('equipes', PUBLIC_TEAM_COLUMNS, teamIds, 'id')")
})

test('diretório de equipes agrega lines e campeonatos sem cruzar identidades', () => {
  const items = buildTeamDirectoryItems({
    teams: [
      { id: 'aloe', nome: 'Aloe Gaming', username: 'aloe', status: 'ativo' },
      { id: 'bravo', nome: 'Bravo', username: 'bravo', status: 'ativo' },
    ],
    lines: [
      { equipe_id: 'aloe', nome: 'Aloe Principal' },
      { equipe_id: 'aloe', nome: 'Aloe Academy' },
      { equipe_id: 'bravo', nome: 'Bravo Mobile' },
    ],
    participations: [
      { equipe_id: 'aloe' },
      { equipe_id: 'aloe' },
      { equipe_id: 'bravo' },
    ],
  })

  expect(items[0].meta[0].value).toBe('2')
  expect(items[0].meta[1].value).toBe('2')
  expect(items[0].searchText).toContain('aloe academy')
  expect(items[0].searchText).not.toContain('bravo mobile')
  expect(items[1].meta[0].value).toBe('1')
  expect(items[1].meta[1].value).toBe('1')
})

test('diretório de jogadores conta somente inscrições válidas do jogador correto', () => {
  const items = buildPlayerDirectoryItems({
    players: [
      { id: 'p1', nome: 'Jogador Um', username: 'um', funcao: 'Capitão', status: 'ativo' },
      { id: 'p2', nome: 'Jogador Dois', username: 'dois', funcao: 'Suporte', status: 'ativo' },
    ],
    registrations: [
      { jogador_id: 'p1', status: 'ativo' },
      { jogador_id: 'p1', status: 'deletado' },
      { jogador_id: 'p2', status: 'ativo' },
      { jogador_id: 'p2', status: 'ativo' },
    ],
  })

  expect(items[0].meta[1].value).toBe('1')
  expect(items[0].searchText).toContain('capitão')
  expect(items[0].searchText).not.toContain('suporte')
  expect(items[1].meta[1].value).toBe('2')
})

test('diretório de managers soma os três tipos de vínculo sem cruzar contas', () => {
  const items = buildManagerDirectoryItems({
    managers: [
      { id: 'm1', nome: 'Manager Um', username: 'manager-um', status: 'ativo' },
      { id: 'm2', nome: 'Manager Dois', username: 'manager-dois', status: 'ativo' },
    ],
    links: [
      { manager_id: 'm1' },
      { manager_id: 'm1' },
      { manager_id: 'm1' },
      { manager_id: 'm2' },
    ],
  })

  expect(items[0].meta[0].value).toBe('3')
  expect(items[0].searchText).not.toContain('manager-dois')
  expect(items[1].meta[0].value).toBe('1')
})

test('diretório de produtoras não duplica campeonatos vinculados pelas duas chaves', () => {
  const items = buildProducerDirectoryItems({
    producers: [
      { id: 'prod-1', auth_user_id: 'auth-1', nome: 'Aloe Produções', status: 'ativo' },
      { id: 'prod-2', auth_user_id: 'auth-2', nome: 'Bravo Produções', status: 'ativo' },
    ],
    championships: [
      { id: 'camp-1', produtora_id: 'prod-1', criado_por: 'auth-1' },
      { id: 'camp-1', produtora_id: 'prod-1', criado_por: 'auth-1' },
      { id: 'camp-2', produtora_id: 'prod-1', criado_por: 'outro' },
      { id: 'camp-3', produtora_id: null, criado_por: 'auth-2' },
    ],
  })

  expect(items[0].meta[0].value).toBe('2')
  expect(items[0].searchText).not.toContain('bravo')
  expect(items[1].meta[0].value).toBe('1')
})

test('estatísticas iniciais reutilizam os dados do servidor', () => {
  const statsDashboard = publicViewSource.slice(
    publicViewSource.indexOf('function StatsDashboard'),
    publicViewSource.indexOf('function FilterOptionGroup'),
  )

  expect(statsDashboard).toContain('const hasActiveStatsFilter = Boolean(')
  expect(statsDashboard).toContain(': Promise.resolve({ equipes: initialTeams })')
  expect(statsDashboard).toContain(': Promise.resolve({ jogadores: initialPlayers })')
  expect(statsDashboard).toContain('fetch(`/api/campeonatos/${championshipId}/estatisticas/campeao`')
})
