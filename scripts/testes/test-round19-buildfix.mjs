import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {fileURLToPath} from 'node:url'
import {safeBuildEnvironment} from '../release/round19-web-check.mjs'
import {validateOriginalZip} from '../release/round19-check-catalog-zip.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
let checks=0
const ok=(condition,label)=>{assert.ok(condition,label);checks++}
for(const kind of ['campeonatos','equipes','jogadores','produtoras','managers']){
  const src=fs.readFileSync(path.join(root,'web/app',kind,'page.tsx'),'utf8')
  ok(/export const dynamic\s*=\s*['"]force-dynamic['"]/.test(src),kind+': pagina nao prerenderiza contra Supabase ficticio')
  ok(!/export const revalidate\s*=/.test(src),kind+': revalidate de segmento nao contradiz dynamic')
}
const server=fs.readFileSync(path.join(root,'web/features/directory/server.ts'),'utf8')
ok(server.includes('unstable_cache')&&server.includes('revalidate: 30'),'diretorios preservam cache do resultado no servidor')
// O teste de remocao precisa de um diretorio SEM .env; no computador real
// pode existir .env.local e nesse caso as chaves sao substituidas por placeholders.
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dzp-buildfix-env-'))
try{
 const raw={NEXT_PUBLIC_SUPABASE_URL:'https://producao.example',SUPABASE_SERVICE_ROLE_KEY:'secret',DATABASE_URL:'postgres://real'}
 const clean=safeBuildEnvironment(raw,tmp)
 ok(clean.NEXT_PUBLIC_SUPABASE_URL==='https://build-placeholder.supabase.co','build usa endpoint publico ficticio')
 ok(!Object.hasOwn(clean,'SUPABASE_SERVICE_ROLE_KEY')&&!Object.hasOwn(clean,'DATABASE_URL'),'segredos herdados removidos sem arquivos .env')
 fs.mkdirSync(path.join(tmp,'web'))
 fs.writeFileSync(path.join(tmp,'web','.env.local'),'SUPABASE_SERVICE_ROLE_KEY=PRODUCTION_SECRET\nDATABASE_URL=postgresql://production\nNEXT_PUBLIC_SUPABASE_URL=https://production.supabase.co\n')
 const protectedEnv=safeBuildEnvironment(raw,tmp)
 ok(protectedEnv.SUPABASE_SERVICE_ROLE_KEY==='build-placeholder-disabled','credencial de .env.local protegida durante build')
 ok(protectedEnv.DATABASE_URL==='postgresql://disabled:disabled@127.0.0.1:1/disabled','endereco de banco .env.local impede producao')
 ok(protectedEnv.NEXT_PUBLIC_SUPABASE_URL==='https://build-placeholder.supabase.co','url publica de .env.local substituida')
 ok(!Object.values(protectedEnv).includes('secret')&&!Object.values(protectedEnv).includes('postgres://real'),'nenhum segredo original permanece no ambiente de teste')
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
const bat=fs.readFileSync(path.join(root,'HOMOLOGAR_POSTGRES_R19.bat'),'utf8')
ok(bat.includes('dropzone-cadastros-ENVIO.zip')&&bat.includes('ZIP_ORIGINAL'),'laboratorio exige ZIP original')
ok(bat.includes('round19-check-catalog-zip.mjs')&&bat.indexOf('round19-check-catalog-zip.mjs')<bat.indexOf('Confirma a criacao'),'ZIP validado antes da confirmacao Docker')
assert.throws(()=>validateOriginalZip('HOMOLOGAR_POSTGRES_R19.bat'),/\.zip ORIGINAL/);checks++
assert.throws(()=>validateOriginalZip(path.join(os.tmpdir(),'arquivo-inexistente.zip')),/nao encontrado/);checks++
const zipInvalid=path.join(os.tmpdir(),'dzp-r19-invalid-'+process.pid+'.zip')
try{fs.writeFileSync(zipInvalid,'nao sou zip');assert.throws(()=>validateOriginalZip(zipInvalid),/ZIP|indice/i);checks++}
finally{fs.rmSync(zipInvalid,{force:true})}

console.log('R19 buildfix: '+checks+' verificacoes locais aprovadas; build integral deve rodar no Windows.')
