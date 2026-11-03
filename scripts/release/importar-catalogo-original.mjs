// R16: extrai SOMENTE o catalogo estrutural do ZIP original, sem desempacotar
// sessoes, imagens ou outros arquivos. Nunca acessa rede nem um banco de dados.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const EXPECTED = 'relatorios-testes/banco-publicado.json'
const MAX_UNCOMPRESSED = 10 * 1024 * 1024
const MAX_DIRECTORY = 32 * 1024 * 1024
const SIGN = { eocd:0x06054b50, central:0x02014b50, local:0x04034b50 }
function readAt(fd, position, size) {
  if (size < 0 || !Number.isSafeInteger(position) || !Number.isSafeInteger(size)) throw new Error('Offsets invalidos no ZIP.')
  const b=Buffer.alloc(size)
  let done=0
  while(done<size){const n=fs.readSync(fd,b,done,size-done,position+done);if(!n)throw new Error('ZIP truncado.');done+=n}
  return b
}
function crc32(buffer) {
  let c=0xffffffff
  for(const byte of buffer){c^=byte;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0)}
  return (c^0xffffffff)>>>0
}
export function extractCatalog(zipFilename) {
  const fd=fs.openSync(zipFilename,'r')
  try {
    const bytes=fs.fstatSync(fd).size
    const tailLength=Math.min(bytes,65557)
    const tail=readAt(fd,bytes-tailLength,tailLength)
    let eocd=-1
    for(let i=tail.length-22;i>=0;i--){
      if(tail.readUInt32LE(i)===SIGN.eocd && i+22+tail.readUInt16LE(i+20)===tail.length){eocd=i;break}
    }
    if(eocd<0)throw new Error('Diretorio central do ZIP nao encontrado.')
    if(tail.readUInt16LE(eocd+4)!==0 || tail.readUInt16LE(eocd+6)!==0)throw new Error('ZIP multidisco nao suportado.')
    const entries=tail.readUInt16LE(eocd+10),size=tail.readUInt32LE(eocd+12),offset=tail.readUInt32LE(eocd+16)
    if(entries!==tail.readUInt16LE(eocd+8)||size>MAX_DIRECTORY||offset+size>bytes)throw new Error('Indice ZIP invalido ou grande demais.')
    const directory=readAt(fd,offset,size)
    let pos=0, found=null
    for(let i=0;i<entries;i++){
      if(pos+46>directory.length||directory.readUInt32LE(pos)!==SIGN.central)throw new Error('Indice ZIP corrompido.')
      const nameLen=directory.readUInt16LE(pos+28),extraLen=directory.readUInt16LE(pos+30),commentLen=directory.readUInt16LE(pos+32)
      const end=pos+46+nameLen+extraLen+commentLen
      if(end>directory.length)throw new Error('Entrada ZIP truncada.')
      const name=directory.subarray(pos+46,pos+46+nameLen).toString('utf8').replaceAll('\\','/')
      if(name===EXPECTED){
        if(found)throw new Error('Catalogo duplicado no ZIP.')
        found={flags:directory.readUInt16LE(pos+8),method:directory.readUInt16LE(pos+10),crc:directory.readUInt32LE(pos+16),compressed:directory.readUInt32LE(pos+20),uncompressed:directory.readUInt32LE(pos+24),local:directory.readUInt32LE(pos+42)}
      }
      pos=end
    }
    if(pos!==directory.length||!found)throw new Error('Catalogo nao encontrado ou diretorio ZIP invalido.')
    if(found.flags&1)throw new Error('Entrada criptografada nao suportada.')
    if(![0,8].includes(found.method)||found.uncompressed>MAX_UNCOMPRESSED||found.compressed>MAX_UNCOMPRESSED||!found.uncompressed)throw new Error('Tamanho ou compressao de catalogo invalida.')
    const local=readAt(fd,found.local,30)
    if(local.readUInt32LE(0)!==SIGN.local)throw new Error('Cabecalho local do catalogo invalido.')
    const dataStart=found.local+30+local.readUInt16LE(26)+local.readUInt16LE(28)
    if(dataStart+found.compressed>bytes)throw new Error('Conteudo do ZIP truncado.')
    const encoded=readAt(fd,dataStart,found.compressed)
    const buffer=found.method===8?zlib.inflateRawSync(encoded,{maxOutputLength:MAX_UNCOMPRESSED}):encoded
    if(buffer.length!==found.uncompressed || crc32(buffer)!==found.crc)throw new Error('Falha na integridade CRC32 do catalogo.')
    const parsed=JSON.parse(buffer.toString('utf8'))
    for(const key of ['tables','columns','indexes','functions','constraints','triggers','policies','rls']){
      if(!Array.isArray(parsed[key])||parsed[key].length===0)throw new Error(`Catalogo incompleto: ${key}`)
    }
    const base=parsed.tables.filter(x=>x.table_schema==='public'&&x.table_type==='BASE TABLE')
    if(base.length<30 || !Number.isFinite(Date.parse(parsed.generated_at)))throw new Error('Catalogo incompleto ou sem data de geracao.')
    return {buffer,summary:{generated_at:parsed.generated_at,base_tables:base.length,views:parsed.tables.filter(x=>x.table_type==='VIEW').length,sha256:crypto.createHash('sha256').update(buffer).digest('hex')}}
  }finally{fs.closeSync(fd)}
}
export function importCatalog(zipFilename,root=ROOT){
  const {buffer,summary}=extractCatalog(zipFilename)
  const destination=path.join(root,EXPECTED)
  fs.mkdirSync(path.dirname(destination),{recursive:true})
  fs.writeFileSync(destination,buffer,{mode:0o600,flag:'w'})
  return { ...summary, output:EXPECTED, note:'Dados de schema historicos; nao comprovam o estado atual nem autorizam implantacao.'}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(!process.argv[2])throw new Error('Uso: node scripts/release/importar-catalogo-original.mjs "CAMINHO_DO_ZIP_ORIGINAL"')
    console.log(JSON.stringify(importCatalog(path.resolve(process.argv[2])),null,2))
  }catch(error){console.error('Importacao nao realizada:',error.message);process.exitCode=1}
}
