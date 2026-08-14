import { Download, MonitorCog, RadioTower, ShieldCheck } from 'lucide-react'

export function LocalStudioHandoff(props: { campeonatoId: string; kind: 'live' | 'artes' }) {
  const isLive = props.kind === 'live'
  return (
    <main className="page page-authenticated" style={{ display: 'grid', placeItems: 'center', minHeight: 'calc(100vh - 84px)', padding: 24 }}>
      <section style={{ width: 'min(760px, 100%)', border: '1px solid var(--line)', background: 'var(--surface)', padding: 'clamp(24px, 5vw, 52px)', boxShadow: '0 24px 80px #00000012' }}>
        <div style={{ width: 48, height: 48, display: 'grid', placeItems: 'center', background: 'var(--brand)', color: 'var(--on-brand)', marginBottom: 18 }}><MonitorCog size={25} /></div>
        <p className="eyebrow">DropZone Live Local</p>
        <h1 style={{ margin: '4px 0 12px' }}>{isLive ? 'Overlays agora são produzidas no computador da transmissão.' : 'Artes e PNGs agora são produzidos localmente.'}</h1>
        <p style={{ maxWidth: 620, color: 'var(--text-muted)', lineHeight: 1.65 }}>
          O site continua fornecendo os dados do campeonato. O editor, as imagens, os vídeos, os arquivos PNG e a saída para OBS/vMix deixam de usar o Storage durante a produção.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, margin: '26px 0' }}>
          <div style={{ border: '1px solid var(--line)', padding: 14 }}><RadioTower size={16} /><strong style={{ display: 'block', marginTop: 8 }}>Saída local</strong><small>OBS/vMix lê via localhost.</small></div>
          <div style={{ border: '1px solid var(--line)', padding: 14 }}><Download size={16} /><strong style={{ display: 'block', marginTop: 8 }}>Assets em cache</strong><small>Logos e dados sincronizam uma vez.</small></div>
          <div style={{ border: '1px solid var(--line)', padding: 14 }}><ShieldCheck size={16} /><strong style={{ display: 'block', marginTop: 8 }}>Projeto protegido</strong><small>Arquivos locais criptografados.</small></div>
        </div>
        <p className="eyebrow" style={{ marginBottom: 0 }}>Aplicativo em teste neste computador · campeonato {props.campeonatoId}</p>
      </section>
    </main>
  )
}
