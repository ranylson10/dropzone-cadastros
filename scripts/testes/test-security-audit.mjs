import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { EventEmitter } from 'node:events'
import { randomBytes } from 'node:crypto'
import ts from 'typescript'

const root = process.cwd()
const nativeRequire = createRequire(import.meta.url)
function loader(overrides = {}) {
  const cache = new Map()
  return function load(filename) {
    const file = path.resolve(root, filename)
    if (file in overrides) return overrides[file]
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    const require = specifier => {
      if (specifier in overrides) return overrides[specifier]
      const relative = specifier.startsWith('@backend/') ? path.join(root, 'backend/src', specifier.slice(9)) : specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : null
      if (relative && fs.existsSync(`${relative}.ts`)) return load(`${relative}.ts`)
      return nativeRequire(specifier)
    }
    new Function('require', 'module', 'exports', '__filename', '__dirname', output)(require, module, module.exports, file, path.dirname(file))
    return module.exports
  }
}

process.env.CURRENCY_QUOTE_SECRET = randomBytes(32).toString('hex')
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://storage.test'
const load = loader()
const registration = load('web/lib/registration-price.ts')
for (const value of [null, undefined, '', '  ', -1, NaN, Infinity, 'sem valor', false, true, [], [0], {}]) {
  assert.equal(registration.registrationPriceLabel(value), 'Sob consulta')
}
for (const value of [0, '0', ' 0 ']) assert.equal(registration.registrationPriceLabel(value), 'Grátis')
assert.equal(registration.registrationAmount('30'), 30)
assert.match(registration.registrationPriceLabel(30), /30,00/)

// The HTTP adapter must authenticate before reading bodies or calling services.
let entityAuthenticated = false
const entityCalls = [], invalidations = []
const entityRoute = loader({
  '@backend/auth/server-auth': {
    getBearerUser: async () => { if (!entityAuthenticated) throw new Error('Sessao obrigatoria'); return { id: 'entity-owner' } },
    getActiveAccount: async (_req, user) => { assert.equal(user.id, 'entity-owner'); return { id: 'producer-own', profile_type: 'produtora' } },
  },
  'next/cache': { revalidateTag: (...args) => invalidations.push(args), revalidatePath: (...args) => invalidations.push(args) },
  ...Object.fromEntries(['listEntities', 'createEntity', 'updateEntity', 'removeEntity'].map((name, index) => [
    `@backend/dropzone/entities/${['list-entities', 'create-entity', 'update-entity', 'remove-entity'][index]}`,
    { [name]: async (context, input) => {
      assert.equal(context.user.id, 'entity-owner')
      assert.equal(context.account.id, 'producer-own')
      assert.equal(context.origin, 'https://app.test')
      entityCalls.push({ name, input })
      context.invalidateTag('directory:campeonatos')
      context.invalidatePath('/campeonatos/entity-own')
      return { success: true }
    } },
  ])),
})('web/app/api/dropzone/route.ts')
let bodiesRead = 0
const entityRequest = { url: 'https://app.test/api/dropzone?entity_type=group', nextUrl: { origin: 'https://app.test' }, json: async () => { bodiesRead++; return { entity_type: 'group', id: 'group-own' } } }
for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) assert.equal((await entityRoute[method](entityRequest)).status, 400)
assert.equal(bodiesRead, 0)
assert.equal(entityCalls.length, 0)
entityAuthenticated = true
for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) assert.equal((await entityRoute[method](entityRequest)).status, 200)
assert.equal(entityCalls[0].input.get('entity_type'), 'group')
assert.equal(bodiesRead, 3)
assert.equal(entityCalls.length, 4)
assert.deepEqual(invalidations[0], ['directory:campeonatos', { expire: 0 }])

// Real entity services deny another producer before mutating its structure.
const entityRows = {
  campeonatos: [
    { id: 'champ-own', produtora_id: 'producer-own', criado_por: 'entity-owner', tipo: 'copa', deleted_at: null },
    { id: 'champ-other', produtora_id: 'producer-other', criado_por: 'other-owner', tipo: 'copa', deleted_at: null },
  ],
  campeonato_grupos: [{ id: 'group-other', campeonato_id: 'champ-other' }],
  campeonato_fases: [{ id: 'phase-own', campeonato_id: 'champ-own', nome: 'Entrada' }],
}
const entityQueries = [], entityWrites = []
const entityDb = { from(table) {
  const filters = []
  let one = false, operation = null, payload = null, range = null
  const q = {
    select() { return q }, order() { return q },
    eq(key, value) { filters.push(row => row[key] === value); return q },
    is(key, value) { filters.push(row => row[key] === value); return q },
    in(key, values) { filters.push(row => values.includes(row[key])); return q },
    range(from, to) { range = [from, to]; return q },
    maybeSingle() { one = true; return q }, single() { one = true; return q },
    insert(value) { operation = 'insert'; payload = value; return q },
    update(value) { operation = 'update'; payload = value; return q },
    delete() { operation = 'delete'; return q },
    then(resolve, reject) { return Promise.resolve().then(() => {
      entityQueries.push(table)
      if (operation) entityWrites.push({ table, operation, payload })
      let rows = (entityRows[table] || []).filter(row => filters.every(matches => matches(row)))
      if (range) rows = rows.slice(range[0], range[1] + 1)
      return { data: one ? rows[0] || null : rows, error: null }
    }).then(resolve, reject) },
  }
  return q
} }
const entityLoader = loader({
  '@backend/shared/supabase-admin': { supabaseAdmin: entityDb },
  '@backend/produtora/workspace-access': { requireProducerWorkspaceAccess: async () => { throw new Error('Sem acesso a produtora') } },
  '@backend/campeonatos/capacidade': {},
  '@backend/campeonatos/participacao-sync': {},
  '@backend/campeonatos/rulebook': {},
  '@backend/equipes/player-roster': {},
})
const entities = {
  ...entityLoader('backend/src/dropzone/entities/create-entity.ts'),
  ...entityLoader('backend/src/dropzone/entities/update-entity.ts'),
  ...entityLoader('backend/src/dropzone/entities/remove-entity.ts'),
  ...entityLoader('backend/src/dropzone/entities/list-entities.ts'),
}
const entityContext = { user: { id: 'entity-owner' }, account: { id: 'producer-own', profile_type: 'produtora' }, origin: 'https://app.test', invalidateTag() {}, invalidatePath() {} }
await assert.rejects(entities.createEntity({ ...entityContext, account: { id: 'player-own', profile_type: 'jogador' } }, { entity_type: 'championship' }), /nao pode criar/)
await assert.rejects(entities.createEntity(entityContext, { entity_type: 'phase', parent_id: 'champ-other', name: 'Entrada' }), /outra produtora/)
await assert.rejects(entities.updateEntity(entityContext, { entity_type: 'group', id: 'group-other', data: { nome: 'Alterado' } }), /outra produtora/)
await assert.rejects(entities.removeEntity(entityContext, { entity_type: 'group', id: 'group-other' }), /outra produtora/)
assert.equal(entityWrites.length, 0)
assert.deepEqual(await entities.listEntities(entityContext, new URLSearchParams({ entity_type: 'registration_link', championship_id: 'champ-other' })), { rows: [] })
assert.equal(entityQueries.includes('campeonato_links'), false, 'foreign private links must not be read before authorization')
const ownPhases = await entities.listEntities(entityContext, new URLSearchParams({ entity_type: 'phase', championship_id: 'champ-own' }))
assert.equal(ownPhases.rows.length, 1)
assert.equal(ownPhases.rows[0].id, 'phase-own')
await entities.removeEntity(entityContext, { entity_type: 'championship', id: 'champ-own' })
assert.equal(entityWrites.length, 1)
assert.equal(entityWrites[0].table, 'campeonatos')
assert.equal(entityWrites[0].payload.status, 'excluido')

const currency = load('backend/src/billing/currency.ts')
const price = load('backend/src/billing/paypal-price.ts')
const unsigned = { baseCurrency: 'BRL', baseAmountCents: 10000, currency: 'BRL', totalMinor: 10000, expiresAt: new Date(Date.now() + 60000).toISOString() }
const quote = { ...unsigned, quoteId: currency.createQuoteToken(unsigned) }
const reservation = { id: 'reservation-test', auth_user_id: 'owner-test', status: 'ativa', expira_em: new Date(Date.now() + 60000).toISOString(), meta: { quote, campeonato_nome: 'Teste' } }
const expected = price.resolvePayPalQuote(reservation, 'lili_reservas_slot')
price.assertPayPalPrice(expected, 10000, 'BRL')
for (const amount of [1, 0, -1, 100.1, '10000', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => price.assertPayPalPrice(expected, amount, 'BRL'))
for (const code of ['USD', 'EUR', 'JPY', '', null]) assert.throws(() => price.assertPayPalPrice(expected, 10000, code))
assert.throws(() => price.resolvePayPalQuote({ meta: { quote: { totalMinor: 1, currency: 'USD' } } }, 'lili_reservas_slot'))
assert.throws(() => currency.verifyQuoteToken(quote.quoteId.slice(0, -1) + '!'))
assert.equal(price.resolvePayPalQuote({ meta: { quote: { ...quote, totalMinor: 1 } } }, 'lili_reservas_slot').totalMinor, 10000)
price.assertPayPalReferenceOpen(reservation, 'lili_reservas_slot')
assert.throws(() => price.assertPayPalReferenceOpen({ ...reservation, status: 'cancelada' }, 'lili_reservas_slot'))
assert.throws(() => price.assertPayPalReferenceOpen({ ...reservation, expira_em: '2000-01-01' }, 'lili_reservas_slot'))
const purchase = { valor_centavos: 20000 }
assert.equal(price.resolvePayPalQuote(purchase, 'sistema_compras_vaga', 'BRL').totalMinor, 20000)
assert.throws(() => price.resolvePayPalQuote(purchase, 'sistema_compras_vaga', 'USD', quote))
const foreign = { ...unsigned, currency: 'USD', totalMinor: 2000 }
const foreignQuote = { ...foreign, quoteId: currency.createQuoteToken(foreign) }
assert.equal(price.resolvePayPalQuote({ valor_centavos: 10000 }, 'sistema_compras_vaga', 'USD', foreignQuote).totalMinor, 2000)

// Exercise the actual Next route: a forged price must never reach the provider.
let createdOrders = 0
const db = { from() { return { select() { return this }, eq() { return this }, async single() { return { data: reservation, error: null } } } } }
const route = loader({
  [path.join(root, 'backend/src/auth/server-auth.ts')]: { getBearerUser: async () => ({ id: 'owner-test' }) },
  [path.join(root, 'backend/src/shared/supabase-admin.ts')]: { supabaseAdmin: db },
  [path.join(root, 'backend/src/billing/paypal.ts')]: { paypalConfigured: () => true, createLiliPayPalOrder: async input => { createdOrders++; assert.equal(input.amountMinor, 10000); assert.equal(input.currency, 'BRL'); return { paypal_order_id: 'test-order' } } },
})('web/app/api/paypal/orders/route.ts')
const request = body => ({ json: async () => body, nextUrl: { origin: 'https://app.test' } })
assert.equal((await route.POST(request({ reservationId: reservation.id, amountMinor: 1, currency: 'USD' }))).status, 400)
assert.equal(createdOrders, 0)
assert.equal((await route.POST(request({ reservationId: reservation.id }))).status, 200)
assert.equal(createdOrders, 1)

// Query pagination keeps every authorized row even when the Data API caps pages.
const { readPagedRows } = load('backend/src/shared/paginated-query.ts')
const authorizedRows = Array.from({ length: 10501 }, (_, id) => ({ id, owner: 'owner-test' }))
const pageOffsets = []
const paged = await readPagedRows({ async range(from, to) {
  pageOffsets.push(from)
  return { data: authorizedRows.slice(from, Math.min(to + 1, from + 200)), error: null }
} })
assert.deepEqual(paged, authorizedRows)
assert.equal(pageOffsets.at(-1), authorizedRows.length)
await assert.rejects(readPagedRows({ async range(from) { return { data: authorizedRows.slice(from, from + 200), error: null } } }, 300), /limite de registros/)
const queryError = new Error('database unavailable')
await assert.rejects(readPagedRows({ async range() { return { data: null, error: queryError } } }), error => error === queryError)

// Exercise the real PayPal service without sending payments or network requests.
process.env.PAYPAL_CLIENT_ID = 'isolated-test-client'
process.env.PAYPAL_CLIENT_SECRET = randomBytes(32).toString('hex')
process.env.PAYPAL_WEBHOOK_ID = 'isolated-test-webhook'
const records = { lili_reservas_slot: [{ ...reservation }], sistema_compras_vaga: [], sistema_pagamentos: [] }
const writes = []
const serviceDb = { from(table) {
  let filters = [], patch = null, insert = null, one = false
  const q = {
    select() { return q }, order() { return q }, limit() { return q },
    eq(key, value) { filters.push(row => row[key] === value); return q },
    in(key, values) { filters.push(row => values.includes(row[key])); return q },
    update(value) { patch = value; return q },
    upsert(value) { insert = value; return q },
    single() { one = true; return q }, maybeSingle() { one = true; return q },
    then(resolve, reject) { return Promise.resolve().then(() => {
      const selected = records[table].filter(row => filters.every(matches => matches(row)))
      if (insert) {
        const existing = records[table].find(row => row.external_reference === insert.external_reference)
        const saved = existing || { id: `payment-${records[table].length + 1}` }
        Object.assign(saved, insert)
        if (!existing) records[table].push(saved)
        writes.push({ table, kind: 'upsert' })
        return { data: one ? saved : [saved], error: null }
      }
      if (patch) { selected.forEach(row => Object.assign(row, patch)); writes.push({ table, kind: 'update' }) }
      return { data: one ? selected[0] || null : selected, error: null }
    }).then(resolve, reject) },
  }
  return q
} }
let attached = 0, released = 0
const paypal = loader({
  [path.join(root, 'backend/src/shared/supabase-admin.ts')]: { supabaseAdmin: serviceDb },
  [path.join(root, 'backend/src/billing/lili-slot-reservation.ts')]: { attachReservationPayment: async () => { attached++ } },
  [path.join(root, 'backend/src/billing/vacancy-purchase.ts')]: { liberarCompraVagaComSplit: async () => { released++ } },
})('backend/src/billing/paypal.ts')
const originalFetch = globalThis.fetch
const providerCalls = []
let providerOrder
globalThis.fetch = async (url, init) => {
  providerCalls.push({ path: new URL(url).pathname, method: init.method || 'GET' })
  if (url.endsWith('/v1/oauth2/token')) return { ok: true, json: async () => ({ access_token: 'test-token' }) }
  if (url.endsWith('/verify-webhook-signature')) return { ok: true, json: async () => ({ verification_status: 'SUCCESS' }) }
  if (url.endsWith('/capture')) {
    providerOrder = { ...providerOrder, status: 'COMPLETED', purchase_units: providerOrder.purchase_units.map(unit => ({ ...unit, payments: { captures: [{ id: 'capture-test', status: 'COMPLETED', amount: unit.amount }] } })) }
    return { ok: true, json: async () => providerOrder }
  }
  if (url.endsWith('/v2/checkout/orders') && init.method === 'POST') {
    const body = JSON.parse(init.body)
    assert.deepEqual(body.purchase_units[0].amount, { currency_code: 'BRL', value: '100.00' })
    providerOrder = { id: 'order-test', status: 'CREATED', purchase_units: body.purchase_units, links: [{ rel: 'approve', href: 'https://paypal.test/approve' }] }
  }
  return { ok: true, json: async () => providerOrder }
}
try {
  const input = { reservation, campeonatoNome: 'Teste', amountMinor: 10000, currency: 'BRL', returnOrigin: 'https://app.test' }
  await assert.rejects(paypal.createLiliPayPalOrder({ ...input, amountMinor: 1 }))
  await assert.rejects(paypal.createLiliPayPalOrder({ ...input, reservation: { ...reservation, auth_user_id: 'other-user' } }))
  assert.equal(providerCalls.length, 0)
  const payment = await paypal.createLiliPayPalOrder(input)
  assert.equal(attached, 1)
  assert.equal(payment.payload_criacao.dropzone.quote.totalMinor, 10000)
  const existingCalls = providerCalls.length
  assert.equal((await paypal.createLiliPayPalOrder(input)).id, payment.id)
  assert.equal(providerCalls.length, existingCalls)
  await assert.rejects(paypal.captureLiliPayPalOrder({ orderId: 'order-test', reservationId: reservation.id, authUserId: 'other-user' }))
  payment.valor_centavos = 1
  await assert.rejects(paypal.captureLiliPayPalOrder({ orderId: 'order-test', reservationId: reservation.id, authUserId: 'owner-test' }))
  assert.equal(providerCalls.length, existingCalls, 'forged stored price must be rejected before provider capture')
  payment.valor_centavos = 10000
  providerOrder.status = 'APPROVED'
  assert.equal((await paypal.captureLiliPayPalOrder({ orderId: 'order-test', reservationId: reservation.id, authUserId: 'owner-test' })).status, 'pago')
  const captures = () => providerCalls.filter(call => call.path.endsWith('/capture')).length
  assert.equal(captures(), 1)
  await paypal.captureLiliPayPalOrder({ orderId: 'order-test', reservationId: reservation.id, authUserId: 'owner-test' })
  assert.equal(captures(), 1, 'repeated capture must be idempotent')
  payment.status = 'aguardando'
  const webhook = { event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'capture-test', supplementary_data: { related_ids: { order_id: 'order-test' } } } }
  providerOrder.purchase_units[0].custom_id = 'other-reservation'
  const writesBefore = writes.length
  await assert.rejects(paypal.applyPayPalWebhook(webhook))
  assert.equal(writes.length, writesBefore)
  providerOrder.purchase_units[0].custom_id = reservation.id
  providerOrder.purchase_units[0].payments.captures[0].amount = { currency_code: 'USD', value: '1.00' }
  await assert.rejects(paypal.applyPayPalWebhook(webhook))
  assert.equal(writes.length, writesBefore)
  providerOrder.purchase_units[0].payments.captures[0].amount = { currency_code: 'BRL', value: '100.00' }
  assert.equal((await paypal.applyPayPalWebhook(webhook)).status, 'pago')
  assert.equal(await paypal.verifyPayPalWebhook(new Headers(), webhook), true)
  assert.equal(released, 0)
} finally { globalThis.fetch = originalFetch }

let requests = 0
let behavior = 'ok'
const transport = {
  request(url, options, callback) {
    requests++
    assert.equal(options.agent, false)
    assert.equal(options.autoSelectFamily, false)
    options.lookup(url.hostname, {}, (error, address) => { assert.equal(error, null); assert.equal(address, '93.184.216.34') })
    const req = new EventEmitter()
    req.destroy = error => { queueMicrotask(() => req.emit('error', error)); return req }
    req.end = () => queueMicrotask(() => {
      const response = new EventEmitter()
      response.resume = () => {}
      response.statusCode = behavior === 'redirect' ? 302 : 200
      response.headers = behavior === 'redirect' ? { location: 'https://127.0.0.1/secret' } : { 'content-type': 'image/png' }
      callback(response)
      if (behavior === 'redirect') return
      if (behavior === 'oversize') { const chunk = Buffer.alloc(1024 * 1024); for (let i = 0; i < 26; i++) response.emit('data', chunk) }
      else response.emit('data', Buffer.from('test-png'))
      response.emit('end')
    })
    return req
  },
}
process.env.STREAM_IMAGE_ALLOWED_ORIGINS = 'https://cdn.test,https://127.0.0.1'
const images = loader({
  'node:dns/promises': { lookup: async hostname => [{ address: hostname === '127.0.0.1' ? '127.0.0.1' : '93.184.216.34', family: 4 }] },
  'node:https': transport,
})('backend/src/uploads/stream-image.ts')
for (const ip of ['0.0.0.0', '10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.0.1', '224.0.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1']) assert.equal(images.isPublicImageAddress(ip), false, ip)
for (const ip of ['8.8.8.8', '93.184.216.34', '2606:4700:4700::1111']) assert.equal(images.isPublicImageAddress(ip), true, ip)
for (const url of ['http://cdn.test/a.png', 'https://other.test/a.png', 'https://u:p@cdn.test/a.png', 'https://cdn.test:444/a.png', 'https://storage.test/auth/v1/admin/users']) assert.throws(() => images.allowedRemoteImageUrl(url))
await assert.rejects(images.loadStreamImage('https://127.0.0.1/secret', 'https://app.test'))
assert.equal(requests, 0)
assert.equal((await images.loadStreamImage('https://cdn.test/a.png', 'https://app.test')).bytes.toString(), 'test-png')
behavior = 'redirect'
await assert.rejects(images.loadStreamImage('https://cdn.test/a.png', 'https://app.test'))
assert.equal(requests, 2, 'redirect to loopback must not open a second socket')
behavior = 'oversize'
await assert.rejects(images.loadStreamImage('https://cdn.test/a.png', 'https://app.test'), /25 MB/)
await assert.rejects(images.loadStreamImage('/api/admin/users', 'https://app.test'))
console.log('OK: autenticação antes dos serviços, permissões entre produtoras, preço/moeda adulterados, assinaturas, propriedade da cotação, reservas expiradas, endpoint e serviço PayPal, captura idempotente, webhook, paginação acima de 10 mil, IPs privados, DNS fixado, redirecionamento e limite de imagem.')
