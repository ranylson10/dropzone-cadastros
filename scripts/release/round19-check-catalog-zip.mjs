// Valida um ZIP original antes de solicitar a criacao do laboratorio Docker.
// Le somente o catalogo historico, sem extrair documentos ou usar rede.
import path from 'node:path'
import fs from 'node:fs'
import {fileURLToPath} from 'node:url'
import {extractCatalog} from './importar-catalogo-original.mjs'

export function validateOriginalZip(filename){
  if(typeof filename!=='string'||!filename.trim()||!/\.zip$/i.test(filename))
    throw new Error('Informe o caminho de um arquivo .zip ORIGINAL, nao o nome do .bat.')
  const absolute=path.resolve(filename.trim())
  if(!fs.existsSync(absolute)||!fs.statSync(absolute).isFile())
    throw new Error('ZIP original nao encontrado. Informe o caminho completo de dropzone-cadastros-ENVIO.zip.')
  const result=extractCatalog(absolute)
  if(result.summary.base_tables<100)
    throw new Error('Catalogo estrutural incompleto: o arquivo nao corresponde ao ZIP original esperado.')
  return result.summary
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const summary=validateOriginalZip(process.argv[2])
    console.log(`ZIP original validado: ${summary.base_tables} tabelas, catalogo de ${summary.generated_at}.`)
  }catch(error){
    console.error('ZIP INVALIDO:',error.message)
    process.exitCode=1
  }
}
