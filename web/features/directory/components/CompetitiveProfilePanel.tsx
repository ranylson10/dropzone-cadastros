import { Activity, Crosshair, Shield, Sparkles, Target } from 'lucide-react'
import type { DirectoryProfile } from '../types'

function maxTrend(profile: NonNullable<DirectoryProfile['competitive']>) {
  return Math.max(1, ...profile.trend.map((item) => Math.max(item.abates, item.assistencias, item.dano / 100)))
}

export function CompetitiveProfilePanel({ profile }: { profile: DirectoryProfile }) {
  const competitive = profile.competitive
  if (!competitive) return null
  const maximum = maxTrend(competitive)

  return (
    <section className="competitive-profile-panel" id="desempenho">
      <header className="competitive-profile-head">
        <span className="competitive-profile-mark"><Activity size={18} /></span>
        <div>
          <small>{competitive.label}</small>
          <h2>Desempenho competitivo</h2>
        </div>
        {competitive.tier ? <span className={`competitive-tier tier-${competitive.tier.toLowerCase()}`}>{competitive.tier}<b>{Number(competitive.score || 0).toFixed(1)}</b></span> : null}
      </header>

      <div className="competitive-kpi-grid">
        {competitive.metrics.map((metric, index) => <article key={metric.label}>
          {index === 0 ? <Crosshair size={15} /> : index === 1 ? <Target size={15} /> : <Shield size={15} />}
          <small>{metric.label}</small>
          <strong>{metric.value}</strong>
        </article>)}
      </div>

      <div className="competitive-profile-detail-grid">
        <section className="competitive-loadout">
          <header><Sparkles size={15} /><strong>Destaques da Garena</strong></header>
          <dl>
            {competitive.highlights.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value || 'Sem dados'}</dd></div>)}
          </dl>
        </section>
        <section className="competitive-trend">
          <header><Activity size={15} /><strong>Média por queda</strong></header>
          {competitive.trend.length ? <div className="competitive-bars" aria-label="Histórico de desempenho por queda">
            {competitive.trend.map((item) => <div key={item.label} className="competitive-bar-item" title={`${item.label}: ${item.abates} abates, ${item.dano.toLocaleString('pt-BR')} dano`}>
              <span className="competitive-bar-stack">
                <i style={{ height: `${Math.max(8, item.abates / maximum * 100)}%` }} />
                <b style={{ height: `${Math.max(5, item.assistencias / maximum * 100)}%` }} />
              </span>
              <small>{item.label}</small>
            </div>)}
          </div> : <p className="competitive-no-data">As médias aparecerão após o primeiro MatchResult sincronizado.</p>}
          <footer><span><i /> Abates</span><span><b /> Assistências</span></footer>
        </section>
      </div>
    </section>
  )
}
