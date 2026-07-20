'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ClipboardCopy,
  Loader2,
  Shield,
  Ticket,
  Users,
} from 'lucide-react'
import { useParams } from 'next/navigation'
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

export default function CompraVagaPage() {
  const params = useParams<{ token: string }>()
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

  // Poll enquanto pendente
  useEffect(() => {
    if (!data?.compra || data.liberado || data.consumido) return
    if (data.compra.status !== 'pendente') return
    const t = setInterval(() => void load({ equipeId: equipeId || undefined }), 5000)
    return () => clearInterval(t)
  }, [data?.compra?.status, data?.liberado, data?.consumido, equipeId, load])

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
  const payment = data?.payment
  const liberado = Boolean(data?.liberado)
  const pending = data?.compra?.status === 'pendente'

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
          <SocialLogin returnTo={returnTo} />
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
              : 'Acompanhe o pagamento e escolha o slot.'}
          </p>
        </div>
        <div className="vacancies-hero-count">
          <Ticket />
          <strong>{slots.length}</strong>
          <span>slots livres no grupo</span>
        </div>
      </section>

      {error ? <div className="admin-feedback error">{error}</div> : null}
      {message ? <div className="admin-feedback">{message}</div> : null}

      <section className="vacancy-claim-grid">
        {/* Pagamento */}
        <article className="panel vacancy-claim-card">
          <header className="section-head">
            <div>
              <p className="eyebrow">Pagamento</p>
              <h2>
                <PixIcon size={18} style={{ display: 'inline', marginRight: 6, color: '#32BCAD' }} />
                {liberado || data?.consumido ? 'Pago e liberado' : 'Aguardando pagamento PIX'}
              </h2>
            </div>
          </header>

          {payment?.invoice_url ? (
            <a
              className="button vacancy-register"
              href={payment.invoice_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginBottom: 12 }}
            >
              Abrir pagamento PIX
            </a>
          ) : null}

          {pixSrc ? (
            <div className="vacancy-pix-box vacancy-pix-box-brand">
              <strong className="vacancy-pix-title">
                <PixIcon size={18} /> Pagar com PIX
              </strong>
              <img src={pixSrc} alt="QR Code PIX" width={200} height={200} />
              {payment?.pix_payload ? (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => void copiar(payment.pix_payload)}
                >
                  <ClipboardCopy size={14} /> Copiar código PIX
                </button>
              ) : null}
            </div>
          ) : null}

          {pending ? (
            <p className="empty" style={{ marginTop: 10 }}>
              <Loader2 className="spin" size={14} style={{ display: 'inline', marginRight: 6 }} />
              Após pagar, esta página atualiza sozinha e libera o próximo grupo com vaga.
            </p>
          ) : null}

          {liberado ? (
            <div className="message" style={{ marginTop: 10 }}>
              <CheckCircle2 size={16} style={{ display: 'inline', marginRight: 6 }} />
              Pagamento confirmado. Escolha o slot no grupo liberado ao lado.
            </div>
          ) : null}
        </article>

        {/* Claim */}
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
                  ? 'Selecione equipe, line e slot livre'
                  : 'Disponível após confirmação do pagamento'}
              </span>
            </div>
          </header>

          {success?.ok || success?.already || data?.consumido ? (
            <div className="invite-auth-box">
              <CheckCircle2 size={40} />
              <p>
                <strong>{success?.line?.nome || 'Line'}</strong>
                {success?.slot?.slot_letra ? (
                  <>
                    {' '}
                    no slot <strong>{success.slot.slot_letra}</strong>
                  </>
                ) : null}
              </p>
              <p>{success?.mensagem || 'Vaga confirmada no campeonato.'}</p>
              <a className="button" href="/vagas">
                Ver vagas
              </a>
              {data?.campeonato?.id ? (
                <a className="button secondary" href={`/campeonatos/${data.campeonato.id}`}>
                  Abrir campeonato
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
              <label className="field">
                <span>Equipe</span>
                <select value={equipeId} onChange={(e) => void onChangeEquipe(e.target.value)}>
                  {equipes.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Line</span>
                <select
                  value={lineId || (lines.length ? '' : '__create__')}
                  onChange={(e) => setLineId(e.target.value)}
                >
                  {lines.map((line) => (
                    <option key={line.id} value={line.id}>
                      {line.nome}
                    </option>
                  ))}
                  <option value="__create__">+ Criar nova line</option>
                </select>
              </label>

              {lineId === '__create__' || (!lines.length && !lineId) ? (
                <label className="field">
                  <span>Nome da nova line</span>
                  <input
                    value={nomeNovaLine}
                    onChange={(e) => setNomeNovaLine(e.target.value)}
                    placeholder="Ex.: ALOE ELITE 2"
                  />
                </label>
              ) : null}

              <label className="field">
                <span>Slot livre</span>
                <select value={slotId} onChange={(e) => setSlotId(e.target.value)}>
                  {slots.length === 0 ? (
                    <option value="">Nenhum slot livre</option>
                  ) : (
                    slots.map((s) => (
                      <option key={s.id} value={s.id}>
                        Slot {s.slot_letra || s.slot_numero}
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

              <button
                className="button vacancy-register"
                type="button"
                disabled={busy || !slotId || (!lineId && !nomeNovaLine.trim())}
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
