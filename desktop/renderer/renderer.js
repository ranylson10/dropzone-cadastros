const api = window.dropzoneLive
const fields = { posicao: '#', logo: 'LOGO', nome: 'EQUIPE', abates: 'ABT', pontos_total: 'PTS', booyahs: 'B!', quedas: 'QD', dano: 'DMG', assistencias: 'AST' }
const palettePresets = [
  { name: 'Ouro', accent: '#d7bd57', surface: '#101827', ink: '#f5f3ed', muted: '#8ea2b9' },
  { name: 'Neon', accent: '#20e480', surface: '#0b1f1a', ink: '#edfff5', muted: '#8ecdb0' },
  { name: 'Azul', accent: '#4ba3ff', surface: '#111a31', ink: '#f4f7ff', muted: '#9eb9e8' },
  { name: 'Vermelho', accent: '#ff5d5d', surface: '#281319', ink: '#fff4f4', muted: '#e7a0a0' },
]
let lives = [], current = null, championships = [], saveTimer = null, outputUrl = '', previewFrame = null
const $ = (selector) => document.querySelector(selector)
const el = { app: $('#app'), gate: $('#login-gate'), workspace: $('#workspace'), empty: $('#empty-state'), list: $('#block-list'), editor: $('#block-editor'), project: $('#project-editor'), layer: $('#selection-layer'), preview: $('#overlay-preview'), title: $('#live-title'), output: $('#output-url'), toast: $('#toast'), dialog: $('#live-dialog') }

function message(error, fallback) { return String(error?.message || fallback || 'Ocorreu um erro.').replace(/^Error invoking remote method '[^']+': Error:\s*/i, '').replace(/^Error:\s*/i, '') }
function toast(text, tone = '') { el.toast.textContent = text; el.toast.className = `toast ${tone}`; clearTimeout(toast.timer); toast.timer = setTimeout(() => el.toast.classList.add('hidden'), 2600) }
function escape(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])) }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || min)) }
function uid() { return crypto.randomUUID() }
function layout() {
  if (!current.layout) current.layout = {}
  const l = current.layout
  l.width ||= 1920; l.height ||= 1080; l.background ||= '#080b13'; l.backgroundFit ||= 'cover'; l.blocks ||= []
  l.palette ||= { ...palettePresets[0] }; l.transition ||= { enter: 'fade', exit: 'fade', duration: 450, delay: 0 }
  return l
}
function ensureArtboard() {
  const surface = $('#design-surface')
  if (!surface || $('#artboard')) return
  const artboard = document.createElement('div'); artboard.id = 'artboard'; artboard.className = 'artboard'
  surface.append(artboard); artboard.append(el.preview, el.layer)
}
function selectedId() { return el.list.dataset.selected || '' }
function selected() { return current?.layout?.blocks?.find((block) => block.id === selectedId()) || null }
function setSelected(id) { el.list.dataset.selected = id || ''; renderLayers(); renderSelection(); renderInspector() }

async function boot() {
  try {
    const session = await api.session(); if (!session.signedIn) return showLogin()
    $('#account-name').textContent = session.account?.name || session.account?.username || 'Conta DropZone'
    el.app.classList.remove('hidden'); el.gate.classList.add('hidden'); championships = await api.championships(); renderChampionships(); await refreshLives()
  } catch (error) { showLogin(message(error, 'Não foi possível confirmar sua sessão.')) }
}
function showLogin(error = '') { el.app.classList.add('hidden'); el.gate.classList.remove('hidden'); $('#login-error').textContent = error }
async function finishLogin(session) {
  $('#account-name').textContent = session.account?.name || session.account?.username || 'Conta DropZone'; el.app.classList.remove('hidden'); el.gate.classList.add('hidden')
  championships = await api.championships(); renderChampionships(); await refreshLives()
}
function renderChampionships() {
  const options = championships.map((item) => `<option value="${escape(item.id)}">${escape(item.nome || 'Campeonato')}</option>`).join('')
  $('#championship-select').innerHTML = '<option value="">Arte livre</option>' + options; $('#new-championship-select').innerHTML = '<option value="">Arte livre</option>' + options
}
async function refreshLives() { lives = await api.listLives(); current = lives.find((item) => item.id === current?.id) || lives[0] || null; render() }
function render() {
  el.workspace.classList.toggle('hidden', !current); el.empty.classList.toggle('hidden', Boolean(current)); if (!current) return
  const l = layout(); if (!selectedId() || !selected()) el.list.dataset.selected = l.blocks[0]?.id || ''
  el.title.textContent = current.name; $('#championship-select').value = current.campeonatoId || ''; $('#sync-status').textContent = current.cache?.syncedAt ? '● Dados atualizados' : '● Local'
  renderProject(); renderLayers(); renderSelection(); renderInspector(); void refreshOutput()
}
function renderProject() {
  const l = layout(); const p = l.palette
  el.project.innerHTML = `<div class="project-section"><label>Fundo<input id="project-background" type="color" value="${escape(l.background)}" /></label><button id="project-background-image" class="wide">${l.backgroundImage ? 'Trocar imagem de fundo' : 'Adicionar imagem de fundo'}</button>${l.backgroundImage ? `<button id="project-background-remove" class="wide subtle">Remover imagem de fundo</button><label>Ajuste<select id="project-background-fit"><option value="cover" ${l.backgroundFit === 'cover' ? 'selected' : ''}>Preencher</option><option value="contain" ${l.backgroundFit === 'contain' ? 'selected' : ''}>Ajustar</option></select></label>` : ''}</div><div class="project-section"><b>Paleta</b><div class="palette-presets">${palettePresets.map((preset, index) => `<button data-palette="${index}" title="${preset.name}" style="--swatch:${preset.accent};--swatch2:${preset.surface}"></button>`).join('')}</div><div class="project-colors"><label>Acento<input id="palette-accent" type="color" value="${escape(p.accent)}" /></label><label>Base<input id="palette-surface" type="color" value="${escape(p.surface)}" /></label><label>Texto<input id="palette-ink" type="color" value="${escape(p.ink)}" /></label></div></div><div class="project-section"><b>Transição</b><div class="project-grid"><label>Entrada<select id="transition-enter">${transitionOptions(l.transition.enter)}</select></label><label>Saída<select id="transition-exit">${transitionOptions(l.transition.exit)}</select></label><label>Tempo<input id="transition-duration" type="number" min="0" max="5000" value="${l.transition.duration}" /></label><label>Delay<input id="transition-delay" type="number" min="0" max="5000" value="${l.transition.delay || 0}" /></label></div><button id="project-test-transition" class="wide">Testar transição</button></div>`
  $('#project-background').oninput = (event) => { l.background = event.target.value; stageChanged() }
  $('#project-background-image').onclick = () => void importBackground()
  $('#project-background-remove')?.addEventListener('click', () => { delete l.backgroundImage; stageChanged(); renderProject() })
  $('#project-background-fit')?.addEventListener('change', (event) => { l.backgroundFit = event.target.value; stageChanged() })
  for (const button of el.project.querySelectorAll('[data-palette]')) button.onclick = () => { l.palette = { ...palettePresets[Number(button.dataset.palette)] }; renderProject(); stageChanged() }
  for (const [id, key] of [['#palette-accent', 'accent'], ['#palette-surface', 'surface'], ['#palette-ink', 'ink']]) $(id).oninput = (event) => { l.palette[key] = event.target.value; stageChanged() }
  for (const [id, key] of [['#transition-enter', 'enter'], ['#transition-exit', 'exit'], ['#transition-duration', 'duration'], ['#transition-delay', 'delay']]) $(id).onchange = (event) => { l.transition[key] = key === 'duration' || key === 'delay' ? clamp(event.target.value, 0, 5000) : event.target.value; stageChanged() }
  $('#project-test-transition').onclick = () => sendPreview(true)
}
function transitionOptions(value) { return ['none', 'fade', 'slide-left', 'slide-right', 'rise', 'drop', 'zoom'].map((item) => `<option value="${item}" ${item === value ? 'selected' : ''}>${({ none: 'Nenhuma', fade: 'Fade', 'slide-left': 'Da esquerda', 'slide-right': 'Da direita', rise: 'Subir', drop: 'Descer', zoom: 'Zoom' })[item]}</option>`).join('') }
function renderLayers() {
  el.list.innerHTML = layout().blocks.map((block, index) => `<button data-block="${block.id}" class="${block.id === selectedId() ? 'active' : ''}" title="${escape(layerName(block))}"><i>${block.type === 'text' ? 'T' : block.type === 'table' ? '▦' : block.type === 'cards' ? '▤' : block.type === 'shape' ? '▰' : block.type === 'stat' ? '#' : '▣'}</i><span>${escape(layerName(block))}</span><small>${index + 1}</small></button>`).join('')
  for (const node of el.list.querySelectorAll('[data-block]')) node.onclick = () => setSelected(node.dataset.block)
}
function layerName(block) { return block.type === 'text' ? block.text || 'Texto' : block.type === 'table' ? block.title || 'Tabela' : block.type === 'cards' ? block.title || 'Cards de equipes' : block.type === 'shape' ? block.name || 'Bloco' : block.type === 'stat' ? block.label || 'Indicador' : block.name || 'Imagem' }
function renderSelection() {
  const active = selected(); const sx = (el.layer.clientWidth || 1920) / 1920; const sy = (el.layer.clientHeight || 1080) / 1080; const px = (value) => Number(value).toFixed(2)
  el.layer.innerHTML = layout().blocks.map((block) => `<div data-select="${block.id}" class="select-box ${block.id === active?.id ? 'active' : ''}" style="left:${px(block.x * sx)}px;top:${px(block.y * sy)}px;width:${px(block.width * sx)}px;height:${px(block.height * sy)}px"><span class="move-grip" title="Arrastar"></span><span class="resize-handle" data-resize="se" title="Redimensionar"></span></div>`).join('')
  for (const node of el.layer.querySelectorAll('[data-select]')) { node.addEventListener('pointerdown', startDrag); node.querySelector('[data-resize]')?.addEventListener('pointerdown', (event) => startDrag(event, true)) }
}
function startDrag(event, forceResize = false) {
  event.preventDefault(); event.stopPropagation(); const node = event.currentTarget?.matches?.('[data-select]') ? event.currentTarget : event.target?.closest?.('[data-select]'); const block = layout().blocks.find((item) => item.id === node?.dataset?.select); if (!node || !block) return
  const resizing = forceResize || event.target?.dataset?.resize === 'se'; el.list.dataset.selected = block.id; renderLayers(); renderInspector(); for (const item of el.layer.querySelectorAll('[data-select]')) item.classList.toggle('active', item === node)
  const artboard = $('#artboard').getBoundingClientRect(); const start = { x: event.clientX, y: event.clientY, blockX: block.x, blockY: block.y, width: block.width, height: block.height }; node.setPointerCapture?.(event.pointerId)
  const move = (next) => { const dx = (next.clientX - start.x) / artboard.width * 1920; const dy = (next.clientY - start.y) / artboard.height * 1080; if (resizing) { block.width = clamp(start.width + dx, 48, 1920 - block.x); block.height = clamp(start.height + dy, 34, 1080 - block.y) } else { block.x = clamp(start.blockX + dx, 0, 1920 - block.width); block.y = clamp(start.blockY + dy, 0, 1080 - block.height) }; node.style.left = `${block.x / 1920 * el.layer.clientWidth}px`; node.style.top = `${block.y / 1080 * el.layer.clientHeight}px`; node.style.width = `${block.width / 1920 * el.layer.clientWidth}px`; node.style.height = `${block.height / 1080 * el.layer.clientHeight}px`; setQuickProperties() }
  const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); node.releasePointerCapture?.(event.pointerId); renderSelection(); stageChanged() }
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true })
}
function renderInspector() {
  const block = selected(); if (!block) { el.editor.innerHTML = ''; return }
  if (block.type === 'text') el.editor.innerHTML = `<input id="prop-text" value="${escape(block.text || '')}" title="Texto" /><div class="prop-grid"><label>Cor<input id="prop-color" type="color" value="${escape(block.color || '#ffffff')}" /></label><label>Tamanho<input id="prop-size" type="number" min="8" max="240" value="${block.size || 36}" /></label><label>Peso<select id="prop-weight"><option value="600">Médio</option><option value="700">Forte</option><option value="900">Extra forte</option></select></label></div>${deleteButton()}`
  else if (block.type === 'table') el.editor.innerHTML = `<input id="prop-title" value="${escape(block.title || '')}" title="Título" /><div class="field-buttons">${Object.entries(fields).map(([key, label]) => `<button data-field="${key}" class="${block.columns?.includes(key) ? 'on' : ''}">${label}</button>`).join('')}</div>${deleteButton()}`
  else if (block.type === 'cards') el.editor.innerHTML = `<input id="prop-title" value="${escape(block.title || '')}" title="Título do painel" /><div class="prop-grid"><label>Por linha<input id="prop-card-columns" type="number" min="1" max="10" value="${block.cardColumns || 5}" /></label><label>Equipes<input id="prop-card-count" type="number" min="1" max="24" value="${block.count || 10}" /></label><label>Fundo A<input id="prop-fill" type="color" value="${escape(block.fill || layout().palette.surface)}" /></label><label>Fundo B<input id="prop-fill2" type="color" value="${escape(block.fill2 || layout().palette.accent)}" /></label></div>${deleteButton()}`
  else if (block.type === 'shape') el.editor.innerHTML = `<input id="prop-name" value="${escape(block.name || '')}" title="Nome do bloco" /><div class="prop-grid"><label>Cor A<input id="prop-fill" type="color" value="${escape(block.fill || layout().palette.surface)}" /></label><label>Cor B<input id="prop-fill2" type="color" value="${escape(block.fill2 || block.fill || layout().palette.surface)}" /></label><label>Opacidade<input id="prop-opacity" type="number" min="0" max="100" value="${Math.round((block.opacity ?? 1) * 100)}" /></label><label>Canto<input id="prop-radius" type="number" min="0" max="160" value="${block.radius || 0}" /></label></div>${deleteButton()}`
  else if (block.type === 'stat') el.editor.innerHTML = `<input id="prop-label" value="${escape(block.label || '')}" title="Legenda" /><input id="prop-value" value="${escape(block.value || '')}" title="Valor" /><div class="prop-grid"><label>Base<input id="prop-fill" type="color" value="${escape(block.fill || layout().palette.surface)}" /></label><label>Cor<input id="prop-color" type="color" value="${escape(block.color || '#ffffff')}" /></label><label>Tamanho<input id="prop-size" type="number" min="8" max="240" value="${block.size || 44}" /></label></div>${deleteButton()}`
  else el.editor.innerHTML = `<button id="replace-image" class="wide">Trocar imagem</button><div class="prop-grid"><label>Ajuste<select id="prop-fit"><option value="contain">Ajustar</option><option value="cover">Preencher</option></select></label><label>Opacidade<input id="prop-opacity" type="number" min="0" max="100" value="${Math.round((block.opacity ?? 1) * 100)}" /></label></div>${deleteButton()}`
  const bind = (id, key, transform = (value) => value) => $(id)?.addEventListener('input', (event) => { block[key] = transform(event.target.value); stageChanged() })
  bind('#prop-text', 'text'); bind('#prop-color', 'color'); bind('#prop-size', 'size', Number); bind('#prop-name', 'name'); bind('#prop-fill', 'fill'); bind('#prop-fill2', 'fill2'); bind('#prop-label', 'label'); bind('#prop-value', 'value'); bind('#prop-radius', 'radius', Number); bind('#prop-opacity', 'opacity', (value) => clamp(value, 0, 100) / 100); bind('#prop-card-columns', 'cardColumns', (value) => clamp(value, 1, 10)); bind('#prop-card-count', 'count', (value) => clamp(value, 1, 24))
  $('#prop-weight')?.addEventListener('change', (event) => { block.weight = Number(event.target.value); stageChanged() }); $('#prop-title')?.addEventListener('input', (event) => { block.title = event.target.value; stageChanged() }); $('#prop-fit')?.addEventListener('change', (event) => { block.fit = event.target.value; stageChanged() })
  for (const button of el.editor.querySelectorAll('[data-field]')) button.onclick = () => { const key = button.dataset.field; block.columns ||= []; block.columns.includes(key) ? block.columns = block.columns.filter((item) => item !== key) : block.columns.push(key); renderInspector(); stageChanged() }
  $('#replace-image')?.addEventListener('click', () => void importImage(block)); $('#delete-block')?.addEventListener('click', () => { layout().blocks = layout().blocks.filter((item) => item.id !== block.id); el.list.dataset.selected = layout().blocks[0]?.id || ''; render(); stageChanged() }); setQuickProperties()
}
function deleteButton() { return '<button id="delete-block" class="danger" title="Excluir camada">Excluir</button>' }
function setQuickProperties() { const block = selected(); for (const [id, key] of [['#tool-x', 'x'], ['#tool-y', 'y'], ['#tool-w', 'width'], ['#tool-h', 'height']]) $(id).value = block ? Math.round(block[key]) : '' }
function bindQuickProperties() { for (const [id, key, max] of [['#tool-x', 'x', 1920], ['#tool-y', 'y', 1080], ['#tool-w', 'width', 1920], ['#tool-h', 'height', 1080]]) $(id).addEventListener('input', (event) => { const block = selected(); if (!block) return; block[key] = clamp(event.target.value, 10, max); renderSelection(); stageChanged() }) }
function sendPreview(playTransition = false) { if (!current) return; cancelAnimationFrame(previewFrame); previewFrame = requestAnimationFrame(() => el.preview.contentWindow?.postMessage({ type: 'dropzone-live:state', live: current, playTransition }, '*')) }
async function persist(show = false) { if (!current) return; try { const snapshot = structuredClone(current); const saved = await api.saveLive(snapshot); lives = lives.map((item) => item.id === saved.id ? saved : item); if (show) toast('Salvo localmente') } catch (error) { toast(message(error, 'Não foi possível salvar.'), 'error') } }
function stageChanged() { sendPreview(); if (current) void api.previewLive?.(structuredClone(current)); clearTimeout(saveTimer); saveTimer = setTimeout(() => void persist(), 220) }
async function refreshOutput() { if (!current) return; try { const url = await api.outputUrl(current.id); el.output.textContent = url; if (outputUrl !== url) { outputUrl = url; el.preview.src = url } else sendPreview() } catch { el.output.textContent = '—' } }
function newBlock(type, image) { const l = layout(); const n = l.blocks.length; const p = l.palette; if (type === 'table') return { id: uid(), type, x: 170, y: 240, width: 1250, height: 650, title: 'CLASSIFICAÇÃO', columns: ['posicao', 'logo', 'nome', 'abates', 'pontos_total'] }; if (type === 'cards') return { id: uid(), type, x: 130, y: 170, width: 1660, height: 720, title: 'EQUIPES CLASSIFICADAS', cardColumns: 5, count: 10, fill: p.surface, fill2: p.accent }; if (type === 'image') return { id: uid(), type, x: 1350, y: 90, width: 400, height: 240, src: image.src, name: image.name, fit: 'contain', opacity: 1 }; if (type === 'shape') return { id: uid(), type, x: 110 + n * 18, y: 120 + n * 18, width: 640, height: 150, name: 'Bloco visual', fill: p.surface, fill2: p.accent, opacity: .95, radius: 18 }; if (type === 'stat') return { id: uid(), type, x: 130 + n * 18, y: 820, width: 300, height: 130, label: 'ABATES', value: '26', fill: p.surface, color: p.ink, size: 52 }; return { id: uid(), type: 'text', x: 120, y: 70 + n * 28, width: 1000, height: 72, text: 'TEXTO', color: p.ink, size: 46, weight: 900 } }
async function create(type, image) { if (!current) return; const block = newBlock(type, image); layout().blocks.push(block); el.list.dataset.selected = block.id; render(); stageChanged() }
async function importImage(block) { try { const image = await api.importImage(); if (!image) return; if (block) { block.src = image.src; block.name = image.name; render(); stageChanged() } else await create('image', image) } catch (error) { toast(message(error, 'Não foi possível importar a imagem.'), 'error') } }
async function importBackground() { try { const image = await api.importImage(); if (!image || !current) return; layout().backgroundImage = image.src; renderProject(); stageChanged() } catch (error) { toast(message(error, 'Não foi possível importar o fundo.'), 'error') } }

$('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); const button = $('#login-form button[type=submit]'); button.disabled = true; try { await finishLogin(await api.login({ profileType: $('#login-profile').value, login: $('#login-name').value, password: $('#login-password').value })) } catch (error) { $('#login-error').textContent = message(error, 'Não foi possível entrar.') } finally { button.disabled = false } })
$('#google-login').addEventListener('click', async () => { const button = $('#google-login'); button.disabled = true; $('#login-error').textContent = ''; try { const result = await api.loginWithGoogle({ profileType: $('#login-profile').value }); $('#login-error').textContent = result.browser === 'chrome' ? 'Conclua o login no Google Chrome. O app será aberto automaticamente.' : 'Conclua o login na janela do Google. O app será aberto automaticamente.' } catch (error) { $('#login-error').textContent = message(error, 'Não foi possível abrir o Google.'); button.disabled = false } })
api.onAuthChanged((session) => { $('#google-login').disabled = false; void finishLogin(session).catch((error) => showLogin(message(error, 'Não foi possível abrir suas produções.'))) }); api.onAuthError((error) => { $('#google-login').disabled = false; showLogin(message({ message: error }, 'Não foi possível concluir o login Google.')) })
$('#logout').onclick = async () => { await api.logout(); lives = []; current = null; outputUrl = ''; showLogin() }; $('#new-live').onclick = () => { $('#new-live-name').value = ''; $('#new-championship-select').value = ''; el.dialog.showModal() }; $('#empty-new-live').onclick = $('#new-live').onclick
$('#create-form').addEventListener('submit', async (event) => { event.preventDefault(); try { current = await api.createLive({ name: $('#new-live-name').value, campeonatoId: $('#new-championship-select').value }); lives.unshift(current); el.dialog.close(); render() } catch (error) { toast(message(error, 'Não foi possível criar.'), 'error') } })
$('#save-live').onclick = () => void persist(true); $('#sync-live').onclick = async () => { if (!current?.campeonatoId) return toast('Escolha um campeonato autorizado.', 'warn'); try { current = await api.syncLive(current.id); lives = lives.map((item) => item.id === current.id ? current : item); render() } catch (error) { toast(message(error, 'Não foi possível atualizar.'), 'error') } }; $('#background-image').onclick = () => void importBackground(); $('#test-transition').onclick = () => sendPreview(true)
$('#export-png').onclick = async () => { if (!current) return; try { const file = await api.exportPng(current.id); if (file) toast('PNG salvo') } catch (error) { toast(message(error, 'Não foi possível exportar.'), 'error') } }; $('#copy-output').onclick = async () => { if (current) { const url = await api.outputUrl(current.id); await api.copy(url); toast('Link copiado') } }; $('#open-output').onclick = async () => { if (current) await api.open(await api.outputUrl(current.id)) }
ensureArtboard(); el.preview.addEventListener('load', () => sendPreview()); window.addEventListener('resize', () => { if (current) renderSelection() }); $('#championship-select').addEventListener('change', (event) => { if (!current) return; current.campeonatoId = event.target.value; stageChanged() }); for (const node of document.querySelectorAll('[data-add]')) node.onclick = () => void create(node.dataset.add); $('#add-image').onclick = () => void importImage(); $('#add-layer').onclick = () => void create('shape'); bindQuickProperties(); boot()
