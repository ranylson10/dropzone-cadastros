import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getBillingProfile, maskBillingDocument, saveBillingProfile } from '@backend/billing/billing-profile'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const profile = await getBillingProfile(user.id)
    return NextResponse.json({
      profile: profile ? {
        name: profile.nome_titular,
        document_masked: maskBillingDocument(profile.documento),
        updated_at: profile.updated_at || null,
      } : null,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível consultar os dados de pagamento.' }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const profile = await saveBillingProfile({
      userId: user.id,
      name: String(body.name || ''),
      document: String(body.document || body.cpf_cnpj || ''),
    })
    return NextResponse.json({ profile: { name: profile.nome_titular, document_masked: maskBillingDocument(profile.documento), updated_at: profile.updated_at || null } })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível salvar os dados de pagamento.' }, { status: 400 })
  }
}
