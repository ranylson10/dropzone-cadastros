// R13: relatório de prontidão, sem conexão com produção e SEM afirmação de deploy.
// Modo --require-ready: bloqueia a liberação se faltar evidência real.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const req = process.argv.includes('--require-ready')
const has = rel => fs.existsSync(path.join(ROOT, rel))
const conditions = [
  { name:'script_regressoes_disponivel', pass: has('scripts/testes/test-round12-token-writers.mjs'), note:'Verifica somente presenca; a execução dos testes precisa de log independente' },
  { name:'dependencias', pass: has('node_modules/next/package.json'), note:'npm ci precisa concluir' },
  { name:'build_integral', pass:false, note:'Next build/prerender autenticado nao executado e auditado' },
  { name:'postgres_concorrencia', pass:false, note:'Duas sessoes PostgreSQL nativas e erros injetados ainda sem evidência R13' },
  { name:'migrations_e_acls', pass:false, note:'Candidatas nao homologadas ou aplicadas ao banco atual' },
  { name:'e2e_visual_e_autenticado', pass:false, note:'Navegador + ambiente de teste faltantes' },
  { name:'rollback_restauracao', pass:false, note:'Restauracao/reversao em homologacao não ensaiada na R13' },
]
const blocked = conditions.filter(x => !x.pass).map(x => x.name)
const data = { round:'R13', verdict:blocked.length?'BLOQUEADA':'LIBERAVEL', production_modified:false, conditions, blocked }
console.log(JSON.stringify(data,null,2))
if (req && blocked.length) process.exitCode=2
