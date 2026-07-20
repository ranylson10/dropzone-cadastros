'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, ClipboardCopy, Loader2, X } from 'lucide-react'
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

type PaymentInfo = {
  id?: string
  status?: string
  valor_centavos?: number
  invoice_url?: string | null
  pix_qrcode?: string | null
  pix_payload?: string | null
  asaas_status?: string | null
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

function moneyCentavos(centavos: unknown) {
  const number = Number(centavos || 0)
  return number > 0
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number / 100)
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

function isPaidStatus(status?: string | null) {
  const s = String(status || '').toLowerCase()
  return (
    s === 'pago'
    || s === 'liberado'
    || s === 'confirmado'
    || s === 'confirmed'
    || s === 'received'
    || s === 'recebido'
  )
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
  const [message, setMessage] = useState('')
  const [showLogin, setShowLogin] = useState(false)
  /** choose → cpf → pix (QR na mesma tela) → paid (redireciona ao claim). */
  const [step, setStep] = useState<'choose' | 'pix-data' | 'pix-pay'>('choose')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [payment, setPayment] = useState<PaymentInfo | null>(null)
  const [compraToken, setCompraToken] = useState('')
  const [claimUrl, setClaimUrl] = useState('')
  const [paid, setPaid] = useState(false)

  const valorLabel = money(championship.valor_inscricao)
  const canPayOnline = Number(championship.valor_inscricao || 0) >= 1
  const contacts = championship.contatos_whatsapp || []
  const cpfDigits = useMemo(() => onlyDigits(cpfCnpj), [cpfCnpj])
  const cpfReady = isValidCpfCnpjLength(cpfDigits)

  const pixSrc = useMemo(() => {
    const raw = payment?.pix_qrcode
    if (!raw) return null
    if (String(raw).startsWith('data:')) return raw
    return `data:image/png;base64,${raw}`
  }, [payment?.pix_qrcode])

  function goToPixForm() {
    setError('')
    setMessage('')
    if (!authenticated) {
      setShowLogin(true)
      onRequireLogin?.()
      return
    }
    setStep('pix-data')
  }

  const pollPayment = useCallback(async () => {
    if (!compraToken) return
    try {
      const { data: session } = await supabase.auth.getSession()
      const access = session.session?.access_token
      if (!access) return

      const res = await fetch(
        `/api/pagamentos/vaga?token=${encodeURIComponent(compraToken)}`,
        {
          headers: { Authorization: `Bearer ${access}` },
          cache: 'no-store',
        },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return

      if (json.payment) {
        setPayment((prev) => ({
          ...prev,
          ...json.payment,
          // Mantém QR/payload se o poll vier sem eles
          pix_qrcode: json.payment.pix_qrcode || prev?.pix_qrcode || null,
          pix_payload: json.payment.pix_payload || prev?.pix_payload || null,
        }))
      }

      const liberado = Boolean(json.liberado) || isPaidStatus(json.compra?.status) || isPaidStatus(json.payment?.status)
      if (liberado) {
        setPaid(true)
        const next =
          claimUrl
          || json.claim_url
          || `/vagas/compra/${encodeURIComponent(compraToken)}`
        // Só redireciona após confirmação do pagamento → escolha de slot
        window.setTimeout(() => {
          window.location.href = next
        }, 900)
      }
    } catch {
      // silencioso no poll
    }
  }, [claimUrl, compraToken])

  useEffect(() => {
    if (step !== 'pix-pay' || !compraToken || paid) return
    const t = window.setInterval(() => {
      void pollPayment()
    }, 4000)
    // primeiro check um pouco depois
    const first = window.setTimeout(() => {
      void pollPayment()
    }, 1500)
    return () => {
      window.clearInterval(t)
      window.clearTimeout(first)
    }
  }, [step, compraToken, paid, pollPayment])

  async function startOnlinePayment() {
    setError('')
    setMessage('')
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

      const token = String(json.compra?.token || '').trim()
      const nextClaim = String(json.claim_url || (token ? `/vagas/compra/${encodeURIComponent(token)}` : ''))
      setCompraToken(token)
      setClaimUrl(nextClaim)
      setPayment(json.payment || null)
      setStep('pix-pay')

      // Já pago (raro): só aí vai para escolha de slot.
      if (isPaidStatus(json.payment?.status) || isPaidStatus(json.compra?.status)) {
        setPaid(true)
        if (nextClaim) window.location.href = nextClaim
        return
      }

      // Se o QR ainda não veio, o poll do step pix-pay completa em instantes.
      // Nunca redireciona para claim/Asaas enquanto o pagamento estiver pendente.
    } catch (e: any) {
      setError(e?.message || 'Erro ao iniciar pagamento.')
    } finally {
      setBusy(false)
    }
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setMessage('Código PIX copiado.')
    } catch {
      setMessage('Não foi possível copiar. Selecione o código e copie manualmente.')
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
        ) : null}

        {step === 'pix-data' ? (
          <>
            <button
              type="button"
              className="vacancy-buy-back"
              onClick={() => {
                setError('')
                setMessage('')
                setStep('choose')
              }}
              disabled={busy}
            >
              <ArrowLeft size={16} /> Voltar
            </button>

            <p className="vacancy-buy-lead">
              Informe o CPF ou CNPJ do pagador para gerar o PIX. O QR Code e o código aparecem nesta
              mesma tela — sem redirecionar para outro site.
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
                    <PixIcon size={18} /> Gerar QR Code PIX
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
        ) : null}

        {step === 'pix-pay' ? (
          <>
            {!paid ? (
              <button
                type="button"
                className="vacancy-buy-back"
                onClick={() => {
                  setError('')
                  setMessage('')
                  setStep('pix-data')
                }}
                disabled={busy}
              >
                <ArrowLeft size={16} /> Voltar
              </button>
            ) : null}

            <p className="vacancy-buy-lead">
              {paid
                ? 'Pagamento confirmado! Abrindo a escolha de slot no grupo com vaga…'
                : 'Escaneie o QR Code ou copie o código PIX. Esta tela atualiza sozinha quando o pagamento for confirmado.'}
            </p>

            {error ? <div className="admin-feedback error">{error}</div> : null}
            {message ? <div className="admin-feedback">{message}</div> : null}

            {paid ? (
              <div className="vacancy-buy-paid">
                <CheckCircle2 size={28} />
                <strong>PIX recebido</strong>
                <span>Redirecionando para escolher o slot…</span>
                <Loader2 className="spin" size={16} />
              </div>
            ) : (
              <div className="vacancy-pix-box vacancy-pix-box-brand vacancy-buy-pix-inline">
                <strong className="vacancy-pix-title">
                  <PixIcon size={18} /> Pagar com PIX
                </strong>
                {payment?.valor_centavos ? (
                  <span className="vacancy-buy-pix-value">
                    {moneyCentavos(payment.valor_centavos)}
                  </span>
                ) : valorLabel ? (
                  <span className="vacancy-buy-pix-value">{valorLabel}</span>
                ) : null}

                {pixSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pixSrc} alt="QR Code PIX" width={200} height={200} />
                ) : (
                  <p className="empty" style={{ margin: 0 }}>
                    QR Code ainda não disponível. Use o código copia e cola abaixo
                    {payment?.pix_payload ? '' : ' — se nada aparecer, tente gerar novamente.'}.
                  </p>
                )}

                {payment?.pix_payload ? (
                  <>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => void copiar(String(payment.pix_payload))}
                    >
                      <ClipboardCopy size={14} /> Copiar código PIX
                    </button>
                    <code className="vacancy-buy-pix-payload" title="Código PIX copia e cola">
                      {payment.pix_payload}
                    </code>
                  </>
                ) : null}

                <p className="vacancy-buy-pix-wait">
                  <Loader2 className="spin" size={14} />
                  Aguardando confirmação do pagamento…
                </p>
              </div>
            )}
          </>
        ) : null}
      </section>
    </div>
  )
}
