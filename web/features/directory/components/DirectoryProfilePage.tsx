import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { DIRECTORY_CONFIG } from '../config'
import { getDirectoryProfile } from '../server'
import type { DirectoryKind } from '../types'
import { PublicDirectoryHeader } from './PublicDirectoryHeader'

export async function DirectoryProfilePage({ kind, id }: { kind: DirectoryKind; id: string }) {
  const profile = await getDirectoryProfile(kind, id)
  if (!profile) notFound()
  const config = DIRECTORY_CONFIG[kind]
  return <><PublicDirectoryHeader active={config.title} /><main className="directory-profile-page"><a className="directory-back" href={`/${kind}`}><ArrowLeft size={16} /> Voltar para {config.title.toLowerCase()}</a><section className="directory-profile-hero"><span className="directory-profile-avatar">{profile.image ? <img src={profile.image} alt="" /> : <b>{profile.name.slice(0, 2).toUpperCase()}</b>}</span><div><small>{profile.eyebrow || config.singular}</small><h1>{profile.name}</h1>{profile.username ? <strong>@{profile.username}</strong> : null}<p>{profile.description}</p></div></section><section className="directory-profile-details">{profile.details.map((item) => <div key={item.label}><small>{item.label}</small><strong>{item.value}</strong></div>)}</section>{profile.sections.map((section) => <section className="directory-profile-section" key={section.title}><div className="directory-section-title"><small>INFORMAÇÕES</small><h2>{section.title}</h2></div>{section.items.length ? <div className="directory-related-grid">{section.items.map((item) => { const body = <><span>{item.image ? <img src={item.image} alt="" /> : item.title.slice(0, 2).toUpperCase()}</span><div><strong>{item.title}</strong>{item.subtitle ? <small>{item.subtitle}</small> : null}</div>{item.href ? <ExternalLink size={16} /> : null}</>; return item.href ? <a key={item.id} href={item.href}>{body}</a> : <article key={item.id}>{body}</article> })}</div> : <div className="directory-empty compact">Nenhuma informação cadastrada nesta seção.</div>}</section>)}</main></>
}
