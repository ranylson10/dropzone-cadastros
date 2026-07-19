'use client'

import { useEffect, useState } from 'react'
import { Field, UploadField } from '@/features/dropzone/components/form-fields'
import { supabase } from '@/lib/supabase-browser'
import { uploadPublicFile } from '@/lib/upload-public'

type ProfileType = 'equipe' | 'manager' | 'jogador' | 'produtora' | 'broadcast'

export function ProfileEditForm(props: {
  profileType: ProfileType
  profileId: string
  initial: {
    nome?: string
    logo_url?: string | null
    avatar_url?: string | null
    bio?: string | null
    tag?: string | null
    whatsapp_url?: string | null
    nome_publico_vendas?: string | null
    id_jogo?: string | null
    funcao?: string | null
  }
  onSaved?: (profile: any) => void
}) {
  const logoField =
    props.profileType === 'manager' || props.profileType === 'jogador' || props.profileType === 'broadcast'
      ? 'avatar_url'
      : 'logo_url'
  const bucket =
    props.profileType === 'jogador' ||
    props.profileType === 'manager' ||
    props.profileType === 'broadcast'
      ? props.profileType
      : props.profileType === 'equipe'
        ? 'equipe'
        : 'produtora'

  const [nome, setNome] = useState(props.initial.nome || '')
  const [bio, setBio] = useState(props.initial.bio || '')
  const [logo, setLogo] = useState(props.initial.logo_url || props.initial.avatar_url || '')
  const [tag, setTag] = useState(props.initial.tag || '')
  const [whatsapp, setWhatsapp] = useState(props.initial.whatsapp_url || '')
  const [nomePublico, setNomePublico] = useState(props.initial.nome_publico_vendas || '')
  const [idJogo, setIdJogo] = useState(props.initial.id_jogo || '')
  const [funcao, setFuncao] = useState(props.initial.funcao || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    setNome(props.initial.nome || '')
    setBio(props.initial.bio || '')
    setLogo(props.initial.logo_url || props.initial.avatar_url || '')
    setTag(props.initial.tag || '')
    setWhatsapp(props.initial.whatsapp_url || '')
    setNomePublico(props.initial.nome_publico_vendas || '')
    setIdJogo(props.initial.id_jogo || '')
    setFuncao(props.initial.funcao || '')
  }, [props.profileId, props.initial.nome, props.initial.bio, props.initial.logo_url, props.initial.avatar_url])

  async function save() {
    setBusy(true)
    setError('')
    setOk('')
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Sessão expirada.')

      const body: Record<string, unknown> = {
        profile_type: props.profileType,
        profile_id: props.profileId,
        nome: nome.trim(),
        bio: bio.trim(),
        [logoField]: logo.trim() || null,
      }
      if (props.profileType === 'equipe') body.tag = tag.trim() || null
      if (props.profileType === 'manager') {
        body.whatsapp_url = whatsapp.trim() || null
        body.nome_publico_vendas = nomePublico.trim() || null
      }
      if (props.profileType === 'jogador') {
        body.id_jogo = idJogo.trim() || null
        body.funcao = funcao.trim() || null
      }

      const res = await fetch('/api/me/perfil', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-profile-type': props.profileType,
        },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar.')
      setOk(json.warning || 'Perfil atualizado.')
      props.onSaved?.(json.profile)
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar perfil.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="inline-action-panel profile-edit-form">
      {error ? <div className="message error">{error}</div> : null}
      {ok ? <div className="message success">{ok}</div> : null}
      <div className="mini-grid two">
        <Field label="Nome">
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
        </Field>
        {props.profileType === 'equipe' ? (
          <Field label="Tag">
            <input value={tag} onChange={(e) => setTag(e.target.value)} maxLength={12} />
          </Field>
        ) : null}
        {props.profileType === 'jogador' ? (
          <Field label="ID do jogo">
            <input value={idJogo} onChange={(e) => setIdJogo(e.target.value)} />
          </Field>
        ) : null}
        {props.profileType === 'jogador' ? (
          <Field label="Função">
            <input value={funcao} onChange={(e) => setFuncao(e.target.value)} placeholder="IGL, entry..." />
          </Field>
        ) : null}
        {props.profileType === 'manager' ? (
          <Field label="Nome público (vendas)">
            <input value={nomePublico} onChange={(e) => setNomePublico(e.target.value)} />
          </Field>
        ) : null}
        {props.profileType === 'manager' ? (
          <Field label="WhatsApp">
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="https://wa.me/..." />
          </Field>
        ) : null}
      </div>
      <UploadField
        label={props.profileType === 'jogador' || props.profileType === 'manager' ? 'Foto / avatar' : 'Logo'}
        value={logo}
        bucket={bucket}
        onChange={setLogo}
        onUpload={async (file, b) => uploadPublicFile(file, b, props.profileType)}
      />
      <Field label="Bio curta (até 280 caracteres)">
        <textarea
          rows={3}
          value={bio}
          maxLength={280}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Uma frase sobre o perfil..."
        />
      </Field>
      <div className="button-row" style={{ marginTop: 8 }}>
        <button type="button" className="button" disabled={busy} onClick={() => void save()}>
          {busy ? 'Salvando...' : 'Salvar perfil'}
        </button>
      </div>
    </div>
  )
}
