import assert from 'node:assert/strict'
import fs from 'node:fs'
import { NextRequest } from 'next/server.js'
import { liliFixture } from './lili-fixture.mjs'

delete process.env.GEMINI_API_KEY
process.env.NEXT_PUBLIC_APP_URL = 'https://dropzone.test'
const fixture = liliFixture()
const route = fixture.load('web/app/api/lili/chat/route.ts')
const request = body => new NextRequest('https://dropzone.test/api/lili/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const originalFetch = globalThis.fetch
globalThis.fetch = async (_url, options) => {
  assert.equal(options?.method === 'POST', false, 'an anonymous conversation must not confirm invitations over HTTP')
  return Response.json({ error: 'Convite não encontrado.' }, { status: 404 })
}
try {
  const source = fs.readFileSync('backend/src/lili/dispatch.ts', 'utf8')
  const intents = [...source.matchAll(/'([^']+)': handle/g)].map(match => match[1])
  assert.equal(intents.length, 88)
  for (const intent of intents) {
    const response = await route.POST(request({ intent, context: { locale: 'pt-BR', selectedTeamId: 'team-other', selectedChampionshipId: 'champ-other', selectedSlotId: 'slot-other', inviteToken: 'FAKE', purchaseToken: 'FAKE' } }))
    assert.ok([200, 400, 503].includes(response.status), intent)
    const body = await response.json()
    assert.ok(body.reply || body.error, `${intent}: missing response`)
  }
  assert.deepEqual(fixture.state.databaseWrites, [], 'anonymous intents cannot write to the database')
  assert.deepEqual(fixture.state.paymentCalls, [], 'anonymous intents cannot invoke billing services')
  for (const intent of ['escalar_elenco', 'resumo_minha_conta', 'listar_minhas_inscricoes', 'pagar_pix_convite_grupo', 'pagar_paypal_compra', 'confirmar_inscricao']) {
    const response = await route.POST(request({ intent }))
    const body = await response.json()
    assert.ok(body.requiresAuth === true || (response.status === 400 && /Sessao/.test(body.error)), intent)
  }
  for (const locale of ['pt-BR', 'es', 'en']) {
    const response = await route.POST(request({ intent: 'menu', context: { locale } }))
    const body = await response.json()
    assert.equal(body.locale, locale)
    assert.equal(body.actions.length, 5)
  }
  assert.equal((await route.POST(request({}))).status, 400)
  const unknown = await (await route.POST(request({ intent: 'INVALID_INTENT', context: { currentFlow: 'registration_token' } }))).json()
  assert.equal(unknown.intent, 'desconhecido')
  assert.ok(unknown.actions.some(action => action.intent === 'cancelar_fluxo'))
  const transport = fixture.load('backend/src/lili/helpers/group-invites.ts')
  const untrusted = new NextRequest('https://attacker.invalid/api/lili/chat', { headers: { authorization: 'Bearer fixture-private-session', cookie: 'fixture-private-cookie' } })
  let forwarded = 0
  globalThis.fetch = async (url, options) => {
    forwarded++
    assert.equal(url.origin, 'https://dropzone.test')
    assert.equal(options.redirect, 'error')
    assert.ok(options.signal instanceof AbortSignal)
    return Response.json({ ok: true })
  }
  await assert.rejects(transport.loadGroupInviteInChat(untrusted, 'token'), /não autorizada/)
  await assert.rejects(transport.loadLineupInviteInChat(untrusted, 'token'), /não autorizada/)
  await assert.rejects(transport.confirmGroupInviteInChat(untrusted, { inviteToken: 'token' }), /não autorizada/)
  assert.equal(forwarded, 0, 'untrusted request origins must never receive session credentials')
  await transport.loadGroupInviteInChat(request({}), 'token')
  assert.equal(forwarded, 1)
  const key = '00000000-0000-4000-8000-000000000001'
  const confirmRequest = new NextRequest('https://dropzone.test/api/lili/chat', { headers: { authorization: 'Bearer fixture', 'Idempotency-Key': key } })
  let posts = 0
  globalThis.fetch = async (url, options) => {
    posts++; assert.equal(options.headers.get('Idempotency-Key'), key)
    assert.equal(options.headers.get('authorization'), 'Bearer fixture'); assert.equal(options.method, 'POST')
    assert.equal(url.origin, 'https://dropzone.test'); assert.equal(options.redirect, 'error')
    assert.equal(new URL(url).pathname, '/api/convites/grupo/literal%252F')
    return Response.json({ ok: true, campeonato_equipe_id: key })
  }
  const confirmed = await transport.confirmGroupInviteInChat(confirmRequest, { inviteToken: 'literal%2F', selectedTeamId: 'team', selectedLineId: 'line', selectedSlotId: 'slot' })
  assert.equal(confirmed.ok, true); assert.equal(posts, 1)
  globalThis.fetch = async () => Response.json({})
  await assert.rejects(() => transport.confirmGroupInviteInChat(confirmRequest, { inviteToken: 'token' }), /confirmar o resultado/)
  console.log('OK: 88 comandos da Lili, autenticação, ausência de gravação/cobrança anônima, três idiomas e origem/redirect de transporte protegidos.')
} finally { globalThis.fetch = originalFetch }
