import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(_req: Request, context: { params: Promise<{ managerId: string }> }) {
  try {
    const { managerId } = await context.params
    const [{ data: manager, error: managerError }, { data: vínculos, error: vínculosError }] = await Promise.all([
      supabaseAdmin.from('managers').select('id,nome,username,avatar_url,foto_url,bio,status').eq('id', managerId).maybeSingle(),
      supabaseAdmin
        .from('campeonato_vendedores')
        .select('id,nome_publico,whatsapp_url,campeonatos(id,nome,logo_url,status),produtoras(id,nome,logo_url)')
        .eq('manager_id', managerId)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false }),
    ])

    if (managerError) throw managerError
    if (vínculosError) throw vínculosError
    if (!manager || ['suspenso', 'banido', 'excluido'].includes(String(manager.status || 'ativo'))) throw new Error('Vendedor não encontrado.')
    return NextResponse.json({ manager, campeonatos: vínculos || [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar vendedor.' }, { status: 404 })
  }
}
