import type { LiliCard, LiliLocale } from '@backend/lili/types'

export function agendaCards(items: any[], locale: LiliLocale = 'pt-BR'): LiliCard[] {
  const labels = locale === 'en'
    ? { match: 'Match', date: 'Date', time: 'Time', tournament: 'Tournament', rounds: 'Rounds', status: 'Status', open: 'Open tournament' }
    : locale === 'es'
      ? { match: 'Partido', date: 'Fecha', time: 'Horario', tournament: 'Campeonato', rounds: 'Partidas', status: 'Estado', open: 'Abrir campeonato' }
      : { match: 'Jogo', date: 'Data', time: 'Horário', tournament: 'Campeonato', rounds: 'Quedas', status: 'Status', open: 'Abrir campeonato' }

  const localeTag = locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US'
  const dateFormatter = new Intl.DateTimeFormat(localeTag, { day: '2-digit', month: '2-digit', year: 'numeric' })

  return items.map((item: any) => {
    const rawDate = String(item.data || item.data_jogo || '').slice(0, 10)
    const parsedDate = rawDate ? new Date(`${rawDate}T12:00:00`) : null
    const dateLabel = parsedDate && !Number.isNaN(parsedDate.getTime()) ? dateFormatter.format(parsedDate) : rawDate
    const start = String(item.horario_inicio || item.horario || '').slice(0, 5)
    const end = String(item.horario_fim || '').slice(0, 5)
    const timeLabel = [start, end].filter(Boolean).join(' — ')
    const championshipId = item.meta?.campeonato_id || item.campeonato_id || null
    const championshipName = item.meta?.campeonato_nome || item.campeonato_nome || null

    const details = [
      dateLabel ? { label: labels.date, value: dateLabel } : null,
      timeLabel ? { label: labels.time, value: timeLabel } : null,
      championshipName ? { label: labels.tournament, value: championshipName } : null,
      item.meta?.numero_partidas ? { label: labels.rounds, value: String(item.meta.numero_partidas) } : null,
      item.meta?.status ? { label: labels.status, value: String(item.meta.status) } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>

    return {
      id: String(item.id),
      kind: 'agenda',
      title: item.titulo || labels.match,
      subtitle: championshipName || undefined,
      badges: item.tipo ? [String(item.tipo)] : undefined,
      details,
      actions: championshipId ? [{
        id: `open-agenda-championship-${championshipId}-${item.id}`,
        label: labels.open,
        href: `/campeonatos/${championshipId}`,
        variant: 'secondary',
      }] : undefined,
    }
  })
}
