import { optionalEnv } from '@backend/shared/env'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function sendDropZoneActionEmail(params: {
  to: string
  subject: string
  title: string
  intro: string
  actionLabel: string
  actionUrl: string
  footnote?: string
}) {
  const apiKey = optionalEnv('RESEND_API_KEY')
  const from = optionalEnv('AUTH_EMAIL_FROM', 'DropZone <onboarding@resend.dev>')
  if (!apiKey) throw new Error('RESEND_API_KEY nao configurada no servidor.')

  const title = escapeHtml(params.title)
  const intro = escapeHtml(params.intro)
  const actionLabel = escapeHtml(params.actionLabel)
  const actionUrl = escapeHtml(params.actionUrl)
  const footnote = params.footnote ? escapeHtml(params.footnote) : ''

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: `
        <div style="font-family:Arial,sans-serif;background:#f4f1ea;padding:28px;color:#17191d">
          <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #d4d0c7;padding:28px">
            <div style="font-size:12px;font-weight:800;letter-spacing:.12em;color:#6f39ff;text-transform:uppercase;margin-bottom:14px">DROPZONE</div>
            <h1 style="font-size:26px;line-height:1.1;margin:0 0 12px">${title}</h1>
            <p style="font-size:15px;line-height:1.6;color:#555;margin:0 0 22px">${intro}</p>
            <a href="${actionUrl}" style="display:inline-block;background:#17191d;color:#fff;text-decoration:none;font-weight:800;padding:13px 18px">${actionLabel}</a>
            ${footnote ? `<p style="font-size:12px;line-height:1.5;color:#777;margin:22px 0 0">${footnote}</p>` : ''}
          </div>
        </div>
      `,
      text: `${params.title}\n\n${params.intro}\n\n${params.actionLabel}: ${params.actionUrl}${params.footnote ? `\n\n${params.footnote}` : ''}`,
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message = payload?.message || payload?.error || `Resend HTTP ${response.status}`
    throw new Error(`Erro ao enviar e-mail pelo Resend: ${message}`)
  }
}
