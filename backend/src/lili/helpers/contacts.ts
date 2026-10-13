import type { LiliAction } from '@backend/lili/types'

export function whatsappHref(contact: any, text: string) {
  const rawUrl = String(contact?.url || '').trim()
  if (rawUrl) {
    const base = rawUrl.split('?')[0]
    return `${base}?text=${encodeURIComponent(text)}`
  }
  const rawPhone = String(contact?.numero || contact?.telefone || contact?.whatsapp || '').replace(/\D/g, '')
  if (!rawPhone) return null
  const phone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

export function whatsappContactActions(contacts: any[], text: string, prefix = 'whatsapp'): LiliAction[] {
  const actions: LiliAction[] = []
  contacts.forEach((contact: any, index: number) => {
    const href = whatsappHref(contact, text)
    if (!href) return
    const name = String(contact?.nome || contact?.name || `Vendedor ${index + 1}`).trim()
    actions.push({
      id: `${prefix}-${index}`,
      label: `🟢 WhatsApp · ${name}`,
      href,
      variant: 'whatsapp',
    })
  })
  return actions
}
