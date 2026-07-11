import { DIRECTORY_NAV } from '../config'

export function PublicDirectoryHeader({ active }: { active?: string }) {
  return (
    <header className="public-directory-header">
      <div className="public-directory-header-inner">
        <a className="app-brand" href="/" aria-label="DropZone">
          <span className="app-brand-logo"><img src="/dropzone-icon.png" alt="" /></span>
          <span className="app-brand-copy"><strong>DROPZONE</strong><small>COMPETITIVE SYSTEM</small></span>
        </a>
        <nav className="public-directory-nav" aria-label="Navegação pública">
          {DIRECTORY_NAV.map((item) => <a key={item.label} className={active === item.label ? 'active' : ''} href={item.href}>{item.label}</a>)}
        </nav>
        <a className="public-directory-access" href="/">Entrar no sistema</a>
      </div>
    </header>
  )
}
