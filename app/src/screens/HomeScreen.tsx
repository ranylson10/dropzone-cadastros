import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { apiUrl } from '@/config/env'
import { MobileAccount } from '@/lib/auth'
import { ProfileSwitcher } from '@/screens/ProfileSwitcher'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ChampionshipCard, MobileRoute, ProfileType } from '@/types/dropzone'

const fallbackProfiles: Array<{ id: ProfileType; label: string }> = [
  { id: 'equipe', label: 'Equipe' },
  { id: 'jogador', label: 'Jogador' },
  { id: 'manager', label: 'Vendedor' },
  { id: 'produtora', label: 'Produtora' },
]

const siteRoutes: Array<{ title: string; description: string; path: string }> = [
  { title: 'Campeonatos', description: 'Lista, venda de vagas e detalhes.', path: '/campeonatos' },
  { title: 'Minha área', description: 'Resumo da conta e acessos rápidos.', path: '/' },
  { title: 'Agenda', description: 'Jogos, prazos e compromissos.', path: '/agenda' },
  { title: 'Carteira', description: 'Saldo, comprovantes e pagamentos.', path: '/carteira' },
]

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

  function openSite(path = '/') {
    void Linking.openURL(apiUrl(path))
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.logoMark} />
        <View style={styles.headerText}>
          <Text style={styles.brand}>DROPZONE</Text>
          <Text style={styles.brandSub}>use o fluxo mobile do site</Text>
        </View>
        <TouchableOpacity style={styles.liliButton} onPress={() => onNavigate('lili')}>
          <Text style={styles.liliText}>Lili</Text>
        </TouchableOpacity>
      </View>

      {props.accounts?.length && props.onSelectAccount && props.onSignOut ? (
        <ProfileSwitcher
          accounts={props.accounts}
          activeAccount={props.activeAccount || null}
          onSelect={props.onSelectAccount}
          onSignOut={props.onSignOut}
        />
      ) : (
        <View style={styles.profileGrid}>
          {fallbackProfiles.map((item) => (
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

      <View style={styles.siteCard}>
        <Text style={styles.eyebrow}>Principal</Text>
        <Text style={styles.title}>Abrir site mobile</Text>
        <Text style={styles.subtitle}>
          O app vai usar a navegação que já está pronta e organizada no site. As funções nativas ficam como atalhos.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => openSite('/')}>
          <Text style={styles.primaryButtonText}>Continuar no site</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Atalhos do site</Text>
        <View style={styles.list}>
          {siteRoutes.map((item) => (
            <TouchableOpacity key={item.path} style={styles.listItem} onPress={() => openSite(item.path)}>
              <View style={styles.listText}>
                <Text style={styles.listTitle}>{item.title}</Text>
                <Text style={styles.listDescription}>{item.description}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Atalhos do app</Text>
        <View style={styles.nativeGrid}>
          <TouchableOpacity style={styles.nativeCard} onPress={() => onNavigate('lili')}>
            <Text style={styles.nativeTitle}>Lili</Text>
            <Text style={styles.nativeText}>Assistente rápida.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nativeCard} onPress={() => onNavigate('vacancies')}>
            <Text style={styles.nativeTitle}>Vagas</Text>
            <Text style={styles.nativeText}>Campeonatos abertos.</Text>
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.brandDark,
    padding: spacing.md,
    gap: spacing.md,
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.gold,
    transform: [{ rotate: '45deg' }],
  },
  headerText: {
    flex: 1,
  },
  brand: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandSub: {
    marginTop: 2,
    color: '#cbd5e1',
    fontSize: typography.tiny,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  liliButton: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  liliText: {
    color: colors.surface,
    fontWeight: '900',
    fontSize: typography.caption,
  },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  profileButton: {
    flexGrow: 1,
    minWidth: '46%',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.md,
  },
  profileButtonActive: {
    backgroundColor: colors.brandDark,
    borderColor: colors.brandDark,
  },
  profileText: {
    color: colors.ink,
    fontWeight: '900',
  },
  profileTextActive: {
    color: colors.surface,
  },
  siteCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.brand,
    fontSize: typography.tiny,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 31,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  primaryButton: {
    marginTop: spacing.sm,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
  list: {
    overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  listItem: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  listText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  listTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  listDescription: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption,
  },
  chevron: {
    color: colors.brand,
    fontSize: 28,
    fontWeight: '900',
  },
  nativeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  nativeCard: {
    flex: 1,
    minHeight: 82,
    borderRadius: radius.md,
    backgroundColor: colors.brandDark,
    padding: spacing.md,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  nativeTitle: {
    color: colors.surface,
    fontWeight: '900',
    fontSize: typography.body,
  },
  nativeText: {
    color: '#cbd5e1',
    fontSize: typography.caption,
  },
})
