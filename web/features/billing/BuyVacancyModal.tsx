'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, Loader2, X } from 'lucide-react'
import { WhatsappContactSelector } from '@/components/forms/campeonato'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { supabase } from '@/lib/supabase-browser'
import { PixIcon, WhatsAppIcon } from './BrandIcons'

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

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

/** Máscara simples CPF (11) ou CNPJ (14). */
function formatCpfCnpj(raw: string) {
  const digits = onlyDigits(raw).slice(0, 14)
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function isValidCpfCnpjLength(digits: string) {
  return digits.length === 11 || digits.length === 14
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
  /** Escolha inicial → formulário de CPF para PIX. */
  const [step, setStep] = useState<'choose' | 'pix-data'>('choose')
  const [cpfCnpj, setCpfCnpj] = useState('')

  const valorLabel = money(championship.valor_inscricao)
  const canPayOnline = Number(championship.valor_inscricao || 0) >= 1
  const contacts = championship.contatos_whatsapp || []
  const cpfDigits = useMemo(() => onlyDigits(cpfCnpj), [cpfCnpj])
  const cpfReady = isValidCpfCnpjLength(cpfDigits)

  function goToPixForm() {
    setError('')
    if (!authenticated) {
      setShowLogin(true)
      onRequireLogin?.()
      return
    }
    setStep('pix-data')
  }

  async function startOnlinePayment() {
    setError('')
    if (!authenticated) {
      setShowLogin(true)
      onRequireLogin?.()
      return
    }

    if (!cpfReady) {
      setError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.')
      return
    }

    setBusy(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const access = session.session?.access_token
      if (!access) {
        setShowLogin(true)
        throw new Error('Entre com sua conta para pagar com PIX.')
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
          cpf_cnpj: cpfDigits,
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

        {step === 'choose' ? (
          <>
            <p className="vacancy-buy-lead">
              Escolha como prefere garantir a vaga. Após a confirmação do pagamento, o sistema libera o
              próximo grupo com slots livres para você escolher e entrar.
            </p>

            {error ? <div className="admin-feedback error">{error}</div> : null}

            <div className="vacancy-buy-options">
              {canPayOnline ? (
                <button
                  className="vacancy-buy-option vacancy-buy-option-pix"
                  type="button"
                  disabled={busy}
                  onClick={goToPixForm}
                >
                  <span className="vacancy-buy-brand-icon vacancy-buy-brand-pix" aria-hidden>
                    <PixIcon size={22} />
                  </span>
                  <span>
                    <strong>Pagar com PIX</strong>
                    <small>Pagamento instantâneo · libera a vaga automaticamente</small>
                  </span>
                </button>
              ) : (
                <div className="vacancy-buy-option vacancy-buy-option-disabled">
                  <span className="vacancy-buy-brand-icon vacancy-buy-brand-pix is-muted" aria-hidden>
                    <PixIcon size={22} />
                  </span>
                  <span>
                    <strong>PIX indisponível</strong>
                    <small>Este campeonato não tem valor de inscrição cobrável.</small>
                  </span>
                </div>
              )}

              {contacts.length ? (
                <div className="vacancy-buy-whatsapp">
                  <div className="vacancy-buy-whatsapp-head">
                    <span className="vacancy-buy-brand-icon vacancy-buy-brand-wa" aria-hidden>
                      <WhatsAppIcon size={18} />
                    </span>
                    <strong>Falar no WhatsApp</strong>
                  </div>
                  <WhatsappContactSelector contacts={contacts as any} championshipName={championship.nome} />
                </div>
              ) : (
                <p className="empty" style={{ marginTop: 8 }}>
                  A organização ainda não cadastrou contato de WhatsApp.
                  {canPayOnline ? ' Use o PIX se preferir pagar online.' : ''}
                </p>
              )}
            </div>

            {showLogin || (!authenticated && canPayOnline) ? (
              <div className="vacancy-buy-login">
                <p>Para pagar com PIX, entre com sua conta (perfil de equipe).</p>
                <SocialLogin returnTo={returnTo} />
              </div>
            ) : null}
          </>
        ) : (
          <>
            <button
              type="button"
              className="vacancy-buy-back"
              onClick={() => {
                setError('')
                setStep('choose')
              }}
              disabled={busy}
            >
              <ArrowLeft size={16} /> Voltar
            </button>

            <p className="vacancy-buy-lead">
              Para gerar o PIX, informe o CPF ou CNPJ do pagador (exigência da cobrança). Depois você
              verá o QR Code e poderá confirmar o pagamento.
            </p>

            {error ? <div className="admin-feedback error">{error}</div> : null}

            <form
              className="vacancy-buy-pix-form"
              onSubmit={(event) => {
                event.preventDefault()
                void startOnlinePayment()
              }}
            >
              <label className="vacancy-buy-field">
                <span>CPF ou CNPJ</span>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  placeholder="000.000.000-00"
                  value={cpfCnpj}
                  disabled={busy}
                  onChange={(event) => setCpfCnpj(formatCpfCnpj(event.target.value))}
                />
                <small>Somente números · CPF (11) ou CNPJ (14 dígitos)</small>
              </label>

              <button
                className="button vacancy-buy-pix-submit"
                type="submit"
                disabled={busy || !cpfReady}
              >
                {busy ? (
                  <>
                    <Loader2 className="spin" size={18} /> Gerando PIX…
                  </>
                ) : (
                  <>
                    <PixIcon size={18} /> Continuar para o PIX
                  </>
                )}
              </button>
            </form>

            {showLogin ? (
              <div className="vacancy-buy-login">
                <p>Sua sessão expirou. Entre novamente para continuar.</p>
                <SocialLogin returnTo={returnTo} />
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
