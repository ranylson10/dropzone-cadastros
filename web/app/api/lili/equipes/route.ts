import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { listControllableEquipes, requireEquipeAccess } from '@backend/equipes/manager-team-access'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { getTeamOperationsOverview } from '@/features/lili/tools'

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const equipeId = String(req.nextUrl.searchParams.get('id') || '').trim()
    const teams = await listControllableEquipes(user.id, accounts)

    if (!equipeId) return NextResponse.json({ items: teams })

    const access = await requireEquipeAccess(user.id, accounts, equipeId, 'ver')
    const [{ data: equipe, error: equipeError }, overview] = await Promise.all([
      supabaseAdmin.from('equipes').select('id,nome,username,tag,logo_url,status,created_at').eq('id', equipeId).single(),
      getTeamOperationsOverview(equipeId),
    ])
    if (equipeError) throw equipeError

    const championshipIds = [...new Set(overview.activeRegistrations.map((row: any) => row.campeonato_id).filter(Boolean))]
    const lineIds = [...new Set(overview.activeRegistrations.map((row: any) => row.line_id).filter(Boolean))]
    const [{ data: championships }, { data: lines }] = await Promise.all([
      championshipIds.length
        ? supabaseAdmin.from('campeonatos').select('id,nome,logo_url,status,tipo').in('id', championshipIds)
        : Promise.resolve({ data: [] as any[] }),
      lineIds.length
        ? supabaseAdmin.from('equipe_lines').select('id,nome,tag,logo_url').in('id', lineIds)
        : Promise.resolve({ data: [] as any[] }),
    ])
    const champMap = new Map((championships || []).map((row: any) => [row.id, row]))
    const lineMap = new Map((lines || []).map((row: any) => [row.id, row]))

    return NextResponse.json({
      team: { ...equipe, papel: access.papel, permissoes: access.permissoes },
      overview: {
        ...overview,
        activeRegistrations: overview.activeRegistrations.map((row: any) => ({
          ...row,
          campeonato: champMap.get(row.campeonato_id) || null,
          line: lineMap.get(row.line_id) || null,
        })),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível carregar suas equipes.' }, { status: 400 })
  }
}
