import { MessageCircle } from 'lucide-react'
import type { CampeonatoWhatsappContact } from './CampeonatoForm'

export function championshipWhatsappUrl(contact: CampeonatoWhatsappContact, championshipName: string) {
  const number = `${contact.ddi}${contact.telefone}`.replace(/\D/g, '')
  const message = `Olá, ${contact.nome}! Quero comprar uma vaga no campeonato ${championshipName}. Pode me passar as informações?`
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export function WhatsappContactSelector({ contacts, championshipName }: { contacts: CampeonatoWhatsappContact[]; championshipName: string }) {
  if (!contacts.length) return null
  return <div className="whatsapp-seller-list">{contacts.map((contact) => (
    <a href={championshipWhatsappUrl(contact, championshipName)} target="_blank" rel="noreferrer" key={contact.id}>
      <span>{contact.bandeira}</span><div><strong>{contact.nome}</strong><small>{contact.pais} · {contact.ddi} {contact.telefone}</small></div><MessageCircle size={18} />
    </a>
  ))}</div>
}
