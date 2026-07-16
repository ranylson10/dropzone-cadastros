import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function canReadStructure(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  if (permission.role === 'owner' || permission.role === 'manager') return permission.canView
  if (permission.role === 'seller') {
    const perms = permission.sellerPermissions
    return Boolean(
      permission.canView
      && (
        permission.canManage
        || permission.canOrganizeGroups
        || permission.canScore
        || perms?.ver_estrutura !== false
      ),
    )
  }
  return false
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canReadStructure(permission)) {
      throw new Error('Você não tem permissão para ver a estrutura deste campeonato.')
    }

    const [{ data: campeonato, error: campError }, { data: fases, error: fasesError }, { data: grupos, error: gruposError }, { data: slots, error: slotsError }, { data: jogos, error: jogosError }] =
      await Promise.all([
        supabaseAdmin
          .from('campeonatos')
          .select('id,nome,logo_url,status,banner_url')
          .eq('id', id)
          .is('deleted_at', null)
          .maybeSingle(),
        supabaseAdmin
          .from('campeonato_fases')
          .select('id,nome,ordem,status,created_at')
          .eq('campeonato_id', id)
          .order('ordem', { ascending: true }),
        supabaseAdmin
          .from('campeonato_grupos')
          // schema real: sem coluna status (só id/nome/slots/fase_id/whatsapp_url/timestamps)
          .select('id,nome,fase_id,slots,whatsapp_url,created_at')
          .eq('campeonato_id', id)
          .order('created_at', { ascending: true }),
        supabaseAdmin
          .from('campeonato_slots')
          .select('id,grupo_id,fase_id,slot_numero,slot_letra,equipe_id,line_id,status')
          .eq('campeonato_id', id),
        supabaseAdmin
          .from('campeonato_jogos')
          .select('id,nome,fase_id,rodada_id,data_jogo,horario,numero_partidas,mapas,grupos_ids,status,created_at')
          .eq('campeonato_id', id)
          .order('created_at', { ascending: true }),
      ])

    if (campError) throw campError
    if (!campeonato) throw new Error('Campeonato não encontrado.')
    if (fasesError) throw fasesError
    if (gruposError) throw gruposError
    if (slotsError) throw slotsError
    if (jogosError) throw jogosError

    const slotsByGrupo = new Map<string, { total: number; ocupados: number; livres: number }>()
    for (const slot of slots || []) {
      const key = String(slot.grupo_id || '')
      if (!key) continue
      const current = slotsByGrupo.get(key) || { total: 0, ocupados: 0, livres: 0 }
      current.total += 1
      if (slot.equipe_id || slot.line_id) current.ocupados += 1
      else current.livres += 1
      slotsByGrupo.set(key, current)
    }

    const gruposEnriquecidos = (grupos || []).map((grupo) => {
      const stats = slotsByGrupo.get(grupo.id) || {
        total: Number(grupo.slots || 0),
        ocupados: 0,
        livres: Number(grupo.slots || 0),
      }
      return {
        ...grupo,
        slots_total: stats.total || Number(grupo.slots || 0),
        slots_ocupados: stats.ocupados,
        slots_livres: stats.livres || Math.max(0, (stats.total || Number(grupo.slots || 0)) - stats.ocupados),
      }
    })

    return NextResponse.json({
      campeonato,
      fases: fases || [],
      grupos: gruposEnriquecidos,
      jogos: (jogos || []).map((jogo) => ({
        ...jogo,
        mapas: Array.isArray(jogo.mapas) ? jogo.mapas : String(jogo.mapas || '').split(',').map((m: string) => m.trim()).filter(Boolean),
        grupos_ids: Array.isArray(jogo.grupos_ids) ? jogo.grupos_ids : [],
      })),
      resumo: {
        fases: (fases || []).length,
        grupos: (grupos || []).length,
        slots_total: (slots || []).length,
        slots_ocupados: (slots || []).filter((s) => s.equipe_id || s.line_id).length,
        jogos: (jogos || []).length,
      },
      permission: {
        canView: permission.canView,
        canManage: permission.canManage,
        canGenerateToken: permission.canGenerateToken,
        canOrganizeGroups: permission.canOrganizeGroups,
        canScore: permission.canScore,
        role: permission.role,
      },
    })
  } catch (error: any) {
    const message =
      (error instanceof Error && error.message)
      || error?.message
      || error?.error_description
      || 'Erro ao carregar estrutura.'
    return NextResponse.json(
      { error: message },
      { status: 400 },
    )
  }
}
