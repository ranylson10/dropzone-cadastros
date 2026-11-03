// R17: checks without Docker, network, production connections or database writes.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {parseLabInspect,createLabIdentityGuard,container,sql} from './postgres-inscricoes/docker-lab.mjs'
const good='a'.repeat(64), other='b'.repeat(64)
const labels={'dropzone.audit':'inscricoes-20261011'}
const inspection=({l=labels,network='none',status='running',image='postgres:17.6',id=good}={})=>
  `${JSON.stringify(l)}|${network}|${status}|${image}|${id}`
let checks=0
const equal=(actual,expected)=>{assert.equal(actual,expected);checks++}
const invalid=(raw)=>{assert.throws(()=>parseLabInspect(raw));checks++}
const rejects=async(fn,regex)=>{await assert.rejects(fn,regex);checks++}
equal(container,'dropzone-audit-inscricoes-01a128')
equal(parseLabInspect(inspection()),good)
invalid(inspection({l:{'dropzone.audit':'fake'}}))
invalid(inspection({l:{'dropzone.audit':'inscricoes-20261011','dropzone.run':'evil'},network:'bridge'}))
invalid(inspection({status:'exited'}))
invalid(inspection({image:'postgres:latest'}))
invalid(inspection({id:'short'}))
invalid(inspection({id:'not-hex'.repeat(8)}))
invalid('not-json|none|running|postgres:17.6|'+good)
invalid('[]|none|running|postgres:17.6|'+good)
invalid('null|none|running|postgres:17.6|'+good)
invalid('')
invalid(inspection()+'|extra')
invalid(inspection().replace('|none|','|host|'))
let calls=0
const guard=createLabIdentityGuard(async()=>{calls++;return inspection()})
equal(await guard(),good)
equal(await guard(),good)
equal(calls,2) // NO cached positive result
const moved=createLabIdentityGuard(async()=>++calls%2===0?inspection({id:other}):inspection())
equal(await moved(),good)
await rejects(()=>moved(),/identity changed/)
const unavailable=createLabIdentityGuard(async()=>{throw new Error('Docker unavailable')})
await rejects(()=>unavailable(),/Docker unavailable/)
const invalidState=createLabIdentityGuard(async()=>inspection({status:'paused'}))
await rejects(()=>invalidState(),/Only the labeled/)
await rejects(()=>sql('select 1',{database:'production'}),/Only isolated fixture database names/)
await rejects(()=>sql('select 1',{database:'dropzone_validation_bad; drop database'}),/Only isolated fixture database names/)
const source=fs.readFileSync(new URL('./postgres-inscricoes/docker-lab.mjs',import.meta.url),'utf8')
assert.ok(source.includes("['exec','-i',identity,'psql'"));checks++
assert.ok(source.includes('const identity=await verifyLab()'));checks++
assert.ok(!source.includes('labVerified??='));checks++
console.log(`R17: ${checks} verificacoes offline de identidade e seguranca do laboratorio aprovadas.`)
