import type { ReactNode } from 'react'

export function WorkspaceMetrics({ label, metrics }: {
  label: string
  metrics: Array<{ label: string; value: ReactNode; hint?: ReactNode }>
}) {
  return <div className="dz-metric-strip" role="group" aria-label={label}>
    {metrics.map(item => <div key={item.label}><small>{item.label}</small><strong>{item.value}</strong>{item.hint ? <span>{item.hint}</span> : null}</div>)}
  </div>
}
