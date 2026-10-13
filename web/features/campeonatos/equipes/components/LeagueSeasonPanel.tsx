'use client'
import {useScopedState} from '@/hooks/useScopedState'
import {useLeagueSeasonMutation} from '@/hooks/useLeagueSeasonMutation'
import {confirmAction} from '@/components/feedback'
import type {LeagueSeasonReadContract} from '@backend/campeonatos/league-season-contract'
import type {LigaSeasonPreview} from '../types/campeonato-equipes.types'
type Preview=LigaSeasonPreview&{fence?:Record<string,any>}
const labels={mantida:'Mantida',promovida:'Promovida',rebaixada:'Rebaixada'}
export function LeagueSeasonPanel({championshipId,contract,initialPreview,availableSlots,occupied,canManage,onRefresh}:{
 championshipId:string;contract:LeagueSeasonReadContract;initialPreview:LigaSeasonPreview|null;availableSlots:number;occupied:number;canManage:boolean;onRefresh:()=>Promise<boolean>}){
 const mutation=useLeagueSeasonMutation(championshipId),[preview,setPreview]=useScopedState<Preview|null>(mutation.scope.key,null),[message,setMessage]=useScopedState(mutation.scope.key,'')
 const bound=contract.league_season_actor_id===mutation.scope.actor,season=bound?(preview||initialPreview):null,atomic=contract.league_season_write_mode==='atomic'
 const total=season?.suggestions.reduce((sum,s)=>sum+s.candidatos.length,0)||0,planned=season?.suggestions.reduce((sum,s)=>sum+s.quantidade_planejada,0)||0,incomplete=total<planned
 async function refreshPreview(){try{const result=await mutation.run(contract,{mode:'preview_league_season_suggestions'});setPreview(result.preview);setMessage('Confira a prévia antes de confirmar a temporada.')}catch{/* Hook exposes safe error. */}}
 async function confirmed(result:any){if(!mutation.scope.isCurrent())return;setPreview(null);const text=`${result.aplicadas} sugestão(ões) confirmada(s) na nova temporada.`;setMessage(text)
  try{if(!await onRefresh())setMessage(text+' O resultado foi confirmado; atualize para recarregar o acompanhamento.')}catch{setMessage(text+' O resultado foi confirmado; atualize para recarregar o acompanhamento.')}}
 async function apply(){if(!preview?.fence||incomplete||!canManage||!mutation.scope.isCurrent())return
  const expected=preview.fence
  if(!await confirmAction(`Confirmar ${total} equipe(s) da prévia apresentada? As vagas abertas, pagas e por convite continuarão livres.`)||!mutation.scope.isCurrent())return
  try{await confirmed(await mutation.run(contract,{mode:'apply_league_season_suggestions',expected}))}catch{/* Original attempt remains available. */}}
 async function retry(){try{await confirmed(await mutation.retry())}catch{/* Hook exposes error and keeps the immutable intent. */}}
 async function discard(){if(!await confirmAction('Após conferir as equipes e o histórico, encerrar a tentativa local da temporada? Isso não desfaz as inscrições no servidor.')||!mutation.scope.isCurrent())return
  if(await mutation.discard())setPreview(null)}
 if(!season&&!mutation.pending&&!mutation.error&&!message)return null
 return <section aria-label="Temporada da Liga">
  {message?<div className="message" role="status">{message}</div>:null}{mutation.error?<div className="message error" role="alert">{mutation.error}</div>:null}
  {mutation.pending?<div className="message" role="status"><p>Há uma temporada aguardando confirmação. Confira as equipes antes de iniciar outra operação.</p>
   <button className="button" type="button" disabled={mutation.busy||!canManage} onClick={()=>void retry()}>Repetir tentativa original da temporada</button>
   <button className="button secondary" type="button" disabled={mutation.busy} onClick={()=>void discard()}>Encerrar tentativa da temporada após conferir</button></div>:null}
  {season?<details className="champ-league-season-preview"><summary><span><small>Nova season · sugestão pela classificação</small><strong>{season.previous_season||`Edição ${season.previous_edition_number}`} → {season.current_season||`Edição ${season.current_edition_number}`}</strong></span><em>{total}/{planned} equipes sugeridas</em></summary>
   <div className="champ-league-season-body"><p>A classificação anterior é uma proposta. Confira a prévia e confirme para inscrever as equipes.</p>
    {incomplete?<div className="champ-league-season-warning">Existem cotas sem classificação suficiente na temporada anterior. Revise os resultados antes de confirmar.</div>:null}
    <div className="champ-league-season-suggestions">{season.suggestions.map((s,index)=><article key={`${s.divisao_id}-${s.tipo}-${index}`}><header><span>{labels[s.tipo]} · {s.divisao_nome}</span><strong>{s.candidatos.length}/{s.quantidade_planejada}</strong></header><small>Origem: {s.origem_divisao_nome}</small>
     {s.candidatos.length?<ul>{s.candidatos.map(c=><li key={`${s.tipo}-${c.equipe_id}`}><span><b>{c.colocacao}º</b>{c.nome}</span><small>{c.grupo_origem_nome}</small></li>)}</ul>:<em>Sem resultado suficiente.</em>}</article>)}</div>
    <div className="champ-league-season-actions"><span>{!atomic?'Confirmação de temporada temporariamente indisponível.':!availableSlots?'Prepare os agrupamentos antes de aplicar.':occupied?'A confirmação em lote fica bloqueada após iniciar o preenchimento manual.':`${total} equipe(s) da prévia serão inscritas.`}</span>
     <button className="button secondary" type="button" disabled={!atomic||!canManage||!mutation.ready||mutation.busy||Boolean(mutation.pending)||!availableSlots||occupied>0} onClick={()=>void refreshPreview()}>Atualizar prévia da temporada</button>
     <button className="button" type="button" disabled={!atomic||!canManage||!mutation.ready||mutation.busy||Boolean(mutation.pending)||!preview?.fence||!availableSlots||occupied>0||!total||incomplete} onClick={()=>void apply()}>Confirmar prévia da temporada</button>
    </div></div></details>:null}
 </section>
}
