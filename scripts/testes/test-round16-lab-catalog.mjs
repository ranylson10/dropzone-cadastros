// Teste OFFLINE do importador R16: nao usa o ZIP privado nem banco externo.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { extractCatalog, importCatalog } from '../release/importar-catalogo-original.mjs'
import { shouldPackage } from '../release/empacotar-fonte.mjs'

const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dropzone-r16-'))
let count=0
function crc32(buffer){let c=0xffffffff;for(const byte of buffer){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function makeZip(filepath,entries){
  const chunks=[],central=[];let offset=0,centralSize=0
  for(const {name,data,compression=8,corruptCrc=false} of entries){
    const key=Buffer.from(name),buf=Buffer.isBuffer(data)?data:Buffer.from(data)
    const zipped=compression===8?zlib.deflateRawSync(buf):buf
    const crc=crc32(buf)^(corruptCrc?1:0)
    const l=Buffer.alloc(30);l.writeUInt32LE(0x04034b50,0);l.writeUInt16LE(20,4);l.writeUInt16LE(compression,8)
    l.writeUInt32LE(crc>>>0,14);l.writeUInt32LE(zipped.length,18);l.writeUInt32LE(buf.length,22);l.writeUInt16LE(key.length,26)
    chunks.push(l,key,zipped)
    const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(compression,10)
    c.writeUInt32LE(crc>>>0,16);c.writeUInt32LE(zipped.length,20);c.writeUInt32LE(buf.length,24)
    c.writeUInt16LE(key.length,28);c.writeUInt32LE(offset,42)
    central.push(c,key);centralSize+=c.length+key.length;offset+=l.length+key.length+zipped.length
  }
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10)
  end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16)
  fs.writeFileSync(filepath,Buffer.concat([...chunks,...central,end]))
}
const sample={generated_at:'2026-10-11T02:46:22.783601Z',tables:Array.from({length:30},(_,i)=>({table_schema:'public',table_name:'example_'+i,table_type:'BASE TABLE'}))}
for(const name of ['columns','indexes','functions','constraints','triggers','policies','rls'])sample[name]=[{}]
const valid=JSON.stringify(sample)
const catalog='relatorios-testes\\banco-publicado.json'
const run=(name,data,opts={})=>{const p=path.join(folder,name);makeZip(p,[{name:opts.file||catalog,data,compression:opts.compression??8,corruptCrc:opts.corruptCrc??false}]);return p}
try {
  for(const method of [0,8]){
    const p=run(`valid-${method}.zip`,valid,{compression:method})
    const value=extractCatalog(p)
    assert.equal(value.summary.base_tables,30)
    assert.equal(value.buffer.toString(),valid)
    count+=2
  }
  const dest=path.join(folder,'output')
  const result=importCatalog(run('import.zip',valid),dest)
  assert.equal(result.output,'relatorios-testes/banco-publicado.json')
  assert.equal(fs.readFileSync(path.join(dest,result.output),'utf8'),valid)
  count+=2
  assert.equal(shouldPackage('relatorios-testes/banco-publicado.json'),false)
  assert.equal(shouldPackage('relatorios-testes/banco-inscricoes-2026-10-11/schema-reconstruction.sql'),false)
  count+=2
  assert.throws(()=>extractCatalog(run('bad-crc.zip',valid,{corruptCrc:true})),/CRC32/);count++
  assert.throws(()=>extractCatalog(run('wrong-name.zip',valid,{file:'../relatorios-testes/banco-publicado.json'})),/Catalogo nao encontrado/);count++
  assert.throws(()=>extractCatalog(run('invalid-json.zip','not-json')),SyntaxError);count++
  assert.throws(()=>extractCatalog(run('missing-metadata.zip',JSON.stringify({tables:[]}))),/Catalogo incompleto/);count++
  const duplicate=path.join(folder,'duplicate.zip');makeZip(duplicate,[{name:catalog,data:valid},{name:catalog,data:valid}])
  assert.throws(()=>extractCatalog(duplicate),/duplicado/);count++
  fs.writeFileSync(path.join(folder,'empty.zip'),Buffer.from('not-a-zip'))
  assert.throws(()=>extractCatalog(path.join(folder,'empty.zip')),/ZIP/);count++
  const schema=fs.readFileSync(new URL('./postgres-inscricoes/build-schema.mjs',import.meta.url),'utf8')
  assert.ok(schema.indexOf('fs.mkdirSync(directory,{recursive:true})') < schema.indexOf("fs.writeFileSync(directory+'/schema-reconstruction.sql'"))
  count++
  console.log(`R16: ${count} verificacoes offline aprovadas (catalogo real nunca entra na distribuicao).`)
}finally{fs.rmSync(folder,{recursive:true,force:true})}
