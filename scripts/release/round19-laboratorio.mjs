// R19: executable LAB ONLY, with fail-closed Docker isolation and real evidence.
// Never reads production DB env vars, never connects to a host/port, never deletes containers.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseLabInspect, container } from '../testes/postgres-inscricoes/docker-lab.mjs'

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const reportDir=path.join(ROOT,'relatorios-testes')
const originalCatalog=path.join(reportDir,'banco-publicado.json')
const commands=Object.freeze({
  import:['scripts/release/importar-catalogo-original.mjs'],
  schema:['scripts/testes/postgres-inscricoes/build-schema.mjs'],
  fresh:['scripts/testes/postgres-inscricoes/fresh-validation.mjs'],
  validate:['scripts/testes/postgres-inscricoes/validate-native.mjs'],
})
const required=['tables','columns','indexes','functions','constraints','triggers','policies','rls']
export function verifyLocalCatalog(filename=originalCatalog){
  const parsed=JSON.parse(fs.readFileSync(filename,'utf8'))
  if(!required.every(k=>Array.isArray(parsed[k])&&parsed[k].length)||
    !Number.isFinite(Date.parse(parsed.generated_at)) ||
    parsed.tables.filter(t=>t.table_schema==='public'&&t.table_type==='BASE TABLE').length<100)
    throw new Error('Catalogo local insuficiente para fixture sintetica.')
  return {generated_at:parsed.generated_at,base_tables:parsed.tables.filter(t=>t.table_schema==='public'&&t.table_type==='BASE TABLE').length}
}
export function assertNoRemoteDbTarget(env){
  // Do NOT inherit application secrets in child processes executing arbitrary build code.
  const clean={...env}
  for(const key of Object.keys(clean)){
    if(/(?:SUPABASE|POSTGRES|DATABASE|DB_URL|DB_HOST|DB_PASSWORD|PGHOST|PGPASSWORD|PGSERVICE|PGPORT|PGUSER|DOCKER_HOST|DOCKER_CONTEXT)/i.test(key))delete clean[key]
  }
  clean.DROPZONE_FIXTURE_DB='dropzone_audit'
  return clean
}
export function verifyLabInspection(stdout){return parseLabInspect(stdout)}
export function verifyLocalDockerEndpoint(raw){
  const endpoint=String(raw||'').trim()
  if (!/^(?:unix:\/\/\/(?:var\/run\/docker\.sock|run\/user\/\d+\/docker\.sock)|npipe:\/{4}\.\/pipe\/(?:docker_engine|dockerDesktopLinuxEngine))$/.test(endpoint))
    throw new Error('Docker remoto ou contexto desconhecido recusado. Selecione Docker Desktop/local.')
  return endpoint
}
export function reportStatus(steps){
  return steps.every(s=>s.status==='PASSOU')?'TESTES_NATIVOS_APROVADOS_EM_FIXTURE':'LABORATORIO_NAO_HOMOLOGADO'
}
function call(command,args=[],{timeout=120000,cwd=ROOT,env}={}){
  const result=spawnSync(command,args,{cwd,env:env||process.env,encoding:'utf8',timeout,windowsHide:true,maxBuffer:12*1024*1024,shell:false})
  return {ok:result.status===0&&!result.error,exit:result.status,stdout:(result.stdout||'').slice(-5000),stderr:(result.stderr||'').slice(-5000),error:result.error?.code||null}
}
function docker(args,opts={}){return call('docker',args,opts)}
function node(file,args=[],opts={}){return call(process.execPath,[file,...args],opts)}
function inspect(){
  return docker(['inspect','--format','{{json .Config.Labels}}|{{.HostConfig.NetworkMode}}|{{.State.Status}}|{{.Config.Image}}|{{.Id}}',container],{timeout:12000})
}
export function runLab({zipPath,runTag,execute=false,invoke=({binary,args,options})=>call(binary,args,options)}={}){
  if(runTag&&!/^[0-9]{8}_[0-9]{6}_[a-f0-9]{6}$/.test(runTag))throw new Error('Identificador de rodada invalido.')
  runTag ||= new Date().toISOString().replace(/[-:]/g,'').replace('T','_').slice(0,15)+'_'+crypto.randomBytes(3).toString('hex')
  const dbName='dropzone_validation_r19_'+runTag
  const steps=[]
  const run=(name,binary,args=[],options={})=>{
    if(!execute){steps.push({name,status:'PLANEJADO',command:path.basename(binary),args});return {ok:true,stdout:''}}
    const result=invoke({binary,args,options:{cwd:ROOT,timeout:options.timeout||120000,env:options.env||assertNoRemoteDbTarget(process.env)}})
    steps.push({name,status:result.ok?'PASSOU':'FALHOU',exit_code:result.exit??null,stderr:result.stderr||null,error:result.error||null})
    if(!result.ok)throw new Error(name+' falhou. '+(result.stderr||result.error||'').slice(0,240))
    return result
  }
  // Docker operations are never executed in plan mode.
  if(!execute){
    if(zipPath)run('importar_catalogo_original',process.execPath,[commands.import[0],path.resolve(zipPath)])
    run('docker_endpoint','docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'])
    run('docker_info','docker',['info','--format','{{.ServerVersion}}'])
    run('iniciar_postgres_sintetico','docker',['run','-d','--name',container,'--label','dropzone.audit=inscricoes-20261011','--network','none','--memory','512m','--cpus','2','-e','POSTGRES_PASSWORD=synthetic_fixture_only','-e','POSTGRES_DB=dropzone_audit','postgres:17.6'])
    run('reconstruir_esquema',process.execPath,[commands.schema[0]])
    run('novo_banco_sintetico',process.execPath,[commands.fresh[0],dbName])
    run('transacoes_concorrentes_nativas',process.execPath,[commands.validate[0],'55000'])
    return {mode:'plano_sem_execucao',database:dbName,steps,notice:'Este plano nao executou nenhum teste; exige Docker e catalogo original.'}
  }
  let error=null,catalog=null
  try{
    if(zipPath){
      if(!fs.existsSync(zipPath))throw new Error('ZIP original nao encontrado.')
      run('importar_catalogo_original',process.execPath,[commands.import[0],path.resolve(zipPath)])
    }
    catalog=verifyLocalCatalog()
    const endpoint=run('docker_endpoint','docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{timeout:15000})
    verifyLocalDockerEndpoint(endpoint.stdout)
    const dockerInfo=run('docker_info','docker',['info','--format','{{.ServerVersion}}'],{timeout:15000})
    if(!dockerInfo.stdout.trim())throw new Error('Docker Engine sem resposta.')
    // Refuse existing containers even if labeled: the reconstruction must begin with a pristine database.
    const existing=invoke({binary:'docker',args:['inspect','--format','{{json .Config.Labels}}|{{.HostConfig.NetworkMode}}|{{.State.Status}}|{{.Config.Image}}|{{.Id}}',container],options:{cwd:ROOT,timeout:12000,env:assertNoRemoteDbTarget(process.env)}})
    if(existing.ok){
      // Validate identity for diagnostics, but NEVER reuse or delete an existing DB.
      verifyLabInspection(existing.stdout)
      throw new Error('Laboratorio anterior ja existe. Nao vou sobrescrever seus dados. Remova manualmente o container de teste apos guardar as evidencias.')
    }
    // Inspect failure could also mean daemon failure. Confirm absence separately.
    const names=run('listar_conteineres','docker',['ps','-a','--format','{{.Names}}'],{timeout:15000}).stdout.split(/\r?\n/)
    if(names.includes(container))throw new Error('Container com nome reservado existente, mas identidade nao validada.')
    run('iniciar_postgres_sintetico','docker',['run','-d','--name',container,'--label','dropzone.audit=inscricoes-20261011','--network','none','--memory','512m','--cpus','2','-e','POSTGRES_PASSWORD=synthetic_fixture_only','-e','POSTGRES_DB=dropzone_audit','postgres:17.6'],{timeout:120000})
    const newContainer=run('conferir_identidade','docker',['inspect','--format','{{json .Config.Labels}}|{{.HostConfig.NetworkMode}}|{{.State.Status}}|{{.Config.Image}}|{{.Id}}',container],{timeout:15000})
    const id=verifyLabInspection(newContainer.stdout)
    let ready=false
    for(let i=0;i<30;i++){
      const state=invoke({binary:'docker',args:['exec',id,'pg_isready','-U','postgres','-d','dropzone_audit'],options:{cwd:ROOT,timeout:12000,env:assertNoRemoteDbTarget(process.env)}})
      if(state.ok){ready=true;break}
      // short bounded spin; pg_isready itself is quick, no external services used.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000)
    }
    if(!ready)throw new Error('PostgreSQL isolado nao ficou pronto em 30 verificacoes.')
    steps.push({name:'postgres_pronto',status:'PASSOU'})
    run('reconstruir_esquema',process.execPath,[commands.schema[0]],{timeout:180000})
    run('novo_banco_sintetico',process.execPath,[commands.fresh[0],dbName],{timeout:180000})
    run('transacoes_concorrentes_nativas',process.execPath,[commands.validate[0],'55000'],{timeout:300000,env:{...assertNoRemoteDbTarget(process.env),DROPZONE_FIXTURE_DB:dbName}})
  }catch(e){error=String(e?.message||e)}
  const report={round:'R19',mode:'postgres_sintetico_local',catalog,run_tag:runTag,database:dbName,
    verdict:error?'BLOQUEADA':reportStatus(steps),error,steps,
    production_writes:0,scope:'Somente PostgreSQL 17 isolado com dados ficticios; nao certifica schema Supabase atual, integracoes nem producao.'}
  fs.mkdirSync(reportDir,{recursive:true})
  const output=path.join(reportDir,`r19-laboratorio-${runTag}.json`)
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{mode:0o600})
  return {...report,output:path.relative(ROOT,output)}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const execute=process.argv.includes('--execute')
  const zip=process.argv.filter(x=>!x.startsWith('--'))[2]||undefined
  try{
    const result=runLab({zipPath:zip,execute})
    console.log(JSON.stringify(result,null,2))
    if(execute&&result.verdict!=='TESTES_NATIVOS_APROVADOS_EM_FIXTURE')process.exitCode=2
  }catch(error){console.error('R19:',error.message);process.exitCode=1}
}
