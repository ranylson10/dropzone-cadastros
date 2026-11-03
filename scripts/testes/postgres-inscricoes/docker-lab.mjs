// Laboratorio sintetico: somente contêiner identificado, sem rede e banco fixture.
// Reinspecione ANTES DE TODA operaçao e fixe o ID imutavel; nunca execute por nome.
import fs from 'node:fs'
import { spawn } from 'node:child_process'
export const container='dropzone-audit-inscricoes-01a128'
export const directory=process.env.DROPZONE_FIXTURE_EVIDENCE_DIRECTORY||'relatorios-testes/banco-inscricoes-2026-10-11'
if(!/^relatorios-testes\/[a-z0-9-]+$/.test(directory))throw new Error('Fixture evidence must stay in a workspace report directory.')

export function parseLabInspect(output){
  const parts=output.trim().split('|')
  if(parts.length!==5)throw new Error('Incomplete Docker inspection; refusing fixture access.')
  const [labels,network,status,image,identity]=parts
  let parsed
  try{parsed=JSON.parse(labels)}catch{throw new Error('Invalid Docker labels; refusing fixture access.')}
  if(!parsed||Array.isArray(parsed)||typeof parsed!=='object'||
    parsed['dropzone.audit']!=='inscricoes-20261011'||network!=='none'||
    status!=='running'||image!=='postgres:17.6'||!/^[a-f0-9]{64}$/.test(identity))
    throw new Error('Only the labeled, network-isolated synthetic PostgreSQL container is allowed.')
  if(['relatorios-testes/progressao-transacao-2026-10-12','relatorios-testes/season-transacao-2026-10-12','relatorios-testes/diario-vinculo-2026-10-12','relatorios-testes/edicao-franquia-2026-10-12','relatorios-testes/lifecycle-transacao-2026-10-12','relatorios-testes/estrutura-grupo-2026-10-12'].includes(directory)){
    const owned=JSON.parse(fs.readFileSync(directory+'/lab-identity.json','utf8').replace(/^\uFEFF/,''))
    if(identity!==owned.containerId||parsed['dropzone.run']!==owned.runKey)throw new Error('Owned progression lab identity changed.')
  }
  return identity
}

export function createLabIdentityGuard(inspect){
  let pinned=null
  return async()=>{
    // Do not cache a passing inspection: containers may be replaced or reconfigured.
    const inspected=parseLabInspect(await inspect())
    if(pinned!==null&&inspected!==pinned)throw new Error('Fixture container identity changed during validation; refusing SQL.')
    pinned=inspected
    return inspected
  }
}
function inspectDocker(){
  return new Promise((resolve,reject)=>{
    const child=spawn('docker',['inspect','--format','{{json .Config.Labels}}|{{.HostConfig.NetworkMode}}|{{.State.Status}}|{{.Config.Image}}|{{.Id}}',container],{windowsHide:true,stdio:['ignore','pipe','pipe']})
    let output='',stderr='',finished=false
    const settle=(err,result)=>{if(finished)return;finished=true;clearTimeout(timer);err?reject(err):resolve(result)}
    const timer=setTimeout(()=>{child.kill();settle(new Error('Fixture container validation timed out.'))},15000)
    child.stdout.on('data',chunk=>{output+=chunk;if(output.length>65536){child.kill();settle(new Error('Docker inspect output too large.'))}})
    child.stderr.on('data',chunk=>{stderr+=chunk})
    child.on('error',error=>settle(error))
    child.on('close',code=>{if(code!==0)settle(new Error('Docker inspect failed: '+stderr.slice(0,256)));else settle(null,output)})
  })
}
const verifyLab=createLabIdentityGuard(inspectDocker)
export async function sql(text,{database=process.env.DROPZONE_FIXTURE_DB||'dropzone_audit',timeout=30000}={}) {
  if(!/^dropzone_(audit|validation_[a-z0-9_]+)$/.test(database))throw new Error('Only isolated fixture database names are allowed.')
  const identity=await verifyLab()
  // Use the inspected container's immutable ID, never its reusable name.
  return new Promise((resolve,reject)=>{
    const child=spawn('docker',['exec','-i',identity,'psql','--no-psqlrc','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-qAt'],{windowsHide:true,stdio:['pipe','pipe','pipe']})
    let out='',err='',finished=false
    const settle=(error,result)=>{if(finished)return;finished=true;clearTimeout(timer);error?reject(error):resolve(result)}
    const timer=setTimeout(()=>{child.kill();settle(new Error('Local PostgreSQL test timeout.'))},timeout)
    child.stdout.on('data',chunk=>out+=chunk)
    child.stderr.on('data',chunk=>err+=chunk)
    child.on('error',error=>settle(error))
    child.on('close',code=>{code===0?settle(null,out.trim()):settle(Object.assign(new Error(err.trim()||'Docker exec failed'),{stdout:out,code}))})
    child.stdin.on('error',error=>settle(error))
    child.stdin.end(text)
  })
}
export async function runFile(file){return sql(fs.readFileSync(file,'utf8'))}
