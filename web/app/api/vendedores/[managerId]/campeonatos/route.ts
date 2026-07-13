import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function missingRelation(error: any) {
  return ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error?.code || '')
}

export async function GET(_req: Request, context: { params: Promise<{ managerId: string }> }) {
  try {
    const { managerId } = await context.params
    const [{ data: manager, error: managerError }, { data: vínculos, error: vínculosError }] = await Promise.all([
      supabaseAdmin.from('managers').select('id,nome,username,avatar_url,bio,status').eq('id', managerId).maybeSingle(),
      supabaseAdmin
        .from('tokens')
        .select('id,campeonato_id,produtora_id,manager_id,status,created_at')
        .eq('tipo', 'manager_invite')
        .eq('manager_id', managerId)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false }),
    ])

    if (managerError) throw managerError
    if (vínculosError) throw vínculosError
    if (!manager || ['suspenso', 'banido', 'excluido'].includes(String(manager.status || 'ativo'))) throw new Error('Vendedor não encontrado.')

    const campeonatoIds = Array.from(new Set((vínculos || []).map((item) => item.campeonato_id).filter(Boolean)))
    const produtoraIds = Array.from(new Set((vínculos || []).map((item) => item.produtora_id).filter(Boolean)))

    const [
      { data: campeonatos, error: campeonatosError },
      { data: produtoras, error: produtorasError },
      { data: configs, error: configsError },
    ] = await Promise.all([
      campeonatoIds.length ? supabaseAdmin.from('campeonatos').select('id,nome,logo_url,status').in('id', campeonatoIds) : Promise.resolve({ data: [] as any[], error: null } as any),
      produtoraIds.length ? supabaseAdmin.from('produtoras').select('id,nome,logo_url').in('id', produtoraIds) : Promise.resolve({ data: [] as any[], error: null } as any),
      campeonatoIds.length ? supabaseAdmin.from('campeonato_configuracoes').select('campeonato_id,contatos_whatsapp').in('campeonato_id', campeonatoIds) : Promise.resolve({ data: [] as any[], error: null } as any),
    ])

    if (campeonatosError) throw campeonatosError
    if (produtorasError) throw produtorasError
    if (configsError && !missingRelation(configsError)) throw configsError

    const campeonatosById = new Map((campeonatos || []).map((item: any) => [item.id, item]))
    const produtorasById = new Map((produtoras || []).map((item: any) => [item.id, item]))
    const contactsByChampId = new Map((configs || []).map((config: any) => [
      config.campeonato_id,
      Array.isArray(config.contatos_whatsapp) ? config.contatos_whatsapp.find((contact: any) => contact?.manager_id === managerId) || null : null,
    ]))

    return NextResponse.json({
      manager,
      campeonatos: (vínculos || []).map((item: any) => {
        const contact = (contactsByChampId.get(item.campeonato_id) || null) as any
        return {
          id: item.id,
          nome_publico: contact?.nome || manager.nome || manager.username,
          whatsapp_url: contact?.url || null,
          campeonatos: campeonatosById.get(item.campeonato_id) || null,
          produtoras: produtorasById.get(item.produtora_id) || null,
        }
      }),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar vendedor.' }, { status: 404 })
  }
}
