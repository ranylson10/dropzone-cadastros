import { useCallback, useEffect, useMemo, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { mobileApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { externalUrl } from "@/config/env";
import { mobileCommerceFromApi, MobileCommerceItem } from "@/lib/commerce";
import { VacancyPaymentResult } from "@/lib/payments";
import { savePendingVacancyPurchase } from "@/lib/purchase-flow";
import { cents } from "@/lib/wallet";
import { ActionCard, ScreenShell } from "@/screens/components";
import { colors, spacing } from "@/theme/tokens";
import { ChampionshipCard, ScreenProps } from "@/types/dropzone";

type CartPaymentMethod = "pix" | "cartao" | "paypal";

const paymentMethods: Array<{
  id: CartPaymentMethod;
  label: string;
  icon: any;
}> = [
  { id: "pix", label: "PIX", icon: "qr-code-outline" },
  { id: "cartao", label: "Cartão", icon: "card-outline" },
  { id: "paypal", label: "PayPal", icon: "globe-outline" },
];

function priceCents(item: MobileCommerceItem) {
  const raw = String(item.priceLabel || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

function asChampionship(item: MobileCommerceItem): ChampionshipCard {
  return {
    id: item.id,
    name: item.name,
    mode: item.mode,
    logoUrl: item.logoUrl,
    bannerUrl: item.bannerUrl,
    priceLabel: item.priceLabel,
    freeSlots: item.freeSlots,
  };
}

export function CommerceScreen({ onBack, onNavigate }: ScreenProps) {
  const auth = useAuth();
  const accessToken = auth.session?.access_token;
  const [cart, setCart] = useState<MobileCommerceItem[]>([]);
  const [wishlist, setWishlist] = useState<MobileCommerceItem[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [methodByItem, setMethodByItem] = useState<
    Record<string, CartPaymentMethod>
  >({});
  const [paymentByItem, setPaymentByItem] = useState<
    Record<string, VacancyPaymentResult>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const loadCommerce = useCallback(async () => {
    if (!accessToken) {
      setCart([]);
      setWishlist([]);
      setWalletBalance(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [cartPayload, wishlistPayload, walletPayload] = await Promise.all([
        mobileApi.commerceCart(accessToken),
        mobileApi.commerceWishlist(accessToken),
        mobileApi.wallet(accessToken, auth.activeProfileType).catch(() => null),
      ]);
      setCart(
        (cartPayload.items || []).map((item: any) =>
          mobileCommerceFromApi(item),
        ),
      );
      setWishlist(
        (wishlistPayload.items || []).map((item: any) =>
          mobileCommerceFromApi(item),
        ),
      );
      setWalletBalance(
        Number(
          (walletPayload as any)?.carteira?.saldo_disponivel_centavos || 0,
        ),
      );
    } catch (err: any) {
      setError(err?.message || "Não foi possível sincronizar suas compras.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, auth.activeProfileType]);

  useEffect(() => {
    void loadCommerce();
  }, [loadCommerce]);

  const totalCents = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum + priceCents(item) * Math.max(1, Number(item.quantity || 1)),
        0,
      ),
    [cart],
  );
  const cartQuantity = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Math.max(1, Number(item.quantity || 1)),
        0,
      ),
    [cart],
  );

  async function updateQuantity(item: MobileCommerceItem, quantity: number) {
    if (!accessToken || !item.itemId) return;
    const next = Math.max(1, Math.min(Number(item.freeSlots || 99), quantity));
    setError(null);
    try {
      const payload = await mobileApi.updateCommerceCartItem(
        item.itemId,
        next,
        accessToken,
      );
      setCart(
        (payload.items || []).map((row: any) => mobileCommerceFromApi(row)),
      );
    } catch (err: any) {
      setError(err?.message || "Não foi possível atualizar a quantidade.");
    }
  }

  async function removeItem(item: MobileCommerceItem) {
    if (!accessToken || !item.itemId) return;
    setError(null);
    try {
      const payload = await mobileApi.removeCommerceCartItem(
        item.itemId,
        accessToken,
      );
      setCart(
        (payload.items || []).map((row: any) => mobileCommerceFromApi(row)),
      );
      setFeedback("Item removido do carrinho.");
    } catch (err: any) {
      setError(err?.message || "Não foi possível remover o item.");
    }
  }

  async function checkout(item: MobileCommerceItem) {
    if (!accessToken || !item.itemId) return;
    setCheckoutId(item.id);
    setError(null);
    setFeedback("");
    try {
      const method = methodByItem[item.id] || "pix";
      const payload = await mobileApi.checkoutCommerceCartItem(
        { item_id: item.itemId, method },
        accessToken,
      );
      const payment: VacancyPaymentResult = {
        reused: false,
        compra: payload.compra,
        payment: payload.payment,
        claim_url: payload.claim_url,
        asaas_configured: true,
      };
      setPaymentByItem((current) => ({ ...current, [item.id]: payment }));
      await savePendingVacancyPurchase(asChampionship(item), payment);
      const url =
        payload.payment?.paypal_approval_url || payload.payment?.invoice_url;
      if (url) await Linking.openURL(externalUrl(url));
      setFeedback(
        "Pagamento criado. Depois da confirmação, conclua a inscrição dentro do app.",
      );
    } catch (err: any) {
      setError(err?.message || "Não foi possível gerar o pagamento.");
    } finally {
      setCheckoutId(null);
    }
  }

  async function continueNative(item: MobileCommerceItem) {
    const payment = paymentByItem[item.id];
    if (!payment) return;
    await savePendingVacancyPurchase(asChampionship(item), payment);
    onNavigate("purchase_claim");
  }

  return (
    <ScreenShell
      eyebrow="Dropzone Pay"
      title="Compras"
      description="Vagas, checkout e inscrições conectados à sua conta."
      onBack={onBack}
    >
      <View style={styles.summary}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryKicker}>
              DROPZONE PAY · RESUMO DO PEDIDO
            </Text>
            <Text style={styles.summaryValue}>{cents(totalCents)}</Text>
          </View>
          <View style={styles.bag}>
            <Ionicons
              name="bag-check-outline"
              size={23}
              color={colors.surface}
            />
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryMetaRow}>
          <SummaryMeta label="VAGAS" value={String(cartQuantity)} />
          <SummaryMeta label="ITENS" value={String(cart.length)} />
          <SummaryMeta label="SALDO" value={cents(walletBalance)} />
        </View>
      </View>

      <View style={styles.walletStrip}>
        <Ionicons name="wallet-outline" size={19} color={colors.ink} />
        <View style={styles.walletStripCopy}>
          <Text style={styles.walletStripTitle}>CARTEIRA INTEGRADA</Text>
          <Text style={styles.walletStripText}>
            Acompanhe saldo, PIX, saques e comprovantes no mesmo ambiente.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.walletButton}
          onPress={() => onNavigate("wallet")}
        >
          <Text style={styles.walletButtonText}>Abrir</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.muted}>Sincronizando carrinho...</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}
      {feedback ? <Text style={styles.success}>{feedback}</Text> : null}

      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionKicker}>CHECKOUT</Text>
          <Text style={styles.sectionTitle}>Carrinho</Text>
        </View>
        <Text style={styles.sectionCount}>{cart.length}</Text>
      </View>

      {!loading && cart.length === 0 ? (
        <ActionCard
          title="Carrinho vazio"
          description="Adicione vagas na vitrine de campeonatos."
          cta="Ver vagas"
          onPress={() => onNavigate("vacancies")}
        />
      ) : null}

      {cart.map((item) => {
        const method = methodByItem[item.id] || "pix";
        const unit = priceCents(item);
        const itemTotal = unit * Math.max(1, Number(item.quantity || 1));
        const payment = paymentByItem[item.id];
        return (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHead}>
              {item.logoUrl ? (
                <Image source={{ uri: item.logoUrl }} style={styles.logo} />
              ) : (
                <View style={styles.logoFallback}>
                  <Ionicons
                    name="trophy-outline"
                    size={20}
                    color={colors.surface}
                  />
                </View>
              )}
              <View style={styles.cardCopy}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardMeta}>
                  {item.freeSlots} vaga(s) disponíveis · {item.priceLabel} cada
                </Text>
              </View>
              <TouchableOpacity
                style={styles.remove}
                onPress={() => void removeItem(item)}
              >
                <Ionicons name="trash-outline" size={17} color="#9a3412" />
              </TouchableOpacity>
            </View>

            <View style={styles.quantityBar}>
              <Text style={styles.quantityLabel}>QUANTIDADE</Text>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() =>
                    void updateQuantity(item, Number(item.quantity || 1) - 1)
                  }
                >
                  <Text style={styles.quantityText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.quantityValue}>{item.quantity || 1}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() =>
                    void updateQuantity(item, Number(item.quantity || 1) + 1)
                  }
                >
                  <Text style={styles.quantityText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.itemTotal}>{cents(itemTotal)}</Text>
            </View>

            <Text style={styles.fieldLabel}>FORMA DE PAGAMENTO</Text>
            <View style={styles.methods}>
              {paymentMethods.map((option) => {
                const active = method === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.method, active && styles.methodActive]}
                    onPress={() =>
                      setMethodByItem((current) => ({
                        ...current,
                        [item.id]: option.id,
                      }))
                    }
                  >
                    <Ionicons
                      name={option.icon}
                      size={17}
                      color={active ? colors.surface : colors.ink}
                    />
                    <Text
                      style={[
                        styles.methodText,
                        active && styles.methodTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {payment ? (
              <View style={styles.paymentStatus}>
                <View style={styles.paymentStatusIcon}>
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={colors.brand}
                  />
                </View>
                <View style={styles.paymentStatusCopy}>
                  <Text style={styles.paymentStatusTitle}>
                    PAGAMENTO CRIADO
                  </Text>
                  <Text style={styles.paymentStatusText}>
                    Status {payment.compra.status} · token{" "}
                    {payment.compra.token.slice(0, 8).toUpperCase()}
                  </Text>
                </View>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.primary}
              disabled={checkoutId === item.id}
              onPress={() => void checkout(item)}
            >
              {checkoutId === item.id ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryText}>
                  {payment
                    ? "Gerar nova cobrança"
                    : `Pagar ${cents(itemTotal)}`}
                </Text>
              )}
            </TouchableOpacity>

            {payment ? (
              <TouchableOpacity
                style={styles.nativeButton}
                onPress={() => void continueNative(item)}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={17}
                  color={colors.ink}
                />
                <Text style={styles.nativeButtonText}>
                  Concluir inscrição no app
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}

      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionKicker}>SALVOS</Text>
          <Text style={styles.sectionTitle}>Favoritos</Text>
        </View>
        <Text style={styles.sectionCount}>{wishlist.length}</Text>
      </View>
      {!loading && !wishlist.length ? (
        <Text style={styles.empty}>Nenhum campeonato salvo.</Text>
      ) : null}
      {wishlist.slice(0, 8).map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.favorite}
          onPress={() => onNavigate("vacancies")}
        >
          <View>
            <Text style={styles.favoriteName}>{item.name}</Text>
            <Text style={styles.cardMeta}>
              {item.freeSlots} vagas disponíveis
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </TouchableOpacity>
      ))}

      <View style={styles.security}>
        <Ionicons name="shield-checkmark-outline" size={20} color="#166534" />
        <View style={{ flex: 1 }}>
          <Text style={styles.securityTitle}>CHECKOUT PROTEGIDO</Text>
          <Text style={styles.securityText}>
            O provedor processa o pagamento e a confirmação da vaga continua
            nativamente no Dropzone.
          </Text>
        </View>
      </View>
    </ScreenShell>
  );
}

function SummaryMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryMeta}>
      <Text style={styles.summaryMetaLabel}>{label}</Text>
      <Text style={styles.summaryMetaValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    backgroundColor: colors.brandDark,
    padding: 12,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    gap: spacing.md,
    borderBottomWidth: 3,
    borderBottomColor: colors.brand,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryKicker: {
    color: colors.gold,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  summaryValue: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900",
  },
  bag: {
    width: 38,
    height: 38,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  summaryDivider: { height: 1, backgroundColor: colors.line },
  summaryMetaRow: { flexDirection: "row", gap: 8 },
  summaryMeta: { flex: 1, minWidth: 0 },
  summaryMetaLabel: { color: colors.muted, fontSize: 7, fontWeight: "900" },
  summaryMetaValue: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
  },
  walletStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 9,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
  },
  walletStripCopy: { flex: 1 },
  walletStripTitle: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  walletStripText: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 8,
    fontWeight: "700",
  },
  walletButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.brandDark,
  },
  walletButtonText: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  loading: {
    alignItems: "center",
    gap: 7,
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  muted: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  warning: {
    backgroundColor: "rgba(212, 165, 87, .12)",
    color: colors.warning,
    fontWeight: "800",
    padding: spacing.md,
  },
  success: {
    backgroundColor: "rgba(101, 185, 130, .12)",
    color: colors.success,
    fontWeight: "800",
    padding: spacing.md,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionKicker: {
    color: colors.brand,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  sectionTitle: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  sectionCount: {
    minWidth: 30,
    textAlign: "center",
    paddingVertical: 5,
    backgroundColor: colors.brandDark,
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
  },
  card: {
    gap: 8,
    padding: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 9 },
  logo: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.surfaceRaised },
  logoFallback: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandDark,
  },
  cardCopy: { flex: 1, minWidth: 0 },
  cardName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  cardMeta: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 8,
    fontWeight: "700",
  },
  remove: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(224, 122, 122, .12)",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  quantityBar: {
    minHeight: 42,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 9,
    backgroundColor: colors.surfaceRaised,
  },
  quantityLabel: { color: colors.muted, fontSize: 7, fontWeight: "900" },
  quantityControls: { flexDirection: "row", alignItems: "center", gap: 1 },
  quantityButton: {
    width: 31,
    height: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  quantityText: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  quantityValue: {
    minWidth: 31,
    textAlign: "center",
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
  },
  itemTotal: {
    marginLeft: "auto",
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  methods: { flexDirection: "row", gap: 5 },
  method: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  methodActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  methodText: { color: colors.ink, fontSize: 8, fontWeight: "900" },
  methodTextActive: { color: colors.onBrand },
  paymentStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 9,
    backgroundColor: "rgba(212, 165, 87, .12)",
    borderWidth: 1,
    borderColor: "#ead1a2",
  },
  paymentStatusIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  paymentStatusCopy: { flex: 1 },
  paymentStatusTitle: {
    color: colors.brand,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  paymentStatusText: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 8,
    fontWeight: "700",
  },
  primary: {
    minHeight: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  primaryText: {
    color: colors.onBrand,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  nativeButton: {
    minHeight: 40,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  nativeButtonText: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  favorite: {
    minHeight: 48,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  favoriteName: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  empty: {
    padding: 14,
    textAlign: "center",
    backgroundColor: colors.surfaceRaised,
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
  },
  security: {
    flexDirection: "row",
    gap: 9,
    padding: 12,
    backgroundColor: "rgba(101, 185, 130, .12)",
    borderWidth: 1,
    borderColor: "#b7d8c0",
  },
  securityTitle: {
    color: colors.success,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  securityText: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 8,
    lineHeight: 13,
    fontWeight: "700",
  },
});
