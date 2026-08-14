import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

const DESKTOP_CALLBACK_URL = 'dropzone-live://auth/callback'

/** Inicia OAuth pelo servidor; o aplicativo nunca recebe chaves administrativas. */
export async function POST() {
  try {
    const { data, error } = await supabaseAdmin.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: DESKTOP_CALLBACK_URL,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account', access_type: 'offline' },
      },
    })
    if (error) throw error
    if (!data.url) throw new Error('O Google não retornou uma URL de login.')

    const url = new URL(data.url)
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) throw new Error('URL de login inválida.')
    return NextResponse.json({ url: url.toString() })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível iniciar o login Google.' }, { status: 400 })
  }
}
