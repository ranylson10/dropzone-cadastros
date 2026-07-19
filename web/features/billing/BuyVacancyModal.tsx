'use client'

import { useState } from 'react'
import { CreditCard, Loader2, MessageCircle, X } from 'lucide-react'
import { WhatsappContactSelector } from '@/components/forms/campeonato'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { supabase } from '@/lib/supabase-browser'

type Contact = {
  id?: string
  nome?: string
  pais?: string
  bandeira?: string
  ddi?: string
  telefone?: string
  url?: string | null
  manager_id?: string
}

type Props = {
  championship: {
    id: string
    nome: string
    valor_inscricao?: number | null
    contatos_whatsapp?: Contact[]
    proximo_grupo?: string | null
  }
  vendedorManagerId?: string | null
  returnTo?: string
  authenticated: boolean
  onClose: () => void
  onRequireLogin?: () => void
}

function money(value: unknown) {
  const number = Number(value)
  return number > 0
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
    : null
}

export function BuyVacancyModal({
  championship,
  vendedorManagerId,
  returnTo = '/vagas',
  authenticated,
  onClose,
  onRequireLogin,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showLogin, setShowLogin] = useState(false)

  const valorLabel = money(championship.valor_inscricao)
  const canPayOnline = Number(championship.valor_inscricao || 0) >= 1
  const contacts = championship.contatos_whatsapp || []

  async function startOnlinePayment() {
    setError('')
    if (!authenticated) {
      setShowLogin(true)
      onRequireLogin?.()
      return
    }

    setBusy(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const access = session.session?.access_token
      if (!access) {
        setShowLogin(true)
        throw new Error('Entre com sua conta para pagar online.')
      }

      const res = await fetch('/api/pagamentos/vaga', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({
          campeonato_id: championship.id,
          vendedor_manager_id: vendedorManagerId || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Não foi possível gerar o pagamento.')

      const claimUrl = String(json.claim_url || `/vagas/compra/${json.compra?.token || ''}`)
      window.location.href = claimUrl
    } catch (e: any) {
      setError(e?.message || 'Erro ao iniciar pagamento.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="report-modal-backdrop" onClick={onClose}>
      <section
        className="report-modal vacancy-contact-modal vacancy-buy-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">Garantir vaga</p>
            <h2>{championship.nome}</h2>
            <span>
              {valorLabel ? `Inscrição ${valorLabel}` : 'Valor sob consulta'}
              {championship.proximo_grupo ? ` · ${championship.proximo_grupo}` : ''}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <p className="vacancy-buy-lead">
          Escolha como prefere garantir a vaga. No pagamento online, após a confirmação o sistema libera o
          próximo grupo com slots livres para você escolher e entrar.
        </p>

        {error ? <div className="admin-feedback error">{error}</div> : null}

        <div className="vacancy-buy-options">
          {canPayOnline ? (
            <button
              className="vacancy-buy-option vacancy-buy-option-primary"
              type="button"
              disabled={busy}
              onClick={() => void startOnlinePayment()}
            >
              {busy ? <Loader2 className="spin" size={20} /> : <CreditCard size={20} />}
              <span>
                <strong>Pagar online</strong>
                <small>Link ASAAS + QR Code PIX · libera o grupo automaticamente</small>
              </span>
            </button>
          ) : (
            <div className="vacancy-buy-option vacancy-buy-option-disabled">
              <CreditCard size={20} />
              <span>
                <strong>Pagamento online indisponível</strong>
                <small>Este campeonato não tem valor de inscrição cobrável (≥ R$ 1,00).</small>
              </span>
            </div>
          )}

          {contacts.length ? (
            <div className="vacancy-buy-whatsapp">
              <div className="vacancy-buy-whatsapp-head">
                <MessageCircle size={18} />
                <strong>Ou fale no WhatsApp</strong>
              </div>
              <WhatsappContactSelector contacts={contacts as any} championshipName={championship.nome} />
            </div>
          ) : (
            <p className="empty" style={{ marginTop: 8 }}>
              A organização ainda não cadastrou contato de WhatsApp. Use o pagamento online se disponível.
            </p>
          )}
        </div>

        {showLogin || (!authenticated && canPayOnline) ? (
          <div className="vacancy-buy-login">
            <p>Para pagar online, entre com sua conta (perfil de equipe).</p>
            <SocialLogin returnTo={returnTo} />
          </div>
        ) : null}
      </section>
    </div>
  )
}
