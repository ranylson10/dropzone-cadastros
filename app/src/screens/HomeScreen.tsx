import { ComponentProps, useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { mobileApi, QuickTokenResult, resolveQuickToken } from '@/lib/api'
import { MobileAccount } from '@/lib/auth'
import { money, VacancyApiItem } from '@/lib/vacancies'
import { colors, spacing, typography } from '@/theme/tokens'
import { ChampionshipCard, MobileRoute } from '@/types/dropzone'

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
  onNavigate: (route: MobileRoute) => void
  accounts?: MobileAccount[]
  accessToken?: string | null
  onSelectChampionship?: (championship: ChampionshipCard) => void
  onCreateChampionship?: () => void
  onTokenResolved?: (result: QuickTokenResult) => void
}) {
  const { onNavigate } = props
  const [vacancies, setVacancies] = useState<VacancyApiItem[]>([])
  const [loadingVacancies, setLoadingVacancies] = useState(true)
  const [tokenValue, setTokenValue] = useState('')
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenError, setTokenError] = useState('')
  const accounts = props.accounts || []
  const team = accounts.find((item) => item.profile_type === 'equipe')
  const seller = accounts.find((item) => item.profile_type === 'manager')
  const authenticated = Boolean(props.accessToken)

  useEffect(() => {
    let mounted = true
    mobileApi.vacancies()
      .then((payload) => {
        if (!mounted) return
        setVacancies(((payload.announcements as VacancyApiItem[]) || []).filter((item) => Number(item.vagas_livres || 0) > 0).slice(0, 5))
      })
      .catch(() => {
        if (mounted) setVacancies([])
      })
      .finally(() => {
        if (mounted) setLoadingVacancies(false)
      })
    return () => { mounted = false }
  }, [])

  const quickPrivateActions = useMemo(() => {
    if (!authenticated) return []
    return [
      { icon: 'shield-checkmark-outline' as const, title: team ? 'Minha equipe' : 'Criar equipe', route: team ? 'team_roster' as MobileRoute : 'team_create' as MobileRoute },
      { icon: 'people-outline' as const, title: 'Escalação', route: 'lineup' as MobileRoute },
      { icon: 'wallet-outline' as const, title: 'Carteira', route: 'wallet' as MobileRoute },
      seller ? { icon: 'cash-outline' as const, title: 'Vendas', route: 'seller_sales' as MobileRoute } : { icon: 'notifications-outline' as const, title: 'Convites', route: 'invites' as MobileRoute },
    ]
  }, [authenticated, seller, team])

  async function submitToken() {
    if (!tokenValue.trim() || tokenLoading) return
    setTokenLoading(true)
    setTokenError('')
    try {
      const result = await resolveQuickToken(tokenValue, props.accessToken)
      props.onTokenResolved?.(result)
      setTokenValue(result.token)
    } catch (error: any) {
      setTokenError(error?.message || 'Token não reconhecido.')
    } finally {
      setTokenLoading(false)
    }
  }

  function openVacancy(item: VacancyApiItem) {
    props.onSelectChampionship?.(toCard(item))
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.intro}>
        <Text style={styles.kicker}>DROPZONE COMPETITIVE</Text>
        <Text style={styles.title}>Entre no competitivo</Text>
        <Text style={styles.subtitle}>Encontre campeonato, use um token ou acesse sua área em poucos toques.</Text>

        <View style={styles.heroActions}>
          <TouchableOpacity style={styles.heroActionPrimary} onPress={() => onNavigate('vacancies')} activeOpacity={0.82}>
            <Ionicons name="ticket-outline" size={25} color="#fff" />
            <View style={styles.heroActionCopy}>
              <Text style={styles.heroActionTitle}>Encontrar vaga</Text>
              <Text style={styles.heroActionMeta}>Campeonatos abertos</Text>
            </View>
            <Ionicons name="arrow-forward" size={19} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.heroActionSecondary} onPress={() => props.onCreateChampionship?.()} activeOpacity={0.82}>
            <Ionicons name="add-circle-outline" size={23} color="#dce2e8" />
            <Text style={styles.heroActionSecondaryText}>Criar campeonato</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tokenSection}>
        <View style={styles.tokenHead}>
          <View style={styles.tokenIcon}><Ionicons name="key-outline" size={20} color={colors.brand} /></View>
          <View style={styles.tokenHeadCopy}>
            <Text style={styles.tokenKicker}>ACESSO POR TOKEN</Text>
            <Text style={styles.tokenTitle}>Entrar com convite ou inscrição</Text>
          </View>
        </View>
        <Text style={styles.tokenDescription}>Cole o token ou o link. O app identifica se é inscrição, escalação, convite de equipe ou outro acesso compatível.</Text>
        <View style={styles.tokenInputRow}>
          <TextInput
            value={tokenValue}
            onChangeText={(value) => { setTokenValue(value); setTokenError('') }}
            placeholder="Ex.: EQS-XXXX ou link completo"
            placeholderTextColor="#8b8b87"
            style={styles.tokenInput}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => void submitToken()}
          />
          <TouchableOpacity style={styles.tokenButton} onPress={() => void submitToken()} disabled={tokenLoading || !tokenValue.trim()}>
            {tokenLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="arrow-forward" size={21} color="#fff" />}
          </TouchableOpacity>
        </View>
        {tokenError ? <Text style={styles.tokenError}>{tokenError}</Text> : null}
      </View>

      <View style={styles.quickSection}>
        <View style={styles.sectionHeadCompact}>
          <View>
            <Text style={styles.sectionKicker}>ATALHOS</Text>
            <Text style={styles.sectionTitle}>Ações rápidas</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate('lili')}><Text style={styles.sectionLink}>Lili ›</Text></TouchableOpacity>
        </View>
        <View style={styles.quickGrid}>
          <QuickAction icon="trophy-outline" label="Campeonatos" onPress={() => onNavigate('vacancies')} />
          <QuickAction icon="people-outline" label="Equipes" onPress={() => onNavigate('team_directory')} />
          <QuickAction icon="person-outline" label="Jogadores" onPress={() => onNavigate('player_directory')} />
          <QuickAction icon="calendar-outline" label="Agenda" onPress={() => onNavigate('agenda')} />
          <QuickAction icon="podium-outline" label="Rank" onPress={() => onNavigate('rank')} />
        </View>
      </View>

      {authenticated && quickPrivateActions.length ? (
        <View style={styles.privateSection}>
          <View style={styles.sectionHeadCompact}><Text style={styles.sectionKicker}>MINHA ÁREA</Text><TouchableOpacity onPress={() => onNavigate('dashboard')}><Text style={styles.sectionLink}>Abrir painel ›</Text></TouchableOpacity></View>
          <View style={styles.privateRow}>
            {quickPrivateActions.map((item) => (
              <TouchableOpacity key={item.title} style={styles.privateItem} onPress={() => onNavigate(item.route)}>
                <Ionicons name={item.icon} size={20} color={colors.ink} />
                <Text style={styles.privateText} numberOfLines={1}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.vacancySection}>
        <View style={styles.sectionHeadCompact}>
          <View>
            <Text style={styles.sectionKicker}>OPORTUNIDADES</Text>
            <Text style={styles.sectionTitle}>Vagas em destaque</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate('vacancies')}><Text style={styles.sectionLink}>Ver todas ›</Text></TouchableOpacity>
        </View>

        {loadingVacancies ? <View style={styles.loading}><ActivityIndicator color={colors.brand} /><Text style={styles.muted}>Buscando vagas...</Text></View> : null}
        {!loadingVacancies && vacancies.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Nenhuma vaga aberta agora</Text><Text style={styles.muted}>Os próximos campeonatos aparecem aqui.</Text></View> : null}

        <View style={styles.vacancyList}>
          {vacancies.map((item) => (
            <TouchableOpacity key={String(item.id || item.nome)} style={styles.vacancyCard} onPress={() => openVacancy(item)} activeOpacity={0.82}>
              <View style={styles.vacancyMedia}>
                {item.banner_url ? <Image source={{ uri: item.banner_url }} style={styles.vacancyImage} /> : null}
                {item.logo_url ? <Image source={{ uri: item.logo_url }} style={styles.vacancyLogo} resizeMode="contain" /> : null}
              </View>
              <View style={styles.vacancyBody}>
                <Text style={styles.vacancyType}>{String(item.tipo || 'Campeonato').toUpperCase()}</Text>
                <Text style={styles.vacancyName} numberOfLines={1}>{item.nome || 'Campeonato'}</Text>
                <Text style={styles.vacancyMeta}>{dateLabel(item.proxima_data)} · {item.proximo_horario || 'A confirmar'}</Text>
                <View style={styles.vacancyStatus}>
                  <Text style={styles.vacancySlots}>{Number(item.vagas_livres || 0)} vagas</Text>
                  <Text style={styles.vacancyPrice}>{money(item.valor_inscricao)}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={19} color="#737982" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function QuickAction(props: { icon: ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickItem} onPress={props.onPress} activeOpacity={0.78}>
      <View style={styles.quickIcon}><Ionicons name={props.icon} size={22} color={colors.ink} /></View>
      <Text style={styles.quickLabel}>{props.label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl, gap: 14 },
  intro: { backgroundColor: colors.brandDark, borderBottomWidth: 3, borderBottomColor: colors.brand, paddingHorizontal: spacing.md, paddingTop: 16, paddingBottom: 14, gap: 7 },
  kicker: { color: '#9fa9b6', fontSize: 9, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  title: { color: colors.surface, fontSize: 29, lineHeight: 32, fontWeight: '900', textTransform: 'uppercase' },
  subtitle: { color: '#bdc4cc', fontSize: 12, lineHeight: 17, maxWidth: 540 },
  heroActions: { gap: 8, marginTop: 7 },
  heroActionPrimary: { minHeight: 64, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.brand },
  heroActionCopy: { flex: 1 },
  heroActionTitle: { color: '#fff', fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  heroActionMeta: { color: 'rgba(255,255,255,.78)', fontSize: 9, fontWeight: '700', marginTop: 2 },
  heroActionSecondary: { minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,.16)', backgroundColor: 'rgba(255,255,255,.05)' },
  heroActionSecondaryText: { color: '#e6ebf0', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  tokenSection: { marginHorizontal: spacing.md, padding: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d8d1c6' },
  tokenHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tokenIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff1f3' },
  tokenHeadCopy: { flex: 1 },
  tokenKicker: { color: colors.brand, fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  tokenTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', textTransform: 'uppercase', marginTop: 1 },
  tokenDescription: { color: '#6c6b69', fontSize: 10, lineHeight: 15, marginTop: 9 },
  tokenInputRow: { marginTop: 10, height: 48, flexDirection: 'row', backgroundColor: '#f0ece5', borderWidth: 1, borderColor: '#d3ccc1' },
  tokenInput: { flex: 1, paddingHorizontal: 12, color: colors.ink, fontSize: 12, fontWeight: '800' },
  tokenButton: { width: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  tokenError: { color: '#b42318', fontSize: 10, lineHeight: 14, fontWeight: '800', marginTop: 8 },
  quickSection: { paddingHorizontal: spacing.md, gap: 9 },
  sectionHeadCompact: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionKicker: { color: '#66707d', fontSize: 8, fontWeight: '900', letterSpacing: 1.8 },
  sectionTitle: { color: colors.ink, fontSize: 20, lineHeight: 22, fontWeight: '900', textTransform: 'uppercase', marginTop: 2 },
  sectionLink: { color: colors.ink, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  quickGrid: { flexDirection: 'row', gap: 6 },
  quickItem: { flex: 1, minWidth: 0, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#e8e2d8', borderWidth: 1, borderColor: '#d4cdc2' },
  quickIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f5ef' },
  quickLabel: { color: colors.ink, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  privateSection: { marginHorizontal: spacing.md, gap: 7 },
  privateRow: { flexDirection: 'row', gap: 6 },
  privateItem: { flex: 1, minWidth: 0, minHeight: 58, padding: 8, alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd6cc' },
  privateText: { color: colors.ink, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  vacancySection: { paddingHorizontal: spacing.md, gap: 9 },
  loading: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  muted: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  empty: { padding: 15, backgroundColor: '#e7e1d8' },
  emptyTitle: { color: colors.ink, fontSize: 12, fontWeight: '900', marginBottom: 3 },
  vacancyList: { backgroundColor: '#d6cfc5', gap: 1 },
  vacancyCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, backgroundColor: '#fff' },
  vacancyMedia: { width: 62, height: 62, backgroundColor: '#171d28', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  vacancyImage: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined, opacity: 0.56 },
  vacancyLogo: { width: 42, height: 42 },
  vacancyBody: { flex: 1, minWidth: 0 },
  vacancyType: { color: colors.brand, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  vacancyName: { color: colors.ink, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', marginTop: 1 },
  vacancyMeta: { color: '#74716d', fontSize: 9, fontWeight: '700', marginTop: 3 },
  vacancyStatus: { flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center' },
  vacancySlots: { color: colors.ink, fontSize: 9, fontWeight: '900' },
  vacancyPrice: { color: colors.brand, fontSize: 10, fontWeight: '900' },
})
