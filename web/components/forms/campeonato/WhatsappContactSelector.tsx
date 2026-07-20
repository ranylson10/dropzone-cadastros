import type { CampeonatoWhatsappContact } from './CampeonatoForm'
import { WhatsAppIcon } from '@/features/billing/BrandIcons'

/** Contato de campeonato (ddi/telefone) ou vendedor (url pronta). */
export type WhatsappContactLike = Partial<CampeonatoWhatsappContact> & {
  id?: string
  nome?: string
  url?: string | null
  manager_id?: string
}

export function championshipWhatsappUrl(contact: WhatsappContactLike, championshipName: string) {
  const message = `Olá, ${contact.nome || ''}! Quero comprar uma vaga no campeonato ${championshipName}. Pode me passar as informações?`
  const ready = String(contact.url || '').trim()
  if (ready) {
    // URL já pronta (vendedor) — acrescenta texto se for wa.me sem query
    if (/wa\.me\//i.test(ready) && !/[?&]text=/.test(ready)) {
      const sep = ready.includes('?') ? '&' : '?'
      return `${ready}${sep}text=${encodeURIComponent(message)}`
    }
    return ready
  }
  const number = `${contact.ddi || ''}${contact.telefone || ''}`.replace(/\D/g, '')
  if (!number) return '#'
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export function WhatsappContactSelector({
  contacts,
  championshipName,
}: {
  contacts: WhatsappContactLike[]
  championshipName: string
}) {
  if (!contacts.length) return null
  return (
    <div className="whatsapp-seller-list">
      {contacts.map((contact, index) => {
        const href = championshipWhatsappUrl(contact, championshipName)
        if (!href || href === '#') return null
        const subtitle = contact.url
          ? 'WhatsApp do vendedor'
          : `${contact.pais || ''} · ${contact.ddi || ''} ${contact.telefone || ''}`.trim()
        return (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            key={contact.id || contact.manager_id || `wa-${index}`}
            className="whatsapp-seller-item"
          >
            <span className="whatsapp-seller-flag" aria-hidden>
              {contact.bandeira || 'BR'}
            </span>
            <div>
              <strong>{contact.nome || 'Contato'}</strong>
              <small>{subtitle}</small>
            </div>
            <span className="whatsapp-seller-wa-icon" aria-hidden>
              <WhatsAppIcon size={20} />
            </span>
          </a>
        )
      })}
    </div>
  )
}
