'use client'
import {confirmAction} from '@/components/feedback'
export function PendingGroupChoice({pending,busy,error,onRetry,onDiscard}:{pending:boolean;busy:boolean;error:string;onRetry:()=>void;onDiscard:()=>void}) {
  return <>{error?<div className="message error" role="alert">{error}</div>:null}{pending?<div className="message" role="status">
    <p>Há uma escolha aguardando confirmação. Confira os slots antes de iniciar outra.</p>
    <button type="button" className="button" style={{minHeight:44}} disabled={busy} onClick={onRetry}>Confirmar resultado da escolha anterior</button>
    <button type="button" className="button secondary" style={{minHeight:44}} disabled={busy} onClick={()=>void confirmAction('Encerrar a tentativa local após conferir os slots? Isso não desfaz a escolha no servidor.').then(confirmed=>{if(confirmed)onDiscard()})}>Encerrar tentativa após conferir os slots</button>
  </div>:null}</>
}
