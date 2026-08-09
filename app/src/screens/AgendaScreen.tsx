import { useEffect, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { agendaDateLabel, agendaDescription, AgendaItem, agendaTitle } from '@/lib/agenda'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { DirectoryHero } from '@/screens/DirectoryHero'
import { colors, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

export function AgendaScreen({ onNavigate }: ScreenProps) {
  const auth = useAuth()
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    mobileApi.agenda(auth.session?.access_token)
      .then((response) => {
        if (!mounted) return
        setItems((response.items as AgendaItem[]) || [])
        setError(null)
      })
      .catch((err) => mounted && setError(err?.message || 'Não foi possível carregar a agenda.'))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [auth.session?.access_token])

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <DirectoryHero
        image={require('../../assets/directory-campeonatos.png')}
        eyebrow="Sua rotina competitiva"
        title="Agenda"
        description="Jogos, horários e prazos do perfil ativo."
        compact
      />

      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brand} /><Text style={styles.loadingText}>Carregando agenda...</Text></View> : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}
      {!loading && items.length === 0 ? (
        <TouchableOpacity style={styles.empty} onPress={() => onNavigate('vacancies')}>
          <Ionicons name="calendar-outline" size={24} color={colors.muted} />
          <Text style={styles.emptyText}>Nada agendado. Ver campeonatos.</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.list}>
        {items.slice(0, 30).map((item, index) => {
          const isGame = String(item.source || '').includes('jogo')
          return (
            <TouchableOpacity key={String(item.id || `${agendaTitle(item)}-${index}`)} style={styles.row} onPress={() => onNavigate(isGame ? 'lineup' : 'my_championships')}>
              <View style={styles.dateBox}>
                <Ionicons name={isGame ? 'game-controller-outline' : 'calendar-outline'} size={19} color={colors.brand} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.date} numberOfLines={1}>{agendaDateLabel(item)}</Text>
                <Text style={styles.title} numberOfLines={1}>{agendaTitle(item)}</Text>
                <Text style={styles.meta} numberOfLines={1}>{agendaDescription(item)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#717b87" />
            </TouchableOpacity>
          )
        })}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.lg },
  loading: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  warning: { margin: spacing.md, padding: 10, backgroundColor: '#fff7ed', color: '#9a3412', fontSize: 11, fontWeight: '800' },
  empty: { margin: spacing.md, minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#e7e1d8' },
  emptyText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  list: { margin: spacing.md, backgroundColor: '#cfc8be', gap: 1 },
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#e8e2d8' },
  dateBox: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f1e9', borderWidth: 1, borderColor: 'rgba(17,24,39,.07)' },
  copy: { flex: 1, minWidth: 0 },
  date: { color: colors.brand, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  title: { marginTop: 2, color: colors.ink, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  meta: { marginTop: 3, color: '#706b64', fontSize: 9, fontWeight: '700' },
})
