import { NextRequest, NextResponse } from 'next/server'
import { AsaasNotConfiguredError } from '@backend/billing/asaas'
import { runLiliChat } from '@backend/lili/chat-service'

export async function POST(req: NextRequest) {
  try {
    return NextResponse.json(await runLiliChat(req, await req.json()))
  } catch (error: any) {
    if (error instanceof AsaasNotConfiguredError || error?.name === 'AsaasNotConfiguredError') {
      return NextResponse.json({ error: 'O pagamento online ainda não está disponível.' }, { status: 503 })
    }
    return NextResponse.json({ error: error?.message || 'A Lili não conseguiu concluir esta consulta.' }, { status: 400 })
  }
}
