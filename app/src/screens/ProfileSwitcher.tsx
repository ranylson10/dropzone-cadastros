import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { MobileAccount } from '@/lib/auth'
import { colors, radius, spacing, typography } from '@/theme/tokens'

export function ProfileSwitcher(props: {
  accounts: MobileAccount[]
  activeAccount: MobileAccount | null
  onSelect: (id: string) => void
  onSignOut: () => void
}) {
  if (!props.accounts.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Nenhum perfil encontrado. Crie um perfil no site para continuar.</Text>
        <TouchableOpacity onPress={props.onSignOut}>
          <Text style={styles.signOut}>Sair</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {props.accounts.map((account) => {
          const active = props.activeAccount?.id === account.id
          return (
            <TouchableOpacity
              key={account.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => props.onSelect(account.id)}
            >
              <Text style={[styles.type, active && styles.typeActive]}>{account.profile_type}</Text>
              <Text style={[styles.name, active && styles.nameActive]} numberOfLines={1}>{account.name}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
      <TouchableOpacity style={styles.logout} onPress={props.onSignOut}>
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  row: {
    gap: spacing.sm,
  },
  chip: {
    minWidth: 132,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.brandDark,
    borderColor: colors.brandDark,
  },
  type: {
    color: colors.brand,
    fontSize: typography.tiny,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  typeActive: {
    color: colors.gold,
  },
  name: {
    color: colors.ink,
    fontWeight: '900',
  },
  nameActive: {
    color: colors.surface,
  },
  logout: {
    alignSelf: 'flex-start',
  },
  logoutText: {
    color: colors.muted,
    fontWeight: '800',
  },
  empty: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.muted,
  },
  signOut: {
    color: colors.brand,
    fontWeight: '900',
  },
})
