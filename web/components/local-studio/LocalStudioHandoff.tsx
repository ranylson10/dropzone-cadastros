import { Download, MonitorCog, RadioTower, ShieldCheck } from 'lucide-react'

export function LocalStudioHandoff(props: { campeonatoId: string; kind: 'live' | 'artes' }) {
  const isLive = props.kind === 'live'
  return (
    <section className="page page-authenticated local-studio-handoff-page" aria-label="Estúdio local">
      <section className="local-studio-handoff-card">
        <div className="local-studio-handoff-icon"><MonitorCog size={25} /></div>
        <p className="eyebrow">DropZone Live Local</p>
        <h1>{isLive ? 'Overlays agora são produzidas no computador da transmissão.' : 'Artes e PNGs agora são produzidos localmente.'}</h1>
        <p>
          O site continua fornecendo os dados do campeonato. O editor, as imagens, os vídeos, os arquivos PNG e a saída para OBS/vMix deixam de usar o Storage durante a produção.
        </p>
        <div className="local-studio-handoff-grid">
          <div><RadioTower size={16} /><strong>Saída local</strong><small>OBS/vMix lê via localhost.</small></div>
          <div><Download size={16} /><strong>Assets em cache</strong><small>Logos e dados sincronizam uma vez.</small></div>
          <div><ShieldCheck size={16} /><strong>Projeto protegido</strong><small>Arquivos locais criptografados.</small></div>
        </div>
        <p className="eyebrow">Aplicativo em teste neste computador · campeonato {props.campeonatoId}</p>
      </section>
    </section>
  )
}
