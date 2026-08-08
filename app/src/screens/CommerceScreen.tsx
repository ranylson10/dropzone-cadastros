import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { getMobileCart, getMobileWishlist, mobileCommerceFromApi, MobileCommerceItem, removeMobileCart, setMobileCartQuantity } from '@/lib/commerce'
import { ActionCard, ScreenShell } from '@/screens/components'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

type CartPaymentMethod = 'pix' | 'cartao' | 'paypal'

const paymentMethods: Array<{ id: CartPaymentMethod; label: string }> = [
  { id: 'pix', label: 'PIX' },
  { id: 'cartao', label: 'Cartão' },
  { id: 'paypal', label: 'PayPal' },
]

export function CommerceScreen({ onBack, onNavigate }: ScreenProps) {
  const auth = useAuth()
  const [cart, setCart] = useState<MobileCommerceItem[]>([])
  const [wishlist, setWishlist] = useState<MobileCommerceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutId, setCheckoutId] = useState<string | null>(null)
  const [methodByItem, setMethodByItem] = useState<Record<string, CartPaymentMethod>>({})
  const [checkoutByItem, setCheckoutByItem] = useState<Record<string, { checkoutUrl: string; claimUrl: string }>>({})
  const [error, setError] = useState<string | null>(null)

  async function loadCommerce() {
    const accessToken = auth.session?.access_token
    setLoading(true)
    setError(null)
    try {
      const [cartPayload, wishlistPayload] = accessToken
        ? await Promise.all([mobileApi.commerceCart(accessToken), mobileApi.commerceWishlist(accessToken)])
        : await Promise.all([{ items: await getMobileCart() }, { items: await getMobileWishlist() }])
      setCart((cartPayload.items || []).map((item: any) => item?.campeonato ? mobileCommerceFromApi(item) : item))
      setWishlist((wishlistPayload.items || []).map((item: any) => item?.campeonato ? mobileCommerceFromApi(item) : item))
    } catch (err: any) {
      setCart(await getMobileCart())
      setWishlist(await getMobileWishlist())
      setError(err?.message || 'Não foi possível sincronizar com o servidor agora.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCommerce()
  }, [auth.session?.access_token])

  async function checkout(item: MobileCommerceItem) {
    const accessToken = auth.session?.access_token
    if (!accessToken || !item.itemId) {
      onNavigate('vacancies')
      return
    }
    setCheckoutId(item.id)
    setError(null)
    try {
      const method = methodByItem[item.id] || 'pix'
      const payload = await mobileApi.checkoutCommerceCartItem({ item_id: item.itemId, method }, accessToken)
      const url = payload.payment?.paypal_approval_url || payload.payment?.invoice_url
      setCheckoutByItem((current) => ({ ...current, [item.id]: { checkoutUrl: url || '', claimUrl: payload.claim_url } }))
      if (url) await Linking.openURL(url)
      else setError('Pagamento criado. Use o botão de inscrição liberada abaixo quando o pagamento confirmar.')
    } catch (err: any) {
      setError(err?.message || 'Não foi possível gerar o pagamento.')
    } finally {
      setCheckoutId(null)
    }
  }

  async function removeItem(item: MobileCommerceItem) {
    const accessToken = auth.session?.access_token
    setError(null)
    if (accessToken && item.itemId) {
      try {
        const payload = await mobileApi.removeCommerceCartItem(item.itemId, accessToken)
        setCart((payload.items || []).map((row: any) => row?.campeonato ? mobileCommerceFromApi(row) : row))
        return
      } catch (err: any) {
        setError(err?.message || 'Não foi possível remover no servidor. Removi apenas do aparelho.')
      }
    }
    setCart(await removeMobileCart(item.id))
  }

  async function updateQuantity(item: MobileCommerceItem, quantity: number) {
    const nextQuantity = Math.max(1, Math.min(Number(item.freeSlots || 99), quantity))
    const accessToken = auth.session?.access_token
    setError(null)
    if (accessToken && item.itemId) {
      try {
        const payload = await mobileApi.updateCommerceCartItem(item.itemId, nextQuantity, accessToken)
        setCart((payload.items || []).map((row: any) => row?.campeonato ? mobileCommerceFromApi(row) : row))
        return
      } catch (err: any) {
        setError(err?.message || 'Não foi possível ajustar no servidor. Ajustei apenas no aparelho.')
      }
    }
    setCart(await setMobileCartQuantity(item.id, nextQuantity))
  }

  return (
    <ScreenShell
      eyebrow="Compra"
      title="Carrinho e favoritos"
      description="Revise vagas salvas, retome campeonatos favoritos e inicie o pagamento quando estiver pronto."
      onBack={onBack}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.meta}>Sincronizando carrinho...</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.warning}>{error}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Carrinho</Text>
        {!loading && cart.length === 0 ? (
          <ActionCard title="Carrinho vazio" description="Adicione vagas pela vitrine de campeonatos para comprar depois." cta="Ver vagas" onPress={() => onNavigate('vacancies')} />
        ) : null}
        {cart.map((item) => (
          <View key={item.id} style={styles.card}>
            {item.bannerUrl ? <Image source={{ uri: item.bannerUrl }} style={styles.banner} /> : null}
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.quantity || 1} vaga(s) · {item.priceLabel}</Text>
            <View style={styles.quantityRow}>
              <TouchableOpacity style={styles.quantityButton} onPress={() => void updateQuantity(item, Number(item.quantity || 1) - 1)}>
                <Text style={styles.quantityText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.quantityValue}>{item.quantity || 1}</Text>
              <TouchableOpacity style={styles.quantityButton} onPress={() => void updateQuantity(item, Number(item.quantity || 1) + 1)}>
                <Text style={styles.quantityText}>+</Text>
              </TouchableOpacity>
              <Text style={styles.quantityHint}>quantidade de vagas</Text>
            </View>
            <View style={styles.methodRow}>
              {paymentMethods.map((method) => {
                const active = (methodByItem[item.id] || 'pix') === method.id
                return (
                  <TouchableOpacity
                    key={method.id}
                    style={[styles.methodButton, active && styles.methodButtonActive]}
                    onPress={() => setMethodByItem((current) => ({ ...current, [item.id]: method.id }))}
                  >
                    <Text style={[styles.methodText, active && styles.methodTextActive]}>{method.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.primary} onPress={() => checkout(item)} disabled={checkoutId === item.id}>
                <Text style={styles.primaryText}>
                  {checkoutId === item.id
                    ? 'Gerando...'
                    : `Pagar com ${paymentMethods.find((method) => method.id === (methodByItem[item.id] || 'pix'))?.label || 'PIX'}`}
                </Text>
              </TouchableOpacity>
              {checkoutByItem[item.id]?.checkoutUrl ? (
                <TouchableOpacity style={styles.secondary} onPress={() => Linking.openURL(checkoutByItem[item.id].checkoutUrl)}>
                  <Text style={styles.secondaryText}>Abrir checkout</Text>
                </TouchableOpacity>
              ) : null}
              {checkoutByItem[item.id]?.claimUrl ? (
                <TouchableOpacity style={styles.secondary} onPress={() => Linking.openURL(checkoutByItem[item.id].claimUrl)}>
                  <Text style={styles.secondaryText}>Abrir inscrição liberada</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.secondary} onPress={() => void removeItem(item)}>
                <Text style={styles.secondaryText}>Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Favoritos</Text>
        {!loading && wishlist.length === 0 ? (
          <Text style={styles.meta}>Nenhum campeonato salvo ainda.</Text>
        ) : null}
        {wishlist.map((item) => (
          <TouchableOpacity key={item.id} style={styles.favorite} onPress={() => onNavigate('vacancies')}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.freeSlots} vagas disponíveis · tocar para abrir vitrine</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  warning: {
    borderRadius: radius.md,
    backgroundColor: '#fff7ed',
    color: '#9a3412',
    fontWeight: '800',
    padding: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
  card: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  banner: {
    height: 120,
    borderRadius: radius.md,
  },
  favorite: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.xs,
  },
  name: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontWeight: '700',
  },
  actions: {
    gap: spacing.sm,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  quantityButton: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandDark,
  },
  quantityText: {
    color: colors.surface,
    fontSize: 22,
    fontWeight: '900',
  },
  quantityValue: {
    minWidth: 38,
    textAlign: 'center',
    color: colors.ink,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
  quantityHint: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  methodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  methodButton: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  methodButtonActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  methodText: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  methodTextActive: {
    color: colors.surface,
  },
  primary: {
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    padding: spacing.md,
  },
  primaryText: {
    color: colors.surface,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  secondary: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  secondaryText: {
    color: colors.ink,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
})
