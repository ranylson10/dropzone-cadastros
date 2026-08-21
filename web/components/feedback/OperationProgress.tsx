type OperationProgressProps = {
  title: string
  steps: string[]
  activeStep: number
  className?: string
}

/** Feedback de etapas para operações que demoram mais que um clique. */
export function OperationProgress({ title, steps, activeStep, className = '' }: OperationProgressProps) {
  const current = Math.max(0, Math.min(activeStep, Math.max(0, steps.length - 1)))
  const percent = steps.length ? Math.round(((current + 1) / steps.length) * 100) : 0

  return (
    <section className={`operation-progress ${className}`.trim()} role="status" aria-live="polite" aria-busy="true">
      <div className="operation-progress-heading"><strong>{title}</strong><span>{percent}%</span></div>
      <div className="operation-progress-track" aria-hidden="true"><i style={{ width: `${percent}%` }} /></div>
      <ol>{steps.map((step, index) => <li className={index < current ? 'done' : index === current ? 'current' : ''} key={step}>{step}</li>)}</ol>
    </section>
  )
}
