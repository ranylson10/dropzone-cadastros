import {NextRequest,NextResponse} from 'next/server'
import {getBearerUser} from '@backend/auth/server-auth'
import {getCampeonatoPermission} from '@backend/campeonatos/campeonato-permissions'
import {leagueSeasonWriteMode,tryAtomicLeagueSeason} from '@backend/campeonatos/league-season-transport'
import {slotTransferErrorResponse} from '@backend/campeonatos/slot-transfer'
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const headers={'Cache-Control':'no-store'}
 try{const user=await getBearerUser(request);if(leagueSeasonWriteMode()!=='atomic')return NextResponse.json({error:'Temporada temporariamente indisponível.'},{status:503,headers})
  const{id}=await params,permission=await getCampeonatoPermission(user.id,id)
  if(!permission.canView||!permission.canManage||permission.role==='none')return NextResponse.json({error:'Sem permissão para importar esta temporada.'},{status:403,headers})
  const result=await tryAtomicLeagueSeason(user.id,id,await request.json(),request.headers.get('Idempotency-Key'))
  if(!result)return NextResponse.json({error:'Ação de temporada inválida.'},{status:400,headers})
  return NextResponse.json(result,{headers})
 }catch(error){const known=slotTransferErrorResponse(error);if(known)return NextResponse.json(known.body,{status:known.status,headers})
  const unauthorized=error instanceof Error&&['Sessao ausente.','Sessao invalida.'].includes(error.message)
  return NextResponse.json({error:unauthorized?'Não autenticado.':'Não foi possível confirmar a temporada.'},{status:unauthorized?401:400,headers})}
}
