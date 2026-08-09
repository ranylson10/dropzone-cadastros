import { ComponentProps } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { externalUrl } from '@/config/env'
import { QuickTokenResult } from '@/lib/api'
import { colors, spacing } from '@/theme/tokens'

const icons: Record<QuickTokenResult['kind'], ComponentProps<typeof Ionicons>['name']> = {
  team_championship_invite: 'trophy-outline',
  group_registration: 'grid-outline',
  lineup: 'people-outline',
  player_registration: 'person-add-outline',
  team_roster_invite: 'shield-checkmark-outline',
  seller_invite: 'cash-outline',
}

export function TokenActionScreen(props: { result: QuickTokenResult | null; onBack: () => void }) {
  const result = props.result
  if (!result) {
    return (
      <View style={styles.center}>
        <Ionicons name="key-outline" size={28} color={colors.muted} />
        <Text style={styles.emptyTitle}>Nenhum token selecionado</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={props.onBack}><Text style={styles.secondaryText}>Voltar</Text></TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <TouchableOpacity style={styles.back} onPress={props.onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={21} color="#fff" />
        </TouchableOpacity>
        <View style={styles.heroIcon}><Ionicons name={icons[result.kind]} size={30} color="#fff" /></View>
        <Text style={styles.kicker}>TOKEN RECONHECIDO</Text>
        <Text style={styles.title}>{result.title}</Text>
        <Text style={styles.description}>{result.description}</Text>
      </View>

      <View style={styles.tokenCard}>
        <Text style={styles.label}>TOKEN</Text>
        <Text style={styles.token} selectable>{result.token}</Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}><Ionicons name="eye-outline" size={18} color={colors.ink} /><Text style={styles.infoText}>Você pode conferir o destino antes de continuar.</Text></View>
        <View style={styles.infoRow}><Ionicons name="lock-closed-outline" size={18} color={colors.ink} /><Text style={styles.infoText}>Se a ação alterar dados, o login será solicitado no momento certo.</Text></View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => void Linking.openURL(externalUrl(result.openPath))}>
        <Text style={styles.primaryText}>{result.actionLabel}</Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={props.onBack}><Text style={styles.secondaryText}>Voltar ao início</Text></TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.background, padding: 24 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  hero: { backgroundColor: colors.brandDark, padding: 18, paddingTop: 14, borderBottomWidth: 3, borderBottomColor: colors.brand },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,.18)', marginBottom: 18 },
  heroIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand, marginBottom: 12 },
  kicker: { color: '#a8b0bb', fontSize: 8, fontWeight: '900', letterSpacing: 1.8 },
  title: { color: '#fff', fontSize: 27, lineHeight: 30, fontWeight: '900', textTransform: 'uppercase', marginTop: 4 },
  description: { color: '#c2c8d0', fontSize: 12, lineHeight: 18, marginTop: 8 },
  tokenCard: { margin: 14, marginBottom: 8, padding: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d7d0c5' },
  label: { color: colors.brand, fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  token: { color: colors.ink, fontSize: 19, fontWeight: '900', letterSpacing: 1.5, marginTop: 4 },
  infoCard: { marginHorizontal: 14, marginBottom: 10, padding: 12, gap: 10, backgroundColor: '#e9e3d9' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  infoText: { flex: 1, color: '#555b64', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  primaryButton: { marginHorizontal: 14, minHeight: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.brand },
  primaryText: { color: '#fff', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  secondaryButton: { marginHorizontal: 14, marginTop: 8, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#cbc4ba', backgroundColor: '#fff' },
  secondaryText: { color: colors.ink, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
})
