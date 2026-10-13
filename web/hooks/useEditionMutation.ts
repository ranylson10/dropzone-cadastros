'use client'
import {useEffect,useRef,useState} from 'react'
import {useAccountResourceScope} from './useAccountResourceScope'
import {editionAttempts,writeEdition,notifyEditionAttempt} from '@/lib/edition-write'
import type {OperationAttempt} from '@backend/shared/operation-attempt'
import type {EditionIntent,EditionReadContract} from '@backend/campeonatos/edition-contract'
export function useEditionMutation(championship:string){
 const scope=useAccountResourceScope(championship),lock=useRef<number|null>(null)
 const [state,setState]=useState<{key:string;pending:OperationAttempt<EditionIntent>|null;error:string;busy:boolean;ready:boolean}>({key:'',pending:null,error:'',busy:false,ready:false})
 useEffect(()=>{let alive=true,revision=0
  const refresh=async()=>{if(!scope.actor)return;const attempt=++revision
   try{const pending=await editionAttempts.read(scope.actor,championship);if(alive&&revision===attempt)setState(previous=>({key:scope.key,pending,error:previous.key===scope.key?previous.error:'',busy:previous.key===scope.key&&previous.busy,ready:true}))}
   catch(error){if(alive&&revision===attempt)setState({key:scope.key,pending:null,error:error instanceof Error?error.message:'Falha ao ler a tentativa.',busy:false,ready:false})}}
  void refresh();const listener=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.actor===scope.actor&&detail?.championship===championship)void refresh()}
  window.addEventListener('dz:edition-attempt',listener);return()=>{alive=false;window.removeEventListener('dz:edition-attempt',listener)}
 },[scope.key,scope.actor,championship])
 const visible=state.key===scope.key?state:{pending:null,error:'',busy:false,ready:false}
 async function run(contract:EditionReadContract,body:Record<string,any>){if(!scope.actor||!visible.ready||!scope.isCurrent())throw new Error('Atualize o acompanhamento antes de confirmar.')
  if(lock.current===scope.epoch)throw new Error('Aguarde a confirmação em andamento.');lock.current=scope.epoch;setState(previous=>({...previous,key:scope.key,error:'',busy:true}))
  try{const result=await writeEdition(championship,contract,body,()=>{if(!scope.isCurrent())throw new Error('A conta ou o campeonato mudou. Consulte a tentativa anterior.')});if(!scope.isCurrent())throw new Error('Edição confirmada no campeonato anterior. Consulte aquele acompanhamento.');return result}
  catch(error){if(scope.isCurrent())setState(previous=>({...previous,key:scope.key,error:error instanceof Error?error.message:'Não foi possível confirmar.',busy:false}));throw error}
  finally{if(lock.current===scope.epoch)lock.current=null;if(scope.isCurrent())setState(previous=>({...previous,busy:false}))}}
 const retry=()=>{if(!visible.pending||!scope.actor)throw new Error('Nenhuma edição pendente.');return run({edition_write_mode:'atomic',edition_actor_id:scope.actor},visible.pending.body)}
 async function discard(){if(!visible.pending||visible.busy||!scope.isCurrent()||!scope.actor)return false
  try{await editionAttempts.discard(visible.pending);if(scope.isCurrent()){notifyEditionAttempt(scope.actor,championship);setState(previous=>({...previous,pending:null,error:''}));return true}}
  catch(error){if(scope.isCurrent())setState(previous=>({...previous,error:error instanceof Error?error.message:'Falha ao encerrar.'}))}return false}
 return{...visible,scope,run,retry,discard}
}
