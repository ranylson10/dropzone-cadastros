import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { listManagedChampionships, listUserRegistrations } from '@/features/lili/tools'

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const [managed, registrations] = await Promise.all([
      listManagedChampionships(user.id),
      listUserRegistrations(user),
    ])

    const items = new Map<string, any>()
    for (const championship of managed) {
      items.set(String(championship.id), {
        id: championship.id,
        nome: championship.nome,
        tipo: championship.tipo,
        logo_url: championship.logo_url,
        banner_url: championship.banner_url,
        status: championship.status,
        relationship: 'admin',
        permission: championship.permission,
        registrations: [],
      })
    }

    for (const registration of registrations) {
      const championship = registration.campeonato
      const championshipId = String(championship?.id || registration.campeonato_id || '')
      if (!championshipId) continue
      const current = items.get(championshipId) || {
        id: championshipId,
        nome: championship?.nome || 'Campeonato',
        tipo: championship?.tipo || null,
        logo_url: championship?.logo_url || null,
        banner_url: championship?.banner_url || null,
        status: championship?.status || null,
        relationship: 'participant',
        permission: null,
        registrations: [],
      }
      current.registrations.push({
        id: registration.id,
        equipe_id: registration.equipe_id,
        equipe_nome: registration.equipe?.nome || null,
        equipe_logo_url: registration.equipe?.logo_url || null,
        line_id: registration.line_id,
        line_nome: registration.line?.nome || registration.nome_exibicao || null,
        grupo_id: registration.grupo_id,
        grupo_nome: registration.grupo?.nome || null,
        slot_numero: registration.slot_numero,
        status: registration.status,
      })
      items.set(championshipId, current)
    }

    return NextResponse.json({ items: [...items.values()] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível carregar seus campeonatos.' }, { status: 400 })
  }
}
