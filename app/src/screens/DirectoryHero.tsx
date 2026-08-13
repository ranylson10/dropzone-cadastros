import Ionicons from '@expo/vector-icons/Ionicons'
import type { ComponentProps } from 'react'
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { ImageSourcePropType } from 'react-native'
import { colors, spacing } from '@/theme/tokens'

type IconName = ComponentProps<typeof Ionicons>['name']

export function DirectoryHero(props: {
  image: ImageSourcePropType
  eyebrow?: string
  title: string
  description?: string
  actionLabel?: string
  actionIcon?: IconName
  onAction?: () => void
  compact?: boolean
}) {
  return (
    <ImageBackground source={props.image} style={[styles.hero, props.compact && styles.heroCompact]} imageStyle={styles.heroImage}>
      <View style={styles.shade} />
      <View style={styles.copy}>
        {props.eyebrow ? <Text style={styles.eyebrow}>{props.eyebrow}</Text> : null}
        <Text style={styles.title}>{props.title}</Text>
        {props.description ? <Text style={styles.description}>{props.description}</Text> : null}
        {props.actionLabel && props.onAction ? (
          <TouchableOpacity style={styles.action} activeOpacity={0.86} onPress={props.onAction}>
            {props.actionIcon ? <Ionicons name={props.actionIcon} size={16} color={colors.onBrand} /> : null}
            <Text style={styles.actionText}>{props.actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  hero: { height: 154, justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.surface },
  heroCompact: { height: 136 },
  heroImage: { resizeMode: 'cover' },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,13,15,.68)' },
  copy: { alignItems: 'center', paddingHorizontal: spacing.lg },
  eyebrow: { color: colors.brandLight, fontSize: 9, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase' },
  title: { marginTop: 3, color: colors.ink, fontSize: 31, lineHeight: 34, fontWeight: '900', textTransform: 'uppercase' },
  description: { marginTop: 2, color: colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  action: { marginTop: 12, minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 15, backgroundColor: colors.brand },
  actionText: { color: colors.onBrand, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
})
