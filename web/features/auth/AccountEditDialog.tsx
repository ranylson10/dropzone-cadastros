'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { getSessionWithTimeout } from '@/lib/auth-client-state'
import { supabase } from '@/lib/supabase-browser'
import type { AccountIdentity } from '@/lib/types'
import { uploadPublicFile } from '@/lib/upload-public'
import { assertUsername, cleanUsername } from '@/lib/validation'
import './account-edit-dialog.css'

export function AccountEditDialog({ identity, onClose, onSaved }: {
  identity: AccountIdentity
  onClose: () => void
  onSaved: (identity: AccountIdentity) => void
}) {
  const [name, setName] = useState(identity.name || '')
  const [username, setUsername] = useState(identity.username || '')
  const [avatar, setAvatar] = useState(identity.avatar_url || '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const imageInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const url = imageFile ? URL.createObjectURL(imageFile) : ''
    setImagePreview(url)
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [imageFile])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const nextName = name.trim()
      if (nextName.length < 2 || nextName.length > 60) throw new Error('O nome deve ter entre 2 e 60 caracteres.')
      const nextUsername = assertUsername(username)
      const session = await getSessionWithTimeout()
      if (!session) throw new Error('Sessão expirada. Entre novamente para salvar suas informações.')
      const avatarUrl = imageFile ? await uploadPublicFile(imageFile, 'account') : avatar
      if (imageFile) {
        setAvatar(avatarUrl)
        setImageFile(null)
        if (imageInput.current) imageInput.current.value = ''
      }
      const response = await fetch('/api/me/account', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: nextName, username: nextUsername, avatar_url: avatarUrl }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Não foi possível atualizar a conta.')
      // Keep the persisted session metadata in sync with the saved account.
      await supabase.auth.refreshSession().catch(() => undefined)
      onSaved({ ...identity, ...payload.user })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a conta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open title="Editar informações" description="Atualize os dados da sua conta DropZone." size="medium"
      onClose={() => { if (!busy) onClose() }} className="account-edit-dialog">
      <form className="account-edit-form" onSubmit={save} aria-busy={busy}>
        <div className="account-edit-avatar">
          {imagePreview || avatar ? <img src={imagePreview || avatar} alt="Foto atual da conta" width={72} height={72} /> : <span aria-hidden="true">{(name || 'DZ').slice(0, 2).toUpperCase()}</span>}
          <Field label="Foto de perfil" hint={imageFile ? `Nova foto: ${imageFile.name}` : 'PNG, JPG ou WebP.'}>
            <Input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => {
              const file = event.target.files?.[0] || null
              if (file && !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
                setError('Escolha uma imagem PNG, JPG ou WebP.')
                event.target.value = ''
                setImageFile(null)
                return
              }
              setImageFile(file)
              setError('')
            }} />
          </Field>
          {avatar || imageFile ? <button type="button" disabled={busy} onClick={() => { setAvatar(''); setImageFile(null); if (imageInput.current) imageInput.current.value = '' }}>Remover foto</button> : null}
        </div>
        <Field label="Nome de exibição" required>
          <Input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={60} autoComplete="name" disabled={busy} required />
        </Field>
        <Field label="Usuário" hint="3 a 24 caracteres: letras, números, ponto ou underline." required>
          <Input value={username} onChange={(event) => setUsername(cleanUsername(event.target.value))} pattern="[a-z0-9._]{3,24}" minLength={3} maxLength={24} autoComplete="username" disabled={busy} required />
        </Field>
        {identity.email ? <Field label="E-mail"><Input type="email" value={identity.email} readOnly /></Field> : null}
        {error ? <p role="alert">{error}</p> : null}
        <div className="account-edit-actions">
          <button type="button" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar alterações'}</button>
        </div>
      </form>
    </Dialog>
  )
}
