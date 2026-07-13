import { NextRequest, NextResponse } from 'next/server'
import { requireSystemAdmin } from '@backend/admin/admin-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

const PROFILE_TABLES = [
  ['produtora', 'produtoras'], ['equipe', 'equipes'], ['jogador', 'jogadores'], ['manager', 'managers'],
] as const

export async function GET(req: NextRequest) {
  try {
    await requireSystemAdmin(req)
    const profileResults = await Promise.all(PROFILE_TABLES.map(async ([tipo, table]) => {
      const { data, count, error } = await supabaseAdmin.from(table).select('id,auth_user_id,username,nome,status,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(100)
      if (error) throw error
      return { tipo, count: count || 0, rows: data || [] }
    }))
    const [championships, reports, restrictions, audits, infra, authUsers] = await Promise.all([
      supabaseAdmin.from('campeonatos').select('id,nome,status,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('sistema_denuncias').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('sistema_restricoes_conta').select('*').eq('ativo', true),
      supabaseAdmin.from('sistema_auditoria').select('*').order('created_at', { ascending: false }).limit(40),
      supabaseAdmin.rpc('sistema_metricas_infra'),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 }),
    ])
    for (const result of [championships, reports, restrictions, audits, infra]) if (result.error) throw result.error
    return NextResponse.json({
      metrics: {
        profiles: Object.fromEntries(profileResults.map((item) => [item.tipo, item.count])),
        championships: championships.count || 0,
        reportsPending: (reports.data || []).filter((item: any) => ['pendente', 'em_analise'].includes(item.status)).length,
        restrictions: (restrictions.data || []).length,
        authUsers: Number((authUsers.data as any)?.total || 0),
        infra: infra.data || {},
      },
      accounts: profileResults.flatMap((item) => item.rows.map((row: any) => ({ ...row, tipo: item.tipo }))),
      championships: championships.data || [], reports: reports.data || [], restrictions: restrictions.data || [], audits: audits.data || [],
    })
  } catch (error: any) { return NextResponse.json({ error: error?.message || 'Erro ao carregar administração.' }, { status: 403 }) }
}
