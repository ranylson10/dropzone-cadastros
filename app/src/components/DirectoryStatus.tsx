import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '@/theme/tokens'

type Props = { page: { items: unknown[]; nextCursor: string | null; loading: boolean; refreshing: boolean; error: string; more: () => Promise<void>; refresh: () => Promise<void> }; empty?: string }

export function DirectoryStatus({ page, empty = 'Nenhum resultado encontrado.' }: Props) {
  const pending = page.loading || page.refreshing
  return <View style={styles.container}>
    {pending ? <ActivityIndicator color={colors.brand} /> : null}
    {page.error ? <>
      <Text style={styles.error}>{page.error}</Text>
      <TouchableOpacity accessibilityRole="button" disabled={pending} style={styles.button} onPress={() => void (page.nextCursor ? page.more() : page.refresh())}>
        <Text style={styles.label}>Tentar novamente</Text>
      </TouchableOpacity>
    </> : !pending && !page.items.length ? <Text style={styles.empty}>{empty}</Text> : null}
    {page.nextCursor && !page.error ? <TouchableOpacity accessibilityRole="button" disabled={pending} style={styles.button} onPress={() => void page.more()}>
      <Text style={styles.label}>{pending ? 'Carregando...' : 'Carregar mais'}</Text>
    </TouchableOpacity> : null}
  </View>
}

const styles = StyleSheet.create({
  container: { gap: 8, paddingVertical: 8 },
  button: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.brand, borderRadius: 10, paddingHorizontal: 16 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  error: { color: '#b42318', fontSize: 12 },
  empty: { color: colors.muted, fontSize: 12 },
})
