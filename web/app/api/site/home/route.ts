import { NextRequest, NextResponse } from 'next/server'
import { requireSystemAdmin } from '@backend/admin/admin-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { DEFAULT_HOME_CONFIG, normalizeHomeConfig } from '@/features/home/home-config'

const CONFIG_ID = 'default'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('site_home_config')
    .select('config,updated_at')
    .eq('id', CONFIG_ID)
    .maybeSingle()

  if (error) {
    if (['42P01', 'PGRST205'].includes(error.code || '')) {
      return NextResponse.json({ config: DEFAULT_HOME_CONFIG, configured: false })
    }
    return NextResponse.json({ config: DEFAULT_HOME_CONFIG, configured: false })
  }

  return NextResponse.json({
    config: normalizeHomeConfig(data?.config),
    configured: Boolean(data),
    updated_at: data?.updated_at || null,
  })
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireSystemAdmin(req)
    const body = await req.json().catch(() => ({}))
    const config = normalizeHomeConfig(body?.config)
    const now = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('site_home_config')
      .upsert({
        id: CONFIG_ID,
        config,
        updated_at: now,
        updated_by: admin.id,
      })
      .select('config,updated_at')
      .single()

    if (error) {
      if (['42P01', 'PGRST205'].includes(error.code || '')) {
        throw new Error('A configuração da página inicial está indisponível. Tente novamente mais tarde.')
      }
      throw error
    }

    await supabaseAdmin.from('sistema_auditoria').insert({
      administrador_auth_user_id: admin.id,
      acao: 'pagina_inicial_atualizada',
      alvo_tipo: 'site_home_config',
      alvo_id: CONFIG_ID,
      detalhes: { updated_at: now },
    })

    return NextResponse.json({ config: normalizeHomeConfig(data.config), updated_at: data.updated_at })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível salvar a página inicial.' }, { status: 400 })
  }
}
