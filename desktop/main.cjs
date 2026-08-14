const { app, BrowserWindow, clipboard, dialog, ipcMain, safeStorage, shell } = require('electron')
const crypto = require('node:crypto')
const fsSync = require('node:fs')
const fs = require('node:fs/promises')
const http = require('node:http')
const path = require('node:path')
const { spawn } = require('node:child_process')

const OUTPUT_PORT = 19386
const DEFAULT_ORIGIN = 'https://dropzone-cadastros.vercel.app'
const OAUTH_PROTOCOL = 'dropzone-live'
const OAUTH_CALLBACK = `${OAUTH_PROTOCOL}://auth/callback`
let mainWindow = null
let outputServer = null
let storeCache = null
let startupProtocolUrl = process.argv.find((value) => String(value).startsWith(`${OAUTH_PROTOCOL}://`)) || null

function defaultLayout() {
  return {
    width: 1920,
    height: 1080,
    background: '#080b13',
    blocks: [
      { id: crypto.randomUUID(), type: 'text', x: 82, y: 64, width: 1400, height: 76, text: 'TABELA GERAL', color: '#ffffff', size: 46 },
      { id: crypto.randomUUID(), type: 'table', x: 82, y: 178, width: 1160, height: 690, title: 'CLASSIFICAÇÃO', columns: ['posicao', 'logo', 'nome', 'abates', 'pontos_total'] },
      { id: crypto.randomUUID(), type: 'text', x: 82, y: 930, width: 1160, height: 34, text: 'DADOS SINCRONIZADOS DO DROPZONE', color: '#87a0b9', size: 18 }
    ]
  }
}

function defaultStore() {
  return { version: 2, auth: null, lives: [] }
}

function demoCache() {
  return {
    demo: true,
    syncedAt: null,
    teams: [
      { posicao: 1, nome: 'ALPHA ESPORTS', abates: 21, pontos_total: 43, booyahs: 2, quedas: 4, dano: 8421, assistencias: 8 },
      { posicao: 2, nome: 'NOVA SQUAD', abates: 17, pontos_total: 35, booyahs: 1, quedas: 4, dano: 7050, assistencias: 6 },
      { posicao: 3, nome: 'TITANS FF', abates: 13, pontos_total: 29, booyahs: 0, quedas: 4, dano: 6210, assistencias: 5 },
      { posicao: 4, nome: 'RUSH LEGENDS', abates: 10, pontos_total: 23, booyahs: 0, quedas: 4, dano: 5170, assistencias: 4 },
    ],
    players: [],
  }
}

function cleanOrigin(value) {
  if (value && String(value).trim().replace(/\/$/, '') !== DEFAULT_ORIGIN) throw new Error('Este aplicativo funciona somente com o DropZone.')
  return DEFAULT_ORIGIN
}

function cleanProfileType(value) {
  const profileType = String(value || 'produtora').trim()
  if (!['produtora', 'equipe', 'jogador', 'manager', 'broadcast'].includes(profileType)) return 'produtora'
  return profileType
}

function protocolUrlFromArgs(commandLine = []) {
  return commandLine.find((value) => String(value).startsWith(`${OAUTH_PROTOCOL}://`)) || null
}

function isAllowedProtocolUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === `${OAUTH_PROTOCOL}:` && url.hostname === 'auth' && url.pathname === '/callback'
  } catch {
    return false
  }
}

function sendAuthEvent(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

/** O login social usa o Chrome normal quando disponivel, preservando a conta Google ja conectada. */
async function openGoogleLogin(url) {
  if (process.platform === 'win32') {
    const candidates = [
      process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ].filter(Boolean)
    const chromePath = candidates.find((candidate) => fsSync.existsSync(candidate))
    if (chromePath) {
      const browser = spawn(chromePath, ['--new-window', url], { detached: true, stdio: 'ignore', windowsHide: false })
      browser.unref()
      return 'chrome'
    }
  }
  await shell.openExternal(url)
  return 'default'
}

function safeLive(live) {
  const id = String(typeof live === 'string' ? live : live?.id || '')
  if (!id || !/^[a-zA-Z0-9-]{8,80}$/.test(id)) throw new Error('Live inválida.')
  return id
}

function statePath() { return path.join(app.getPath('userData'), 'dropzone-live-local.bin') }
function assetsPath() { return path.join(app.getPath('userData'), 'assets') }

function assetContentType(file) {
  const extension = path.extname(file).toLowerCase()
  if (extension === '.webp') return 'image/webp'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.gif') return 'image/gif'
  if (extension === '.svg') return 'image/svg+xml'
  return 'image/png'
}

async function loadStore() {
  if (storeCache) return storeCache
  try {
    const encrypted = await fs.readFile(statePath())
    if (!safeStorage.isEncryptionAvailable()) throw new Error('A proteção de dados do Windows não está disponível.')
    storeCache = JSON.parse(safeStorage.decryptString(encrypted))
  } catch (error) {
    if (error && error.code !== 'ENOENT') console.warn('Store local reiniciado:', error.message)
    storeCache = defaultStore()
  }
  return storeCache
}

async function saveStore(next) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Não foi possível usar a criptografia nativa do Windows.')
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  const encrypted = safeStorage.encryptString(JSON.stringify(next))
  await fs.writeFile(statePath(), encrypted)
  storeCache = next
  return next
}

async function requireAuth() {
  const store = await loadStore()
  if (!store.auth?.accessToken || !store.auth?.userId) throw new Error('Entre com sua conta DropZone para usar o editor.')
  return { store, auth: store.auth }
}

async function remoteJson(pathname, options = {}) {
  const response = await fetch(`${DEFAULT_ORIGIN}${pathname}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.profileType ? { 'x-profile-type': options.profileType } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeout || 15_000),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Não foi possível falar com o DropZone.')
  return payload
}

async function authorizedChampionships(auth) {
  const payload = await remoteJson('/api/lili/campeonatos', { token: auth.accessToken, profileType: auth.profileType })
  return (payload.items || []).filter((item) => item.relationship === 'admin' && item.permission && (
    item.permission.role === 'owner'
    || item.permission.role === 'manager'
    || item.permission.canManage
    || item.permission.canOrganizeGroups
    || item.permission.canManageGames
    || item.permission.canScore
  ))
}

async function cacheAsset(remoteUrl) {
  if (!remoteUrl) return ''
  let url
  try { url = new URL(String(remoteUrl)) } catch { return '' }
  if (!['https:', 'http:'].includes(url.protocol)) return ''
  const key = crypto.createHash('sha256').update(url.toString()).digest('hex')
  await fs.mkdir(assetsPath(), { recursive: true })
  const found = await fs.readdir(assetsPath()).catch(() => [])
  const existing = found.find((file) => file.startsWith(key))
  if (existing) return `/asset/${encodeURIComponent(existing)}`

  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) })
  if (!response.ok) return ''
  const contentType = String(response.headers.get('content-type') || '').toLowerCase()
  if (!contentType.startsWith('image/')) return ''
  const data = Buffer.from(await response.arrayBuffer())
  if (data.length > 8 * 1024 * 1024) return ''
  const extension = contentType.includes('webp') ? 'webp' : contentType.includes('jpeg') ? 'jpg' : contentType.includes('gif') ? 'gif' : 'png'
  const file = `${key}.${extension}`
  await fs.writeFile(path.join(assetsPath(), file), data)
  return `/asset/${encodeURIComponent(file)}`
}

async function syncLive(liveId) {
  const { store, auth } = await requireAuth()
  const index = store.lives.findIndex((live) => live.id === safeLive(liveId))
  if (index < 0) throw new Error('Live não encontrada.')
  const live = store.lives[index]
  if (!live.campeonatoId) throw new Error('Informe o ID do campeonato antes de sincronizar.')
  if (live.ownerId !== auth.userId) throw new Error('Esta produção não pertence à conta conectada.')
  const available = await authorizedChampionships(auth)
  if (!available.some((item) => String(item.id) === String(live.campeonatoId))) {
    throw new Error('Sua conta não tem acesso de produção a este campeonato.')
  }
  const payload = await remoteJson(`/api/desktop/campeonatos/${encodeURIComponent(live.campeonatoId)}/estatisticas`, {
    token: auth.accessToken,
    profileType: auth.profileType,
  })
  const teams = await Promise.all((payload.equipes || []).slice(0, 60).map(async (team, position) => ({
    ...team,
    posicao: Number(team.colocacao ?? team.posicao ?? position + 1),
    nome: String(team.nome || team.line_nome || 'Equipe'),
    logo_local: await cacheAsset(team.logo_url)
  })))
  const players = await Promise.all((payload.jogadores || []).slice(0, 60).map(async (player, position) => ({
    ...player,
    posicao: Number(player.colocacao ?? position + 1),
    nick: String(player.nick || player.nome || 'Jogador'),
    foto_local: await cacheAsset(player.foto_url)
  })))
  live.cache = { teams, players, syncedAt: new Date().toISOString() }
  live.updatedAt = new Date().toISOString()
  store.lives[index] = live
  await saveStore(store)
  return live
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
}

function overlayHtml(live) {
  const payload = JSON.stringify(live).replace(/</g, '\\u003c')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box}html,body,#stage{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;color:#f5f3ed;font-family:Arial,sans-serif}.block{position:absolute}.title{font-weight:900;letter-spacing:.04em;text-transform:uppercase}.image{display:block}.table{padding:24px;background:#0d1322e8;border:1px solid #c9b766;box-shadow:0 18px 70px #0008}.table h2{margin:0 0 14px;color:#f5f3ed;font-size:25px;letter-spacing:.08em}.table-row{height:52px;display:grid;align-items:center;gap:10px;padding:0 13px;border-top:1px solid #ffffff18;font-size:22px;font-weight:700}.table-row:nth-child(even){background:#ffffff08}.table-row img{width:35px;height:35px;object-fit:contain}.muted{color:#c4bc9b;font-size:16px}
  </style></head><body><div id="stage"></div><script>
    let live=${payload}; const stage=document.getElementById('stage');
    const fields={posicao:'POS',logo:'',nome:'EQUIPE',abates:'ABT',pontos_total:'PTS',booyahs:'B!',quedas:'QD',dano:'DANO',assistencias:'AST'};
    function value(team,key,i){if(key==='posicao')return team.posicao||i+1;if(key==='logo')return team.logo_local||'';return team[key]??team.cells?.[key]??'—'}
    function render(){const layout=live.layout||{};stage.style.background=layout.background||'transparent';stage.innerHTML=(layout.blocks||[]).map(block=>{const base='left:'+block.x/1920*100+'%;top:'+block.y/1080*100+'%;width:'+block.width/1920*100+'%;height:'+block.height/1080*100+'%;';if(block.type==='text')return '<div class="block title" style="'+base+'color:'+escape(block.color||'#fff')+';font-size:'+((block.size||36)/1080*100)+'vh">'+escape(block.text||'TÍTULO')+'</div>';if(block.type==='image')return block.src?'<img class="block image" src="'+escape(block.src)+'" alt="" style="'+base+'object-fit:'+escape(block.fit||'contain')+';opacity:'+Number(block.opacity??1)+'">':'';if(block.type==='table'){const columns=block.columns||['posicao','logo','nome','abates','pontos_total'];const grid=columns.map(c=>c==='nome'?'2fr':'minmax(48px,.55fr)').join(' ');const head=columns.map(c=>'<span>'+escape(fields[c]||c.toUpperCase())+'</span>').join('');const rows=(live.cache?.teams||[]).slice(0,10).map((team,i)=>'<div class="table-row" style="grid-template-columns:'+grid+'">'+columns.map(c=>c==='logo'?'<span>'+(value(team,c,i)?'<img src="'+escape(value(team,c,i))+'">':'')+'</span>':'<span>'+escape(value(team,c,i))+'</span>').join('')+'</div>').join('');return '<section class="block table" style="'+base+'"><h2>'+escape(block.title||'CLASSIFICAÇÃO')+'</h2><div class="table-row muted" style="grid-template-columns:'+grid+'">'+head+'</div>'+rows+'</section>'}return ''}).join('')}
    function escape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}render();setInterval(async()=>{try{const next=await fetch('/state/'+encodeURIComponent(live.id),{cache:'no-store'}).then(r=>r.json());live=next;render()}catch{}},1200)
  </script></body></html>`
}

async function outputHandler(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${OUTPUT_PORT}`)
  const store = await loadStore()
  if (url.pathname === '/health') return res.end('ok')
  if (url.pathname.startsWith('/asset/')) {
    const name = path.basename(decodeURIComponent(url.pathname.slice('/asset/'.length)))
    try {
      const body = await fs.readFile(path.join(assetsPath(), name))
      const type = assetContentType(name)
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' })
      return res.end(body)
    } catch { res.writeHead(404); return res.end() }
  }
  const match = url.pathname.match(/^\/(?:overlay|state)\/([a-zA-Z0-9-]{8,80})$/)
  if (!match) { res.writeHead(404); return res.end('Not found') }
  const live = store.lives.find((item) => item.id === match[1])
  if (!live || !store.auth?.userId || live.ownerId !== store.auth.userId) { res.writeHead(404); return res.end('Live not found') }
  if (url.pathname.startsWith('/state/')) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    return res.end(JSON.stringify(live))
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
  return res.end(overlayHtml(live))
}

function startOutputServer() {
  outputServer = http.createServer((req, res) => outputHandler(req, res).catch((error) => { console.error(error); res.writeHead(500); res.end('Erro local') }))
  outputServer.listen(OUTPUT_PORT, '127.0.0.1')
}

function createWindow() {
  mainWindow = new BrowserWindow({ width: 1500, height: 940, minWidth: 1060, minHeight: 700, backgroundColor: '#080b13', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

ipcMain.handle('auth:session', async () => {
  const store = await loadStore()
  if (!store.auth?.accessToken) return { signedIn: false }
  try {
    const profile = await remoteJson('/api/me', { token: store.auth.accessToken, profileType: store.auth.profileType })
    store.auth = { ...store.auth, userId: profile.user.id, account: profile.account, accounts: profile.accounts }
    await saveStore(store)
    return { signedIn: true, account: store.auth.account, accounts: store.auth.accounts }
  } catch {
    store.auth = null
    await saveStore(store)
    return { signedIn: false }
  }
})
ipcMain.handle('auth:login', async (_event, input) => {
  const profileType = cleanProfileType(input?.profileType)
  const login = String(input?.login || '').trim()
  const password = String(input?.password || '')
  if (!login || !password) throw new Error('Informe seu login e senha.')
  const payload = await remoteJson('/api/auth/login', { method: 'POST', body: { profile_type: profileType, login, password } })
  const token = payload.session?.access_token
  if (!token) throw new Error('O DropZone não retornou uma sessão válida.')
  const profile = await remoteJson('/api/me', { token, profileType })
  const store = await loadStore()
  store.auth = { accessToken: token, refreshToken: payload.session?.refresh_token || null, profileType, userId: profile.user.id, account: profile.account, accounts: profile.accounts }
  await saveStore(store)
  return { account: profile.account, accounts: profile.accounts }
})
ipcMain.handle('auth:google:start', async (_event, input) => {
  const store = await loadStore()
  store.oauthPendingProfileType = cleanProfileType(input?.profileType)
  await saveStore(store)
  const payload = await remoteJson('/api/desktop/auth/google/start', { method: 'POST', body: {} })
  const url = String(payload.url || '')
  let parsed
  try { parsed = new URL(url) } catch { throw new Error('O DropZone nao retornou um link seguro do Google.') }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
    throw new Error('O DropZone nao retornou um link seguro do Google.')
  }
  const browser = await openGoogleLogin(url)
  return { started: true, browser }
})
ipcMain.handle('auth:logout', async () => { const store = await loadStore(); store.auth = null; await saveStore(store); return true })
ipcMain.handle('auth:championships', async () => { const { auth } = await requireAuth(); return authorizedChampionships(auth) })
ipcMain.handle('lives:list', async () => { const { store, auth } = await requireAuth(); return store.lives.filter((live) => live.ownerId === auth.userId) })
ipcMain.handle('lives:create', async (_event, input) => {
  const { store, auth } = await requireAuth()
  const live = { id: crypto.randomUUID(), ownerId: auth.userId, name: String(input?.name || 'Nova live').slice(0, 80), campeonatoId: String(input?.campeonatoId || '').trim(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), layout: defaultLayout(), cache: demoCache() }
  store.lives.unshift(live); await saveStore(store); return live
})
ipcMain.handle('lives:save', async (_event, next) => { const { store, auth } = await requireAuth(); const index = store.lives.findIndex((live) => live.id === safeLive(next?.id)); if (index < 0 || store.lives[index].ownerId !== auth.userId) throw new Error('Live não encontrada.'); const current = store.lives[index]; const live = { ...current, name: String(next.name || current.name).slice(0,80), campeonatoId: String(next.campeonatoId || current.campeonatoId).trim(), layout: next.layout || current.layout, updatedAt: new Date().toISOString() }; store.lives[index] = live; await saveStore(store); return live })
ipcMain.handle('lives:delete', async (_event, liveId) => { const { store, auth } = await requireAuth(); store.lives = store.lives.filter((live) => live.id !== safeLive(liveId) || live.ownerId !== auth.userId); await saveStore(store); return true })
ipcMain.handle('lives:sync', async (_event, liveId) => syncLive(liveId))
ipcMain.handle('assets:import-image', async () => {
  await requireAuth()
  const picked = await dialog.showOpenDialog(mainWindow, {
    title: 'Importar imagem para a arte local',
    properties: ['openFile'],
    filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }],
  })
  if (picked.canceled || !picked.filePaths[0]) return null
  const source = picked.filePaths[0]
  const info = await fs.stat(source)
  if (info.size > 16 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 16 MB.')
  const extension = path.extname(source).toLowerCase()
  if (!['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) throw new Error('Formato de imagem não suportado.')
  await fs.mkdir(assetsPath(), { recursive: true })
  const filename = `local-${crypto.randomUUID()}${extension}`
  await fs.copyFile(source, path.join(assetsPath(), filename))
  return { src: `/asset/${encodeURIComponent(filename)}`, name: path.basename(source) }
})
ipcMain.handle('output:url', async (_event, liveId) => {
  const { store, auth } = await requireAuth()
  const id = safeLive(liveId)
  if (!store.lives.some((live) => live.id === id && live.ownerId === auth.userId)) throw new Error('Live não encontrada.')
  return `http://127.0.0.1:${OUTPUT_PORT}/overlay/${id}`
})
ipcMain.handle('lives:export-png', async (_event, liveId) => {
  const { store, auth } = await requireAuth()
  const id = safeLive(liveId)
  if (!store.lives.some((live) => live.id === id && live.ownerId === auth.userId)) throw new Error('Live não encontrada.')
  const capture = new BrowserWindow({
    show: false,
    width: 1920,
    height: 1080,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  try {
    await capture.loadURL(`http://127.0.0.1:${OUTPUT_PORT}/overlay/${id}`)
    await new Promise((resolve) => setTimeout(resolve, 350))
    const image = await capture.webContents.capturePage()
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar overlay em PNG',
      defaultPath: `DropZone-${id.slice(0, 8)}.png`,
      filters: [{ name: 'Imagem PNG', extensions: ['png'] }],
    })
    if (result.canceled || !result.filePath) return null
    await fs.writeFile(result.filePath, image.toPNG())
    return result.filePath
  } finally {
    if (!capture.isDestroyed()) capture.destroy()
  }
})
ipcMain.handle('system:copy', (_event, value) => clipboard.writeText(String(value || '')))
ipcMain.handle('system:open', (_event, value) => shell.openExternal(String(value || '')))

async function completeGoogleLogin(protocolUrl) {
  if (!isAllowedProtocolUrl(protocolUrl)) return
  const parsed = new URL(protocolUrl)
  const params = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  const oauthError = params.get('error_description') || params.get('error')
  if (oauthError) {
    sendAuthEvent('auth:oauth-error', 'O Google nao concluiu o login: ' + oauthError)
    return
  }
  const accessToken = params.get('access_token') || ''
  const refreshToken = params.get('refresh_token') || ''
  if (!accessToken || !refreshToken) {
    sendAuthEvent('auth:oauth-error', 'O retorno do Google nao trouxe uma sessao valida.')
    return
  }
  try {
    const store = await loadStore()
    const profileType = cleanProfileType(store.oauthPendingProfileType)
    const profile = await remoteJson('/api/me', { token: accessToken, profileType })
    store.auth = {
      accessToken,
      refreshToken,
      profileType: profile.account?.profile_type || profileType,
      userId: profile.user.id,
      account: profile.account,
      accounts: profile.accounts,
    }
    delete store.oauthPendingProfileType
    await saveStore(store)
    sendAuthEvent('auth:changed', { account: store.auth.account, accounts: store.auth.accounts })
  } catch (error) {
    const store = await loadStore()
    delete store.oauthPendingProfileType
    await saveStore(store)
    sendAuthEvent('auth:oauth-error', error?.message || 'Nao foi possivel confirmar sua conta DropZone.')
  }
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
}

function registerProtocolHandler() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) app.setAsDefaultProtocolClient(OAUTH_PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
    return
  }
  app.setAsDefaultProtocolClient(OAUTH_PROTOCOL)
}

registerProtocolHandler()
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine) => {
    const protocolUrl = protocolUrlFromArgs(commandLine)
    focusMainWindow()
    if (protocolUrl) void completeGoogleLogin(protocolUrl)
  })
  app.on('open-url', (event, protocolUrl) => {
    event.preventDefault()
    focusMainWindow()
    void completeGoogleLogin(protocolUrl)
  })
  app.whenReady().then(async () => {
    startOutputServer()
    createWindow()
    if (startupProtocolUrl) {
      const protocolUrl = startupProtocolUrl
      startupProtocolUrl = null
      await completeGoogleLogin(protocolUrl)
    }
  })
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => outputServer?.close())
