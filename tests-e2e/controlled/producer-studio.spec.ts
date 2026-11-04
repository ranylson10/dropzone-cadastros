import { expect, test, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { deputyFixture } from '../helpers/circuito-fixture'

const champId = '00000000-0000-4000-8000-000000000700'
const panelUrl = `/?painel=1&perfil=produtora&perfil_id=producer-a&section=campeonatos&campeonato=${champId}`

async function studio(page: Page) {
  const base = await deputyFixture(page, { ownedProducer: true })
  const producer = base.contexts.find(item => item.id === 'producer-a')!
  const championship = { ...producer, id: champId, entity_type: 'championship', name: 'Copa Aurora', data: { tipo: 'copa', produtora_id: producer.id, aprovacao_status: 'aprovado', numero_vagas: 24, logo_url: '/branding/dropzone-platform.png' } }
  const submissions: unknown[] = []
  let locked = false
  const games = ['game-1', 'game-2'].map((id, index) => ({ id, nome: `Jogo ${index + 1}`, fase_id: 'phase-1', fase: { nome: 'Classificatória', ordem: 1 }, numero_partidas: 2, status: 'agendado' }))
  await page.route(url => url.pathname === '/api/dropzone', route => route.fulfill({ json: { rows: [championship], summary: { teamCount: 3, gameCount: 2, phaseCount: 1, groupCount: 1 } } }))
  await page.route(/\/api\/campeonatos\/[^/]+\/pontuador\/jogos$/, route => route.fulfill({ json: { jogos: games } }))
  await page.route(/\/api\/campeonatos\/[^/]+\/pontuador\/game-[12]$/, route => route.fulfill({ json: {
    campeonato: { id: champId, nome: 'Copa Aurora', campeonato_configuracoes: [{ pontos_colocacao: [12, 9, 8], pontos_por_abate: 0, estatisticas_delay_segundos: 300 }] },
    jogo: games.find(game => route.request().url().endsWith(game.id)), fase: { nome: 'Classificatória' },
    partidas: [1, 2].map(n => ({ id: `drop-${n}`, numero_partida: n, mapa_codigo: 'bermuda', mapa_nome: 'Bermuda', status: n === 1 && locked ? 'finalizada' : 'agendada' })),
    slots: ['a', 'b', 'c'].map((id, index) => ({ campeonato_equipe_id: id, grupo_id: 'group', grupo_nome: 'Grupo A', slot_numero: index + 1, equipe_nome: `Equipe ${id.toUpperCase()}`, equipe_tag: id })),
    matriz: [{ partida_id: 'drop-1', campeonato_equipe_id: 'a', resultado_id: 'result-a', posicao: 1, abates: 2 }, { partida_id: 'drop-1', campeonato_equipe_id: 'b', status_presenca: 'falta' }],
    jogadores: [{ id: 'player-a', campeonato_equipe_id: 'a', nick: 'Jogador A', id_jogo: '123' }, { id: 'player-c', campeonato_equipe_id: 'c', nick: 'Jogador C', id_jogo: '456' }],
    resultados_jogadores: [], classificacao_geral: [], classificacao_jogo: [], classificacao_mapas: {}, mvp_geral: [], mvp_jogo: [], vinculos_matchresult: [],
  } }))
  await page.route(/\/sumula\/manual$/, route => {
    expect(route.request().method()).toBe('POST')
    submissions.push(route.request().postDataJSON())
    return route.fulfill({ json: { ok: true } })
  })
  await page.route(/\/quedas\/drop-1\/finalizar$/, route => {
    locked = true
    return route.fulfill({ json: { queda: { id: 'drop-1', status: 'finalizada' } } })
  })
  await page.goto(panelUrl)
  await expect(page.getByRole('navigation', { name: 'Áreas do campeonato' })).toBeVisible()
  return { ...base, submissions }
}

test('producer uses the local studio sequence and keeps advanced rules in their menu', async ({ page }) => {
  await studio(page)
  const nav = page.getByRole('navigation', { name: 'Áreas do campeonato' })
  await expect(nav.getByRole('button')).toHaveText(['Resumo', 'Fases e grupos', 'Equipes', 'Elencos', 'Jogos e quedas', 'Pontuador', 'Tabelas', 'Inscrições'])
  await page.getByText('Regras avançadas', { exact: true }).click()
  await expect(page.getByRole('button', { name: /Inscrição, elenco e transferências/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Temporadas, divisões e progressão/ })).toBeVisible()
  await page.getByRole('button', { name: /Inscrição, elenco e transferências/ }).click()
  const dialog = page.getByRole('dialog', { name: /Editar campeonato/ })
  await expect(dialog.getByLabel('Regras avançadas')).toHaveValue('operation')
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page.getByRole('button', { name: 'Regras de pontuação', exact: true }).click()
  await expect(page.locator('.championship-scoring-card')).toBeVisible()
})

test('embedded scoring protects FALT and saves only edited teams without inventing player statistics', async ({ page, isMobile }, info) => {
  const data = await studio(page)
  await page.getByRole('navigation', { name: 'Áreas do campeonato' }).getByRole('button', { name: 'Pontuador', exact: true }).click()
  const scorer = page.getByRole('region', { name: 'Pontuador do jogo' })
  await expect(scorer).toBeVisible()
  await expect(page.getByLabel('Fase', { exact: true })).toHaveValue('phase-1')
  await expect(page.getByLabel('Jogo', { exact: true })).toHaveValue('game-1')
  await expect(scorer.getByLabel('Colocação de Equipe B')).toBeDisabled()
  await expect(scorer.locator('tbody tr').first().locator('td').nth(10)).toHaveText('12')
  await scorer.getByLabel('Colocação de Equipe C').fill('2')
  await scorer.getByLabel('Abates de Equipe C', { exact: true }).fill('0')
  await expect(scorer.locator('.scorer-workspace-header')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(scorer.getByText('Equipe C', { exact: true })).toBeVisible()
  if (isMobile) {
    const cell = await scorer.getByLabel('Abates de Equipe C', { exact: true }).boundingBox()
    expect(cell!.x + cell!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    await scorer.screenshot({ path: info.outputPath('producer-studio-scoring.png') })
    expect((await scorer.locator('tbody tr').last().boundingBox())!.height).toBeLessThan(200)
  }
  await scorer.screenshot({ path: info.outputPath('producer-studio-scoring.png') })
  const access = await new AxeBuilder({ page }).include('.producer-scoring-workspace').withTags(['wcag2a','wcag2aa']).analyze()
  expect(access.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([])
  if (isMobile) expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  await scorer.getByRole('button', { name: /Salvar e finalizar Q1/ }).click()
  await expect(scorer.getByRole('button', { name: 'Editar Q1' })).toBeVisible()
  expect(data.submissions).toEqual([{ partida_id: 'drop-1', origem: 'manual', equipes: [{ campeonato_equipe_id: 'c', posicao: 2, abates: 0, punicao_pontos: 0, punicao_motivo: '', jogadores: [] }] }])
  expect(data.errors).toEqual([])
})

test('changing drop, game or producer tool requires discarding a pending draft', async ({ page }) => {
  await studio(page)
  const nav = page.getByRole('navigation', { name: 'Áreas do campeonato' })
  await nav.getByRole('button', { name: 'Pontuador', exact: true }).click()
  const scorer = page.getByRole('region', { name: 'Pontuador do jogo' })
  await scorer.getByLabel('Abates de Equipe C', { exact: true }).fill('3')
  await scorer.getByRole('button', { name: /Q2/ }).click()
  await page.getByRole('dialog', { name: 'Confirmar ação' }).getByRole('button', { name: 'Cancelar' }).click()
  await expect(scorer.getByLabel('Abates de Equipe C', { exact: true })).toHaveValue('3')
  await page.getByLabel('Jogo', { exact: true }).selectOption('game-2')
  await page.getByRole('dialog', { name: 'Confirmar ação' }).getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByLabel('Jogo', { exact: true })).toHaveValue('game-1')
  await nav.getByRole('button', { name: 'Resumo', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirmar ação' }).getByRole('button', { name: 'Cancelar' }).click()
  await expect(scorer).toBeVisible()
  await page.getByRole('navigation', { name: 'Áreas principais da produtora' }).getByRole('button', { name: 'Início', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirmar ação' }).getByRole('button', { name: 'Cancelar' }).click()
  await expect(scorer).toBeVisible()
  await page.getByRole('button', { name: 'Regras de pontuação', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirmar ação' }).getByRole('button', { name: 'Cancelar' }).click()
  await expect(scorer.getByLabel('Abates de Equipe C', { exact: true })).toHaveValue('3')
  await scorer.getByRole('button', { name: /Q2/ }).click()
  await page.getByRole('dialog', { name: 'Confirmar ação' }).getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(scorer.getByLabel('Abates de Equipe C', { exact: true })).toHaveValue('')
})
