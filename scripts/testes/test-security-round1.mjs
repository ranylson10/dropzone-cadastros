// Rodada 01: regressao de seguranca sem credenciais, rede ou banco real.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = process.cwd()
function loadRoute(relative, dependencies = {}) {
  const full = path.resolve(root, relative)
  const js = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  })
  assert.equal(js.diagnostics?.length, 0, `Sintaxe TypeScript de ${relative}`)
  const mod = { exports: {} }
  const localRequire = name => {
    if (name === 'next/server') return { NextResponse: Response }
    if (Object.hasOwn(dependencies, name)) return dependencies[name]
    return require(name)
  }
  new Function('require', 'module', 'exports', js.outputText)(localRequire, mod, mod.exports)
  return mod.exports
}

const specSample = JSON.parse(fs.readFileSync(path.join(root, 'web/features/campeonatos/export/templates/PlayerNameOverwrite.sample.json'), 'utf8'))
assert.ok(Array.isArray(specSample.PlayerNameList) && specSample.PlayerNameList.length > 0)
assert.ok(Array.isArray(specSample.TeamRegionList) && specSample.TeamRegionList.length > 0)
assert.ok(Array.isArray(specSample.TextColor) && specSample.TextColor.length === 1)
const specUtil = loadRoute('web/features/campeonatos/export/utils/player-name-overwrite.ts')
assert.deepEqual(Object.keys(JSON.parse(specUtil.serializePlayerNameOverwrite({
  PlayerNameList: specSample.PlayerNameList.slice(0, 2),
  TeamRegionList: specSample.TeamRegionList.slice(0, 2),
  TextColor: specSample.TextColor,
}))).sort(), ['PlayerNameList', 'TeamRegionList', 'TextColor'])

const origin = 'https://dropzone.example'
const makeReq = (route, body, headers = {}) => {
  const req = new Request(`${origin}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, ...headers },
    body: JSON.stringify(body),
  })
  req.nextUrl = new URL(req.url)
  return req
}

let fetches = []
const previousFetch = globalThis.fetch
try {
  // Mídia: somente URL publica; NUNCA acessar a chave administrativa.
  const media = loadRoute('web/app/api/media/[bucket]/[...path]/route.ts', {
    '@backend/shared/supabase-admin': {
      supabaseUrl: 'https://storage.example',
      get supabaseAdmin() { throw new Error('Vazamento: usou service role no proxy publico') },
    },
  })
  globalThis.fetch = async (url, options) => {
    fetches.push({ url: String(url), options })
    if (String(url).includes('blocked.png')) return new Response('private', { status: 403 })
    return new Response('public-media', { status: 200, headers: { 'Content-Type': 'image/png', 'Content-Length': '12' } })
  }
  const context = (bucket, path) => ({ params: Promise.resolve({ bucket, path }) })
  const reqMedia = (method = 'GET') => ({ method, headers: new Headers() })
  assert.equal((await media.GET(reqMedia(), context('private', ['blocked.png']))).status, 404)
  assert.equal(fetches.length, 0, 'bucket nao permitido nao consulta Storage')
  const allowed = await media.GET(reqMedia(), context('equipe', ['test.png']))
  assert.equal(allowed.status, 200)
  assert.equal(await allowed.text(), 'public-media')
  assert.match(allowed.headers.get('cache-control'), /immutable/)
  assert.equal(fetches.length, 1)
  assert.match(fetches[0].url, /\/storage\/v1\/object\/public\/equipe\/test.png/)
  const denied = await media.GET(reqMedia(), context('equipe', ['blocked.png']))
  assert.equal(denied.status, 403)
  assert.equal(fetches.length, 2, 'nao tenta URL assinada em erro do Storage publico')
  const head = await media.HEAD(reqMedia('HEAD'), context('equipe', ['test.png']))
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
  assert.equal((await media.GET(reqMedia(), context('equipe', ['..']))).status, 404)

  // Tradução: preservar anonimos legitimos, limitar abuso, entrada e concorrencia.
  process.env.GEMINI_API_KEY = 'fake-key-for-local-test'
  let providerCalls = 0
  globalThis.fetch = async (_url, options) => {
    providerCalls++
    const body = JSON.parse(options.body)
    const values = JSON.parse(body.contents[0].parts[0].text)
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(values.map(v => `TRANSLATED:${v}`)) }] } }] }) }
  }
  const i18n = loadRoute('web/app/api/i18n/translate/route.ts')
  let response = await i18n.POST(makeReq('/api/i18n/translate', { locale: 'en', texts: ['hello'] }, { origin: 'https://evil.example' }))
  assert.equal(response.status, 403)
  assert.equal(providerCalls, 0)
  response = await i18n.POST(makeReq('/api/i18n/translate', { locale: 'en', texts: ['hello'] }, { 'content-length': '18001' }))
  assert.equal(response.status, 413)
  response = await i18n.POST(makeReq('/api/i18n/translate', { locale: 'en', texts: ['A'.repeat(19_000)] }))
  assert.equal(response.status, 413, 'bloqueia bytes reais mesmo com tamanho nao confiavel')
  response = await i18n.POST(makeReq('/api/i18n/translate', { locale: 'en', texts: ['A'.repeat(501)] }))
  assert.equal(response.status, 400)
  response = await i18n.POST(makeReq('/api/i18n/translate', { locale: 'pt-BR', texts: ['olá'] }))
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).translations, ['olá'])
  assert.equal(providerCalls, 0)
  response = await i18n.POST(makeReq('/api/i18n/translate', { locale: 'en', texts: ['hello'] }, { 'x-forwarded-for': '198.51.100.1' }))
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).translations, ['TRANSLATED:hello'])
  assert.equal(providerCalls, 1)
  response = await i18n.POST(makeReq('/api/i18n/translate', { locale: 'en', texts: ['hello'] }, { 'x-forwarded-for': '198.51.100.1' }))
  assert.equal(response.status, 200)
  assert.equal(providerCalls, 1, 'cache evita segunda consulta ao provider')
  // Diversos IPs simulados nao podem ultrapassar o limite global por instancia.
  const statuses = []
  for (let i = 0; i < 125; i++) {
    const resp = await i18n.POST(makeReq('/api/i18n/translate', { locale: 'en', texts: [`unique-${i}`] }, { 'x-forwarded-for': `192.0.2.${i}` }))
    statuses.push(resp.status)
  }
  assert.ok(statuses.includes(429), 'limite global bloqueia alternancia de IPs')
  assert.equal(providerCalls, 119, '120 chamadas permitidas no total e uma era cache hit')
  console.log('OK Rodada 01: mídia pública, privacidade, POST tradução, tamanho, cache, limite global, JSON SPEC')
} finally {
  globalThis.fetch = previousFetch
}
