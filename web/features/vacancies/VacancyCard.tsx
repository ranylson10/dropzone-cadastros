'use client'

import { ArrowRight, CalendarDays, CheckCircle2, Flame, Gift, MapPin, Radio, Ticket, Users, X, ZoomIn } from 'lucide-react'
import '@/app/vagas/vagas.css'

export type VacancyCatalogItem = {
  id: string
  nome: string
  tipo?: string | null
  logo_url?: string | null
  banner_url?: string | null
  valor_inscricao?: number | string | null
  premiacao?: number | string | null
  descricao_premiacao?: string | null
  tem_live?: boolean
  vagas_livres?: number
  total_vagas?: number
  proxima_data?: string | null
  proximo_horario?: string | null
  proximo_grupo?: string | null
  servidor?: string | null
  ja_tem_vaga?: boolean
  grupos?: Array<{ id: string; nome: string; vagas_livres?: number }>
  [key: string]: unknown
}

export function vacancyDateLabel(value?: string | null) {
  if (!value) return 'Data a confirmar'
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

export function vacancyMoney(value: unknown) {
  const number = Number(value)
  return number > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number) : 'Grátis'
}

export function vacancyRatio(item: VacancyCatalogItem) {
  return Math.max(6, Math.min(100, (Number(item.vagas_livres || 0) / Math.max(1, Number(item.total_vagas || 1))) * 100))
}

export function hasVacancyPrize(item: VacancyCatalogItem) {
  return Boolean(item.premiacao || item.descricao_premiacao)
}

export function VacancyCard({
  item,
  onPreview,
  onBuy,
  buyLabel = 'Garantir minha vaga',
  persuasion = 'Compra segura, vaga liberada e inscrição guiada pelo sistema.',
}: {
  item: VacancyCatalogItem
  onPreview: (item: VacancyCatalogItem) => void
  onBuy: (item: VacancyCatalogItem) => void
  buyLabel?: string
  persuasion?: string
}) {
  return (
    <article className="vacancy-card">
      <button className="vacancy-banner" type="button" onClick={() => onPreview(item)} aria-label={`Ampliar banner de ${item.nome}`}>
        {item.banner_url ? <img src={item.banner_url} alt={`Banner ${item.nome}`} /> : <span className="vacancy-banner-fallback"><Ticket size={28} /></span>}
        <span className="vacancy-type-badge">{item.tipo || 'Campeonato'}</span>
        <span className="vacancy-banner-badges">
          {item.tem_live ? <b><Radio size={12} /> Live</b> : null}
          {hasVacancyPrize(item) ? <b><Gift size={12} /> Prêmio</b> : null}
          {Number(item.vagas_livres || 0) <= 3 ? <b className="hot"><Flame size={12} /> Últimas</b> : null}
        </span>
        <span className="vacancy-zoom-label"><ZoomIn size={14} /> Ver banner</span>
        {item.ja_tem_vaga ? <span className="vacancy-enrolled"><CheckCircle2 size={14} /> Sua equipe já tem vaga</span> : null}
      </button>
      <div className="vacancy-card-body">
        <header>{item.logo_url ? <img src={item.logo_url} alt="" /> : null}<div><p>{item.tipo}</p><h2>{item.nome}</h2></div></header>
        <div className="vacancy-next-date"><CalendarDays /><div><small>Próxima vaga</small><strong>{vacancyDateLabel(item.proxima_data)} {item.proximo_horario ? `· ${String(item.proximo_horario).slice(0, 5)}h` : ''}</strong><span>{item.proximo_grupo}</span></div></div>
        <div className="vacancy-sale-line">
          <span><b>{item.vagas_livres}</b> de {item.total_vagas} vagas reais</span>
          <i><em style={{ width: `${vacancyRatio(item)}%` }} /></i>
        </div>
        <div className="vacancy-meta"><span><Users size={14} /><b>{item.vagas_livres}</b> vagas</span><span><Ticket size={14} /><b>{vacancyMoney(item.valor_inscricao)}</b></span>{item.servidor ? <span><MapPin size={14} />{item.servidor}</span> : null}</div>
        {(hasVacancyPrize(item) || item.tem_live) ? <div className="vacancy-commercial-badges">
          {item.tem_live ? <span><Radio size={13} /> Transmissão ao vivo</span> : null}
          {item.premiacao ? <span><Gift size={13} /> Premiação {vacancyMoney(item.premiacao)}</span> : item.descricao_premiacao ? <span><Gift size={13} /> Premiação informada</span> : null}
        </div> : null}
        <div className="vacancy-groups">{(item.grupos || []).slice(0, 3).map((group) => <span key={group.id}>{group.nome}<b>{group.vagas_livres} livres</b></span>)}</div>
        <div className="vacancy-persuasion"><strong>Garanta sua vaga</strong><span>{persuasion}</span></div>
        <button className="button vacancy-register" type="button" onClick={() => onBuy(item)}>{buyLabel} <ArrowRight size={15} /></button>
        <a className="vacancy-details-link" href={`/campeonatos/${item.id}`}>Ver detalhes do campeonato</a>
      </div>
    </article>
  )
}

export function VacancyPreview({ item, onClose }: { item: VacancyCatalogItem | null; onClose: () => void }) {
  if (!item) return null
  return <div className="vacancy-preview-overlay" onClick={onClose}><button onClick={onClose} aria-label="Fechar banner"><X size={21} /></button><figure onClick={(event) => event.stopPropagation()}>{item.banner_url ? <img src={item.banner_url} alt={`Banner completo de ${item.nome}`} /> : null}<figcaption>{item.nome}</figcaption></figure></div>
}
