import { Download, MonitorCog, RadioTower, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

export function LocalStudioHandoff(props: { campeonatoId: string; kind: 'live' | 'artes' }) {
  const isLive = props.kind === 'live'
  return (
    <section className="page page-authenticated local-studio-handoff-page dz-mobile-utility" aria-label="Estúdio local">
      <section className="local-studio-handoff-card">
        <div className="local-studio-handoff-icon"><MonitorCog size={25} /></div>
        <p className="eyebrow">DropZone Live Local</p>
        <h1>{isLive ? 'Transmissão no computador' : 'Artes no computador'}</h1>
        <p>
          Use o DropZone Live Local no computador para preparar artes e transmitir. Pelo celular, você pode organizar e acompanhar o campeonato.
        </p>
        <div className="local-studio-handoff-grid">
          <div><RadioTower size={16} /><strong>Saída local</strong><small>OBS/vMix lê via localhost.</small></div>
          <div><Download size={16} /><strong>Assets em cache</strong><small>Logos e dados sincronizam uma vez.</small></div>
          <div><ShieldCheck size={16} /><strong>Projeto protegido</strong><small>Arquivos locais criptografados.</small></div>
        </div>
        <p className="eyebrow">DropZone Live Local em fase de testes.</p>
        <Link className="button secondary" href={`/campeonatos/${props.campeonatoId}`}>Ver campeonato</Link>
      </section>
    </section>
  )
}
