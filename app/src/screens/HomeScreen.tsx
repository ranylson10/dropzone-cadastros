import { useEffect, useMemo, useState } from 'react'
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { MobileAccount } from '@/lib/auth'
import { fallbackVacancies, toChampionshipCard, VacancyApiItem } from '@/lib/vacancies'
import { actionsForProfile } from '@/navigation/mobileExperience'
import { ProfileSwitcher } from '@/screens/ProfileSwitcher'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ChampionshipCard, MobileRoute, ProfileType, UserTask } from '@/types/dropzone'

const profiles: Array<{ id: ProfileType; label: string }> = [
  { id: 'equipe', label: 'Equipe' },
  { id: 'jogador', label: 'Jogador' },
  { id: 'manager', label: 'Vendedor' },
  { id: 'produtora', label: 'Produtora' },
]

const demoTasks: UserTask[] = [
  {
    id: 'lineup-today',
    title: 'Escalação pendente',
    description: 'Complete o elenco antes do prazo do próximo jogo.',
    action: 'lineup',
    severity: 'warning',
  },
  {
    id: 'invite-open',
    title: 'Convite aguardando resposta',
    description: 'Veja pedidos de jogadores, equipes ou campeonatos em aberto.',
    action: 'invites',
    severity: 'info',
  },
]

function routeForAction(action: string): MobileRoute {
  if (action === 'browse_vacancies' || action === 'buy_slot') return 'vacancies'
  return action as MobileRoute
}

export function HomeScreen(props: {
  profile: ProfileType
  onProfileChange: (profile: ProfileType) => void
  onNavigate: (route: MobileRoute) => void
  accounts?: MobileAccount[]
  activeAccount?: MobileAccount | null
  onSelectAccount?: (id: string) => void
  onSignOut?: () => void
  onSelectChampionship?: (championship: ChampionshipCard) => void
}) {
  const { profile, onProfileChange, onNavigate } = props
  const actions = useMemo(() => actionsForProfile(profile), [profile])
  const [vacancies, setVacancies] = useState<ChampionshipCard[]>(fallbackVacancies.map(toChampionshipCard))

  useEffect(() => {
    let mounted = true
    mobileApi.vacancies()
      .then((response) => {
        if (!mounted) return
        const cards = ((response.announcements as VacancyApiItem[]) || []).slice(0, 3).map(toChampionshipCard)
        setVacancies(cards.length ? cards : fallbackVacancies.map(toChampionshipCard))
      })
      .catch(() => {
        if (mounted) setVacancies(fallbackVacancies.map(toChampionshipCard))
      })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>DropZone Mobile</Text>
        <Text style={styles.title}>O que você precisa resolver agora?</Text>
        <Text style={styles.subtitle}>
          Atalhos para comprar vaga, entrar no campeonato, escalar jogadores e acompanhar jogos sem caçar menu.
        </Text>
      </View>

      {props.accounts?.length && props.onSelectAccount && props.onSignOut ? (
        <ProfileSwitcher
          accounts={props.accounts}
          activeAccount={props.activeAccount || null}
          onSelect={props.onSelectAccount}
          onSignOut={props.onSignOut}
        />
      ) : (
        <View style={styles.profileRow}>
          {profiles.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.profileButton, profile === item.id && styles.profileButtonActive]}
              onPress={() => onProfileChange(item.id)}
            >
              <Text style={[styles.profileText, profile === item.id && styles.profileTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Próximas ações</Text>
        {demoTasks.map((task) => (
          <TouchableOpacity key={task.id} style={[styles.taskCard, task.severity === 'warning' && styles.taskWarning]} onPress={() => onNavigate(routeForAction(task.action))}>
            <View>
              <Text style={styles.cardTitle}>{task.title}</Text>
              <Text style={styles.cardText}>{task.description}</Text>
            </View>
            <Text style={styles.cardCta}>Abrir</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acesso rápido</Text>
        <View style={styles.actionGrid}>
          {actions.map((action) => (
            <TouchableOpacity key={action.id} style={styles.actionCard} onPress={() => onNavigate(routeForAction(action.id))}>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionDescription}>{action.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Campeonatos com vagas</Text>
        {vacancies.map((championship) => (
          <TouchableOpacity
            key={championship.id}
            style={styles.vacancyCard}
            onPress={() => props.onSelectChampionship ? props.onSelectChampionship(championship) : onNavigate('vacancies')}
          >
            <View style={styles.bannerMock}>
              {championship.bannerUrl ? <Image source={{ uri: championship.bannerUrl }} style={styles.bannerImage} /> : null}
              <Text style={styles.bannerBadge}>{championship.hasLive ? 'LIVE' : 'VAGA'}</Text>
            </View>
            <View style={styles.vacancyBody}>
              <Text style={styles.cardTitle}>{championship.name}</Text>
              <Text style={styles.cardText}>{championship.mode}</Text>
              <Text style={styles.vacancyMeta}>
                {championship.priceLabel} · {championship.freeSlots} vagas · {championship.nextMatchLabel}
              </Text>
              <Text style={styles.cardCta}>Garantir vaga</Text>
            </View>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.moreButton} onPress={() => onNavigate('vacancies')}>
          <Text style={styles.moreButtonText}>Ver todas as vagas</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    borderRadius: radius.lg,
    backgroundColor: colors.brandDark,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: typography.tiny,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.surface,
    fontSize: typography.title,
    fontWeight: '900',
  },
  subtitle: {
    color: '#d6dae2',
    fontSize: typography.body,
    lineHeight: 21,
  },
  profileRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  profileButton: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  profileButtonActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  profileText: {
    color: colors.ink,
    fontWeight: '800',
  },
  profileTextActive: {
    color: colors.surface,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
  taskCard: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  taskWarning: {
    borderColor: colors.warning,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  cardText: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  cardCta: {
    color: colors.brand,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionCard: {
    width: '48%',
    minHeight: 116,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  actionTitle: {
    color: colors.ink,
    fontWeight: '900',
  },
  actionDescription: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  vacancyCard: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  bannerMock: {
    height: 136,
    backgroundColor: colors.brandDark,
    padding: spacing.md,
  },
  bannerImage: {
    ...StyleSheet.absoluteFill,
    height: undefined,
    width: undefined,
    resizeMode: 'cover',
  },
  bannerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand,
    color: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: typography.tiny,
    fontWeight: '900',
  },
  vacancyBody: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  vacancyMeta: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  moreButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  moreButtonText: {
    color: colors.ink,
    fontWeight: '900',
  },
})
