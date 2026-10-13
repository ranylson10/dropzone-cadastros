import fs from 'node:fs'
import { spawn } from 'node:child_process'
export const container='dropzone-audit-inscricoes-01a128'
export const directory=process.env.DROPZONE_FIXTURE_EVIDENCE_DIRECTORY||'relatorios-testes/banco-inscricoes-2026-10-11'
if(!/^relatorios-testes\/[a-z0-9-]+$/.test(directory))throw new Error('Fixture evidence must stay in a workspace report directory.')
let labVerified
function verifyLab(){
  labVerified??=new Promise((resolve,reject)=>{
    const child=spawn('docker',['inspect','--format','{{json .Config.Labels}}|{{.HostConfig.NetworkMode}}|{{.State.Status}}|{{.Config.Image}}|{{.Id}}',container],{windowsHide:true,stdio:['ignore','pipe','pipe']})
    let output='';const timer=setTimeout(()=>{child.kill();reject(new Error('Fixture container validation timed out.'))},15000)
    child.stdout.on('data',chunk=>output+=chunk)
    child.on('error',error=>{clearTimeout(timer);reject(error)})
    child.on('close',code=>{
      clearTimeout(timer)
      try{const [labels,network,status,image,identity]=output.trim().split('|');const parsed=JSON.parse(labels)
        if(code!==0||parsed['dropzone.audit']!=='inscricoes-20261011'||network!=='none'||status!=='running'||image!=='postgres:17.6')throw new Error('Only the labeled, network-isolated synthetic PostgreSQL container is allowed.')
        if(['relatorios-testes/progressao-transacao-2026-10-12','relatorios-testes/season-transacao-2026-10-12','relatorios-testes/diario-vinculo-2026-10-12','relatorios-testes/edicao-franquia-2026-10-12','relatorios-testes/lifecycle-transacao-2026-10-12','relatorios-testes/estrutura-grupo-2026-10-12'].includes(directory)){
          const owned=JSON.parse(fs.readFileSync(directory+'/lab-identity.json','utf8').replace(/^\uFEFF/,''))
          if(identity!==owned.containerId||parsed['dropzone.run']!==owned.runKey)throw new Error('Owned progression lab identity changed.')
        }
        resolve()}
      catch(error){reject(error)}
    })
  })
  return labVerified
}
export async function sql(text,{database=process.env.DROPZONE_FIXTURE_DB||'dropzone_audit',timeout=30000}={}) {
  if(!/^dropzone_(audit|validation_[a-z0-9_]+)$/.test(database))throw new Error('Only isolated fixture database names are allowed.')
  await verifyLab()
  return new Promise((resolve,reject)=>{
    const child=spawn('docker',['exec','-i',container,'psql','--no-psqlrc','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-qAt'],{windowsHide:true,stdio:['pipe','pipe','pipe']})
    let out='',err='';const timer=setTimeout(()=>{child.kill();reject(new Error('Local PostgreSQL test timeout.'))},timeout)
    child.stdout.on('data',chunk=>out+=chunk);child.stderr.on('data',chunk=>err+=chunk)
    child.on('error',error=>{clearTimeout(timer);reject(error)})
    child.on('close',code=>{clearTimeout(timer);code===0?resolve(out.trim()):reject(Object.assign(new Error(err.trim()),{stdout:out,code}))})
    child.stdin.end(text)
  })
}
export async function runFile(path){return sql(fs.readFileSync(path,'utf8'))}
