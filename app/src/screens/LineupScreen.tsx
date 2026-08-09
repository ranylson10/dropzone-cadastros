import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { lineupDateLabel, LineupSummary, lineupSubtitle } from '@/lib/lineups'
import { ActionCard, ScreenShell } from '@/screens/components'
import { colors, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

export function LineupScreen({ onBack, onNavigate }: ScreenProps) {
  const auth = useAuth()
  const accessToken = auth.session?.access_token
  const [lineups, setLineups] = useState<LineupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createdInvite, setCreatedInvite] = useState<Record<string, { token: string; url: string; text?: string }>>({})
  const [creatingId, setCreatingId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    mobileApi.lineups(accessToken)
      .then((response) => {
        if (!mounted) return
        setLineups((response.escalacoes as LineupSummary[]) || [])
        setError(null)
      })
      .catch((err) => {
        if (!mounted) return
        setLineups([])
        setError(err?.message || 'Não foi possível carregar as escalações.')
      })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [accessToken])

  const totals = useMemo(() => lineups.reduce((acc, lineup) => {
    const limit = Number(lineup.limite_jogadores || 6)
    const confirmed = Number(lineup.jogadores_confirmados || lineup.jogadores?.length || 0)
    acc.confirmed += confirmed
    acc.limit += limit
    acc.open += Math.max(0, limit - confirmed)
    return acc
  }, { confirmed: 0, limit: 0, open: 0 }), [lineups])

  async function generateInvite(lineup: LineupSummary) {
    const participationId = String(lineup.campeonato_equipe_id || '')
    if (!participationId) return
    setCreatingId(participationId)
    setError(null)
    try {
      const created = await mobileApi.createLineupInvite(participationId, accessToken)
      setCreatedInvite((current) => ({ ...current, [participationId]: { token: created.token, url: created.public_url, text: created.texto } }))
    } catch (err: any) {
      setError(err?.message || 'Não foi possível gerar o convite de escalação.')
    } finally {
      setCreatingId(null)
    }
  }

  return (
    <ScreenShell eyebrow="Equipe" title="Escalação" onBack={onBack}>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>Resumo do elenco</Text>
        <Text style={styles.heroTitle}>{totals.confirmed}/{totals.limit || 0}</Text>
        <Text style={styles.heroText}>{totals.open} vaga(s) ainda abertas nas inscrições carregadas.</Text>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brand} /><Text style={styles.muted}>Carregando escalações...</Text></View> : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}

      {!loading && lineups.length === 0 ? (
        <ActionCard title="Nenhuma line inscrita" description="Entre em um campeonato com vaga. Depois a escalação aparece aqui." cta="Buscar vagas" onPress={() => onNavigate('vacancies')} />
      ) : null}

      {lineups.map((lineup) => {
        const id = String(lineup.campeonato_equipe_id || lineup.campeonato_nome || Math.random())
        const limit = Number(lineup.limite_jogadores || 6)
        const confirmed = Number(lineup.jogadores_confirmados || lineup.jogadores?.length || 0)
        const free = Math.max(0, Number(lineup.vagas_disponiveis ?? limit - confirmed))
        const progress = Math.max(4, Math.min(100, (confirmed / Math.max(1, limit)) * 100))
        const invite = createdInvite[id]
        const token = invite?.token || lineup.link_token || null
        const inviteUrl = invite?.url || (lineup.link_token ? `https://dropzone-cadastros.vercel.app/escala/${lineup.link_token}` : '')
        return (
          <View key={id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.slotBox}><Text style={styles.slotValue}>{confirmed}</Text><Text style={styles.slotLabel}>/{limit}</Text></View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle} numberOfLines={1}>{lineup.campeonato_nome || 'Campeonato'}</Text>
                <Text style={styles.cardMeta} numberOfLines={1}>{lineupSubtitle(lineup)}</Text>
              </View>
            </View>

            <View style={styles.progress}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
            <View style={styles.infoRow}>
              <Info label="jogo" value={lineupDateLabel(lineup)} />
              <Info label="livres" value={String(free)} />
              <Info label="status" value={free ? 'pendente' : 'fechado'} />
            </View>

            {token ? (
              <View style={styles.tokenBox}>
                <Text style={styles.tokenLabel}>Token ativo</Text>
                <Text style={styles.tokenValue} selectable>{token}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.primary} onPress={() => generateInvite(lineup)} disabled={creatingId === id}>
                <Text style={styles.primaryText}>{creatingId === id ? 'Gerando...' : token ? 'Renovar token' : 'Gerar token'}</Text>
              </TouchableOpacity>
              {inviteUrl ? (
                <TouchableOpacity style={styles.secondary} onPress={() => Linking.openURL(inviteUrl)}>
                  <Text style={styles.secondaryText}>Abrir link de escalação</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )
      })}
    </ScreenShell>
  )
}

function Info(props: { label: string; value: string }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoValue} numberOfLines={1}>{props.value}</Text>
      <Text style={styles.infoLabel}>{props.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.brandDark, borderBottomWidth: 3, borderBottomColor: colors.brand, padding: spacing.lg, gap: spacing.xs },
  heroKicker: { color: colors.gold, fontSize: typography.tiny, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  heroTitle: { color: colors.surface, fontSize: 42, fontWeight: '900' },
  heroText: { color: '#cbd5e1', fontSize: typography.caption, fontWeight: '700' },
  loading: { alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: spacing.sm, padding: spacing.lg },
  muted: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  warning: { backgroundColor: '#fff7ed', color: '#9a3412', fontWeight: '800', padding: spacing.md },
  card: { backgroundColor: colors.surface, borderTopWidth: 3, borderTopColor: colors.brand, padding: spacing.md, gap: spacing.sm, elevation: 2 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  slotBox: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandDark },
  slotValue: { color: colors.surface, fontSize: 20, fontWeight: '900' },
  slotLabel: { color: '#cbd5e1', fontSize: 9, fontWeight: '900' },
  cardTitleWrap: { flex: 1 },
  cardTitle: { color: colors.ink, fontSize: typography.subtitle, fontWeight: '900', textTransform: 'uppercase' },
  cardMeta: { color: colors.muted, fontSize: typography.caption, fontWeight: '700', marginTop: 2 },
  progress: { height: 6, overflow: 'hidden', backgroundColor: '#ece7df' },
  progressFill: { height: '100%', backgroundColor: colors.brand },
  infoRow: { flexDirection: 'row', gap: spacing.sm },
  infoBox: { flex: 1, backgroundColor: colors.background, padding: spacing.sm },
  infoValue: { color: colors.ink, fontSize: typography.caption, fontWeight: '900' },
  infoLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  tokenBox: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line, padding: spacing.sm },
  tokenLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  tokenValue: { color: colors.ink, fontSize: typography.body, fontWeight: '900', marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  primary: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  primaryText: { color: colors.surface, fontSize: typography.caption, fontWeight: '900', textTransform: 'uppercase' },
  secondary: { width: 116, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  secondaryText: { color: colors.ink, fontSize: typography.caption, fontWeight: '900', textTransform: 'uppercase' },
})
