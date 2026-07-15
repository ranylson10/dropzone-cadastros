'use client'

import { CheckCircle2, Circle, MessageCircle, Store, Trophy } from 'lucide-react'

type Step = {
  id: string
  title: string
  detail: string
  done: boolean
  actionLabel?: string
  onAction?: () => void
}

export function ManagerFlowStrip(props: {
  hasWhatsapp: boolean
  ativosCount: number
  anunciandoCount: number
  pendentesPreencher: number
  onGoVendas: () => void
  onGoCampeonatos: () => void
  onOpenNextChamp?: () => void
}) {
  const steps: Step[] = [
    {
      id: 'contato',
      title: '1. Contato de vendas',
      detail: props.hasWhatsapp
        ? 'WhatsApp configurado no portfólio.'
        : 'Cadastre o WhatsApp para o comprador te chamar.',
      done: props.hasWhatsapp,
      actionLabel: props.hasWhatsapp ? undefined : 'Configurar',
      onAction: props.hasWhatsapp ? undefined : props.onGoVendas,
    },
    {
      id: 'portfolio',
      title: '2. Anunciar no link',
      detail:
        props.ativosCount === 0
          ? 'Aguarde a produtora liberar um campeonato.'
          : props.anunciandoCount > 0
            ? `${props.anunciandoCount} evento(s) no seu link público.`
            : 'Marque quais campeonatos entram no portfólio.',
      done: props.ativosCount > 0 && props.anunciandoCount > 0,
      actionLabel: props.ativosCount > 0 && props.anunciandoCount === 0 ? 'Anunciar' : undefined,
      onAction: props.ativosCount > 0 && props.anunciandoCount === 0 ? props.onGoVendas : undefined,
    },
    {
      id: 'preencher',
      title: '3. Preencher vagas',
      detail:
        props.pendentesPreencher > 0
          ? `${props.pendentesPreencher} evento(s) com vaga livre para você preencher.`
          : props.ativosCount > 0
            ? 'Abra o campeonato e adicione as lines que vendeu.'
            : 'Depois de vender, adicione a equipe/line no slot.',
      done: props.ativosCount > 0 && props.pendentesPreencher === 0,
      actionLabel:
        props.ativosCount > 0
          ? props.pendentesPreencher > 0
            ? 'Preencher agora'
            : 'Abrir operação'
          : undefined,
      onAction:
        props.ativosCount > 0
          ? props.onOpenNextChamp || props.onGoCampeonatos
          : undefined,
    },
  ]

  return (
    <section className="panel span-3 manager-flow-strip">
      <div className="section-head">
        <div>
          <p className="eyebrow">Fluxo do vendedor</p>
          <h2>Vender → anunciar → preencher</h2>
          <p className="empty" style={{ marginTop: 6 }}>
            Caminho principal do manager afiliado. Use os atalhos para não perder o passo.
          </p>
        </div>
        <Store />
      </div>

      <div className="manager-flow-steps">
        {steps.map((step) => (
          <article key={step.id} className={`manager-flow-step ${step.done ? 'is-done' : ''}`}>
            <div className="manager-flow-step-icon">
              {step.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </div>
            <div className="manager-flow-step-copy">
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </div>
            {step.actionLabel && step.onAction ? (
              <button type="button" className="button small" onClick={step.onAction}>
                {step.actionLabel}
              </button>
            ) : step.done ? (
              <span className="manager-flow-ok">OK</span>
            ) : null}
          </article>
        ))}
      </div>

      <div className="manager-flow-shortcuts">
        <button type="button" className="button secondary small" onClick={props.onGoVendas}>
          <MessageCircle size={14} /> Central de vendas
        </button>
        <button type="button" className="button small" onClick={props.onGoCampeonatos}>
          <Trophy size={14} /> Operar campeonatos
        </button>
      </div>
    </section>
  )
}
