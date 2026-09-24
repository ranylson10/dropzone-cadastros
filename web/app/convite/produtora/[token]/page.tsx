'use client'

import { useEffect, useState } from 'react'
import { Building2, CheckCircle2, LockKeyhole, LogIn, Users } from 'lucide-react'
import { useParams } from 'next/navigation'
import { buildLoginHref, currentInternalPath } from '@/features/auth/auth-return'
import { supabase } from '@/lib/supabase-browser'
import './invite.css'

type InvitePreview = {
  tipo: 'criacao' | 'membro'
  produtora_nome: string
  cargo?: string | null
  cargo_label?: string | null
  email_mascarado: string
  status: string
  expira_em: string
}

export default function ProducerInvitePage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const [invite, setInvite] = useState<InvitePreview | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([
      fetch(`/api/produtora/convites/${encodeURIComponent(token)}`, { cache: 'no-store' }).then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Convite inválido.')
        return payload.convite as InvitePreview
      }),
      supabase.auth.getSession(),
    ])
      .then(([preview, session]) => {
        if (!active) return
        setInvite(preview)
        setAuthenticated(Boolean(session.data.session?.access_token))
      })
      .catch((cause: any) => { if (active) setError(cause?.message || 'Não foi possível carregar o convite.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  async function acceptInvite() {
    setBusy(true)
    setError('')
    try {
      const { data } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token
      if (!accessToken) {
        window.location.assign(buildLoginHref(null, currentInternalPath()))
        return
      }
      const response = await fetch(`/api/produtora/convites/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Não foi possível aceitar o convite.')
      setAccepted(true)
      const workspaceId = String(payload?.workspace?.id || '').trim()
      const target = workspaceId ? `/?perfil=produtora&perfil_id=${encodeURIComponent(workspaceId)}` : '/?perfil=produtora'
      window.setTimeout(() => window.location.assign(target), 900)
    } catch (cause: any) {
      setError(cause?.message || 'Não foi possível aceitar o convite.')
    } finally {
      setBusy(false)
    }
  }

  const unavailable = invite && invite.status !== 'pendente'
  const creation = invite?.tipo === 'criacao'

  return (
    <main className="producer-invite-page">
      <section className="producer-invite-card">
        <header>
          <span className="producer-invite-logo"><Building2 size={26} /></span>
          <div><small>DROPZONE · ACESSO PRIVADO</small><h1>{creation ? 'Criar workspace' : 'Entrar na produtora'}</h1></div>
        </header>

        {loading ? <div className="producer-invite-state">Carregando convite…</div> : null}
        {error ? <div className="producer-invite-state error">{error}</div> : null}

        {!loading && invite ? (
          <>
            <div className="producer-invite-workspace">
              <span>{creation ? <LockKeyhole size={22} /> : <Users size={22} />}</span>
              <div>
                <small>{creation ? 'Produtora autorizada pela Central DropZone' : 'Equipe interna'}</small>
                <strong>{invite.produtora_nome}</strong>
                <p>{creation ? 'Este convite cria um workspace privado vinculado à sua conta.' : `Cargo liberado: ${invite.cargo_label || invite.cargo || 'Membro'}.`}</p>
              </div>
            </div>
            <dl className="producer-invite-meta">
              <div><dt>Conta autorizada</dt><dd>{invite.email_mascarado}</dd></div>
              <div><dt>Validade</dt><dd>{new Date(invite.expira_em).toLocaleDateString('pt-BR')}</dd></div>
            </dl>

            {accepted ? (
              <div className="producer-invite-success"><CheckCircle2 size={22} /><span><strong>Acesso confirmado</strong><small>Abrindo o workspace da produtora…</small></span></div>
            ) : unavailable ? (
              <div className="producer-invite-state error">Este convite está {invite.status} e não pode mais ser utilizado.</div>
            ) : authenticated ? (
              <button className="producer-invite-primary" type="button" disabled={busy} onClick={() => void acceptInvite()}>
                <CheckCircle2 size={18} /> {busy ? 'Confirmando…' : creation ? 'Criar minha produtora' : 'Aceitar acesso'}
              </button>
            ) : (
              <a className="producer-invite-primary" href={buildLoginHref(null, currentInternalPath())}><LogIn size={18} /> Entrar para aceitar</a>
            )}
            <p className="producer-invite-note">Entre com o mesmo e-mail que recebeu o convite. O acesso só funciona para a conta autorizada.</p>
          </>
        ) : null}
      </section>
    </main>
  )
}
