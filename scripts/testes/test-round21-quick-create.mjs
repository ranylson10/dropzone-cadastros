import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p) => fs.readFileSync(path.join(root,p), 'utf8')
const form = read('web/components/forms/campeonato/CampeonatoForm.tsx')
const producer = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
const auth = read('web/features/dropzone/DropZoneHome.tsx')
const css = read('web/components/forms/campeonato/campeonato-quick-r21.css')
let checks = 0
const check = (label, truth) => { assert.ok(truth, label); checks++ }

function readFunction(name, next) {
  const start = form.indexOf(`  function ${name}(`)
  const end = form.indexOf(`  function ${next}(`, start + 1)
  assert.ok(start >= 0 && end > start, `Fonte ${name}`)
  return form.slice(start, end).trim()
}

const guardSource = readFunction('quickCreationError','selectCreationFlow')
function validate(fields = {}, options = {}) {
  const value = {tipo:'copa',nome:'Copa Teste',logo_url:'logo.png', numero_vagas:'96', estrutura_planejada:[{equipes_por_grupo:'12'}], origem_criacao:'novo', inscricao_paga:false, valor_inscricao:'', liga_divisoes:[], ...fields}
  const ctx = {mode: options.mode || 'create', creationFlow: options.creationFlow || 'quick', originChoice: options.originChoice || 'novo', value, normalizedDailySchedules:()=>options.schedules ?? [{horario:'19:00'}]}
  return vm.runInNewContext(`${guardSource}; quickCreationError()`, ctx)
}
const cases = [
  ['copa pronta', {}, '', {}],
  ['sem nome', {nome:' '}, 'nome', {}],
  ['sem logo', {logo_url:''}, 'logo', {}],
  ['sem formato', {tipo:''}, 'formato', {}],
  ['vagas abaixo', {numero_vagas:'1'}, '2 a 500', {}],
  ['vagas acima', {numero_vagas:'501'}, '2 a 500', {}],
  ['vagas fracionarias', {numero_vagas:'2.5'}, '2 a 500', {}],
  ['vagas não numéricas', {numero_vagas:'x'}, '2 a 500', {}],
  ['pagamento sem preço', {inscricao_paga:true, valor_inscricao:''}, 'valor', {}],
  ['pagamento com preço', {inscricao_paga:true, valor_inscricao:'29.90'}, '', {}],
  ['confronto deve ter 2', {tipo:'confronto',numero_vagas:'12'}, 'exatamente 2', {}],
  ['confronto válido', {tipo:'confronto',numero_vagas:'2'}, '', {}],
  ['xtreino limite', {tipo:'xtreino',numero_vagas:'16'}, '2 a 15', {}],
  ['xtreino válido', {tipo:'xtreino',numero_vagas:'12'}, '', {}],
  ['diario limite', {tipo:'diario',numero_vagas:'53'}, '52', {}],
  ['diario horário válido', {tipo:'diario',numero_vagas:'12'}, '', {}],
  ['diario sem horário', {tipo:'diario',numero_vagas:'12'}, 'horário', {schedules:[]}],
  ['liga sem agrupamento', {tipo:'liga',numero_vagas:'12'}, 'Liga', {}],
  ['liga válida', {tipo:'liga',numero_vagas:'12',liga_divisoes:[{equipes:'12',entradas:[{quantidade:'12'}]}]}, '', {}],
  ['copa sem plano', {estrutura_planejada:[]}, 'estrutura', {}],
  ['rejeita season no rapido', {origem_criacao:'season'}, 'Criar novo', {}],
  ['fluxo completo não usa guarda rápida', {nome:''}, '', {creationFlow:'complete'}],
  ['edição não usa guarda rápida', {nome:''}, '', {mode:'edit'}],
]
for (const [name, fields, result, opts] of cases) {
  const actual = validate(fields, opts)
  check(name, result ? actual.includes(result) : actual === '')
}
check('wizard rápido inclui pontuação antes de confirmar', form.includes("? [{ id: 'origin', label: 'Dados essenciais' }, { id: 'scoring', label: 'Pontuação' }, { id: 'review', label: 'Confirmar' }]"))
check('fluxo rápido padrão', form.includes("useState<'quick' | 'complete'>('quick')"))
check('assistente completo preservado', form.includes('Assistente completo') && form.includes("selectCreationFlow('complete')"))
check('atalho rápido selecionado no formato', form.includes("setOriginChoice('novo')"))
check('validação antes da próxima etapa', form.includes('const error = quickCreationError()') && form.includes('return setWizardError(error)'))
check('validação antes de gravar', form.includes('const quickError = quickCreationError()') && form.includes("setFormPage('origin'); return"))
check('criação continua com API existente', form.includes('await onSubmit(resolvedValue)'))
check('cotação obrigatória permanece visível na revisão', form.includes('Pacote DropZone · valor estimado') && form.includes('quote.valor_total_brl'))
check('logos continuam necessários', form.includes('Envie a logo do campeonato.') && producer.includes('props.createChampionship(resolvedChampionship)'))
check('origens e seasons preservadas no assistente completo', form.includes("selectCreationOrigin('season')") && form.includes("selectCreationOrigin('modelo')"))
check('número da liga atualiza a origem padrão', form.includes("tipo: 'classificatoria_aberta', quantidade: raw"))
check('número da copa atualiza as fases', form.includes("value.tipo === 'copa') updateGuidedCup(raw)"))
check('número do diário atualiza horários', form.includes("value.tipo === 'diario')") && form.includes('updateGuidedDaily(raw)'))
check('número xtreino segue limite', form.includes('if (number <= 15) updateXtreinoTeams(raw)'))
check('botão configurar campeonato após cadastro', producer.includes('Configurar campeonato') && producer.includes('setChampionshipDetailOpen(true)'))
check('modal financeiro permanece acessível', producer.includes('Pagar online com PIX') && producer.includes('Aguardar liberação do admin'))
check('cadastro equipe com nome, usuário e tag', auth.includes("profileType === 'equipe' ? 'Nome da equipe'") && auth.includes('label="Tag"') && auth.includes('@usuário deste perfil'))
check('cadastro jogador com nick, usuário e id', auth.includes("profileType === 'jogador' ? 'Nick'") && auth.includes('label="ID de jogo"'))
check('função foi para perfil opcional', auth.indexOf('<summary>Personalizar perfil') < auth.indexOf('label="Função no jogo"'))
check('foto/localização preservadas', auth.includes('LocationSearch value={registerData}') && auth.includes('onUpload={uploadPublicFile}'))
check('layout mobile adaptativo', css.includes('@media(max-width:600px)'))
check('respeita movimento reduzido', css.includes('prefers-reduced-motion'))
console.log(`R21: ${checks} verificações locais aprovadas, incluindo ${cases.length} casos de validação executados.`)
