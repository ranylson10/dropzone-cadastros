const { app, BrowserWindow, clipboard, dialog, ipcMain, safeStorage, shell } = require('electron')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const http = require('node:http')
const path = require('node:path')

const OUTPUT_PORT = 19386
const DEFAULT_ORIGIN = 'https://dropzone-cadastros.vercel.app'
let mainWindow = null
let outputServer = null
let storeCache = null

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
  return { version: 1, lives: [] }
}

function cleanOrigin(value) {
  const raw = String(value || DEFAULT_ORIGIN).trim().replace(/\/$/, '')
  const parsed = new URL(raw)
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Endereço do DropZone inválido.')
  return parsed.origin
}

function safeLive(live) {
  const id = String(live?.id || '')
  if (!id || !/^[a-zA-Z0-9-]{8,80}$/.test(id)) throw new Error('Live inválida.')
  return id
}

function statePath() { return path.join(app.getPath('userData'), 'dropzone-live-local.bin') }
function assetsPath() { return path.join(app.getPath('userData'), 'assets') }

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
  const store = await loadStore()
  const index = store.lives.findIndex((live) => live.id === safeLive(liveId))
  if (index < 0) throw new Error('Live não encontrada.')
  const live = store.lives[index]
  if (!live.campeonatoId) throw new Error('Informe o ID do campeonato antes de sincronizar.')
  const origin = cleanOrigin(live.origin)
  const endpoint = `${origin}/api/campeonatos/${encodeURIComponent(live.campeonatoId)}`
  const [teamsResponse, playersResponse] = await Promise.all([
    fetch(`${endpoint}/estatisticas/equipes`, { signal: AbortSignal.timeout(15_000) }),
    fetch(`${endpoint}/estatisticas/mvp`, { signal: AbortSignal.timeout(15_000) })
  ])
  if (!teamsResponse.ok) throw new Error('Não foi possível buscar as estatísticas das equipes.')
  const teamsPayload = await teamsResponse.json()
  const playersPayload = playersResponse.ok ? await playersResponse.json() : { jogadores: [] }
  const teams = await Promise.all((teamsPayload.equipes || []).slice(0, 60).map(async (team, position) => ({
    ...team,
    posicao: Number(team.colocacao ?? team.posicao ?? position + 1),
    nome: String(team.nome || team.line_nome || 'Equipe'),
    logo_local: await cacheAsset(team.logo_url)
  })))
  const players = await Promise.all((playersPayload.jogadores || []).slice(0, 60).map(async (player, position) => ({
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
    *{box-sizing:border-box}html,body,#stage{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:Arial,sans-serif}.block{position:absolute}.title{font-weight:900;letter-spacing:.04em;text-transform:uppercase}.table{padding:24px;background:#0d1322e8;border:1px solid #40638a;box-shadow:0 18px 70px #0008}.table h2{margin:0 0 14px;font-size:25px;letter-spacing:.08em}.table-row{height:52px;display:grid;align-items:center;gap:10px;padding:0 13px;border-top:1px solid #ffffff18;font-size:22px;font-weight:700}.table-row:nth-child(even){background:#ffffff08}.table-row img{width:35px;height:35px;object-fit:contain}.muted{color:#8da4bd;font-size:16px}
  </style></head><body><div id="stage"></div><script>
    let live=${payload}; const stage=document.getElementById('stage');
    const fields={posicao:'POS',logo:'',nome:'EQUIPE',abates:'ABT',pontos_total:'PTS',booyahs:'B!',quedas:'QD',dano:'DANO',assistencias:'AST'};
    function value(team,key,i){if(key==='posicao')return team.posicao||i+1;if(key==='logo')return team.logo_local||'';return team[key]??team.cells?.[key]??'—'}
    function render(){const layout=live.layout||{};stage.style.background=layout.background||'transparent';stage.innerHTML=(layout.blocks||[]).map(block=>{const base='left:'+block.x/1920*100+'%;top:'+block.y/1080*100+'%;width:'+block.width/1920*100+'%;height:'+block.height/1080*100+'%;';if(block.type==='text')return '<div class="block title" style="'+base+'color:'+escape(block.color||'#fff')+';font-size:'+((block.size||36)/1080*100)+'vh">'+escape(block.text||'TÍTULO')+'</div>';if(block.type==='table'){const columns=block.columns||['posicao','logo','nome','abates','pontos_total'];const grid=columns.map(c=>c==='nome'?'2fr':'minmax(48px,.55fr)').join(' ');const head=columns.map(c=>'<span>'+escape(fields[c]||c.toUpperCase())+'</span>').join('');const rows=(live.cache?.teams||[]).slice(0,10).map((team,i)=>'<div class="table-row" style="grid-template-columns:'+grid+'">'+columns.map(c=>c==='logo'?'<span>'+(value(team,c,i)?'<img src="'+escape(value(team,c,i))+'">':'')+'</span>':'<span>'+escape(value(team,c,i))+'</span>').join('')+'</div>').join('');return '<section class="block table" style="'+base+'"><h2>'+escape(block.title||'CLASSIFICAÇÃO')+'</h2><div class="table-row muted" style="grid-template-columns:'+grid+'">'+head+'</div>'+rows+'</section>'}return ''}).join('')}
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
      const type = name.endsWith('.webp') ? 'image/webp' : name.endsWith('.jpg') ? 'image/jpeg' : name.endsWith('.gif') ? 'image/gif' : 'image/png'
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' })
      return res.end(body)
    } catch { res.writeHead(404); return res.end() }
  }
  const match = url.pathname.match(/^\/(?:overlay|state)\/([a-zA-Z0-9-]{8,80})$/)
  if (!match) { res.writeHead(404); return res.end('Not found') }
  const live = store.lives.find((item) => item.id === match[1])
  if (!live) { res.writeHead(404); return res.end('Live not found') }
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

ipcMain.handle('lives:list', async () => (await loadStore()).lives)
ipcMain.handle('lives:create', async (_event, input) => {
  const store = await loadStore()
  const live = { id: crypto.randomUUID(), name: String(input?.name || 'Nova live').slice(0, 80), campeonatoId: String(input?.campeonatoId || '').trim(), origin: cleanOrigin(input?.origin), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), layout: defaultLayout(), cache: { teams: [], players: [] } }
  store.lives.unshift(live); await saveStore(store); return live
})
ipcMain.handle('lives:save', async (_event, next) => { const store = await loadStore(); const index = store.lives.findIndex((live) => live.id === safeLive(next?.id)); if (index < 0) throw new Error('Live não encontrada.'); const current = store.lives[index]; const live = { ...current, name: String(next.name || current.name).slice(0,80), campeonatoId: String(next.campeonatoId || current.campeonatoId).trim(), origin: cleanOrigin(next.origin || current.origin), layout: next.layout || current.layout, updatedAt: new Date().toISOString() }; store.lives[index] = live; await saveStore(store); return live })
ipcMain.handle('lives:delete', async (_event, liveId) => { const store = await loadStore(); store.lives = store.lives.filter((live) => live.id !== safeLive(liveId)); await saveStore(store); return true })
ipcMain.handle('lives:sync', async (_event, liveId) => syncLive(liveId))
ipcMain.handle('output:url', async (_event, liveId) => `http://127.0.0.1:${OUTPUT_PORT}/overlay/${safeLive(liveId)}`)
ipcMain.handle('lives:export-png', async (_event, liveId) => {
  const id = safeLive(liveId)
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

app.whenReady().then(() => { startOutputServer(); createWindow() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => outputServer?.close())
