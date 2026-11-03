// R19: run web build with a sanitized environment; never load production secrets.
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {sourceFingerprint} from './round14-evidence.mjs'
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
export const WEB_STEPS=[['npm_ci',['ci','--no-audit']],['typecheck',['run','typecheck']],['lint',['run','lint']],['build_integral',['run','build']]]
// Next carrega .env.local durante o build; limpar somente process.env nao basta.
// Le apenas NOMES das variaveis dos arquivos de env para sobrescreve-las no filho.
// Nunca registra nem copia os valores originais.
export function localEnvVariableNames(root=ROOT){
  const keys=new Set()
  const names=['.env','.env.local','.env.production','.env.production.local']
  for(const dir of [root,path.join(root,'web')])for(const name of names){
    const file=path.join(dir,name)
    if(!fs.existsSync(file)||!fs.statSync(file).isFile())continue
    const contents=fs.readFileSync(file,'utf8')
    for(const line of contents.split(/\r?\n/)){
      const match=line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z_0-9]*)\s*=/)
      if(match)keys.add(match[1])
    }
  }
  return keys
}
export function safeBuildEnvironment(input,root=ROOT){
  const clean={...input}
  for(const key of Object.keys(clean)){
    if(/(?:SUPABASE|POSTGRES|DATABASE|DB_URL|DB_HOST|DB_PASSWORD|^PG[A-Z_]|SERVICE_ROLE|JWT|SECRET|TOKEN|STRIPE|MERCADO|PIX|API_KEY|GOOGLE_APPLICATION_CREDENTIALS|DOCKER_HOST|DOCKER_CONTEXT)/i.test(key))delete clean[key]
  }
  // Variaveis carregadas automaticamente do .env.local teriam prioridade se
  // ausentes. Valores de teste no process.env prevalecem, impedindo usar chaves
  // privadas presentes em arquivo durante o build sanitizado.
  for(const key of localEnvVariableNames(root)){
    if(/^NEXT_PUBLIC_/i.test(key)) clean[key]=''
    else if(/SUPABASE|POSTGRES|DATABASE|DB_URL|DB_HOST|DB_PASSWORD|^PG[A-Z_]|SERVICE_ROLE|JWT|SECRET|TOKEN|STRIPE|MERCADO|PIX|API_KEY|GOOGLE_APPLICATION_CREDENTIALS|DOCKER_HOST|DOCKER_CONTEXT/i.test(key)) {
      clean[key]=/DATABASE_URL|POSTGRES.*URL|DB_URL/i.test(key)
        ? 'postgresql://disabled:disabled@127.0.0.1:1/disabled'
        : 'build-placeholder-disabled'
    }
  }
  clean.NEXT_PUBLIC_SUPABASE_URL='https://build-placeholder.supabase.co'
  clean.NEXT_PUBLIC_SUPABASE_ANON_KEY='build-placeholder-public-key'
  clean.NEXT_PUBLIC_SITE_URL='http://127.0.0.1:3000'
  clean.NEXT_TELEMETRY_DISABLED='1'
  return clean
}
function executeNpm(args,env){
  const windows=process.platform==='win32'
  const binary=windows?'cmd.exe':'npm'
  const fullArgs=windows?['/d','/s','/c',`npm ${args.join(' ')}`]:args
  const result=spawnSync(binary,fullArgs,{cwd:ROOT,encoding:'utf8',timeout:600000,maxBuffer:12*1024*1024,env,windowsHide:true,shell:false})
  const stdout=String(result.stdout||'').slice(-5000)
  const stderr=String(result.stderr||'').slice(-5000)
  if(stdout)process.stdout.write(stdout+'\n')
  if(stderr)process.stderr.write(stderr+'\n')
  return {status:result.error||result.status!==0?'FALHOU':'PASSOU',exit_code:result.status??null,error:result.error?.code||null,stdout_tail:stdout,stderr_tail:stderr}
}
export function webPlan(){return {mode:'plano',steps:WEB_STEPS.map(([name,args])=>({name,args})),note:'Plano sem npm ci/build executados.'}}
function run(){
  if(!process.argv.includes('--execute')){console.log(JSON.stringify(webPlan(),null,2));return}
  const env=safeBuildEnvironment(process.env)
  const source=sourceFingerprint()
  const steps=[]
  for(const [name,args] of WEB_STEPS){
    console.log('\n[R19 web] '+name)
    const result=executeNpm(args,env)
    steps.push({name,...result})
    if(result.status!=='PASSOU')break
  }
  const report={round:'R19',source,steps,verdict:steps.length===WEB_STEPS.length&&steps.every(s=>s.status==='PASSOU')?'BUILD_WEB_LOCAL_APROVADO':'BLOQUEADA',
    caveat:'Nao executou login/Playwright, PostgreSQL ou deploy. Apenas build local com variaveis publicas ficticias.'}
  const out=path.join(ROOT,'relatorios-testes','r19-web-evidence.json')
  fs.mkdirSync(path.dirname(out),{recursive:true})
  fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{mode:0o600})
  console.log('\nResultado R19:',report.verdict,'|',path.relative(ROOT,out))
  if(report.verdict!=='BUILD_WEB_LOCAL_APROVADO')process.exitCode=2
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run()
