// R05 — integracoes. Executa localmente sem Electron, Next, Supabase ou rede.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = process.cwd()
const asset = require(path.join(root, 'desktop/remote-assets.cjs'))
const ts = (() => {
  try { return require('typescript') } catch {
    // Teste isolado: a instalação global do TypeScript também é válida.
    const { execFileSync } = require('node:child_process')
    const prefix = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
    return require(path.join(prefix, 'typescript'))
  }
})()
let checks = 0
function yes(value, message) { assert.ok(value, message); checks++ }
function no(value, message) { assert.ok(!value, message); checks++ }
function eq(actual, expected, message) { assert.equal(actual, expected, message); checks++ }

function loadTs(relative, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true })
  eq(compiled.diagnostics.length, 0, `${relative} deve compilar`)
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', compiled.outputText)((name) => {
    if (name === 'node:crypto') return require('node:crypto')
    if (Object.hasOwn(dependencies, name)) return dependencies[name]
    if (name === '../../shared/supabase-admin') return { supabaseAdmin: {} }
    throw new Error(`Dependencia nao esperada: ${name}`)
  }, mod, mod.exports)
  return mod.exports
}

const site = 'https://dropzone-cadastros.vercel.app'
const storage = 'https://uukivzxabiydnrvjvabt.supabase.co'
yes(asset.allowedAssetUrl(`${site}/api/media/equipe/time.png`), 'rota publica DropZone')
yes(asset.allowedAssetUrl(`${storage}/storage/v1/object/public/jogador/foto.png`), 'imagem publica storage')
yes(asset.allowedAssetUrl(`${site}/branding/logo.png`), 'branding do site')
for (const bad of [
  'http://127.0.0.1/admin', 'https://localhost/secret', 'http://169.254.169.254/latest/meta-data',
  'https://evil.example/logo.png', 'https://supabase.co.attacker.tld/storage/v1/object/public/equipe/a.png',
  `${storage}/storage/v1/object/sign/equipe/private.png`, `${storage}/storage/v1/object/public/secret/file.png`,
  `${site}/api/auth/refresh`, 'file:///C:/Windows/system.ini',
  'https://bob:password@uukivzxabiydnrvjvabt.supabase.co/storage/v1/object/public/equipe/a.png',
]) no(asset.allowedAssetUrl(bad), `bloquear URL ${bad}`)

const response = (body, headers = { 'content-type': 'image/png' }, status = 200) => new Response(body, { status, headers })
let calls = 0
const mock = async (_url, opts) => { calls++; eq(opts.redirect, 'manual'); return response(Buffer.from('PNG')) }
const allowed = await asset.downloadSafeImage(mock, `${storage}/storage/v1/object/public/equipe/logo.png`)
eq(allowed?.extension, 'png')
eq(allowed?.data.toString('utf8'), 'PNG')
eq(calls, 1)
eq(await asset.downloadSafeImage(mock, 'http://127.0.0.1/img.png'), null)
eq(calls, 1, 'nao abrir rede para endereco privado')
eq(await asset.downloadSafeImage(async () => response('', { location: 'http://localhost/admin' }, 302), `${site}/api/media/equipe/test.png`), null)
eq(await asset.downloadSafeImage(async () => response('', { 'content-type': 'image/svg+xml' }), `${site}/api/media/equipe/test.svg`), null)
eq(await asset.downloadSafeImage(async () => response('', { 'content-type': 'image/png', 'content-length': String(asset.MAX_ASSET_BYTES + 1) }), `${site}/api/media/equipe/test.png`), null)
const oversize = new ReadableStream({
  start(controller) { controller.enqueue(Buffer.alloc(asset.MAX_ASSET_BYTES + 3)); controller.close() },
})
eq(await asset.downloadSafeImage(async () => response(oversize), `${site}/api/media/equipe/test.png`), null, 'interromper stream acima de 8 MB')

const uuid = '9b13044a-6295-4ee1-a7e4-824ff90ec12b'
yes(asset.allowedOutputLink(`http://127.0.0.1:19386/overlay/${uuid}`, 19386))
for (const bad of [`file:///tmp/test`, `https://evil.example/`, `http://127.0.0.1:19386/state/${uuid}`, `http://127.0.0.1:19386/overlay/${uuid}?evil=1`, 'http://127.0.0.1:19386/health']) no(asset.allowedOutputLink(bad, 19386), `bloquear openExternal ${bad}`)

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'desktop/package.json'), 'utf8'))
yes(pkg.build.files.includes('remote-assets.cjs'), 'helper incluído no instalador Electron')
const desktop = fs.readFileSync(path.join(root,'desktop/main.cjs'),'utf8')
yes(desktop.includes('downloadSafeImage(fetch, remoteUrl)'), 'cache utiliza validador seguro')
yes(desktop.includes('allowedOutputLink(value, OUTPUT_PORT)'), 'abertura externa limitada')
no(desktop.includes('await response.arrayBuffer()'), 'nao carregar corpo arbitrario na memoria')

const engine = loadTs('backend/src/campeonatos/estatisticas/engine-result.service.ts')
const body = () => ({
  version: 1, idempotency_key: 'test-1',
  context: { campeonato_id: 'camp-1', fase_id: 'fase-1', jogo_id: 'jogo-1', partida_id: 'partida-1' },
  teams: [{ campeonato_equipe_id: 'team-1', placement: 1, kills: 4 }],
  players: [{ campeonato_jogador_id: 'player-1', campeonato_equipe_id: 'team-1', kills: 2, damage: 200, assists: 0, revives: null }],
  source: { name: 'DPZ Live Engine', session_id: 'session-1', finalized_at: '2026-10-21T00:00:00Z', api_finalized: true },
})
const valid = body()
eq(engine.validateEngineResultV1('camp-1','partida-1',valid),valid)
const withBadPlayer = (field, value) => { const payload=body();payload.players[0][field]=value; return payload }
for (const [field, value] of [['damage',-3],['damage','10'],['damage',1.7],['assists',-1],['revives',-1]]) {
  assert.throws(() => engine.validateEngineResultV1('camp-1','partida-1',withBadPlayer(field,value)),new RegExp(field))
  checks++
}
for (const field of ['damage','assists','revives']) {
  const payload=withBadPlayer(field,undefined)
  eq(engine.validateEngineResultV1('camp-1','partida-1',payload),payload)
}
for (const field of ['weapons','loadouts']) {
  const payload=body(); payload[field]={wrong:'shape'}
  assert.throws(() => engine.validateEngineResultV1('camp-1','partida-1',payload),/listas/)
  checks++
}

// Garena: um MatchResult parcial nao deve apagar o ID valido de um jogador
// previamente cadastrado; a vinculacao explicita da importacao ainda tem prioridade.
const fixture = {
  matchresult_importacoes_jogadores: [{
    id_jogo: '888001', campeonato_jogador_id: null, jogador_id: null,
    jogador_temporario_id: null, importacao_equipe_id: 'imp-e1',
  }],
  matchresult_importacoes_equipes: [{ id: 'imp-e1', campeonato_equipe_id: null, nome_normalizado: 'alpha' }],
  campeonato_jogadores: [{
    id: 'insc-player', id_jogo: '888001', campeonato_equipe_id: 'insc-team',
    jogador_id: 'profile-1', jogador_temporario_id: null, status: 'ativo',
  }],
}
const fakeSupabase = {
  from(table) {
    const q = {
      select() { return q }, eq() { return q }, neq() { return q }, not() { return q },
      then(resolve) { return Promise.resolve({ data: fixture[table], error: null }).then(resolve) },
    }
    return q
  },
}
const garena = loadTs('backend/src/campeonatos/estatisticas/garena-matchstats.service.ts', {
  '../../shared/supabase-admin': { supabaseAdmin: fakeSupabase },
})
const garenaLinks = await garena.findPlayerLinks('imp-1', 'camp-1')
const survivor = garenaLinks.links.get('888001')
eq(survivor.campeonato_jogador_id, 'insc-player', 'importacao parcial conserva inscricao')
eq(survivor.jogador_id, 'profile-1', 'importacao parcial conserva perfil do jogador')
eq(survivor.campeonato_equipe_id, 'insc-team', 'importacao parcial conserva equipe do elenco')
fixture.matchresult_importacoes_jogadores[0].campeonato_jogador_id = 'explicit-player'
fixture.matchresult_importacoes_equipes[0].campeonato_equipe_id = 'explicit-team'
const explicitLinks = await garena.findPlayerLinks('imp-1', 'camp-1')
eq(explicitLinks.links.get('888001').campeonato_jogador_id, 'explicit-player', 'vinculo especifico tem prioridade')
eq(explicitLinks.links.get('888001').campeonato_equipe_id, 'explicit-team')

const spec = loadTs('web/features/campeonatos/export/utils/player-name-overwrite.ts')
const payload = {
  equipes:[{id:'e',nome:'EQUIPE',tag:'EQ',lines:[{id:'l',nome:'LINE',jogadores:[
    {id:'1',id_jogo:'900000000001',nick:'VALIDO',funcao:'rusher'},
    {id:'2',id_jogo:'9007199254740993',nick:'ARREDONDADO',funcao:'rusher'}
  ]}]}]
}
const result=spec.buildPlayerNameOverwrite(payload,{roleColor:'#fff',teamColor:'#fff',textColor:spec.DEFAULT_FF_TEXT_COLORS})
eq(result.stats.players,1)
eq(result.stats.skipped,1)
eq(JSON.parse(result.content).PlayerNameList[0].PlayerID,900000000001)
console.log(`OK R05: ${checks} verificacoes — Electron, imagens, contrato Engine, IDs SPEC`)
