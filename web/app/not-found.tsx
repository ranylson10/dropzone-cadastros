import Link from 'next/link'
import { ArrowLeft, Trophy } from 'lucide-react'
import { AppShell } from '@/components/layout'

export default function NotFound() {
  return <AppShell headerVariant="storefront" loadSession withAuthOffset={false} mainClassName="dz-not-found">
    <section>
      <p>404 · Fora do mapa</p>
      <h1>Essa página não foi encontrada.</h1>
      <p>O endereço pode ter mudado. Encontre sua próxima competição ou volte ao início.</p>
      <div><Link className="button" href="/campeonatos"><Trophy size={18} /> Ver campeonatos</Link><Link className="button secondary" href="/"><ArrowLeft size={18} /> Voltar ao início</Link></div>
    </section>
  </AppShell>
}
