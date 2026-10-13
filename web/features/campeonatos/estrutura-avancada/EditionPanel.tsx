'use client'
import {useEffect} from 'react'
import {Input} from '@/components/ui/Field'
import {confirmAction} from '@/components/feedback'
import {useScopedState} from '@/hooks/useScopedState'
import {useEditionMutation} from '@/hooks/useEditionMutation'
import {editionProjection,type EditionReadContract} from '@backend/campeonatos/edition-contract'
type Row=Record<string,any>
export function EditionPanel({championshipId,contract,edition,franchise,canManage,onRefresh}:{championshipId:string;contract:EditionReadContract;edition:Row|null;franchise:Row|null;canManage:boolean;onRefresh:()=>Promise<boolean>}){
 const mutation=useEditionMutation(championshipId),[form,setForm]=useScopedState(mutation.scope.key,{franchise_name:'',edition_number:'',season:'',public_title:''}),[message,setMessage]=useScopedState(mutation.scope.key,'')
 const bound=contract.edition_actor_id===mutation.scope.actor,atomic=contract.edition_write_mode==='atomic'
 useEffect(()=>{if(bound)setForm({franchise_name:franchise?.nome||'',edition_number:edition?.numero_edicao?String(edition.numero_edicao):'',season:edition?.temporada||'',public_title:edition?.titulo_publico||''})},[edition,franchise,bound])
 async function confirmed(){if(!mutation.scope.isCurrent())return;const text='Edição confirmada.';setMessage(text);try{if(!await onRefresh())setMessage(text+' Atualize para recarregar o histórico.')}catch{setMessage(text+' Atualize para recarregar o histórico.')}}
 async function save(){try{if(!canManage||!mutation.scope.isCurrent())return
  const body={action:'save_edition',franchise_id:franchise?.id||null,...form,expected:{edition:editionProjection(edition),franchise:editionProjection(franchise,true),source:null}}
  if(!await confirmAction('Confirmar os dados apresentados da edição? Alterar o nome histórico afeta todas as temporadas da franquia e exige gerenciar todos os campeonatos vinculados.')||!mutation.scope.isCurrent())return
  await mutation.run(contract,body);await confirmed()
 }catch(error){if(mutation.scope.isCurrent())setMessage(error instanceof Error?error.message:'Falha ao salvar edição.')}}
 async function retry(){try{await mutation.retry();await confirmed()}catch{/* Original intent remains. */}}
 async function discard(){if(!await confirmAction('Após conferir edição e franquia, encerrar a tentativa local? Isso não desfaz o histórico no servidor.')||!mutation.scope.isCurrent())return;await mutation.discard()}
 const disabled=!canManage||!atomic||!mutation.ready||mutation.busy||Boolean(mutation.pending)
 return <section aria-label="Histórico e edição">
  {message?<div role="status" className="message">{message}</div>:null}{mutation.error?<div role="alert" className="message error">{mutation.error}</div>:null}
  {mutation.pending?<div role="status" className="message"><p>Há uma edição aguardando confirmação. Confira o histórico antes de alterar os dados.</p><button className="button" disabled={mutation.busy||!canManage} onClick={()=>void retry()}>Repetir edição original</button><button className="button secondary" disabled={mutation.busy} onClick={()=>void discard()}>Encerrar tentativa de edição após conferir</button></div>:null}
  {bound?<><p>Nome e dados históricos são compartilhados por todas as temporadas. Alterá-los exige gerenciar todos os campeonatos da franquia.</p>{!atomic?<p>Edição temporariamente indisponível.</p>:null}
   <div className="mini-grid four">
    <label><span>Nome histórico</span><Input value={form.franchise_name} disabled={disabled} onChange={event=>setForm({...form,franchise_name:event.target.value})} placeholder="Copa ALOE" /></label>
    <label><span>Número da edição</span><Input type="number" min="1" value={form.edition_number} disabled={disabled} onChange={event=>setForm({...form,edition_number:event.target.value})} /></label>
    <label><span>Temporada</span><Input value={form.season} disabled={disabled} onChange={event=>setForm({...form,season:event.target.value})} placeholder="2026 · Season 1" /></label>
    <label><span>Título público</span><Input value={form.public_title} disabled={disabled} onChange={event=>setForm({...form,public_title:event.target.value})} /></label>
   </div><button className="button" disabled={disabled||!form.franchise_name.trim()} onClick={()=>void save()}>{mutation.busy?'Salvando…':'Salvar edição'}</button>
  </>:null}
 </section>
}
