'use client'

import { useEffect, useState } from 'react'
import { Check, CheckCircle2, Shield, UserRound, X } from 'lucide-react'
import { useParams } from 'next/navigation'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { buildLoginHref, buildProfileCreationHref } from '@/features/auth/auth-return'
import { supabase } from '@/lib/supabase-browser'

export default function ConviteVendedorPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '').trim()
  const returnTo = `/vendedor/${encodeURIComponent(token)}`

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [gate, setGate] = useState(true)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const hasSession = Boolean(sessionData.session)
      setGate(!hasSession)

      const response = await fetch(`/api/vendedores/convite/${encodeURIComponent(token)}`, {
        headers: sessionData.session
          ? { Authorization: `Bearer ${sessionData.session.access_token}` }
          : undefined,
        cache: 'no-store',
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao carregar convite.')
      setData(json)
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar convite.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) void load()
  }, [token])

  // Logado sem perfil manager → formulário de criação (padrão do sistema)
  useEffect(() => {
    if (loading || !data) return
    if (data.error) return
    if (!data.autenticado) return
    if (data.manager) return
    if (!data.valido) return
    window.location.replace(buildProfileCreationHref('manager', returnTo))
  }, [loading, data?.autenticado, data?.manager, data?.valido, data?.error, returnTo, token])

  async function accept() {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        setGate(true)
        throw new Error('Entre com uma conta de manager para aceitar.')
      }
      if (!data?.manager) {
        window.location.assign(buildProfileCreationHref('manager', returnTo))
        return
      }

      const response = await fetch(`/api/vendedores/convite/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome_publico: data.manager?.nome || data.manager?.username || '',
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao aceitar convite.')
      setMessage(json.mensagem || 'Convite aceito.')
      // Painel do manager: configurar WhatsApp e ver campeonatos liberados
      window.location.href = json.painel_url || '/'
    } catch (err: any) {
      setError(err?.message || 'Erro ao aceitar convite.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <DropzoneLoader label="Carregando convite" />

  if (!data?.convite) {
    return (
      <main className="invite-page">
        <div className="invite-card">
          <Shield size={38} />
          <h1>Convite inválido</h1>
          <p>{error || 'Não foi possível carregar este convite.'}</p>
        </div>
      </main>
    )
  }

  const produtoraNome = data.convite.produtoras?.nome || 'a produtora'
  const titulo =
    data.modo === 'produtora' || !data.convite.campeonatos?.nome
      ? produtoraNome
      : data.convite.campeonatos.nome

  // Logado sem manager: tela de transição
  if (data.autenticado && !data.manager && data.valido) {
    return (
      <main className="invite-page">
        <div className="invite-card">
          <UserRound size={42} />
          <p className="eyebrow">Perfil de manager</p>
          <h1>Criando seu perfil de manager...</h1>
          <p>
            Para vender vagas você precisa de um <strong>perfil de manager</strong>. Abrindo o cadastro...
          </p>
          <a className="button invite-confirm" href={buildProfileCreationHref('manager', returnTo)}>
            Criar manager agora
          </a>
          <a className="button secondary" href={buildLoginHref('manager', returnTo, true)}>
            Usar outro login
          </a>
        </div>
      </main>
    )
  }

  return (
    <>
      <main className="invite-page">
        <div className="invite-card">
          <Shield size={42} />
          <p className="eyebrow">Convite de vendedor</p>
          <h1>{titulo}</h1>
          <p>
            Convite para <strong>vender vagas de campeonatos</strong> da produtora{' '}
            <strong>{produtoraNome}</strong>.
          </p>

          <div className="invite-details" style={{ gridTemplateColumns: '1fr', textAlign: 'left', marginTop: 8 }}>
            <span style={{ borderRight: 0 }}>
              <strong>O que você recebe</strong>
              Entrar na lista de vendedores da produtora. O produtor libera os campeonatos e o limite de vagas.
            </span>
            <span style={{ borderRight: 0 }}>
              <strong>Depois de aceitar</strong>
              No painel do manager você cadastra o WhatsApp de vendas e escolhe o que anunciar no seu link.
            </span>
            <span style={{ borderRight: 0, borderBottom: 0 }}>
              <strong>Requisito</strong>
              Conta com perfil de <strong>manager</strong> (não é perfil de equipe nem jogador).
            </span>
          </div>

          {error ? <p className="invite-message" style={{ color: '#b4232d' }}>{error}</p> : null}
          {message ? <p className="invite-message">{message}</p> : null}

          {!data.valido ? (
            <div className="invite-expired">
              <CheckCircle2 size={20} />
              Este convite expirou ou já foi utilizado.
            </div>
          ) : data.autenticado && data.manager ? (
            <>
              <div className="invite-current-team" style={{ marginTop: 16 }}>
                <small>Você vai aceitar como</small>
                <strong>{data.manager.nome || data.manager.username}</strong>
                <span>Manager</span>
              </div>
              <button className="button invite-confirm" type="button" disabled={saving} onClick={() => void accept()}>
                <Check size={16} /> {saving ? 'Aceitando...' : 'Aceitar convite'}
              </button>
              <a className="button secondary" href={buildLoginHref('manager', returnTo, true)}>
                Usar outra conta
              </a>
            </>
          ) : (
            <div className="invite-auth-box" style={{ marginTop: 16 }}>
              <p>Entre com uma conta de <strong>manager</strong> para aceitar este convite.</p>
              <button className="button invite-confirm" type="button" onClick={() => setGate(true)}>
                Entrar / criar manager
              </button>
            </div>
          )}
        </div>
      </main>

      {gate ? (
        <div className="vacancies-access-gate">
          <section>
            <button
              className="gate-close"
              type="button"
              onClick={() => setGate(false)}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
            <img src="/dropzone-icon.png" alt="" />
            <p className="eyebrow">Convite de vendedor</p>
            <h2>Como deseja continuar?</h2>
            <p>
              Para aceitar você precisa de um <strong>perfil de manager</strong>. Entre com Google/Facebook/Discord —
              se ainda não tiver manager, o cadastro abre em seguida.
            </p>
            <SocialLogin profileType="manager" returnTo={returnTo} />
            <a
              className="button secondary"
              href={buildLoginHref('manager', returnTo)}
              style={{ width: '100%', marginTop: 8, placeContent: 'center' }}
            >
              Entrar com login e senha
            </a>
          </section>
        </div>
      ) : null}
    </>
  )
}
