import { expect, type Page } from '@playwright/test'

export async function deputyFixture(page: Page, options: { analytics?: boolean; ownedProducer?: boolean; extraTeams?: number } = {}) {
  const user = { id: '00000000-0000-4000-8000-000000000601', aud: 'authenticated', role: 'authenticated', email: 'vice@example.test', app_metadata: {}, user_metadata: { display_name: 'Vice-líder', account_username: 'vice' }, created_at: '2026-01-01T00:00:00Z' }
  const base = { entity_type: 'account', auth_user_id: null, username: 'fixture', token: null, parent_id: null, ref_id: null, status: 'ativo', created_by: null, created_at: '2026-01-01', updated_at: '2026-01-01' }
  const manager = { ...base, id: 'manager-a', profile_type: 'manager', name: 'Vice-líder', auth_user_id: user.id, data: {} }
  const contexts = [manager,
    { ...base, id: 'team-a', profile_type: 'equipe', name: 'Equipe Aurora', data: { delegated_access: true, delegated_permissions: { pode_ver: true, pode_editar: false, pode_escalar: false } } },
    { ...base, id: 'team-b', profile_type: 'equipe', name: 'Equipe Brasa', data: { delegated_access: true, delegated_permissions: { pode_ver: true, pode_editar: true, pode_escalar: true } } },
    { ...base, id: 'player-a', profile_type: 'jogador', name: 'Jogador Aurora', data: { delegated_access: true, delegated_permissions: { pode_ver: true, pode_editar: false } } },
    { ...base, id: 'player-b', profile_type: 'jogador', name: 'Jogador Brasa', data: { delegated_access: true, delegated_permissions: { pode_ver: true, pode_editar: true } } },
  ]
  if (options.ownedProducer) contexts.push({ ...base, id: 'producer-a', profile_type: 'produtora', name: '6B Produções', auth_user_id: user.id, data: {} })
  for (let index = 0; index < (options.extraTeams || 0); index++) contexts.push({ ...contexts[1], id: `team-extra-${index}`, name: `Equipe extra ${index}` })
  const exp = Math.floor(Date.now() / 1000) + 3600
  const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp, role: 'authenticated' })).toString('base64url'), 'fixture'].join('.')
  const session = { access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_at: exp, expires_in: 3600, user }
  await page.addInitScript(({ session }) => {
    if (sessionStorage.getItem('circuito-fixture')) return
    sessionStorage.setItem('circuito-fixture', '1')
    localStorage.clear()
    localStorage.setItem('sb-uukivzxabiydnrvjvabt-auth-token', JSON.stringify(session))
  }, { session })
  await page.route('**/auth/v1/**', route => route.fulfill({ json: user }))
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', route => {
    expect(route.request().method(), 'this scenario may never write to a live account').toBe('GET')
    const path = new URL(route.request().url()).pathname
    if (path === '/api/me') return route.fulfill({ json: { account: manager, accounts: [manager], user: { name: 'Vice-líder', username: 'vice' } } })
    if (path === '/api/me/contexts') return route.fulfill({ json: { contexts } })
    if (path === '/api/equipe/dashboard') return route.fulfill({ json: { opcoes: { eventos: [], lines: [], mapas: [] }, participacoes: { hoje: 0, mes: 0, ano: 0, total: 0 }, kpis: { campeonatos_disputados: 0, quedas: 0, booyahs: 0, abates: 0, pontos_total: null, pontos_media: null, colocacao_media: null, top3_percentual: null, top5_percentual: null, premio_em_disputa: null, campeonatos_com_premiacao_ativa: 0 }, premios: { em_disputa: 0, eventos: [] }, evolucao: [], mapas: [{ codigo: 'bermuda', nome: 'Bermuda', quedas: 4, booyahs: 1, top5_percentual: 25, pontos_media: 12, abates_media: 5, colocacao_media: 8 }, { codigo: 'purgatorio', nome: 'Purgatório', quedas: 4, booyahs: 0, top5_percentual: 15, pontos_media: 8, abates_media: 3, colocacao_media: 10 }], eventos: [], jogadores: [], lines: [], insights: {}, meta: { resultados_considerados: options.analytics ? 8 : 0, jogadores_com_resultado: 0, atualizado_em: '2026-11-03' } } })
    if (path === '/api/dropzone') return route.fulfill({ json: { rows: contexts.filter(item => item.profile_type === 'equipe').map(item => ({ ...item, entity_type: 'team', data: { ...item.data, managed_by_current_user: true } })) } })
    return route.fulfill({ json: { rows: [], items: [], team: [], player: [], purchases: [], escalacoes: [], treinos: [], announcements: [] } })
  })
  return { errors, contexts }
}
