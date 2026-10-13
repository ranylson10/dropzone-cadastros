'use client'
import {useEffect} from 'react'
import {useScopedState} from '@/hooks/useScopedState'
import {useDailyGroupMutation} from '@/hooks/useDailyGroupMutation'
import {confirmAction} from '@/components/feedback'
import {Select} from '@/components/ui/Field'
import {dailyGroupSnapshot,type DailyGroupReadContract} from '@backend/campeonatos/daily-group-contract'
type Row=Record<string,any>
export function DailyGroupPanel({championshipId,contract,hours,groups,canManage,onRefresh,onDelete}:{championshipId:string;contract:DailyGroupReadContract;hours:Row[];groups:Row[];canManage:boolean;onRefresh:()=>Promise<boolean>;onDelete:(hour:string)=>void}){
 const mutation=useDailyGroupMutation(championshipId),[message,setMessage]=useScopedState(mutation.scope.key,''),[selection,setSelection]=useScopedState<Record<string,string>>(mutation.scope.key,{})
 const bound=contract.daily_group_actor_id===mutation.scope.actor,atomic=contract.daily_group_write_mode==='atomic'
 useEffect(()=>setSelection({}),[hours,groups])
 async function confirmed(){if(!mutation.scope.isCurrent())return;const text='Vínculo de horário confirmado.';setMessage(text)
  try{if(!await onRefresh())setMessage(text+' Atualize para recarregar a estrutura.')}catch{setMessage(text+' Atualize para recarregar a estrutura.')}}
 async function link(hour:Row){try{const group=selection[hour.id];if(!group||!canManage||!mutation.scope.isCurrent())return
  const expected=dailyGroupSnapshot(championshipId,groups,hours)
  if(!await confirmAction('Confirmar o vínculo deste horário com o grupo selecionado? Os vínculos anteriores desses dois registros serão desfeitos.')||!mutation.scope.isCurrent())return
  await mutation.run(contract,{action:'link_daily_group',daily_hour_id:hour.id,group_id:group,expected});await confirmed()
 }catch(error){if(mutation.scope.isCurrent())setMessage(error instanceof Error?error.message:'Falha ao vincular horário.')}}
 async function retry(){try{await mutation.retry();await confirmed()}catch{/* Hook keeps original intent. */}}
 async function discard(){if(!await confirmAction('Após conferir os horários e grupos, encerrar a tentativa local? Isso não desfaz o vínculo no servidor.')||!mutation.scope.isCurrent())return;await mutation.discard()}
 return <section aria-label="Vínculos dos horários do Diário">
  {message?<div role="status" className="message">{message}</div>:null}{mutation.error?<div role="alert" className="message error">{mutation.error}</div>:null}
  {mutation.pending?<div role="status" className="message"><p>Há um vínculo de horário aguardando confirmação. Confira a estrutura antes de alterar os horários.</p>
   <button className="button" disabled={mutation.busy||!canManage} onClick={()=>void retry()}>Repetir vínculo original do horário</button>
   <button className="button secondary" disabled={mutation.busy} onClick={()=>void discard()}>Encerrar tentativa de vínculo após conferir</button></div>:null}
  {bound?<><p>{atomic?'Selecione o grupo e confirme a alteração dos vínculos.':'Vínculo de horário temporariamente indisponível.'}</p><div className="advanced-stage-list">{hours.map(hour=><article key={hour.id}><div><b>{hour.nome_exibicao||String(hour.horario).slice(0,5)}</b><small>{hour.capacidade||0} vagas · {hour.numero_quedas} queda(s) · {hour.mapa||'Mapa não definido'}</small>
   <Select aria-label={`Grupo do horário ${hour.nome_exibicao||String(hour.horario).slice(0,5)}`} value={selection[hour.id]??hour.grupo_id??''} disabled={!atomic||!canManage||!mutation.ready||mutation.busy||Boolean(mutation.pending)} onChange={event=>setSelection(previous=>({...previous,[hour.id]:event.target.value}))}><option value="">Selecionar grupo</option>{groups.map(group=><option key={group.id} value={group.id}>{group.nome}</option>)}</Select>
   <button className="button" disabled={!atomic||!canManage||!mutation.ready||mutation.busy||Boolean(mutation.pending)||!selection[hour.id]} onClick={()=>void link(hour)}>Confirmar grupo do horário</button></div>
   <button className="button secondary" disabled={!canManage||mutation.busy||Boolean(mutation.pending)} onClick={()=>onDelete(hour.id)}>Excluir horário</button>
  </article>)}</div></>:null}
 </section>
}
