// R15: diagnostico SOMENTE LEITURA do laboratorio LOCAL de PostgreSQL.
// Nao cria containers, nao executa SQL e nao aceita conexao externa.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const name = 'dropzone-audit-inscricoes-01a128'
const checks = []
const check = (id, ok, message) => checks.push({ id, status: ok ? 'OK' : 'BLOQUEADO', message })
const catalog = path.join(root, 'relatorios-testes', 'banco-publicado.json')
let catalogOk = false
let snapshot = null
try {
  const stat = fs.statSync(catalog)
  const value = JSON.parse(fs.readFileSync(catalog, 'utf8'))
  const base = value.tables?.filter(row => row.table_schema === 'public' && row.table_type === 'BASE TABLE') || []
  const timestamp = Date.parse(value.generated_at)
  catalogOk = stat.size > 10000 && base.length >= 100 &&
    ['columns','indexes','functions','constraints','triggers','policies','rls'].every(key => Array.isArray(value[key]) && value[key].length > 0) &&
    Number.isFinite(timestamp) && timestamp <= Date.now()+86400000
  if (catalogOk) snapshot = { generated_at:value.generated_at, base_tables:base.length,
    age_days:Math.max(0,Math.floor((Date.now()-timestamp)/86400000)),
    warning:'Snapshot historico para fixture sintetica; nunca e prova do schema atual nem substitui staging.' }
} catch { /* Catalogo ausente ou invalido; nunca consultar producao como fallback */ }
check('catalogo_fixture_local', catalogOk,
  catalogOk ? `Catalogo de ${snapshot.generated_at}; ${snapshot.base_tables} tabelas-base, ${snapshot.age_days} dias de idade (somente fixture).` :
    'Falta catalogo valido em relatorios-testes/banco-publicado.json; importe com IMPORTAR_CATALOGO_R16.bat.')
const docker = spawnSync('docker', ['inspect', '--format', '{{json .Config.Labels}}|{{.HostConfig.NetworkMode}}|{{.State.Status}}|{{.Config.Image}}', name],
  {cwd:root,encoding:'utf8',timeout:12000,windowsHide:true,maxBuffer:100000})
let verified = false
if (docker.status === 0 && !docker.error) {
  try {
    const [labelText, network, status, image] = docker.stdout.trim().split('|')
    const labels = JSON.parse(labelText)
    verified = labels['dropzone.audit'] === 'inscricoes-20261011' && network === 'none' &&
      status === 'running' && image === 'postgres:17.6'
  } catch { /* fail closed */ }
}
check('postgres17_isolado', verified,
  verified ? 'Docker isolado com identidade, imagem e label exigidos.' : 'Contêiner Docker sintético postgres:17.6 ausente ou identidade/rede inadequada.')
const schemaScript = fs.existsSync(path.join(root,'scripts/testes/postgres-inscricoes/build-schema.mjs'))
const nativeScript = fs.existsSync(path.join(root,'scripts/testes/postgres-inscricoes/validate-native.mjs'))
check('rotinas_nativas',schemaScript && nativeScript, 'Reconstrucao e testes de concorrencia locais.')
const result = { stage:'R16-preflight-local',safe_for_production:false,mode:'somente-leitura',catalog_snapshot:snapshot,checks,
  ready:checks.every(c=>c.status==='OK'),instructions:[
  'Leia scripts/testes/postgres-inscricoes/README.md; laboratorio sintetico nao substitui staging.',
  'Somente com o laboratorio isolado: node scripts/testes/postgres-inscricoes/build-schema.mjs',
  'Prepare um banco NOVO: node scripts/testes/postgres-inscricoes/fresh-validation.mjs dropzone_validation_r15',
  'Teste: configure DROPZONE_FIXTURE_DB=dropzone_validation_r15 e rode node scripts/testes/postgres-inscricoes/validate-native.mjs 50000',
  'Nunca use a URL do Supabase de producao nesse laboratorio.'
] }
console.log(JSON.stringify(result,null,2))
if (!result.ready) process.exitCode=2
