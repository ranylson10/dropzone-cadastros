import {operationJson,operationUuid} from './operation-json'
export type OperationAttempt<T> = {requestId:string;storageKey:string;body:T}
export type OperationStorage = {get:(key:string)=>Promise<string|null>;set:(key:string,value:string)=>Promise<void>;
  remove:(key:string)=>Promise<void>;hash:(value:string)=>Promise<string>;uuid:()=>string}
export function createOperationAttempts<T extends Record<string,any>>(namespace:string,label:string,normalize:(value:Record<string,any>)=>T,storage:OperationStorage){
  if(!/^[a-z_]+$/.test(namespace))throw new Error('Invalid operation namespace')
  const preparing=new Map<string,Promise<OperationAttempt<T>>>()
  const key=async(actor:string,champ:string)=>`dz.${namespace}.v1.`+await storage.hash(JSON.stringify([1,operationUuid(actor),operationUuid(champ)]))
  async function parse(value:string,storageKey:string){const record=JSON.parse(value),body=normalize(record.body),requestId=operationUuid(record.requestId)
    if(record.version!==1||record.digest!==await storage.hash(operationJson([storageKey,requestId,body])))throw new Error('Invalid record')
    return{body,requestId,storageKey}}
  async function read(actor:string,champ:string){try{const storageKey=await key(actor,champ),value=await storage.get(storageKey);return value?await parse(value,storageKey):null}
    catch{throw new Error(`Não foi possível ler a ${label} pendente. Verifique o armazenamento.`)}}
  async function prepare(actor:string,champ:string,value:Record<string,any>){const body=normalize(value);let storageKey:string
    try{storageKey=await key(actor,champ)}catch{throw new Error(`Não foi possível guardar a ${label}. Verifique o armazenamento.`)}
    let operation=preparing.get(storageKey)
    if(!operation){operation=(async()=>{try{const saved=await storage.get(storageKey);if(saved)return await parse(saved,storageKey)
      const requestId=operationUuid(storage.uuid()),digest=await storage.hash(operationJson([storageKey,requestId,body])),record=JSON.stringify({version:1,requestId,body,digest})
      await storage.set(storageKey,record);if(await storage.get(storageKey)!==record)throw new Error('Not persisted');return{body,requestId,storageKey}
    }catch{throw new Error(`Não foi possível guardar a ${label}. Verifique o armazenamento.`)}})();preparing.set(storageKey,operation)}
    try{const attempt=await operation;if(operationJson(attempt.body)!==operationJson(body))throw new Error(`Confirme a ${label} pendente antes de iniciar outra.`);return attempt}
    finally{if(preparing.get(storageKey)===operation)preparing.delete(storageKey)}}
  async function discard(attempt:OperationAttempt<T>){const saved=await storage.get(attempt.storageKey)
    if(saved&&(await parse(saved,attempt.storageKey)).requestId===attempt.requestId){await storage.remove(attempt.storageKey);if(await storage.get(attempt.storageKey))throw new Error('Não foi possível encerrar a tentativa. Verifique o armazenamento.')}}
  async function complete(attempt:OperationAttempt<T>){try{await discard(attempt)}catch{/* Original receipt remains replayable. */}}
  return{read,prepare,discard,complete}
}
