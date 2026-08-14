const api = window.dropzoneLive
const fields = { posicao: '#', logo: '◉', nome: 'Nome', abates: 'ABT', pontos_total: 'PTS', booyahs: 'B!', quedas: 'QD', dano: 'DMG', assistencias: 'AST' }
let lives = [], current = null, championships = [], saveTimer = null, previewTimer = null
const $ = (s) => document.querySelector(s)
const el = { app: $('#app'), gate: $('#login-gate'), workspace: $('#workspace'), empty: $('#empty-state'), list: $('#block-list'), editor: $('#block-editor'), layer: $('#selection-layer'), preview: $('#overlay-preview'), title: $('#live-title'), output: $('#output-url'), toast: $('#toast'), dialog: $('#live-dialog') }

function message(error, fallback) { return String(error?.message || fallback || 'Ocorreu um erro.').replace(/^Error invoking remote method '[^']+': Error:\s*/i, '').replace(/^Error:\s*/i, '') }
function toast(text, tone = '') { el.toast.textContent = text; el.toast.className = `toast ${tone}`; clearTimeout(toast.timer); toast.timer = setTimeout(() => el.toast.classList.add('hidden'), 3400) }
function layout() { if (!current.layout) current.layout = { width: 1920, height: 1080, background: '#080b13', blocks: [] }; if (!Array.isArray(current.layout.blocks)) current.layout.blocks = [] }
function selectedId() { return el.list.dataset.selected || '' }
function selected() { return current?.layout?.blocks?.find((b) => b.id === selectedId()) || null }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || min)) }

async function boot() {
  try {
    const session = await api.session()
    if (!session.signedIn) return showLogin()
    $('#account-name').textContent = session.account?.name || session.account?.username || 'Conta DropZone'
    el.app.classList.remove('hidden'); el.gate.classList.add('hidden')
    championships = await api.championships()
    renderChampionships(); await refreshLives()
  } catch (error) { showLogin(message(error, 'Não foi possível confirmar sua sessão.')) }
}
function showLogin(error = '') { el.app.classList.add('hidden'); el.gate.classList.remove('hidden'); $('#login-error').textContent = error }
async function finishLogin(session) {
  $('#account-name').textContent = session.account?.name || session.account?.username || 'Conta DropZone'
  el.app.classList.remove('hidden'); el.gate.classList.add('hidden')
  championships = await api.championships(); renderChampionships(); await refreshLives()
}
function renderChampionships() {
  const options = championships.map((item) => `<option value="${escape(item.id)}">${escape(item.nome || 'Campeonato')}</option>`).join('')
  $('#championship-select').innerHTML = '<option value="">Arte livre</option>' + options
  $('#new-championship-select').innerHTML = '<option value="">Arte livre</option>' + options
}
async function refreshLives() { lives = await api.listLives(); current = lives.find((x) => x.id === current?.id) || lives[0] || null; render() }
function render() {
  el.workspace.classList.toggle('hidden', !current); el.empty.classList.toggle('hidden', Boolean(current))
  if (!current) return
  layout(); if (!selectedId() || !selected()) el.list.dataset.selected = current.layout.blocks[0]?.id || ''
  el.title.textContent = current.name; $('#championship-select').value = current.campeonatoId || ''
  $('#sync-status').textContent = current.cache?.syncedAt ? '● Dados atualizados' : '● Local'
  renderLayers(); renderSelection(); renderInspector(); void refreshOutput()
}
function renderLayers() {
  el.list.innerHTML = current.layout.blocks.map((b, i) => `<button data-block="${b.id}" class="${b.id === selectedId() ? 'active' : ''}" title="${escape(layerName(b))}"><i>${b.type === 'text' ? 'T' : b.type === 'table' ? '▦' : '▣'}</i><span>${escape(layerName(b))}</span><small>${i + 1}</small></button>`).join('')
  for (const node of el.list.querySelectorAll('[data-block]')) node.onclick = () => { el.list.dataset.selected = node.dataset.block; renderLayers(); renderSelection(); renderInspector() }
}
function layerName(b) { return b.type === 'text' ? b.text || 'Texto' : b.type === 'table' ? b.title || 'Tabela' : b.name || 'Imagem' }
function renderSelection() {
  const selectedBlock = selected(); const scaleX = 100 / 1920, scaleY = 100 / 1080
  el.layer.innerHTML = current.layout.blocks.map((b) => `<div data-select="${b.id}" class="select-box ${b.id === selectedBlock?.id ? 'active' : ''}" style="left:${b.x * scaleX}%;top:${b.y * scaleY}%;width:${b.width * scaleX}%;height:${b.height * scaleY}%"></div>`).join('')
  for (const node of el.layer.querySelectorAll('[data-select]')) node.addEventListener('pointerdown', startDrag)
}
function startDrag(event) {
  event.preventDefault(); const id = event.currentTarget.dataset.select; const block = current.layout.blocks.find((b) => b.id === id); if (!block) return
  el.list.dataset.selected = id; renderLayers(); renderInspector(); renderSelection()
  const surface = $('#design-surface').getBoundingClientRect(); const start = { x: event.clientX, y: event.clientY, blockX: block.x, blockY: block.y }
  const move = (e) => { block.x = clamp(start.blockX + ((e.clientX - start.x) / surface.width) * 1920, 0, 1920 - block.width); block.y = clamp(start.blockY + ((e.clientY - start.y) / surface.height) * 1080, 0, 1080 - block.height); renderSelection(); setQuickProperties() }
  const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); stageChanged() }
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true })
}
function renderInspector() {
  const b = selected(); if (!b) { el.editor.innerHTML = ''; return }
  if (b.type === 'text') el.editor.innerHTML = `<input id="prop-text" value="${escapeAttr(b.text || '')}" title="Texto" /><input id="prop-color" type="color" value="${escapeAttr(b.color || '#ffffff')}" title="Cor" /><input id="prop-size" type="number" value="${b.size || 36}" title="Tamanho" />${deleteButton()}`
  else if (b.type === 'table') el.editor.innerHTML = `<input id="prop-title" value="${escapeAttr(b.title || '')}" title="Título" /><div class="field-buttons">${Object.entries(fields).map(([key, label]) => `<button data-field="${key}" class="${b.columns?.includes(key) ? 'on' : ''}">${label}</button>`).join('')}</div>${deleteButton()}`
  else el.editor.innerHTML = `<button id="replace-image">Trocar imagem</button>${deleteButton()}`
  $('#prop-text')?.addEventListener('input', (e) => { b.text = e.target.value; stageChanged() }); $('#prop-color')?.addEventListener('input', (e) => { b.color = e.target.value; stageChanged() }); $('#prop-size')?.addEventListener('input', (e) => { b.size = Number(e.target.value); stageChanged() }); $('#prop-title')?.addEventListener('input', (e) => { b.title = e.target.value; stageChanged() })
  for (const node of el.editor.querySelectorAll('[data-field]')) node.onclick = () => { const key = node.dataset.field; b.columns ||= []; b.columns.includes(key) ? b.columns = b.columns.filter((x) => x !== key) : b.columns.push(key); renderInspector(); stageChanged() }
  $('#replace-image')?.addEventListener('click', () => void importImage(b)); $('#delete-block')?.addEventListener('click', () => { current.layout.blocks = current.layout.blocks.filter((x) => x.id !== b.id); el.list.dataset.selected = current.layout.blocks[0]?.id || ''; render(); stageChanged() }); setQuickProperties()
}
function deleteButton() { return '<button id="delete-block" class="danger" title="Excluir camada">×</button>' }
function setQuickProperties() { const b = selected(); for (const [id, key] of [['#tool-x', 'x'], ['#tool-y', 'y'], ['#tool-w', 'width'], ['#tool-h', 'height']]) $(id).value = b ? Math.round(b[key]) : '' }
function bindQuickProperties() { for (const [id, key, max] of [['#tool-x', 'x', 1920], ['#tool-y', 'y', 1080], ['#tool-w', 'width', 1920], ['#tool-h', 'height', 1080]]) $(id).addEventListener('input', (e) => { const b = selected(); if (!b) return; b[key] = clamp(e.target.value, 10, max); renderSelection(); stageChanged() }) }
async function persist(show = false) { if (!current) return; try { current = await api.saveLive(current); lives = lives.map((x) => x.id === current.id ? current : x); if (show) toast('Salvo') } catch (e) { toast(message(e, 'Não foi possível salvar.'), 'error') } }
function stageChanged() { clearTimeout(saveTimer); saveTimer = setTimeout(() => void persist(), 280); clearTimeout(previewTimer); previewTimer = setTimeout(() => void refreshOutput(), 420) }
async function refreshOutput() { if (!current) return; try { const url = await api.outputUrl(current.id); el.output.textContent = url; el.preview.src = `${url}?preview=${Date.now()}` } catch (e) { el.output.textContent = '—' } }
async function create(type, image) { if (!current) return; layout(); const n = current.layout.blocks.length; const block = type === 'table' ? { id: crypto.randomUUID(), type: 'table', x: 1260, y: 180 + Math.min(n * 16, 180), width: 580, height: 620, title: 'TABELA', columns: ['posicao', 'logo', 'nome', 'abates', 'pontos_total'] } : type === 'image' ? { id: crypto.randomUUID(), type: 'image', x: 1350, y: 70, width: 400, height: 220, src: image.src, name: image.name, fit: 'contain', opacity: 1 } : { id: crypto.randomUUID(), type: 'text', x: 100, y: 70 + n * 25, width: 900, height: 72, text: 'TEXTO', color: '#f5f3ed', size: 42 }; current.layout.blocks.push(block); el.list.dataset.selected = block.id; render(); stageChanged() }
async function importImage(block) { try { const image = await api.importImage(); if (!image) return; if (block) { block.src = image.src; block.name = image.name; render(); stageChanged() } else await create('image', image) } catch (e) { toast(message(e, 'Não foi possível importar a imagem.'), 'error') } }
function escape(v) { return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) } function escapeAttr(v) { return escape(v) }

$('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); const button = $('#login-form button[type=submit]'); button.disabled = true; try { await finishLogin(await api.login({ profileType: $('#login-profile').value, login: $('#login-name').value, password: $('#login-password').value })) } catch (e) { $('#login-error').textContent = message(e, 'Não foi possível entrar.') } finally { button.disabled = false } })
$('#google-login').addEventListener('click', async () => { const button = $('#google-login'); button.disabled = true; $('#login-error').textContent = ''; try { const result = await api.loginWithGoogle({ profileType: $('#login-profile').value }); $('#login-error').textContent = result.browser === 'chrome' ? 'Conclua o login no Google Chrome. O app será aberto automaticamente.' : 'Conclua o login na janela do Google. O app será aberto automaticamente.' } catch (e) { $('#login-error').textContent = message(e, 'Não foi possível abrir o Google.'); button.disabled = false } })
api.onAuthChanged((session) => { $('#google-login').disabled = false; void finishLogin(session).catch((e) => showLogin(message(e, 'Não foi possível abrir suas produções.'))) })
api.onAuthError((error) => { $('#google-login').disabled = false; showLogin(message({ message: error }, 'Não foi possível concluir o login Google.')) })
$('#logout').onclick = async () => { await api.logout(); lives = []; current = null; showLogin() }
$('#new-live').onclick = () => { $('#new-live-name').value = ''; $('#new-championship-select').value = ''; el.dialog.showModal() }; $('#empty-new-live').onclick = $('#new-live').onclick
$('#create-form').addEventListener('submit', async (event) => { event.preventDefault(); try { current = await api.createLive({ name: $('#new-live-name').value, campeonatoId: $('#new-championship-select').value }); lives.unshift(current); el.dialog.close(); render() } catch (e) { toast(message(e, 'Não foi possível criar.'), 'error') } })
$('#save-live').onclick = () => void persist(true); $('#sync-live').onclick = async () => { if (!current?.campeonatoId) return toast('Escolha um campeonato autorizado.', 'warn'); try { current = await api.syncLive(current.id); lives = lives.map((x) => x.id === current.id ? current : x); render() } catch (e) { toast(message(e, 'Não foi possível atualizar.'), 'error') } }
$('#export-png').onclick = async () => { if (!current) return; try { const file = await api.exportPng(current.id); if (file) toast('PNG salvo') } catch (e) { toast(message(e, 'Não foi possível exportar.'), 'error') } }; $('#copy-output').onclick = async () => { if (current) { const url = await api.outputUrl(current.id); await api.copy(url); toast('Link copiado') } }; $('#open-output').onclick = async () => { if (current) await api.open(await api.outputUrl(current.id)) }
$('#championship-select').addEventListener('change', (e) => { if (!current) return; current.campeonatoId = e.target.value; stageChanged() }); for (const node of document.querySelectorAll('[data-add]')) node.onclick = () => void create(node.dataset.add); $('#add-image').onclick = () => void importImage(); bindQuickProperties(); boot()
