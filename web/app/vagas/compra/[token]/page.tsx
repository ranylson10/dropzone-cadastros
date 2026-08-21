'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ClipboardCopy,
  Loader2,
  Shield,
  Sparkles,
  Ticket,
  Users,
} from 'lucide-react'
import { useParams, useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/layout'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { buildProfileCreationHref } from '@/features/auth/auth-return'
import { PixIcon } from '@/features/billing/BrandIcons'
import { supabase } from '@/lib/supabase-browser'
import '../../vagas.css'

type SlotOpt = { id: string; slot_numero: number | null; slot_letra: string | null }
type LineOpt = { id: string; nome: string; tag?: string | null; ja_inscrita?: boolean }
type EquipeOpt = { id: string; nome: string; logo_url?: string | null; papel?: string }

function moneyCentavos(centavos: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(centavos || 0) / 100,
  )
}

function optionLabel(count: number, singular: string, plural: string) {
  if (count === 0) return `nenhum ${singular}`
  if (count === 1) return `1 ${singular}`
  return `${count} ${plural}`
}

export default function CompraVagaPage() {
  const params = useParams<{ token: string }>()
  const searchParams = useSearchParams()
  const token = String(params?.token || '').trim().toUpperCase()
  const returnTo = `/vagas/compra/${encodeURIComponent(token)}`

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [data, setData] = useState<any>(null)
  const [authenticated, setAuthenticated] = useState(false)

  const [equipeId, setEquipeId] = useState('')
  const [lineId, setLineId] = useState('')
  const [nomeNovaLine, setNomeNovaLine] = useState('')
  const [slotId, setSlotId] = useState('')
  const [success, setSuccess] = useState<any>(null)

  const load = useCallback(
    async (opts?: { equipeId?: string }) => {
      setError('')
      try {
        const { data: session } = await supabase.auth.getSession()
        const access = session.session?.access_token
        setAuthenticated(Boolean(access))
        if (!access) {
          setData(null)
          setLoading(false)
          return
        }

        const qs = new URLSearchParams({ token, context: '1' })
        if (opts?.equipeId) qs.set('equipe_id', opts.equipeId)

        const res = await fetch(`/api/pagamentos/vaga?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${access}` },
          cache: 'no-store',
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Erro ao carregar compra.')
        setData(json)

        const equipes: EquipeOpt[] = json.equipes || []
        const selected = opts?.equipeId || json.equipe_selecionada_id || equipes[0]?.id || ''
        setEquipeId((prev) => prev || selected)

        const lines: LineOpt[] = json.lines || []
        if (!lineId && lines[0]?.id) setLineId(lines[0].id)
        if (!lineId && !lines.length) setLineId('__create__')

        const slots: SlotOpt[] = json.slots_livres || []
        if (!slotId && slots[0]?.id) setSlotId(slots[0].id)

        if (json.consumido && json.compra?.campeonato_equipe_id) {
          setSuccess({
            already: true,
            mensagem: 'Esta compra já foi utilizada. Sua line já está no campeonato.',
            campeonato_equipe_id: json.compra.campeonato_equipe_id,
          })
        }
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar.')
      } finally {
        setLoading(false)
      }
    },
    [token, lineId, slotId],
  )

  useEffect(() => {
    if (token) void load()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const paypalStatus = searchParams.get('paypal')
    const orderId = searchParams.get('token')
    const purchaseId = searchParams.get('purchase_id')
    if (paypalStatus !== 'approved' || !orderId || !purchaseId || !authenticated) return
    let active = true
    ;(async () => {
      try {
        setBusy(true)
        setMessage('Confirmando pagamento PayPal...')
        const { data: session } = await supabase.auth.getSession()
        const access = session.session?.access_token
        if (!access) throw new Error('Entre novamente para confirmar o PayPal.')
        const res = await fetch(`/api/paypal/orders/${encodeURIComponent(orderId)}/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` },
          body: JSON.stringify({ purchaseId }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || 'Não foi possível confirmar o PayPal.')
        if (!active) return
        setMessage('Pagamento PayPal confirmado. Escolha sua equipe, line e slot.')
        await load({ equipeId: equipeId || undefined })
        window.history.replaceState({}, '', returnTo)
      } catch (e: any) {
        if (active) setError(e?.message || 'Erro ao confirmar PayPal.')
      } finally {
        if (active) setBusy(false)
      }
    })()
    return () => { active = false }
  }, [authenticated, equipeId, load, returnTo, searchParams])

  // Poll enquanto pendente
  useEffect(() => {
    if (!data?.compra || data.liberado || data.consumido) return
    if (data.compra.status !== 'pendente') return
    const t = setInterval(() => void load({ equipeId: equipeId || undefined }), 5000)
    return () => clearInterval(t)
  }, [data?.compra?.status, data?.liberado, data?.consumido, equipeId, load])

  useEffect(() => {
    if (!data?.liberado || success?.ok || success?.already) return
    const equipesAuto: EquipeOpt[] = data?.equipes || []
    const linesAuto: LineOpt[] = data?.lines || []
    const slotsAuto: SlotOpt[] = data?.slots_livres || []
    if (!equipeId && equipesAuto.length === 1) setEquipeId(equipesAuto[0].id)
    if (!lineId && linesAuto.length === 1) setLineId(linesAuto[0].id)
    if (!lineId && linesAuto.length === 0) setLineId('__create__')
    if (!slotId && slotsAuto.length === 1) setSlotId(slotsAuto[0].id)
  }, [data, equipeId, lineId, slotId, success?.already, success?.ok])

  async function onChangeEquipe(id: string) {
    setEquipeId(id)
    setLineId('')
    setNomeNovaLine('')
    setLoading(true)
    await load({ equipeId: id })
  }

  async function claim() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { data: session } = await supabase.auth.getSession()
      const access = session.session?.access_token
      if (!access) throw new Error('Entre novamente para confirmar a vaga.')
      if (!equipeId) throw new Error('Selecione a equipe.')
      if (!slotId) throw new Error('Selecione o slot.')
      if (!lineId && !nomeNovaLine.trim()) throw new Error('Selecione ou crie uma line.')

      const res = await fetch('/api/pagamentos/vaga/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({
          token,
          equipe_id: equipeId,
          slot_id: slotId,
          line_id: lineId && lineId !== '__create__' ? lineId : undefined,
          nome_line: lineId === '__create__' || !lineId ? nomeNovaLine.trim() : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Não foi possível entrar no campeonato.')
      setSuccess(json)
      setMessage(json.mensagem || 'Vaga confirmada!')
      await load({ equipeId })
    } catch (e: any) {
      setError(e?.message || 'Erro ao confirmar vaga.')
    } finally {
      setBusy(false)
    }
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setMessage('Copiado.')
    } catch {
      setMessage('Não foi possível copiar.')
    }
  }

  const equipes: EquipeOpt[] = data?.equipes || []
  const lines: LineOpt[] = data?.lines || []
  const slots: SlotOpt[] = data?.slots_livres || []
  const selectedEquipe = equipes.find((item) => item.id === equipeId) || null
  const selectedLine = lines.find((item) => item.id === lineId) || null
  const selectedSlot = slots.find((item) => item.id === slotId) || null
  const payment = data?.payment
  const liberado = Boolean(data?.liberado)
  const pending = data?.compra?.status === 'pendente'
  const paymentMethod = String(payment?.metodo || payment?.billing_type || '').toLowerCase()
  const paymentProvider = String(payment?.provider || '').toLowerCase()
  const isPixPayment = !paymentMethod || paymentMethod.includes('pix')
  const isCardPayment = paymentMethod.includes('cartao') || paymentMethod.includes('credit') || paymentMethod.includes('card')
  const isPaypalPayment = paymentMethod.includes('paypal') || paymentProvider === 'paypal'
  const externalPaymentUrl = String(payment?.invoice_url || payment?.paypal_approval_url || '').trim()
  const compraStatus = String(data?.compra?.status || '').toLowerCase()
  const paymentStatus = String(payment?.status || '').toLowerCase()
  const hasPaymentReceipt = Boolean(
    payment?.id
    && (
      liberado
      || data?.consumido
      || ['pago', 'liberado', 'consumido', 'recebido', 'confirmado'].includes(compraStatus)
      || ['pago', 'recebido', 'confirmado', 'liberado'].includes(paymentStatus)
    ),
  )
  const paymentReceiptHref = hasPaymentReceipt
    ? `/carteira?comprovante=${encodeURIComponent(String(payment.id))}&tipo=pagamento`
    : ''
  const needsNewLine = lineId === '__create__' || (!lines.length && !selectedLine)
  const canConfirmEntry = Boolean(liberado && equipeId && slotId && (!needsNewLine || nomeNovaLine.trim()))
  const lineupHref = success?.campeonato_equipe_id
    ? `/painel?tab=equipe&campeonato_equipe_id=${encodeURIComponent(String(success.campeonato_equipe_id))}&acao=escalar`
    : '/painel?tab=equipe&acao=escalar'

  const pixSrc = useMemo(() => {
    const raw = payment?.pix_qrcode
    if (!raw) return null
    if (String(raw).startsWith('data:')) return raw
    return `data:image/png;base64,${raw}`
  }, [payment?.pix_qrcode])

  if (loading && !data) {
    return <DropzoneLoader label="Carregando compra da vaga" />
  }

  if (!authenticated) {
    return (
      <main className="invite-page">
        <div className="invite-card">
          <Shield size={42} />
          <p className="eyebrow">Compra de vaga</p>
          <h1>Entre para continuar</h1>
          <p>Use a mesma conta com a qual iniciou o pagamento para liberar o grupo e escolher o slot.</p>
          {error ? <p className="invite-message" style={{ color: '#b4232d' }}>{error}</p> : null}
          <SocialLogin profileType="equipe" returnTo={returnTo} />
        </div>
      </main>
    )
  }

  if (error && !data) {
    return (
      <main className="invite-page">
        <div className="invite-card">
          <Ticket size={38} />
          <h1>Compra não encontrada</h1>
          <p>{error}</p>
          <a className="button" href="/vagas">
            Voltar às vagas
          </a>
        </div>
      </main>
    )
  }

  return (
    <AppShell activeLabel="Vagas abertas" loadSession mainClassName="vacancies-page page">
      <section className="vacancies-hero" style={{ marginBottom: 12 }}>
        <div>
          <p className="eyebrow">Compra de vaga</p>
          <h1>{data?.campeonato?.nome || 'Campeonato'}</h1>
          <p>
            {data?.compra
              ? `${moneyCentavos(data.compra.valor_centavos)} · status: ${data.compra.status}`
              : 'Acompanhe o pagamento e coloque sua equipe no campeonato.'}
          </p>
        </div>
        <div className="vacancies-hero-count">
          <Ticket />
          <strong>{slots.length}</strong>
          <span>vagas livres no grupo</span>
        </div>
      </section>

      <section className="vacancy-claim-steps" aria-label="Etapas da entrada no campeonato">
        <span className={payment ? 'done' : 'active'}><CheckCircle2 size={14} /> Pagamento</span>
        <span className={liberado ? 'active' : ''}><Users size={14} /> Escolher equipe</span>
        <span className={success?.ok || success?.already || data?.consumido ? 'done' : ''}><Ticket size={14} /> Entrar no campeonato</span>
      </section>

      {error ? <div className="admin-feedback error">{error}</div> : null}
      {message ? <div className="admin-feedback">{message}</div> : null}

      <section className="vacancy-claim-grid">
        {/* Pagamento — QR só enquanto pendente; sem redirecionar para outro ambiente no PIX */}
        <article className="panel vacancy-claim-card">
          <header className="section-head">
            <div>
              <p className="eyebrow">Pagamento</p>
              <h2>
                <PixIcon size={18} style={{ display: 'inline', marginRight: 6, color: '#32BCAD' }} />
                {liberado || data?.consumido
                  ? 'Pago e liberado'
                  : isPaypalPayment
                    ? 'Aguardando PayPal'
                    : isCardPayment
                      ? 'Aguardando cartão'
                      : 'Aguardando pagamento PIX'}
              </h2>
            </div>
          </header>

          {liberado || data?.consumido ? (
            <div className="invite-auth-box" style={{ alignItems: 'flex-start', marginTop: 4 }}>
              <div className="message" style={{ marginTop: 0 }}>
                <CheckCircle2 size={16} style={{ display: 'inline', marginRight: 6 }} />
                Pagamento confirmado. Agora falta só colocar sua equipe na vaga liberada.
              </div>
              {paymentReceiptHref ? (
                <a className="button secondary" href={paymentReceiptHref}>
                  Ver comprovante de pagamento
                </a>
              ) : null}
            </div>
          ) : (
            <>
              {isPixPayment && (pixSrc || payment?.pix_payload) ? (
                <div className="vacancy-pix-box vacancy-pix-box-brand">
                  <strong className="vacancy-pix-title">
                    <PixIcon size={18} /> Pagar com PIX
                  </strong>
                  {pixSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pixSrc} alt="QR Code PIX" width={200} height={200} />
                  ) : null}
                  {payment?.pix_payload ? (
                    <>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => void copiar(payment.pix_payload)}
                      >
                        <ClipboardCopy size={14} /> Copiar código PIX
                      </button>
                      <code className="vacancy-buy-pix-payload" title="Código PIX copia e cola">
                        {payment.pix_payload}
                      </code>
                    </>
                  ) : null}
                </div>
              ) : pending ? (
                <p className="empty">
                  {isPaypalPayment
                    ? 'Aguardando retorno do PayPal.'
                    : isCardPayment
                      ? 'Aguardando confirmação do pagamento por cartão.'
                      : 'PIX ainda não carregou. Aguarde alguns segundos ou volte e gere novamente.'}
                </p>
              ) : null}

              {pending ? (
                <p className="empty" style={{ marginTop: 10 }}>
                  <Loader2 className="spin" size={14} style={{ display: 'inline', marginRight: 6 }} />
                  Após confirmar o pagamento, esta página atualiza sozinha e libera o próximo grupo com vaga.
                </p>
              ) : null}
              {pending && externalPaymentUrl ? (
                <a className="button vacancy-register" href={externalPaymentUrl} target="_blank" rel="noreferrer">
                  Abrir pagamento seguro
                </a>
              ) : null}
            </>
          )}
        </article>

        {/* Claim — só liberado após pagamento confirmado */}
        <article className="panel vacancy-claim-card">
          <header className="section-head">
            <div>
              <p className="eyebrow">Entrar no campeonato</p>
              <h2>
                <Users size={18} style={{ display: 'inline', marginRight: 6 }} />
                {data?.grupo?.nome || data?.compra?.meta?.grupo_nome || 'Próximo grupo'}
              </h2>
              <span>
                {liberado
                  ? 'Vou te guiar: equipe, elenco e vaga no grupo'
                  : 'Disponível após confirmação do pagamento'}
              </span>
            </div>
          </header>

          {success?.ok || success?.already || data?.consumido ? (
            <div className="invite-auth-box">
              <CheckCircle2 size={40} />
              <p className="eyebrow">Tudo certo</p>
              <p>
                <strong>{success?.line?.nome || 'Elenco'}</strong>
                {success?.slot?.slot_letra ? (
                  <>
                    {' '}
                    na vaga <strong>{success.slot.slot_letra}</strong>
                  </>
                ) : null}
              </p>
              <p>{success?.mensagem || 'Sua equipe entrou no campeonato.'}</p>
              <a className="button" href={lineupHref}>
                Escalar jogadores
              </a>
              {data?.campeonato?.id ? (
                <a className="button secondary" href={`/campeonatos/${data.campeonato.id}`}>
                  Abrir campeonato
                </a>
              ) : null}
              {paymentReceiptHref ? (
                <a className="button secondary" href={paymentReceiptHref}>
                  Ver comprovante de pagamento
                </a>
              ) : null}
            </div>
          ) : !liberado ? (
            <p className="empty">Conclua o pagamento para liberar a escolha de slot.</p>
          ) : !equipes.length ? (
            <div className="invite-auth-box">
              <p>Você precisa de um perfil de <strong>equipe</strong> para ocupar a vaga.</p>
              <a className="button" href={buildProfileCreationHref('equipe', returnTo)}>
                Criar equipe
              </a>
            </div>
          ) : (
            <div className="vacancy-claim-form">
              <div className="vacancy-guided-summary">
                <Sparkles size={17} />
                <div>
                  <strong>
                    {equipes.length === 1 && lines.length <= 1 && slots.length === 1
                      ? 'Deixei quase tudo pronto pra você.'
                      : 'Escolha só o que precisa para entrar.'}
                  </strong>
                  <span>
                    Encontrei {optionLabel(equipes.length, 'equipe', 'equipes')}, {optionLabel(lines.length, 'elenco livre', 'elencos livres')} e {optionLabel(slots.length, 'vaga livre', 'vagas livres')} neste grupo.
                  </span>
                </div>
              </div>

              <label className="field">
                <span>Equipe que vai jogar</span>
                <select value={equipeId} onChange={(e) => void onChangeEquipe(e.target.value)}>
                  {equipes.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Elenco / line</span>
                <select
                  value={lineId || (lines.length ? '' : '__create__')}
                  onChange={(e) => setLineId(e.target.value)}
                >
                  {lines.map((line) => (
                    <option key={line.id} value={line.id}>
                      {line.nome}
                    </option>
                  ))}
                  <option value="__create__">+ Criar novo elenco</option>
                </select>
              </label>

              {needsNewLine ? (
                <label className="field">
                  <span>Nome do novo elenco</span>
                  <input
                    value={nomeNovaLine}
                    onChange={(e) => setNomeNovaLine(e.target.value)}
                    placeholder="Ex.: ALOE ELITE 2"
                  />
                </label>
              ) : null}

              <label className="field">
                <span>Vaga no grupo</span>
                <select value={slotId} onChange={(e) => setSlotId(e.target.value)}>
                  {slots.length === 0 ? (
                    <option value="">Nenhuma vaga livre</option>
                  ) : (
                    slots.map((s) => (
                      <option key={s.id} value={s.id}>
                        Vaga {s.slot_letra || s.slot_numero}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <div className="vacancy-slot-chips">
                {slots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`vacancy-slot-chip ${slotId === s.id ? 'active' : ''}`}
                    onClick={() => setSlotId(s.id)}
                  >
                    {s.slot_letra || s.slot_numero}
                  </button>
                ))}
              </div>

              <div className="vacancy-entry-review">
                <strong>Resumo da entrada</strong>
                <span>Equipe: {selectedEquipe?.nome || 'selecione uma equipe'}</span>
                <span>Elenco: {needsNewLine ? (nomeNovaLine.trim() || 'informe o nome do elenco') : selectedLine?.nome || 'selecione um elenco'}</span>
                <span>Vaga: {selectedSlot ? `Grupo ${data?.grupo?.nome || data?.compra?.meta?.grupo_nome || ''} · ${selectedSlot.slot_letra || selectedSlot.slot_numero}` : 'selecione uma vaga'}</span>
              </div>

              <button
                className="button vacancy-register"
                type="button"
                disabled={busy || !canConfirmEntry}
                onClick={() => void claim()}
              >
                {busy ? 'Confirmando…' : 'Confirmar e entrar no campeonato'}
              </button>
            </div>
          )}
        </article>
      </section>
    </AppShell>
  )
}
