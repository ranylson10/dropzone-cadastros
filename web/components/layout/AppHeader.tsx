'use client'

import Link from 'next/link'

import { Input as UiInput } from '@/components/ui/Field'
import { CalendarDays, Camera, ChevronDown, Globe2, Home, LayoutDashboard, Loader2, LogOut, Menu, Plus, Search, Shield, Trophy, UsersRound, UserRound, Wallet, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { useDisclosureFocus } from '@/components/ui/useDisclosureFocus'
import { usePathname } from 'next/navigation'
import { isWebProfileType, type DropZoneRow, type WebProfileType } from '@/lib/types'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { SystemLogo } from '@/components/brand/SystemLogo'
import { WorkspacePanelSwitcher } from '@/components/workspace/WorkspacePanelSwitcher'
import { APP_NAV, resolveActiveNavLabel, type AppNavItem } from './nav'
import { supabase } from '@/lib/supabase-browser'
import { useGlobalLocale } from '@/features/i18n/global-locale'
import { uploadPublicFile } from '@/lib/upload-public'

export type AppHeaderNavItem = AppNavItem

type AppHeaderProps = {
  /** Defaults to global APP_NAV — change only in nav.ts */
  navItems?: AppHeaderNavItem[]
  activeLabel?: string
  profileName?: string
  profileSubtitle?: string
  profileImage?: string
  accounts?: DropZoneRow[]
  activeAccountId?: string
  activeContext?: DropZoneRow | null
  switchingAccountId?: string
  onSwitchAccount?: (account: DropZoneRow) => void
  onCreateLinkedProfile?: (profileType?: WebProfileType) => void
  onSignOut?: () => void
  onHomeClick?: () => void
  /** Guest CTA when not logged in */
  loginHref?: string
  loginLabel?: string
  /** Mostra chip de saldo (produtora / manager) */
  showWallet?: boolean
  /** Link para /admin se for admin do sistema */
  showAdmin?: boolean
  showQuickActions?: boolean
}

function profileMedia(account: DropZoneRow) {
  return account.data?.logo_url || account.data?.avatar_url || ''
}

function areaLabel(type?: string | null) {
  if (type === 'equipe') return 'Minha equipe'
  if (type === 'jogador') return 'Perfil competitivo'
  if (type === 'produtora') return 'Minha produtora'
  if (type === 'manager') return 'Minha área'
  return 'Área da conta'
}

/**
 * Avatar com tamanho travado em style inline + attrs HTML.
 * Não depende de CSS global — evita logo estourar a tela.
 */
function LockedAvatar({
  src,
  size,
  fallback,
}: {
  src?: string
  size: number
  fallback: string
}) {
  const box: CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    maxWidth: size,
    maxHeight: size,
    overflow: 'hidden',
    borderRadius: '10px',
    border: 0,
    background: 'var(--ui-surface-soft, #202125)',
    flex: `0 0 ${size}px`,
    boxSizing: 'border-box',
  }
  const img: CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    maxWidth: size,
    maxHeight: size,
    objectFit: 'cover',
    display: 'block',
    borderRadius: '10px',
  }
  return (
    <span style={box} className="app-profile-avatar" data-locked-avatar={size} aria-hidden="true">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} style={img} />
      ) : (
        <b style={{ fontSize: Math.max(12, size * 0.32), fontWeight: 900 }}>{fallback}</b>
      )}
    </span>
  )
}

export function AppHeader({
  navItems = APP_NAV,
  activeLabel,
  profileName,
  profileSubtitle,
  profileImage,
  accounts = [],
  activeAccountId,
  activeContext,
  switchingAccountId,
  onSwitchAccount,
  onCreateLinkedProfile,
  onSignOut,
  onHomeClick,
  loginHref = '/login?returnTo=%2F',
  loginLabel = 'Entrar no sistema',
  showWallet = false,
  showAdmin = false,
  showQuickActions = true,
}: AppHeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [walletSaldo, setWalletSaldo] = useState<number | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [globalLocale, changeGlobalLocale] = useGlobalLocale()
  const [accountAvatar, setAccountAvatar] = useState(profileImage || '')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const menuId = useId().replace(/:/g, '')
  const profilePopup = useDisclosureFocus(profileOpen, () => setProfileOpen(false))
  const languagePopup = useDisclosureFocus(languageOpen, () => setLanguageOpen(false))
  const mobilePopup = useDisclosureFocus<HTMLElement>(mobileOpen, () => setMobileOpen(false), true, true)
  const pathname = usePathname()
  const navActive = activeLabel || resolveActiveNavLabel(pathname)
  const isAuthenticated = Boolean(profileName && onSignOut)
  const visibleAccounts = accounts.filter((item) => isWebProfileType(item.profile_type))
  const activeAccount = activeContext || visibleAccounts.find((item) => item.id === activeAccountId) || visibleAccounts[0] || null
  const activeProfileType = activeAccount?.profile_type || null

  const quickActions = activeProfileType === 'produtora'
    ? [
        { label: 'Criar campeonato', detail: 'Começar uma nova competição', href: '/?painel=1&acao=criar-campeonato', icon: Trophy },
        { label: 'Meus campeonatos', detail: 'Continuar uma organização', href: '/?painel=1&section=campeonatos', icon: LayoutDashboard },
        { label: 'Agenda', detail: 'Jogos e compromissos', href: '/agenda', icon: CalendarDays },
      ]
    : activeProfileType === 'equipe'
      ? [
          { label: 'Encontrar campeonato', detail: 'Ver vagas abertas', href: '/campeonatos?vagas=1', icon: Trophy },
          { label: 'Minha equipe', detail: 'Elenco, lines e gestão', href: '/?painel=1&section=dashboard', icon: UsersRound },
          { label: 'Agenda', detail: 'Próximos jogos', href: '/agenda', icon: CalendarDays },
        ]
      : activeProfileType === 'jogador'
        ? [
            { label: 'Minhas competições', detail: 'Inscrições, agenda e resultados', href: '/?painel=1&section=competicoes', icon: Trophy },
            { label: 'Minha agenda', detail: 'Jogos e escalações', href: '/agenda', icon: CalendarDays },
            { label: 'Encontrar campeonato', detail: 'Explorar competições', href: '/campeonatos', icon: Trophy },
          ]
        : activeProfileType === 'manager'
          ? [
              { label: 'Central de afiliados', detail: 'Vendas e comissões', href: '/afiliados', icon: LayoutDashboard },
              { label: 'Vagas abertas', detail: 'Campeonatos disponíveis', href: '/campeonatos?vagas=1', icon: Trophy },
              { label: 'Agenda', detail: 'Próximos compromissos', href: '/agenda', icon: CalendarDays },
            ]
          : [
              { label: 'Buscar campeonato', detail: 'Explorar competições', href: '/campeonatos', icon: Search },
              { label: 'Vagas abertas', detail: 'Encontrar uma oportunidade', href: '/campeonatos?vagas=1', icon: Trophy },
              { label: 'Equipes', detail: 'Encontre equipes e jogadores', href: '/equipes', icon: UsersRound },
            ]

  useEffect(() => {
    setAccountAvatar(profileImage || '')
  }, [profileImage])

  async function changeAccountAvatar(file?: File) {
    if (!file || avatarUploading) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('Escolha uma imagem PNG, JPG ou WebP.')
      return
    }
    setAvatarUploading(true)
    setAvatarError('')
    try {
      const avatarUrl = await uploadPublicFile(file, 'account')
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Sessão expirada.')
      const response = await fetch('/api/me/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar a foto.')
      await supabase.auth.refreshSession().catch(() => undefined)
      setAccountAvatar(avatarUrl)
    } catch (error: any) {
      setAvatarError(error?.message || 'Não foi possível salvar a foto.')
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  useEffect(() => {
    setProfileOpen(false)
    setLanguageOpen(false)
    setMobileOpen(false)
    setQuickOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isAuthenticated) {
      setWalletSaldo(null)
      setIsAdmin(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) return

        if (showWallet) {
          const res = await fetch('/api/me/carteira', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          })
          const json = await res.json().catch(() => ({}))
          if (!cancelled && res.ok) {
            setWalletSaldo(Number(json.carteira?.saldo_disponivel_centavos || 0))
          }
        } else if (!cancelled) {
          setWalletSaldo(null)
        }

        // Sempre revalida admin no backend (não confiar no prop sozinho)
        const adminRes = await fetch('/api/admin/session', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const adminJson = await adminRes.json().catch(() => ({}))
        if (!cancelled) setIsAdmin(Boolean(adminJson.isAdmin))
      } catch {
        if (!cancelled) {
          setWalletSaldo(null)
          setIsAdmin(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showWallet, isAuthenticated, activeAccountId])

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link className="app-brand" href="/" aria-label="DropZone. O seu jogo começa aqui — início">
          <span className="app-brand-logo">
            <SystemLogo size={44} alt="" fit="contain" variant="default" />
          </span>
          <span className="app-brand-copy">
            <strong aria-label="DropZone">DROPZONE<span className="dz-brand-period" aria-hidden="true">.</span></strong>
            <small aria-hidden="true">O SEU JOGO COMEÇA AQUI</small>
          </span>
        </Link>

        <button
          className="app-mobile-toggle"
          type="button"
          onClick={(event) => {
            event.currentTarget.focus({ preventScroll: true })
            setProfileOpen(false)
            setLanguageOpen(false)
            setQuickOpen(false)
            setMobileOpen((value) => !value)
          }}
          aria-expanded={mobileOpen}
          aria-controls={`${menuId}-navigation`}
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {mobileOpen ? (
          <button
            type="button"
            className="app-mobile-nav-backdrop"
            aria-label="Fechar navegação"
            onClick={() => mobilePopup.close(true)}
          />
        ) : null}

        <nav ref={mobilePopup.panelRef} id={`${menuId}-navigation`} className={`app-main-nav ${mobileOpen ? 'is-open' : ''}`} tabIndex={-1} aria-label="Navegação principal">
          <div className="app-mobile-sheet-heading">
            <div><small>DROPZONE / PAINEL</small><strong>Menu da plataforma</strong></div>
            <button type="button" onClick={() => mobilePopup.close(true)} aria-label="Fechar menu"><X size={21} aria-hidden="true" /></button>
          </div>
          {isAuthenticated ? <Link href="/?painel=1" className="app-dashboard-entry" aria-current={navActive === 'Meu painel' ? 'page' : undefined} onClick={() => setMobileOpen(false)}><LayoutDashboard size={17} aria-hidden="true" /> Meu painel</Link> : null}
          {navItems.map((item) => {
            const hasChildren = Boolean(item.children?.length)
            if (!hasChildren) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={navActive === item.label ? 'active' : ''}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              )
            }
            return (
              <div
                key={item.label}
                className={`app-nav-dropdown ${navActive === item.label ? 'active' : ''}`}
              >
                <Link
                  href={item.href}
                  className={`app-nav-parent ${navActive === item.label ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                  <ChevronDown size={14} className="app-nav-caret" aria-hidden />
                </Link>
                <div className="app-nav-submenu">
                  {item.children!.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => setMobileOpen(false)}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
          {isAuthenticated ? (
            <div className="app-mobile-nav-account">
              <Link href="/?painel=1" onClick={() => setMobileOpen(false)}>
                <LayoutDashboard size={16} />
                <span>Meu painel</span>
              </Link>
              <button type="button" className="app-mobile-account-trigger" onClick={() => {
                setMobileOpen(false)
                setProfileOpen(true)
              }}><UserRound size={16} aria-hidden="true" /><span>Trocar perfil e configurações da conta</span></button>
              {showWallet ? (
                <Link href="/carteira" onClick={() => setMobileOpen(false)}>
                  <Wallet size={16} />
                  <span>Carteira</span>
                  <strong>
                    {walletSaldo == null
                      ? 'Abrir'
                      : new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(walletSaldo / 100)}
                  </strong>
                </Link>
              ) : null}
              {isAdmin || showAdmin ? (
                <Link href="/admin" onClick={() => setMobileOpen(false)}>
                  <Shield size={16} />
                  <span>Administração</span>
                </Link>
              ) : null}
            </div>
          ) : <Link className="app-mobile-login" href={loginHref} onClick={() => setMobileOpen(false)}>{loginLabel}</Link>}
        </nav>

        <nav className="app-mobile-dock" aria-label="Navegação inferior do aplicativo">
          <Link href="/" className={pathname === '/' && !isAuthenticated ? 'active' : ''} aria-current={pathname === '/' && !isAuthenticated ? 'page' : undefined} onClick={event => { setQuickOpen(false); if (onHomeClick && pathname === '/') { event.preventDefault(); onHomeClick() } }}>
            <Home size={20} aria-hidden /><span>Início</span>
          </Link>
          <Link href="/campeonatos" className={pathname === '/campeonatos' || pathname?.startsWith('/campeonatos/') ? 'active' : ''} aria-current={pathname === '/campeonatos' || pathname?.startsWith('/campeonatos/') ? 'page' : undefined} onClick={() => setQuickOpen(false)}>
            <Trophy size={20} aria-hidden /><span>Campeonatos</span>
          </Link>
          <Link href="/equipes" className={pathname === '/equipes' || pathname?.startsWith('/equipes/') ? 'active' : ''} aria-current={pathname === '/equipes' || pathname?.startsWith('/equipes/') ? 'page' : undefined} onClick={() => setQuickOpen(false)}>
            <UsersRound size={20} aria-hidden /><span>Equipes</span>
          </Link>
          <Link href="/jogadores" className={pathname === '/jogadores' || pathname?.startsWith('/jogadores/') ? 'active' : ''} aria-current={pathname === '/jogadores' || pathname?.startsWith('/jogadores/') ? 'page' : undefined} onClick={() => setQuickOpen(false)}>
            <UserRound size={20} aria-hidden /><span>Jogadores</span>
          </Link>
          <WorkspacePanelSwitcher className="app-mobile-panel-action" active={pathname === '/' && isAuthenticated}
            activeAccountId={activeAccountId} onSelect={onSwitchAccount}
            onBeforeOpen={() => { setMobileOpen(false); setProfileOpen(false); setQuickOpen(false); setLanguageOpen(false) }} />
        </nav>
        {isAuthenticated && showQuickActions ? <button type="button" className="app-action-fab"
          aria-label="Abrir ações rápidas" aria-expanded={quickOpen}
          onClick={() => { setMobileOpen(false); setProfileOpen(false); setQuickOpen((value) => !value) }}>
          <Plus size={22} aria-hidden /><span>Ação</span>
        </button> : null}

        <Dialog open={quickOpen} title="Ações rápidas" description="O que você quer fazer?"
          onClose={() => setQuickOpen(false)} size="medium" closeLabel="Fechar ações rápidas" className="app-quick-dialog">
              <div className="app-mobile-quick-list">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <Link href={action.href} key={action.href + action.label} onClick={() => setQuickOpen(false)}>
                      <span className="app-mobile-quick-action-icon"><Icon size={19} aria-hidden /></span>
                      <span><strong>{action.label}</strong><small>{action.detail}</small></span>
                      <span aria-hidden>›</span>
                    </Link>
                  )
                })}
              </div>
        </Dialog>

        <div className="app-global-language" data-no-translate aria-label="Idioma">
          <button
            type="button"
            className="app-global-language-trigger"
            aria-expanded={languageOpen}
            aria-controls={languageOpen ? `${menuId}-language` : undefined}
            aria-label={`Alterar idioma: ${globalLocale === 'pt-BR' ? 'PT' : globalLocale.toUpperCase()}`}
            onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); setLanguageOpen((value) => !value) }}
          >
            <Globe2 size={14} />
            <span>{globalLocale === 'pt-BR' ? 'PT' : globalLocale.toUpperCase()}</span>
            <ChevronDown size={14} className={languageOpen ? 'rotated' : ''} />
          </button>
          {languageOpen ? (
            <div ref={languagePopup.panelRef} id={`${menuId}-language`} className="app-global-language-menu" role="group" aria-label="Idiomas do site">
              {(['pt-BR', 'es', 'en'] as const).map((item) => (
                <button
                  type="button"
                  key={item}
                  className={globalLocale === item ? 'active' : ''}
                  aria-label={item === 'pt-BR' ? 'Português' : item === 'es' ? 'Español' : 'English'}
                  aria-pressed={globalLocale === item}
                  onClick={() => {
                    changeGlobalLocale(item)
                    languagePopup.close(true)
                  }}
                >
                  <span>{item === 'pt-BR' ? 'PT' : item.toUpperCase()}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {isAuthenticated ? (
          <div className="app-profile">
            <WorkspacePanelSwitcher className="app-desktop-panel-switcher"
              label={activeAccount?.name || 'Painéis'} activeAccountId={activeAccountId}
              onSelect={onSwitchAccount}
              onBeforeOpen={() => { setProfileOpen(false); setLanguageOpen(false); setQuickOpen(false) }} />
            {showWallet ? (
              <Link
                href="/carteira"
                className="app-wallet-chip"
                title="Abrir carteira"
                onClick={() => setMobileOpen(false)}
              >
                <Wallet size={15} />
                <span>
                  {walletSaldo == null
                    ? 'Carteira'
                    : new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(walletSaldo / 100)}
                </span>
              </Link>
            ) : null}
            {isAdmin || showAdmin ? (
              <Link
                href="/admin"
                className="app-admin-chip"
                title="Administração do sistema"
                onClick={() => setMobileOpen(false)}
              >
                Admin
              </Link>
            ) : null}
            <NotificationBell />
            <button
              type="button"
              className="app-profile-trigger"
              onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); setProfileOpen((value) => !value) }}
              aria-expanded={profileOpen}
              aria-controls={profileOpen ? `${menuId}-account` : undefined}
            >
              <span className="sr-only">Abrir minha conta </span>
              <LockedAvatar
                src={accountAvatar || undefined}
                size={40}
                fallback={String(profileName).slice(0, 2).toUpperCase()}
              />
              <span className="app-profile-copy" style={{ minWidth: 0, overflow: 'hidden' }}>
                <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profileName}
                </strong>
                <small style={{ display: 'block', color: 'var(--ui-muted)', fontSize: 12 }}>
                  {profileSubtitle || 'Conta DropZone'}
                </small>
              </span>
              <ChevronDown size={16} className={profileOpen ? 'rotated' : ''} />
            </button>

            {profileOpen ? (
              <div
                ref={profilePopup.panelRef}
                id={`${menuId}-account`}
                role="region"
                aria-label="Minha conta"
                className="app-profile-menu linked-account-menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: 280,
                  maxWidth: '90vw',
                  maxHeight: '70vh',
                  overflow: 'auto',
                  border: '1px solid var(--ui-line)',
                  borderRadius: 8,
                  background: 'var(--ui-surface-raised)',
                  boxShadow: '0 18px 50px rgba(0,0,0,.32)',
                  zIndex: 200,
                }}
              >
                <div className="app-profile-menu-head" style={{ padding: 14, borderBottom: '1px solid var(--ui-line)', background: 'var(--ui-surface)' }}>
                  <strong>Minha conta</strong>
                  <span style={{ display: 'block', marginTop: 3, color: 'var(--ui-muted)', fontSize: 12 }}>
                    {visibleAccounts.length ? 'Cadastros disponíveis nesta conta' : 'Conta DropZone conectada'}
                  </span>
                </div>
                <UiInput
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(event) => void changeAccountAvatar(event.target.files?.[0])}
                />
                <button
                  type="button"
                  disabled={avatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    width: '100%',
                    border: 0,
                    borderTop: '1px solid var(--ui-line)',
                    padding: '12px 14px',
                    background: 'transparent',
                    color: 'var(--ui-text)',
                    cursor: avatarUploading ? 'wait' : 'pointer',
                    fontWeight: 800,
                  }}
                >
                  {avatarUploading ? <Loader2 className="spin" size={16} /> : <Camera size={16} />}
                  {avatarUploading ? 'Enviando foto...' : accountAvatar ? 'Alterar foto de perfil' : 'Adicionar foto de perfil'}
                </button>
                {avatarError ? <span role="alert" style={{ display: 'block', padding: '0 14px 11px', color: 'var(--ui-danger, #d76c6c)', fontSize: 12 }}>{avatarError}</span> : null}
                {visibleAccounts.length ? <Link
                  href="/#meus-cadastros"
                  onClick={() => {
                    setProfileOpen(false)
                    setMobileOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    width: '100%',
                    padding: '13px 14px',
                    background: 'linear-gradient(135deg, var(--ui-primary, #c9b766), var(--ui-primary-light, #dfcf85))',
                    color: '#171717',
                    textDecoration: 'none',
                    fontWeight: 900,
                    borderBottom: '1px solid rgba(0,0,0,.22)',
                    boxShadow: 'inset 0 -1px rgba(255,255,255,.2)',
                  }}
                >
                  <LayoutDashboard size={17} strokeWidth={2.5} /> Meus cadastros
                </Link> : null}
                {showWallet ? (
                  <Link
                    href="/carteira"
                    onClick={() => {
                      setProfileOpen(false)
                      setMobileOpen(false)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      width: '100%',
                      borderTop: '1px solid var(--ui-line)',
                      padding: '12px 14px',
                      background: 'transparent',
                      color: 'var(--ui-text)',
                      textDecoration: 'none',
                      fontWeight: 800,
                    }}
                  >
                    <Wallet size={16} />
                    {walletSaldo == null
                      ? 'Carteira'
                      : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(walletSaldo / 100)}
                  </Link>
                ) : null}
                {onCreateLinkedProfile ? (
                  <button
                    type="button"
                    onClick={() => {
                      onCreateLinkedProfile()
                      setProfileOpen(false)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      width: '100%',
                      border: 0,
                      borderTop: '1px solid var(--ui-line)',
                      padding: '12px 14px',
                      background: 'transparent',
                      color: 'var(--ui-text)',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                  <Plus size={16} /> Ativar nova área
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onSignOut}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    width: '100%',
                    border: 0,
                    borderTop: '1px solid var(--ui-line)',
                    padding: '12px 14px',
                    background: 'transparent',
                    color: 'var(--ui-danger, #d76c6c)',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  <LogOut size={16} /> Sair de todos
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <Link className="app-header-login" href={loginHref}>
            {loginLabel}
          </Link>
        )}
      </div>
    </header>
  )
}
