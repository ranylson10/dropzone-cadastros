import type { ReactNode } from 'react'

type PanelHeroProps = {
  eyebrow?: string
  title: string
  description: string
  profileImage?: string
  actions?: ReactNode
}

export function PanelHero({ eyebrow = 'DropZone', title, description, profileImage, actions }: PanelHeroProps) {
  return (
    <section className="panel-hero" id="painel-inicio">
      <div className="panel-hero-texture" aria-hidden="true" />
      <div className="panel-hero-glow" aria-hidden="true" />
      <div className="panel-hero-content">
        {profileImage ? (
          <div className="panel-hero-avatar">
            <img src={profileImage} alt="" />
          </div>
        ) : null}
        <div className="panel-hero-copy">
          <p className="panel-hero-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {actions ? <div className="panel-hero-actions">{actions}</div> : null}
    </section>
  )
}
