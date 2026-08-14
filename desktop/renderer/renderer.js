const api = window.dropzoneLive
const fieldMeta = {
  posicao: ['#', 'Posição'], logo: ['◉', 'Logo'], nome: ['Aa', 'Nome da equipe'],
  abates: ['✦', 'Abates'], pontos_total: ['★', 'Pontos totais'], booyahs: ['B!', 'Booyahs'],
  quedas: ['QD', 'Quedas'], dano: ['DMG', 'Dano'], assistencias: ['AST', 'Assistências']
}
let lives = []
let current = null
let saveTimer = null
let previewTimer = null

const $ = (selector) => document.querySelector(selector)
const el = {
  list: $('#live-list'), empty: $('#empty-state'), editor: $('#editor'), title: $('#live-title'), subtitle: $('#live-subtitle'),
  eyebrow: $('#live-eyebrow'), fields: $('#fields'), blockList: $('#block-list'), blockEditor: $('#block-editor'),
  preview: $('#overlay-preview'), status: $('#sync-status'), output: $('#output-url'), toast: $('#toast'), dialog: $('#live-dialog')
}

function toast(message, tone = '') {
  el.toast.textContent = message
  el.toast.className = `toast ${tone}`
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => el.toast.classList.add('hidden'), 3600)
}

function ensureLayout() {
  if (!current.layout) current.layout = { width: 1920, height: 1080, background: '#080b13', blocks: [] }
  if (!Array.isArray(current.layout.blocks)) current.layout.blocks = []
}
function selectedBlockId() { return String(el.blockList.dataset.selected || '') }
function getSelectedBlock() { return current?.layout?.blocks?.find((block) => block.id === selectedBlockId()) || null }
function updateLiveInList(live) { lives = lives.map((item) => item.id === live.id ? live : item) }

async function refreshLives(selectId) {
  lives = await api.listLives()
  const nextId = selectId || current?.id || lives[0]?.id
  current = lives.find((live) => live.id === nextId) || null
  render()
}

function render() {
  el.list.innerHTML = lives.map((live) => `<button class="live-item ${current?.id === live.id ? 'active' : ''}" data-live="${live.id}"><span>✦</span><div><b>${escape(live.name)}</b><small>${live.cache?.demo ? 'Arte de teste' : `${live.cache?.teams?.length || 0} equipes sincronizadas`}</small></div></button>`).join('') || '<p class="no-lives">Nenhuma produção criada.</p>'
  for (const button of el.list.querySelectorAll('[data-live]')) button.onclick = () => { current = lives.find((live) => live.id === button.dataset.live); render() }
  el.empty.classList.toggle('hidden', Boolean(current)); el.editor.classList.toggle('hidden', !current)
  for (const id of ['sync-live', 'export-png', 'copy-output']) $("#" + id).disabled = !current
  if (!current) return
  ensureLayout()
  el.title.textContent = current.name
  el.eyebrow.textContent = current.campeonatoId ? `CAMPEONATO · ${current.campeonatoId}` : 'ARTE DE TESTE · DADOS DEMONSTRATIVOS'
  el.subtitle.textContent = current.campeonatoId ? 'Sincronize os dados do campeonato e continue criando tudo localmente.' : 'Escreva, importe imagens do PC e exporte PNG sem depender do site.'
  $('#live-name').value = current.name || ''; $('#championship-id').value = current.campeonatoId || ''; $('#origin').value = current.origin || ''
  el.status.textContent = current.cache?.syncedAt ? `Atualizado ${new Date(current.cache.syncedAt).toLocaleString('pt-BR')}` : 'Dados demonstrativos prontos'
  renderFields(); renderBlocks(); void refreshOutput()
}

function renderFields() {
  el.fields.innerHTML = Object.entries(fieldMeta).map(([key, [symbol, label]]) => `<button class="field" data-field="${key}"><i>${symbol}</i><span>${label}</span></button>`).join('')
  for (const button of el.fields.querySelectorAll('[data-field]')) button.onclick = () => {
    const block = getSelectedBlock()
    if (!block || block.type !== 'table') return toast('Selecione uma tabela antes de incluir uma coluna.', 'warn')
    const key = button.dataset.field
    block.columns = block.columns || []
    block.columns.includes(key) ? block.columns = block.columns.filter((item) => item !== key) : block.columns.push(key)
    renderBlocks(); stageChanged()
  }
}

function geometryEditor(block) {
  return `<div class="geometry"><label>X<input data-geometry="x" type="number" min="0" max="1920" value="${Number(block.x || 0)}" /></label><label>Y<input data-geometry="y" type="number" min="0" max="1080" value="${Number(block.y || 0)}" /></label><label>Largura<input data-geometry="width" type="number" min="20" max="1920" value="${Number(block.width || 200)}" /></label><label>Altura<input data-geometry="height" type="number" min="20" max="1080" value="${Number(block.height || 100)}" /></label></div>`
}

function blockLabel(block) {
  if (block.type === 'table') return ['▦', block.title || 'Tabela']
  if (block.type === 'image') return ['▣', block.name || 'Imagem']
  return ['T', block.text || 'Texto']
}

function renderBlocks() {
  el.blockList.innerHTML = current.layout.blocks.map((block, index) => { const [icon, label] = blockLabel(block); return `<button class="block-row ${selectedBlockId() === block.id ? 'active' : ''}" data-block="${block.id}"><b>${icon}</b><span>${escape(label)}</span><small>${index + 1}</small></button>` }).join('')
  for (const button of el.blockList.querySelectorAll('[data-block]')) button.onclick = () => { el.blockList.dataset.selected = button.dataset.block; renderBlocks() }
  const block = getSelectedBlock()
  if (!block) { el.blockEditor.innerHTML = '<p class="hint">Selecione uma camada para editar sua arte.</p>'; return }
  const geometry = geometryEditor(block)
  if (block.type === 'text') {
    el.blockEditor.innerHTML = `<p class="editor-title">Texto</p><label>Conteúdo<input id="block-text" value="${escapeAttr(block.text || '')}" /></label><div class="inline-fields"><label>Cor<input id="block-color" type="color" value="${escapeAttr(block.color || '#ffffff')}" /></label><label>Tamanho<input id="block-size" type="number" min="12" max="180" value="${Number(block.size || 36)}" /></label></div>${geometry}`
  } else if (block.type === 'image') {
    el.blockEditor.innerHTML = `<p class="editor-title">Imagem local</p><p class="hint">${escape(block.name || 'Nenhuma imagem escolhida.')}</p><button id="replace-image" class="button button-secondary wide">Importar imagem do PC</button><label>Encaixe<select id="image-fit"><option value="contain" ${block.fit !== 'cover' ? 'selected' : ''}>Mostrar inteira</option><option value="cover" ${block.fit === 'cover' ? 'selected' : ''}>Preencher área</option></select></label><label>Opacidade<input id="image-opacity" type="number" min="0" max="1" step="0.05" value="${Number(block.opacity ?? 1)}" /></label>${geometry}`
  } else {
    el.blockEditor.innerHTML = `<p class="editor-title">Tabela</p><label>Título da tabela<input id="block-title" value="${escapeAttr(block.title || '')}" /></label><p class="hint">Colunas ativas</p><div class="selected-columns">${(block.columns || []).map((key) => `<button data-remove-column="${key}">${escape(fieldMeta[key]?.[1] || key)} ×</button>`).join('') || '<small>Escolha campos na coluna Dados.</small>'}</div>${geometry}`
  }
  bindBlockEditor(block)
}

function bindBlockEditor(block) {
  const input = (id, prop, asNumber = false) => $(id)?.addEventListener('input', (event) => { block[prop] = asNumber ? Number(event.target.value) : event.target.value; stageChanged() })
  input('#block-text', 'text'); input('#block-color', 'color'); input('#block-size', 'size', true); input('#block-title', 'title'); input('#image-opacity', 'opacity', true)
  $('#image-fit')?.addEventListener('change', (event) => { block.fit = event.target.value; stageChanged() })
  $('#replace-image')?.addEventListener('click', () => void importImageInto(block))
  for (const node of el.blockEditor.querySelectorAll('[data-geometry]')) node.addEventListener('input', (event) => { block[event.target.dataset.geometry] = Number(event.target.value); stageChanged() })
  for (const button of el.blockEditor.querySelectorAll('[data-remove-column]')) button.onclick = () => { block.columns = block.columns.filter((key) => key !== button.dataset.removeColumn); renderBlocks(); stageChanged() }
}

async function persistCurrent(show = false) {
  if (!current) return
  try { current = await api.saveLive(current); updateLiveInList(current); if (show) toast('Projeto salvo neste computador.') } catch (error) { toast(error.message || 'Não foi possível salvar.', 'error') }
}
function stageChanged() {
  clearTimeout(saveTimer); saveTimer = setTimeout(() => void persistCurrent(false), 280)
  clearTimeout(previewTimer); previewTimer = setTimeout(() => void refreshOutput(), 420)
}

async function refreshOutput() {
  if (!current) return
  const url = await api.outputUrl(current.id)
  el.output.textContent = url
  el.preview.src = `${url}?preview=${Date.now()}`
}

async function saveCurrent(show = true) {
  if (!current) return
  current.name = $('#live-name').value.trim() || current.name
  current.campeonatoId = $('#championship-id').value.trim()
  current.origin = $('#origin').value.trim()
  await persistCurrent(show)
  render()
}

function createBlock(type, image) {
  ensureLayout(); const offset = current.layout.blocks.length * 24
  let block
  if (type === 'table') block = { id: crypto.randomUUID(), type: 'table', x: 100 + offset, y: 170 + offset, width: 1080, height: 640, title: 'CLASSIFICAÇÃO', columns: ['posicao', 'logo', 'nome', 'abates', 'pontos_total'] }
  else if (type === 'image') block = { id: crypto.randomUUID(), type: 'image', x: 1350, y: 70 + offset, width: 420, height: 220, src: image.src, name: image.name, fit: 'contain', opacity: 1 }
  else block = { id: crypto.randomUUID(), type: 'text', x: 100 + offset, y: 70 + offset, width: 1200, height: 80, text: 'NOVO TEXTO', color: '#f5f3ed', size: 42 }
  current.layout.blocks.push(block); el.blockList.dataset.selected = block.id; renderBlocks(); stageChanged()
}

async function importImageInto(existingBlock) {
  try {
    const image = await api.importImage()
    if (!image) return
    if (existingBlock) { existingBlock.src = image.src; existingBlock.name = image.name; renderBlocks(); stageChanged() }
    else createBlock('image', image)
  } catch (error) { toast(error.message || 'Não foi possível importar a imagem.', 'error') }
}

async function sync() {
  if (!current) return
  if (!current.campeonatoId) return toast('Informe e salve o ID do campeonato antes de atualizar os dados.', 'warn')
  $('#sync-live').disabled = true; $('#sync-live').textContent = '↻ Atualizando…'
  try { current = await api.syncLive(current.id); updateLiveInList(current); toast(`${current.cache?.teams?.length || 0} equipes e logos sincronizados neste PC.`); render() }
  catch (error) { toast(error.message || 'Falha ao atualizar os dados.', 'error') }
  finally { $('#sync-live').disabled = false; $('#sync-live').textContent = '↻ Atualizar dados' }
}

function openDialog() { $('#new-live-name').value = ''; $('#new-championship-id').value = ''; $('#new-origin').value = 'https://dropzone-cadastros.vercel.app'; el.dialog.showModal(); $('#new-live-name').focus() }
function escape(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])) }
function escapeAttr(value) { return escape(value) }

$('#new-live').onclick = openDialog; $('#empty-new-live').onclick = openDialog
$('#create-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const live = await api.createLive({ name: $('#new-live-name').value, campeonatoId: $('#new-championship-id').value, origin: $('#new-origin').value }); el.dialog.close(); await refreshLives(live.id); toast('Arte criada com dados demonstrativos. Pode editar e testar agora.') } catch (error) { toast(error.message || 'Não foi possível criar.', 'error') } })
$('#sync-live').onclick = sync; $('#save-live').onclick = () => void saveCurrent(true)
$('#export-png').onclick = async () => { if (!current) return; try { const savedPath = await api.exportPng(current.id); if (savedPath) toast('PNG salvo localmente: ' + savedPath) } catch (error) { toast(error.message || 'Não foi possível exportar o PNG.', 'error') } }
$('#copy-output').onclick = async () => { if (!current) return; const url = await api.outputUrl(current.id); await api.copy(url); toast('URL local copiada para OBS ou vMix.') }
$('#open-output').onclick = async () => { if (current) await api.open(await api.outputUrl(current.id)) }
$('#delete-live').onclick = async () => { if (!current || !confirm(`Excluir “${current.name}” deste PC?`)) return; await api.deleteLive(current.id); current = null; await refreshLives(); toast('Produção removida deste PC.') }
for (const button of document.querySelectorAll('[data-add]')) button.onclick = () => createBlock(button.dataset.add)
$('#add-image').onclick = () => void importImageInto()
refreshLives().catch((error) => toast(error.message || 'Falha ao abrir os projetos locais.', 'error'))
