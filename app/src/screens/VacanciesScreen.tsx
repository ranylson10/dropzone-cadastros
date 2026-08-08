import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { dateLabel, fallbackVacancies, money, toChampionshipCard, VacancyApiItem } from '@/lib/vacancies'
import { ActionCard, MetricPill, ScreenShell } from '@/screens/components'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

const filters = [
  { id: 'all', label: 'Todos' },
  { id: 'today', label: 'Hoje' },
  { id: 'free', label: 'Grátis' },
  { id: 'live', label: 'Com live' },
  { id: 'last', label: 'Últimas vagas' },
] as const

type FilterId = typeof filters[number]['id']

export function VacanciesScreen({ onBack, onSelectChampionship }: ScreenProps) {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all')
  const [vacancies, setVacancies] = useState<VacancyApiItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    mobileApi.vacancies()
      .then((response) => {
        if (!mounted) return
        setVacancies((response.announcements as VacancyApiItem[]) || [])
        setError(null)
      })
      .catch((err) => {
        if (!mounted) return
        setVacancies(fallbackVacancies)
        setError(err?.message || 'Não foi possível carregar as vagas agora.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const visibleVacancies = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return vacancies.filter((item) => {
      if (activeFilter === 'today') return item.proxima_data === today
      if (activeFilter === 'free') return Number(item.valor_inscricao || 0) <= 0
      if (activeFilter === 'live') return Boolean(item.tem_live)
      if (activeFilter === 'last') return Number(item.vagas_livres || 0) > 0 && Number(item.vagas_livres || 0) <= 8
      return true
    })
  }, [activeFilter, vacancies])

  return (
    <ScreenShell
      eyebrow="Vitrine"
      title="Campeonatos com vagas"
      description="Preço, premiação, vagas livres, live e próximo jogo em uma tela rápida para decidir onde entrar."
      onBack={onBack}
    >
      <View style={styles.filters}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[styles.filter, activeFilter === filter.id && styles.filterActive]}
            onPress={() => setActiveFilter(filter.id)}
          >
            <Text style={[styles.filterText, activeFilter === filter.id && styles.filterTextActive]}>{filter.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.meta}>Buscando vagas abertas...</Text>
        </View>
      ) : null}

      {error ? (
        <Text style={styles.warning}>Usei dados de demonstração porque a vitrine não respondeu: {error}</Text>
      ) : null}

      {!loading && visibleVacancies.length === 0 ? (
        <ActionCard
          title="Nenhuma vaga nesse filtro"
          description="Troque o filtro ou volte mais tarde. A vitrine só mostra campeonatos ativos, aprovados e com vagas livres."
          cta="Ver todos"
          onPress={() => setActiveFilter('all')}
        />
      ) : null}

      {visibleVacancies.map((item) => (
        <TouchableOpacity key={item.id} style={styles.card} onPress={() => onSelectChampionship?.(toChampionshipCard(item))}>
          <View style={styles.banner}>
            {item.banner_url ? <Image source={{ uri: item.banner_url }} style={styles.bannerImage} /> : null}
            <Text style={styles.badge}>{item.tem_live ? 'LIVE' : String(item.tipo || 'VAGA').toUpperCase()}</Text>
          </View>
          <View style={styles.body}>
            <Text style={styles.name}>{item.nome || 'Campeonato'}</Text>
            <View style={styles.metrics}>
              <MetricPill label="inscrição" value={money(item.valor_inscricao)} />
              <MetricPill label="premiação" value={item.descricao_premiacao || money(item.premiacao)} />
            </View>
            <Text style={styles.meta}>{Number(item.vagas_livres || 0)} de {Number(item.total_vagas || 0)} vagas livres · {dateLabel(item)}</Text>
            <Text style={styles.meta}>{[item.plataforma, item.servidor].filter(Boolean).join(' · ') || 'Formato competitivo'}</Text>
            <Text style={styles.cta}>Garantir vaga</Text>
          </View>
        </TouchableOpacity>
      ))}

      <ActionCard
        title="Compra guiada"
        description="Depois do pagamento, o app leva direto para equipe, elenco, vaga no grupo e escalação."
        cta="Fluxo planejado"
      />
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filter: {
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  filterText: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: typography.caption,
  },
  filterTextActive: {
    color: colors.surface,
  },
  loading: {
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  warning: {
    borderRadius: radius.md,
    backgroundColor: '#fff7ed',
    color: '#9a3412',
    fontWeight: '800',
    padding: spacing.md,
  },
  card: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  banner: {
    height: 150,
    backgroundColor: colors.brandDark,
    padding: spacing.md,
  },
  bannerImage: {
    ...StyleSheet.absoluteFill,
    height: undefined,
    width: undefined,
    resizeMode: 'cover',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand,
    color: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: typography.tiny,
    fontWeight: '900',
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  name: {
    color: colors.ink,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  meta: {
    color: colors.muted,
    fontWeight: '700',
  },
  cta: {
    color: colors.brand,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
})
