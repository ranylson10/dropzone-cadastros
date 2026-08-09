import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { MobileAccount } from '@/lib/auth'
import { money, VacancyApiItem } from '@/lib/vacancies'
import { ProfileSwitcher } from '@/screens/ProfileSwitcher'
import { colors, spacing, typography } from '@/theme/tokens'
import { ChampionshipCard, MobileRoute, ProfileType } from '@/types/dropzone'

const fallbackProfiles: Array<{ id: ProfileType; label: string }> = [
  { id: 'equipe', label: 'Equipe' },
  { id: 'jogador', label: 'Jogador' },
  { id: 'manager', label: 'Vendedor' },
  { id: 'produtora', label: 'Produtora' },
]

function dateLabel(value?: string | null) {
  if (!value) return 'Data a confirmar'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return 'Data a confirmar'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date)
}

function toCard(item: VacancyApiItem): ChampionshipCard {
  return {
    id: String(item.id || item.nome || 'campeonato'),
    name: item.nome || 'Campeonato',
    mode: item.tipo || 'competitivo',
    logoUrl: item.logo_url || null,
    bannerUrl: item.banner_url || null,
    priceLabel: money(item.valor_inscricao),
    prizeLabel: item.descricao_premiacao || money(item.premiacao),
    freeSlots: Number(item.vagas_livres || 0),
    nextMatchLabel: dateLabel(item.proxima_data),
    hasLive: Boolean(item.tem_live),
  }
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
  const [vacancies, setVacancies] = useState<VacancyApiItem[]>([])
  const [loadingVacancies, setLoadingVacancies] = useState(true)
  const accounts = props.accounts || []
  const producer = accounts.find((item) => item.profile_type === 'produtora')
  const team = accounts.find((item) => item.profile_type === 'equipe')
  const seller = accounts.find((item) => item.profile_type === 'manager')

  useEffect(() => {
    let mounted = true
    mobileApi.vacancies()
      .then((payload) => {
        if (!mounted) return
        setVacancies(((payload.announcements as VacancyApiItem[]) || []).filter((item) => Number(item.vagas_livres || 0) > 0).slice(0, 6))
      })
      .catch(() => {
        if (mounted) setVacancies([])
      })
      .finally(() => {
        if (mounted) setLoadingVacancies(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const availableVacancies = useMemo(
    () => vacancies.reduce((sum, item) => sum + Number(item.vagas_livres || 0), 0),
    [vacancies],
  )

  function openVacancy(item: VacancyApiItem) {
    props.onSelectChampionship?.(toCard(item))
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.intro}>
        <View style={styles.logoMark}>
          <View style={[styles.logoPiece, styles.logoPieceLeft]} />
          <View style={[styles.logoPiece, styles.logoPieceRight]} />
          <View style={[styles.logoPiece, styles.logoPieceBottom]} />
        </View>
        <Text style={styles.kicker}>DROPZONE COMPETITIVE</Text>
        <Text style={styles.title}>Resolva rápido</Text>
        <Text style={styles.subtitle}>Vagas, campeonatos, escalação e carteira no caminho mais curto.</Text>
        <View style={styles.primaryActions}>
          <TouchableOpacity
            style={[styles.introAction, styles.introActionPrimary]}
            onPress={() => onNavigate(producer ? 'producer_overview' : 'vacancies')}
          >
            <Text style={styles.introActionTitle}>{producer ? 'Criar campeonato' : 'Garantir vaga'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.introAction} onPress={() => onNavigate(team ? 'lineup' : 'my_championships')}>
            <Text style={styles.introActionTitle}>{team ? 'Escalar elenco' : 'Meus campeonatos'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {accounts.length && props.onSelectAccount && props.onSignOut ? (
        <ProfileSwitcher
          accounts={accounts}
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

      <View style={styles.overview}>
        <View style={styles.overviewItem}><Text style={styles.overviewNumber}>{vacancies.length}</Text><Text style={styles.overviewText}>campeonatos</Text></View>
        <View style={styles.overviewItem}><Text style={styles.overviewNumber}>{accounts.length}</Text><Text style={styles.overviewText}>perfis</Text></View>
        <View style={styles.overviewItem}><Text style={styles.overviewNumber}>{availableVacancies}</Text><Text style={styles.overviewText}>vagas</Text></View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionKicker}>ACESSO RÁPIDO</Text>
            <Text style={styles.sectionTitle}>Minha área</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate('lili')}>
            <Text style={styles.sectionLink}>Lili ›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.accessList}>
          <AccessItem title="Campeonatos" text="Vagas, inscritos e ações" onPress={() => onNavigate('vacancies')} />
          <AccessItem title="Minha equipe" text={team ? 'Lines e elenco' : 'Buscar vagas abertas'} onPress={() => onNavigate(team ? 'team_roster' : 'vacancies')} />
          <AccessItem title="Escalação" text="Tokens e jogadores" onPress={() => onNavigate('lineup')} />
          <AccessItem title="Agenda" text="Jogos e prazos" onPress={() => onNavigate('agenda')} />
          <AccessItem title="Carteira" text="Saldo e comprovantes" onPress={() => onNavigate('wallet')} />
          <AccessItem title={seller ? 'Vendas' : 'Rank'} text={seller ? 'Painel do vendedor' : 'Equipes e jogadores'} onPress={() => onNavigate(seller ? 'seller_sales' : 'rank')} />
        </View>
      </View>

      <View style={[styles.section, styles.vacancySection]}>
        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionKicker}>OPORTUNIDADES</Text>
            <Text style={styles.sectionTitle}>Vagas em destaque</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate('vacancies')}>
            <Text style={styles.sectionLink}>Ver todas ›</Text>
          </TouchableOpacity>
        </View>

        {loadingVacancies ? (
          <View style={styles.loading}><ActivityIndicator color={colors.brand} /><Text style={styles.muted}>Buscando vagas...</Text></View>
        ) : null}

        {!loadingVacancies && vacancies.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>Nenhuma vaga aberta agora</Text><Text style={styles.muted}>Os próximos campeonatos aparecem aqui.</Text></View>
        ) : null}

        {vacancies.map((item) => (
          <TouchableOpacity key={String(item.id || item.nome)} style={styles.vacancyCard} onPress={() => openVacancy(item)}>
            <View style={styles.vacancyMedia}>
              {item.banner_url ? <Image source={{ uri: item.banner_url }} style={styles.vacancyImage} /> : null}
              <Text style={styles.vacancyBadge}>{String(item.tipo || 'Vaga').toUpperCase()}</Text>
              {item.logo_url ? <Image source={{ uri: item.logo_url }} style={styles.vacancyLogo} /> : null}
            </View>
            <View style={styles.vacancyBody}>
              <Text style={styles.vacancyType}>{item.tipo || 'Campeonato'}</Text>
              <Text style={styles.vacancyName} numberOfLines={1}>{item.nome || 'Campeonato'}</Text>
              <Text style={styles.vacancyMeta}>{dateLabel(item.proxima_data)} · {item.proximo_horario || 'Horário a confirmar'}</Text>
              <View style={styles.vacancyStatus}>
                <Text style={styles.vacancySlots}>{Number(item.vagas_livres || 0)} de {Number(item.total_vagas || 0)} vagas</Text>
                <Text style={styles.vacancyPrice}>{money(item.valor_inscricao)}</Text>
              </View>
              <View style={styles.vacancyLine}><View style={[styles.vacancyLineFill, { width: `${Math.max(8, Math.min(100, (Number(item.vagas_livres || 0) / Math.max(1, Number(item.total_vagas || 1))) * 100))}%` }]} /></View>
              <Text style={styles.buyText}>Garantir vaga ›</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

function AccessItem(props: { title: string; text: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.accessItem} onPress={props.onPress}>
      <View style={styles.accessIcon} />
      <View style={styles.accessText}>
        <Text style={styles.accessTitle}>{props.title}</Text>
        <Text style={styles.accessDescription} numberOfLines={1}>{props.text}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl, gap: spacing.md },
  intro: {
    backgroundColor: colors.brandDark,
    borderBottomWidth: 3,
    borderBottomColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  logoMark: { width: 42, height: 36, position: 'relative' },
  logoPiece: { position: 'absolute', width: 18, height: 22, borderRadius: 2, backgroundColor: colors.brand, transform: [{ skewY: '-24deg' }] },
  logoPieceLeft: { left: 0, top: 0 },
  logoPieceRight: { right: 0, top: 0 },
  logoPieceBottom: { left: 12, bottom: 0, transform: [{ skewY: '24deg' }] },
  kicker: { color: '#aeb6c0', fontSize: typography.tiny, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  title: { color: colors.surface, fontSize: 31, lineHeight: 34, fontWeight: '900', textTransform: 'uppercase' },
  subtitle: { color: '#bdc4cc', fontSize: typography.caption, lineHeight: 19 },
  primaryActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  introAction: { flex: 1, minHeight: 58, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.06)', padding: spacing.sm, justifyContent: 'center' },
  introActionPrimary: { backgroundColor: colors.brand, borderColor: colors.brand },
  introActionTitle: { color: colors.surface, fontSize: typography.caption, fontWeight: '900', textTransform: 'uppercase', textAlign: 'center' },
  profileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.sm },
  profileButton: { flexGrow: 1, minWidth: '46%', alignItems: 'center', borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingVertical: spacing.sm },
  profileButtonActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  profileText: { color: colors.muted, fontWeight: '900' },
  profileTextActive: { color: colors.surface },
  overview: { marginHorizontal: spacing.sm, flexDirection: 'row', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  overviewItem: { flex: 1, padding: spacing.sm, borderRightWidth: 1, borderRightColor: colors.line },
  overviewNumber: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  overviewText: { color: colors.muted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', lineHeight: 12 },
  section: { paddingHorizontal: spacing.sm, gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: spacing.sm },
  sectionKicker: { color: colors.muted, fontSize: typography.tiny, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  sectionLink: { color: colors.ink, fontSize: typography.tiny, fontWeight: '900', textTransform: 'uppercase' },
  accessList: { gap: 6 },
  accessItem: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: spacing.sm },
  accessIcon: { width: 38, height: 38, backgroundColor: colors.brandDark },
  accessText: { flex: 1 },
  accessTitle: { color: colors.ink, fontSize: typography.caption, fontWeight: '900', textTransform: 'uppercase' },
  accessDescription: { color: colors.muted, fontSize: typography.tiny, marginTop: 2 },
  chevron: { color: colors.brand, fontSize: 24, fontWeight: '900' },
  vacancySection: { marginHorizontal: spacing.sm, padding: spacing.sm, backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#e4ddd2' },
  loading: { minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  muted: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  empty: { minHeight: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: spacing.md },
  emptyTitle: { color: colors.ink, fontWeight: '900', textTransform: 'uppercase' },
  vacancyCard: { overflow: 'hidden', minHeight: 190, flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 3, borderTopColor: colors.brand, shadowColor: '#111827', shadowOpacity: 0.12, shadowRadius: 16, elevation: 2 },
  vacancyMedia: { width: 128, minHeight: 190, backgroundColor: '#101820', position: 'relative', justifyContent: 'flex-end', padding: 8 },
  vacancyImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: undefined, height: undefined },
  vacancyBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.brand, color: colors.surface, fontSize: 8, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 4 },
  vacancyLogo: { width: 42, height: 42, alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,0.9)' },
  vacancyBody: { flex: 1, padding: spacing.sm, gap: 7, justifyContent: 'center' },
  vacancyType: { color: colors.muted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  vacancyName: { color: colors.ink, fontSize: 17, fontWeight: '900', textTransform: 'uppercase' },
  vacancyMeta: { color: colors.muted, fontSize: typography.tiny, fontWeight: '700' },
  vacancyStatus: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.xs },
  vacancySlots: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  vacancyPrice: { color: colors.ink, fontSize: typography.caption, fontWeight: '900' },
  vacancyLine: { height: 5, backgroundColor: '#ece7df', overflow: 'hidden' },
  vacancyLineFill: { height: '100%', backgroundColor: colors.brand },
  buyText: { alignSelf: 'flex-end', color: colors.brand, fontSize: typography.tiny, fontWeight: '900', textTransform: 'uppercase' },
})
