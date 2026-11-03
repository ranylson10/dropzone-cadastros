import { Activity, ChevronDown, Crosshair, Shield, Sparkles, Target } from 'lucide-react'
import type { DirectoryProfile } from '../types'
import styles from './CompetitiveProfilePanel.module.css'

function maxTrend(profile: NonNullable<DirectoryProfile['competitive']>) {
  return Math.max(1, ...profile.trend.map((item) => Math.max(item.abates, item.assistencias, item.dano / 100)))
}

export function CompetitiveProfilePanel({ profile }: { profile: DirectoryProfile }) {
  const competitive = profile.competitive
  if (!competitive) return null
  const maximum = maxTrend(competitive)
  const telemetryAvailable = competitive.telemetryAvailable !== false
  const primaryMetrics = telemetryAvailable ? competitive.metrics : competitive.metrics.filter(item => ['Pontos', 'Abates', 'Booyahs', 'Quedas'].includes(item.label))
  const primaryAverages = telemetryAvailable ? competitive.averages : competitive.averages.filter(item => ['Pontos', 'Abates'].includes(item.label))

  return (
    <section className={`competitive-profile-panel ${styles.panel}`} id="desempenho">
      <header className="competitive-profile-head">
        <span className="competitive-profile-mark"><Activity size={18} /></span>
        <div>
          <small>{competitive.label}</small>
          <h2>Desempenho competitivo</h2>
        </div>
        {competitive.tier ? <span className={`competitive-tier tier-${competitive.tier.toLowerCase()}`}>{competitive.tier}<b>{Number(competitive.score || 0).toFixed(1)}</b></span> : null}
      </header>

      <div className="competitive-kpi-grid">
        {primaryMetrics.map((metric, index) => <article key={metric.label}>
          {index === 0 ? <Crosshair size={15} /> : index === 1 ? <Target size={15} /> : <Shield size={15} />}
          <small>{metric.label}</small>
          <strong>{competitive.hasResults === false ? '—' : metric.value}</strong>
        </article>)}
      </div>

      <div className="competitive-average-grid" aria-label="Médias por partida">
        <strong>Média por partida</strong>
        {primaryAverages.map((average) => <span key={average.label}><small>{average.label}</small><b>{competitive.hasResults === false ? '—' : average.value}</b></span>)}
      </div>

      <details className="competitive-profile-details">
        <summary><span>Mais estatísticas</span>{!telemetryAvailable ? <small>Telemetria ainda não sincronizada</small> : null}<ChevronDown size={16} aria-hidden="true" /></summary>
      {telemetryAvailable ? <div className="competitive-profile-detail-grid">
        <section className="competitive-loadout">
          <header><Sparkles size={15} /><strong>Dados Garena</strong></header>
          <dl>
            {competitive.highlights.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value || 'Sem dados'}</dd></div>)}
          </dl>
        </section>
        <section className="competitive-trend" data-identity-color="semantic">
          <header><Activity size={15} /><strong>Histórico por partida</strong></header>
          {competitive.trend.length ? <div className="competitive-bars" aria-label="Histórico de desempenho por partida">
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
      </div> : <p className="competitive-no-data">Os dados de armas, habilidades e desempenho detalhado aparecem após a sincronização das partidas. As informações ausentes não são contabilizadas como zero.</p>}
      </details>
    </section>
  )
}
