import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { apiUrl } from '@/config/env'
import { MobileAccount } from '@/lib/auth'
import { colors, radius, spacing, typography } from '@/theme/tokens'

const typeLabel: Record<string, string> = {
  produtora: 'Produtora',
  equipe: 'Equipe',
  jogador: 'Jogador',
  manager: 'Vendedor',
  broadcast: 'Broadcast',
}

export function ProfileSwitcher(props: {
  accounts: MobileAccount[]
  activeAccount: MobileAccount | null
  onSelect: (id: string) => void
  onSignOut: () => void
}) {
  if (!props.accounts.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Nenhum perfil nesta conta</Text>
        <Text style={styles.emptyText}>Crie um perfil no site para liberar o app.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => Linking.openURL(apiUrl('/login'))}>
          <Text style={styles.primaryButtonText}>Criar perfil</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={props.onSignOut}>
          <Text style={styles.signOut}>Sair</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const active = props.activeAccount || props.accounts[0]
  const others = props.accounts.filter((account) => account.id !== active?.id).slice(0, 3)

  return (
    <View style={styles.wrap}>
      <View style={styles.activeCard}>
        <View style={styles.activeInfo}>
          <Text style={styles.type}>{typeLabel[active.profile_type] || active.profile_type}</Text>
          <Text style={styles.name} numberOfLines={1}>{active.name}</Text>
        </View>
        <TouchableOpacity onPress={props.onSignOut}>
          <Text style={styles.signOut}>Sair</Text>
        </TouchableOpacity>
      </View>

      {others.length ? (
        <View style={styles.otherRow}>
          {others.map((account) => (
            <TouchableOpacity key={account.id} style={styles.otherChip} onPress={() => props.onSelect(account.id)}>
              <Text style={styles.otherText} numberOfLines={1}>
                {typeLabel[account.profile_type] || account.profile_type}: {account.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.md,
  },
  activeInfo: {
    flex: 1,
  },
  type: {
    color: colors.brand,
    fontSize: typography.tiny,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  name: {
    marginTop: 3,
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  otherRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  otherChip: {
    maxWidth: '100%',
    borderRadius: 999,
    backgroundColor: '#eee9dd',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  otherText: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  signOut: {
    color: colors.muted,
    fontWeight: '900',
  },
  empty: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.ink,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 19,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    padding: spacing.md,
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
})
