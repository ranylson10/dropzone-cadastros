import {supabase} from './supabase-browser'
import {editionAttempts,writeEdition} from './edition-write'
import {editionProjection} from '@backend/campeonatos/edition-contract'
/** Championship creation remains a separate operation; this only saves its historical edition. */
export async function saveCreationEdition(champ:string,values:Record<string,any>,assertCurrent:()=>void){
 const{data,error}=await supabase.auth.getSession();if(error||!data.session)throw new Error('Entre novamente para salvar a edição.')
 const actor=data.session.user.id,token=data.session.access_token;assertCurrent()
 const read=async(id:string)=>{const response=await fetch(`/api/campeonatos/${encodeURIComponent(id)}/estrutura-avancada`,{cache:'no-store',headers:{Authorization:`Bearer ${token}`}}),body=await response.json().catch(()=>null);assertCurrent()
  if(!response.ok||body?.edition_actor_id!==actor||!body.permission?.canManage)throw new Error('Não foi possível consultar a edição autorizada. Atualize o campeonato.');return body}
 const board=await read(champ),pending=await editionAttempts.read(actor,champ)
 if(pending)return writeEdition(champ,board,{...values,expected:pending.body.expected},assertCurrent)
 if(board.edition)throw new Error('O campeonato já possui edição. Use o editor do histórico para alterá-la.')
 const source=values.source_championship_id?await read(values.source_championship_id):null
 const expected={edition:null,franchise:editionProjection(source?.franchise??null,true),source:source?{campeonato_id:values.source_championship_id,edition:editionProjection(source.edition??null)}:null}
 return writeEdition(champ,board,{...values,expected},assertCurrent)
}
