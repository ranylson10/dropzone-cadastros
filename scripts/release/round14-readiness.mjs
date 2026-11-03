// Readiness nunca aceita declaracoes manuais de homologacao externa.
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, sourceFingerprint, assessment } from './round14-evidence.mjs'
const filename = path.join(ROOT,'relatorios-testes/round14-local-evidence.json')
let data
try { data = JSON.parse(fs.readFileSync(filename,'utf8')) } catch { data = null }
if (data?.kind !== 'dropzone-round14-local-evidence') data=null
const report = assessment(data,sourceFingerprint())
console.log(JSON.stringify({ round:'R14', evidence_file:data?path.relative(ROOT,filename):null,
  result:report, note:'Aprovacao final depende de homologacao externa e revisao humana; esse script nao executa migrations.' },null,2))
if (process.argv.includes('--require-ready') && report.verdict!=='PRONTA_PARA_REVISAO_HUMANA') process.exitCode=2
