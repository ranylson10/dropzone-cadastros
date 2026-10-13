import * as Crypto from 'expo-crypto'
import {dropzoneFetch} from './api'
import {championshipSession} from './championship-session'
import {secureStorage} from './secureStorage'
import {createOperationAttempts, type OperationAttempt} from '../../../backend/src/shared/operation-attempt'
import {operationJson,operationUuid} from '../../../backend/src/shared/operation-json'
import {runChampionshipOperation} from '../../../backend/src/campeonatos/championship-operation'
import {assertStructureGroupResponse,structureGroupIntent,structureGroupValues,type StructureGroupIntent,type StructureGroupReadContract} from '../../../backend/src/campeonatos/structure-group-contract'
export type {StructureGroupIntent,StructureGroupReadContract}
export type MobileGroupAttempt=OperationAttempt<StructureGroupIntent>
type Current=()=>void
export const mobileGroupAttempts=createOperationAttempts('structure_group','criação de grupo',structureGroupIntent,{
 get:key=>secureStorage.getItem(key),set:(key,value)=>secureStorage.setItem(key,value),remove:key=>secureStorage.removeItem(key),
 hash:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,value),uuid:()=>Crypto.randomUUID(),
})
export async function readMobileGroupBoard(champ:string,actor:string,assertCurrent:Current,signal?:AbortSignal){
 champ=operationUuid(champ);actor=operationUuid(actor)
 const session=await championshipSession(actor);assertCurrent()
 const body=await dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(champ)}/estrutura`,{accessToken:session.token,cache:'no-store',signal,timeoutMs:15000})
 await championshipSession(actor);assertCurrent()
 if(!body||!Array.isArray(body.fases)||body.fases.length>1000)throw Error('Estrutura inválida. Atualize o campeonato.')
 const phases: Array<{id:string;nome:string;tipo:'normal'|'grande_final'}>=body.fases.map((row:any)=>{
  const id=operationUuid(row.id)
  if(typeof row.nome!=='string'||!row.nome.trim()||!['normal','grande_final'].includes(row.tipo)||row.campeonato_id!=null&&row.campeonato_id!==champ)throw Error('Fase inválida para este campeonato.')
  return {id,nome:row.nome,tipo:row.tipo as 'normal'|'grande_final'}
 })
 if(new Set(phases.map((row:any)=>row.id)).size!==phases.length)throw Error('Estrutura inválida. Atualize o campeonato.')
 const atomic=body.structure_group_write_mode==='atomic'&&body.permission?.canOrganizeGroups===true
 if(atomic&&body.structure_group_actor_id!==actor)throw Error('A conta mudou. Atualize a estrutura.')
 return {phases,contract:{structure_group_write_mode:atomic?'atomic':'legacy',structure_group_actor_id:actor} satisfies StructureGroupReadContract}
}
async function send(champ:string,actor:string,requestId:string,body:Record<string,any>,assertCurrent:Current){
 const session=await championshipSession(actor);assertCurrent()
 const result=await dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(champ)}/estrutura/grupo-atomico`,{
  method:'POST',cache:'no-store',accessToken:session.token,timeoutMs:35000,headers:{'Idempotency-Key':requestId},body:JSON.stringify(body),
 })
 assertStructureGroupResponse(result,actor,champ,requestId,body.action,structureGroupValues(body));return result
}
export async function writeMobileGroup(champ:string,actor:string,contract:StructureGroupReadContract,value:Record<string,any>,assertCurrent:Current){
 champ=operationUuid(champ);actor=operationUuid(actor)
 if(contract.structure_group_write_mode!=='atomic'||contract.structure_group_actor_id!==actor)throw Error('Criação de grupo temporariamente indisponível.')
 const values=structureGroupValues(value);await championshipSession(actor);assertCurrent()
 return runChampionshipOperation(actor,champ,operationJson(['structure_group',values]),true,async()=>{
  if(await mobileGroupAttempts.read(actor,champ))throw Error('Repita ou encerre a tentativa original antes de criar outro grupo.')
  const preview=await send(champ,actor,operationUuid(Crypto.randomUUID()),{action:'preview_create_group',...values},assertCurrent)
  await championshipSession(actor);assertCurrent()
  const attempt=await mobileGroupAttempts.prepare(actor,champ,{action:'create_group',...values,expected:preview.preview.fence})
  const result=await send(champ,actor,attempt.requestId,attempt.body,assertCurrent)
  await mobileGroupAttempts.complete(attempt);await championshipSession(actor);assertCurrent();return result
 })
}
export async function retryMobileGroup(champ:string,actor:string,attempt:MobileGroupAttempt,assertCurrent:Current){
 champ=operationUuid(champ);actor=operationUuid(actor);await championshipSession(actor);assertCurrent()
 return runChampionshipOperation(actor,champ,operationJson(['structure_group-retry',attempt.requestId]),true,async()=>{
  const saved=await mobileGroupAttempts.read(actor,champ)
  if(!saved||saved.requestId!==attempt.requestId||saved.storageKey!==attempt.storageKey||operationJson(saved.body)!==operationJson(attempt.body))throw Error('A tentativa mudou. Atualize o acompanhamento.')
  const result=await send(champ,actor,saved.requestId,saved.body,assertCurrent)
  await mobileGroupAttempts.complete(saved);await championshipSession(actor);assertCurrent();return result
 })
}
export async function discardMobileGroup(champ:string,actor:string,attempt:MobileGroupAttempt,assertCurrent:Current){
 champ=operationUuid(champ);actor=operationUuid(actor);await championshipSession(actor);assertCurrent()
 return runChampionshipOperation(actor,champ,operationJson(['structure_group-discard',attempt.requestId]),false,async()=>{
  const saved=await mobileGroupAttempts.read(actor,champ)
  if(!saved||saved.requestId!==attempt.requestId||saved.storageKey!==attempt.storageKey||operationJson(saved.body)!==operationJson(attempt.body))throw Error('A tentativa mudou. Atualize o acompanhamento.')
  await championshipSession(actor);assertCurrent();await mobileGroupAttempts.discard(saved);assertCurrent()
 })
}
