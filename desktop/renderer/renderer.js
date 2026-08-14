const api = window.dropzoneLive
const fieldMeta = {
  posicao: ['#', 'Posição'], logo: ['◉', 'Logo'], nome: ['Aa', 'Nome da equipe'],
  abates: ['✦', 'Abates'], pontos_total: ['★', 'Pontos totais'], booyahs: ['B!', 'Booyahs'],
  quedas: ['QD', 'Quedas'], dano: ['DMG', 'Dano'], assistencias: ['AST', 'Assistências']
}
let lives = []
let current = null

const $ = (selector) => document.querySelector(selector)
const el = {
  list: $('#live-list'), empty: $('#empty-state'), editor: $('#editor'), title: $('#live-title'),
  eyebrow: $('#live-eyebrow'), fields: $('#fields'), blockList: $('#block-list'), blockEditor: $('#block-editor'),
  preview: $('#overlay-preview'), status: $('#sync-status'), output: $('#output-url'), toast: $('#toast'), dialog: $('#live-dialog')
}

function toast(message, tone = '') {
  el.toast.textContent = message; el.toast.className = `toast ${tone}`
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.toast.classList.add('hidden'), 3400)
}

function clone(value) { return JSON.parse(JSON.stringify(value)) }
function ensureLayout() { if (!current.layout) current.layout = { width: 1920, height: 1080, background: '#080b13', blocks: [] }; if (!Array.isArray(current.layout.blocks)) current.layout.blocks = [] }
function selectedBlockId() { return String(el.blockList.dataset.selected || '') }
function getSelectedBlock() { return current?.layout?.blocks?.find((block) => block.id === selectedBlockId()) || null }

async function refreshLives(selectId) {
  lives = await api.listLives()
  const nextId = selectId || current?.id || lives[0]?.id
  current = lives.find((live) => live.id === nextId) || null
  render()
}

function render() {
  el.list.innerHTML = lives.map((live) => `<button class="live-item ${current?.id === live.id ? 'active' : ''}" data-live="${live.id}"><span>◈</span><div><b>${escape(live.name)}</b><small>${live.cache?.teams?.length || 0} equipes em cache</small></div></button>`).join('') || '<p class="no-lives">Nenhuma live local.</p>'
  for (const button of el.list.querySelectorAll('[data-live]')) button.onclick = () => { current = lives.find((live) => live.id === button.dataset.live); render() }
  el.empty.classList.toggle('hidden', Boolean(current)); el.editor.classList.toggle('hidden', !current)
  $('#sync-live').disabled = !current; $('#export-png').disabled = !current; $('#copy-output').disabled = !current
  if (!current) return
  ensureLayout(); el.title.textContent = current.name; el.eyebrow.textContent = current.campeonatoId ? `CAMPEONATO · ${current.campeonatoId}` : 'LIVE LOCAL SEM CAMPEONATO'
  $('#live-name').value = current.name || ''; $('#championship-id').value = current.campeonatoId || ''; $('#origin').value = current.origin || ''
  el.status.textContent = current.cache?.syncedAt ? `Sincronizado ${new Date(current.cache.syncedAt).toLocaleString('pt-BR')}` : 'Aguardando sincronização'
  renderFields(); renderBlocks(); void refreshOutput()
}

function renderFields() {
  el.fields.innerHTML = Object.entries(fieldMeta).map(([key, [symbol, label]]) => `<button class="field" data-field="${key}"><i>${symbol}</i><span>${label}</span><small>${key}</small></button>`).join('')
  for (const button of el.fields.querySelectorAll('[data-field]')) button.onclick = () => {
    const block = getSelectedBlock()
    if (!block || block.type !== 'table') return toast('Selecione uma tabela para adicionar uma coluna.', 'warn')
    const key = button.dataset.field
    block.columns = block.columns || []
    block.columns.includes(key) ? block.columns = block.columns.filter((item) => item !== key) : block.columns.push(key)
    renderBlocks(); void saveCurrent(false)
  }
}

function renderBlocks() {
  el.blockList.innerHTML = current.layout.blocks.map((block, index) => `<button class="block-row ${selectedBlockId() === block.id ? 'active' : ''}" data-block="${block.id}"><b>${block.type === 'table' ? '▦' : 'T'}</b><span>${escape(block.type === 'table' ? block.title || 'Tabela' : block.text || 'Texto')}</span><small>${index + 1}</small></button>`).join('')
  for (const button of el.blockList.querySelectorAll('[data-block]')) button.onclick = () => { el.blockList.dataset.selected = button.dataset.block; renderBlocks() }
  const block = getSelectedBlock()
  if (!block) { el.blockEditor.innerHTML = '<p class="hint">Selecione um bloco para ajustar o conteúdo.</p>'; return }
  if (block.type === 'text') el.blockEditor.innerHTML = `<label>Texto<input id="block-text" value="${escapeAttr(block.text || '')}" /></label><label>Cor<input id="block-color" type="color" value="${escapeAttr(block.color || '#ffffff')}" /></label><label>Tamanho<input id="block-size" type="range" min="12" max="96" value="${Number(block.size || 36)}" /></label>`
  else el.blockEditor.innerHTML = `<label>Título da tabela<input id="block-title" value="${escapeAttr(block.title || '')}" /></label><p class="hint">Colunas ativas</p><div class="selected-columns">${(block.columns || []).map((key) => `<button data-remove-column="${key}">${escape(fieldMeta[key]?.[1] || key)} ×</button>`).join('') || '<small>Use os campos à esquerda.</small>'}</div>`
  $('#block-text')?.addEventListener('input', (event) => { block.text = event.target.value; void saveCurrent(false); refreshOutput() })
  $('#block-color')?.addEventListener('input', (event) => { block.color = event.target.value; void saveCurrent(false); refreshOutput() })
  $('#block-size')?.addEventListener('input', (event) => { block.size = Number(event.target.value); void saveCurrent(false); refreshOutput() })
  $('#block-title')?.addEventListener('input', (event) => { block.title = event.target.value; void saveCurrent(false); refreshOutput() })
  for (const button of el.blockEditor.querySelectorAll('[data-remove-column]')) button.onclick = () => { block.columns = block.columns.filter((key) => key !== button.dataset.removeColumn); renderBlocks(); void saveCurrent(false) }
}

async function refreshOutput() {
  if (!current) return
  const url = await api.outputUrl(current.id); el.output.textContent = url
  el.preview.src = `${url}?preview=${Date.now()}`
}

async function saveCurrent(show = true) {
  if (!current) return
  current.name = $('#live-name').value.trim() || current.name
  current.campeonatoId = $('#championship-id').value.trim()
  current.origin = $('#origin').value.trim()
  try { current = await api.saveLive(current); if (show) toast('Projeto salvo neste PC.'); await refreshLives(current.id) } catch (error) { toast(error.message || 'Não foi possível salvar.', 'error') }
}

function createBlock(type) {
  ensureLayout(); const offset = current.layout.blocks.length * 28
  const block = type === 'table'
    ? { id: crypto.randomUUID(), type: 'table', x: 100 + offset, y: 160 + offset, width: 1080, height: 640, title: 'NOVA TABELA', columns: ['posicao', 'logo', 'nome', 'abates', 'pontos_total'] }
    : { id: crypto.randomUUID(), type: 'text', x: 100 + offset, y: 80 + offset, width: 1000, height: 70, text: 'NOVO TEXTO', color: '#ffffff', size: 38 }
  current.layout.blocks.push(block); el.blockList.dataset.selected = block.id; renderBlocks(); void saveCurrent(false); void refreshOutput()
}

async function sync() { if (!current) return; $('#sync-live').disabled = true; $('#sync-live').textContent = '↻ Sincronizando…'; try { current = await api.syncLive(current.id); toast(`${current.cache?.teams?.length || 0} equipes e logos sincronizados para este PC.`); await refreshLives(current.id) } catch (error) { toast(error.message || 'Falha na sincronização.', 'error') } finally { $('#sync-live').disabled = false; $('#sync-live').textContent = '↻ Sincronizar dados' } }

function openDialog() { $('#new-live-name').value = ''; $('#new-championship-id').value = ''; $('#new-origin').value = 'https://dropzone-cadastros.vercel.app'; el.dialog.showModal(); $('#new-live-name').focus() }
function escape(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])) }
function escapeAttr(value) { return escape(value) }

$('#new-live').onclick = openDialog; $('#empty-new-live').onclick = openDialog
$('#create-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const live = await api.createLive({ name: $('#new-live-name').value, campeonatoId: $('#new-championship-id').value, origin: $('#new-origin').value }); el.dialog.close(); await refreshLives(live.id); toast('Live criada. Agora sincronize os dados.') } catch (error) { toast(error.message || 'Não foi possível criar a live.', 'error') } })
$('#sync-live').onclick = sync; $('#save-live').onclick = () => saveCurrent(true)
$('#export-png').onclick = async () => {
  if (!current) return
  try {
    const savedPath = await api.exportPng(current.id)
    if (savedPath) toast('PNG salvo localmente: ' + savedPath)
  } catch (error) { toast(error.message || 'Não foi possível exportar o PNG.', 'error') }
}
$('#copy-output').onclick = async () => { if (!current) return; const url = await api.outputUrl(current.id); await api.copy(url); toast('URL local copiada. Use-a como Browser Source no OBS ou vMix.') }
$('#open-output').onclick = async () => { if (!current) return; await api.open(await api.outputUrl(current.id)) }
$('#delete-live').onclick = async () => { if (!current || !confirm(`Excluir “${current.name}” deste PC?`)) return; await api.deleteLive(current.id); current = null; await refreshLives(); toast('Live removida deste PC.') }
for (const button of document.querySelectorAll('[data-add]')) button.onclick = () => createBlock(button.dataset.add)
refreshLives().catch((error) => toast(error.message || 'Falha ao abrir projetos locais.', 'error'))
