'use client'
import {useEffect,useRef,useState} from 'react'
import {supabase} from '@/lib/supabase-browser'
import {readGroupChoiceAttempt,prepareGroupChoiceAttempt,completeGroupChoiceAttempt,discardGroupChoiceAttempt,type GroupChoiceIntent,type GroupChoiceAttempt} from '@/lib/group-choice-attempt'

export function useGroupChoiceMutation(championshipId:string,scope:'team'|'admin') {
  const [actor,setActor]=useState(''),[stored,setStored]=useState<{scope:string;attempt:GroupChoiceAttempt}|null>(null)
  const [status,setStatus]=useState<{scope:string;error:string;busy:boolean}|null>(null)
  const resource=JSON.stringify([actor,championshipId,scope]),current=useRef(resource);current.current=resource
  const lock=useRef<string|null>(null)
  useEffect(()=>{let active=true;void supabase.auth.getSession().then(({data})=>{if(active)setActor(data.session?.user?.id||'')})
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>{if(active)setActor(session?.user?.id||'')})
    return()=>{active=false;data.subscription.unsubscribe()}
  },[])
  useEffect(()=>{let active=true;if(actor&&championshipId)void readGroupChoiceAttempt(actor,championshipId,scope).then(attempt=>{
    if(active)setStored(attempt?{scope:resource,attempt}:null)
  }).catch(error=>{if(active)setStatus({scope:resource,error:error.message,busy:false})});return()=>{active=false}},[actor,championshipId,scope,resource])
  const pending=stored?.scope===resource?stored.attempt:null,busy=status?.scope===resource&&status.busy,error=status?.scope===resource?status.error:''
  async function run(value:GroupChoiceIntent) {
    if(!actor||current.current!==resource)throw new Error('Entre novamente para confirmar a escolha.')
    if(lock.current===resource)throw new Error('Aguarde a confirmação da escolha em andamento.')
    lock.current=resource;setStatus({scope:resource,error:'',busy:true})
    try{
      const {data}=await supabase.auth.getSession(),session=data.session
      if(session?.user?.id!==actor||!session.access_token)throw new Error('A conta mudou. Entre novamente antes de confirmar.')
      const attempt=await prepareGroupChoiceAttempt(actor,championshipId,scope,value)
      if(current.current!==resource)throw new Error('O campeonato ou a conta mudou. Confirme no acompanhamento anterior.')
      setStored({scope:resource,attempt})
      const body=scope==='team'?{...attempt.body,grupo_id:attempt.body.group_id}
        :{...attempt.body,action:({assign:'assign_group_manual',cancel:'cancel_group_choice_admin',restore:'restore_group_choice_admin'} as const)[attempt.body.action]}
      const method=scope==='admin'||attempt.body.action==='assign'?'POST':attempt.body.action==='cancel'?'DELETE':'PUT'
      const endpoint=scope==='team'?'escolha-grupo':'estrutura-avancada'
      const response=await fetch(`/api/campeonatos/${encodeURIComponent(championshipId)}/${endpoint}`,{method,
        headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json','Idempotency-Key':attempt.requestId},body:JSON.stringify(body)})
      const result=await response.json()
      if(!response.ok||result.ok!==true)throw new Error(result.error||'Não foi possível confirmar a escolha.')
      completeGroupChoiceAttempt(attempt)
      if(current.current!==resource)throw new Error('A escolha foi confirmada. Consulte o campeonato anterior.')
      setStored(null);return result
    }catch(cause){const message=cause instanceof Error?cause.message:'Não foi possível confirmar a escolha.'
      if(current.current===resource)setStatus({scope:resource,error:message,busy:false});throw cause
    }finally{if(lock.current===resource)lock.current=null;if(current.current===resource)setStatus(value=>({...value,scope:resource,error:value?.error||'',busy:false}))}
  }
  function discard(){if(pending&&!busy){try{discardGroupChoiceAttempt(pending);setStored(null)}catch{setStatus({scope:resource,error:'Não foi possível encerrar a tentativa local.',busy:false})}}}
  return {run,pending,busy:Boolean(busy),error,discard,actor}
}
