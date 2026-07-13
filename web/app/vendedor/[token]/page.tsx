'use client'

import { useEffect, useState } from 'react'
import { Check, MessageCircle, Shield, UserRound } from 'lucide-react'
import { useParams } from 'next/navigation'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'
import { WHATSAPP_COUNTRIES } from '@/components/forms/campeonato/CampeonatoForm'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { buildLoginHref, buildProfileCreationHref } from '@/features/auth/auth-return'
import { supabase } from '@/lib/supabase-browser'

const DEFAULT_WHATSAPP_COUNTRY = WHATSAPP_COUNTRIES[0]

type PhoneContact = {
  pais: string
  bandeira: string
  ddi: string
  telefone: string
}

export default function ConviteVendedorPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '').trim()
  const [data, setData] = useState<any>(null)
  const [nomePublico, setNomePublico] = useState('')
  const [phoneContact, setPhoneContact] = useState<PhoneContact>({
    pais: DEFAULT_WHATSAPP_COUNTRY.pais,
    bandeira: DEFAULT_WHATSAPP_COUNTRY.bandeira,
    ddi: DEFAULT_WHATSAPP_COUNTRY.ddi,
    telefone: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const response = await fetch(`/api/vendedores/convite/${encodeURIComponent(token)}`, {
        headers: sessionData.session ? { Authorization: `Bearer ${sessionData.session.access_token}` } : undefined,
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao carregar convite.')
      setData(json)
      setNomePublico((current) => current || json.convite?.nome_publico || json.manager?.nome || '')
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar convite.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (token) void load() }, [token])

  async function accept() {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Entre como manager para aceitar.')
      const response = await fetch(`/api/vendedores/convite/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_publico: nomePublico,
          whatsapp_url: `${phoneContact.ddi}${phoneContact.telefone}`,
          pais: phoneContact.pais,
          bandeira: phoneContact.bandeira,
          ddi: phoneContact.ddi,
          telefone: phoneContact.telefone,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao aceitar convite.')
      setMessage('Convite aceito. Seu painel público de vendas está ativo.')
      window.location.href = json.painel_url
    } catch (err: any) {
      setError(err?.message || 'Erro ao aceitar convite.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <DropzoneLoader label="Carregando convite" />

  if (!data?.convite) {
    return <main className="invite-page"><div className="invite-card"><Shield size={38} /><h1>Convite inválido</h1><p>{error || 'Não foi possível carregar este convite.'}</p></div></main>
  }

  const returnTo = `/vendedor/${encodeURIComponent(token)}`

  return (
    <main className="page public-page">
      <div className="shell public-shell">
        <section className="panel span-3 public-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Convite de vendedor</p>
              <h2>{data.convite.campeonatos?.nome || 'Campeonato'}</h2>
              <span>{data.convite.produtoras?.nome ? `Produtora ${data.convite.produtoras.nome}` : 'Painel de afiliado'}</span>
            </div>
            <MessageCircle />
          </div>

          {error ? <div className="message error">{error}</div> : null}
          {message ? <div className="message">{message}</div> : null}

          {data.autenticado ? data.manager ? (
            <div className="public-grid">
              <div className="panel-soft">
                <h3>Dados públicos de venda</h3>
                <Field label="Nome exibido"><input value={nomePublico} onChange={(event) => setNomePublico(event.target.value)} placeholder="Seu nome ou operação comercial" /></Field>
                <div className="whatsapp-contact-list">
                  <div className="whatsapp-contact-row seller-contact-row">
                    <Field label="País do contato">
                      <select value={phoneContact.pais} onChange={(event) => {
                        const country = WHATSAPP_COUNTRIES.find((item) => item.pais === event.target.value) || DEFAULT_WHATSAPP_COUNTRY
                        setPhoneContact((current) => ({ ...current, ...country }))
                      }}>
                        {WHATSAPP_COUNTRIES.map((country) => <option value={country.pais} key={country.ddi}>{country.bandeira} {country.pais} ({country.ddi})</option>)}
                      </select>
                    </Field>
                    <Field label="DDI"><input inputMode="tel" value={phoneContact.ddi} onChange={(event) => setPhoneContact((current) => ({ ...current, ddi: event.target.value.replace(/[^0-9+]/g, '') }))} placeholder="+55" /></Field>
                    <Field label="Contato">
                      <div className="phone-input-group"><span>{phoneContact.bandeira} {phoneContact.ddi}</span><input inputMode="tel" value={phoneContact.telefone} onChange={(event) => setPhoneContact((current) => ({ ...current, telefone: event.target.value.replace(/[^0-9 ()-]/g, '') }))} placeholder="(91) 99999-9999" /></div>
                    </Field>
                  </div>
                </div>
                <button className="button" disabled={saving} onClick={accept}><Check size={16} /> {saving ? 'Ativando...' : 'Aceitar e ativar vendas'}</button>
              </div>
              <div className="panel-soft">
                <h3>Permissão concedida</h3>
                <p className="empty">Você poderá vender vagas deste campeonato, cadastrar seu botão de WhatsApp e gerar convites de equipe sem acesso administrativo completo.</p>
              </div>
            </div>
          ) : (
            <div className="invite-auth-box">
              <UserRound size={26} />
              <p>Seu login está ativo, mas ainda não possui um perfil de manager.</p>
              <a className="button" href={buildProfileCreationHref('manager', returnTo)}>Criar manager com meu login atual</a>
              <a className="button secondary" href={buildLoginHref('manager', returnTo, true)}>Usar outro login</a>
            </div>
          ) : (
            <div className="invite-auth-actions">
              <SocialLogin profileType="manager" returnTo={returnTo} />
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>
}
