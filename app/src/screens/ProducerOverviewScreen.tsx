import { useCallback, useEffect, useMemo, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { externalUrl } from "@/config/env";
import { mobileApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cents } from "@/lib/wallet";
import { colors, spacing } from "@/theme/tokens";
import { ScreenProps } from "@/types/dropzone";

type Tab = "overview" | "championships" | "sellers" | "finance";
export function ProducerOverviewScreen({
  onNavigate,
  onManageChampionship,
}: ScreenProps) {
  const auth = useAuth(),
    token = auth.session?.access_token;
  const [payload, setPayload] = useState<any>({}),
    [wallet, setWallet] = useState<any>({}),
    [notifications, setNotifications] = useState<any>({}),
    [tab, setTab] = useState<Tab>("overview"),
    [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState(""),
    [expandedSellerId, setExpandedSellerId] = useState<string | null>(null);
  const load = useCallback(
    async (refresh = false) => {
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");
      try {
        const [sellerResult, walletResult, noticeResult, champResult] =
          await Promise.all([
            mobileApi.producerSellers(token),
            mobileApi.wallet(token, "produtora"),
            mobileApi.notifications(token),
            mobileApi.championshipAdminList(token),
          ]);
        setPayload({
          ...sellerResult,
          managedChampionships: champResult.items || [],
        });
        setWallet(walletResult);
        setNotifications(noticeResult);
      } catch (err: any) {
        setError(err?.message || "Não foi possível carregar a produtora.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const sellers = payload.vendedores || [],
    championships = payload.managedChampionships || payload.campeonatos || [],
    invites = payload.convites_pendentes || [],
    movements = wallet.lancamentos || [],
    payments = wallet.pagamentos || [],
    withdrawals = wallet.saques || [],
    activeSellers = sellers.filter((x: any) => String(x.status) === "ativo");
  const totals = useMemo(
    () => ({
      credits: movements
        .filter((x: any) => x.direcao === "credito")
        .reduce(
          (sum: number, x: any) => sum + Number(x.valor_centavos || 0),
          0,
        ),
      sales: payments
        .filter((x: any) =>
          ["pago", "aprovado", "confirmed", "paid"].includes(String(x.status)),
        )
        .reduce(
          (sum: number, x: any) => sum + Number(x.valor_centavos || 0),
          0,
        ),
    }),
    [movements, payments],
  );
  async function invite() {
    setBusy("invite");
    try {
      const result = await mobileApi.createProducerSellerInvite(
        { limite_vagas: 0 },
        token,
      );
      setFeedback(result.mensagem || "Convite criado.");
      if (result.texto_whatsapp || result.link)
        await Share.share({ message: result.texto_whatsapp || result.link });
      await load(true);
    } catch (err: any) {
      setError(err?.message || "Não foi possível criar o convite.");
    } finally {
      setBusy("");
    }
  }
  async function toggleSeller(seller: any) {
    const next = String(seller.status) === "ativo" ? "inativo" : "ativo";
    setBusy(String(seller.manager_id));
    try {
      const result = await mobileApi.updateProducerSeller(
        String(seller.manager_id),
        { status: next },
        token,
      );
      setFeedback(result.mensagem || "Vendedor atualizado.");
      await load(true);
    } catch (err: any) {
      setError(err?.message || "Não foi possível atualizar o vendedor.");
    } finally {
      setBusy("");
    }
  }
  async function toggleSellerChampionship(seller: any, championship: any) {
    const sellerId = String(seller.manager_id || "");
    const championshipId = String(championship.id || "");
    if (!sellerId || !championshipId) return;
    const assigned = (seller.campeonatos || []).some(
      (link: any) =>
        String(link.campeonato_id) === championshipId &&
        !["cancelado", "inativo"].includes(String(link.status)),
    );
    const busyKey = `seller-champ:${sellerId}:${championshipId}`;
    setBusy(busyKey);
    setError("");
    setFeedback("");
    try {
      const result = assigned
        ? await mobileApi.detachProducerSellerFromChampionship(
            sellerId,
            championshipId,
            token,
          )
        : await mobileApi.attachProducerSellerToChampionship(
            sellerId,
            championshipId,
            token,
          );
      setFeedback(
        result.mensagem ||
          (assigned
            ? "Vendedor removido do campeonato."
            : "Vendedor liberado no campeonato."),
      );
      await load(true);
    } catch (err: any) {
      setError(
        err?.message ||
          "Não foi possível atualizar o campeonato deste vendedor.",
      );
    } finally {
      setBusy("");
    }
  }

  function removeSeller(seller: any) {
    Alert.alert(
      "Remover vendedor?",
      `O histórico de ${seller.nome_publico || "vendedor"} será preservado.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              setBusy(String(seller.manager_id));
              await mobileApi.removeProducerSeller(
                String(seller.manager_id),
                token,
              );
              setFeedback("Vendedor removido da produtora.");
              await load(true);
            } catch (err: any) {
              setError(err?.message || "Não foi possível remover.");
            } finally {
              setBusy("");
            }
          },
        },
      ],
    );
  }
  if (auth.activeProfileType !== "produtora")
    return (
      <View style={styles.center}>
        <Ionicons name="business-outline" size={31} color={colors.brand} />
        <Text style={styles.emptyText}>
          Selecione o perfil da produtora no menu superior.
        </Text>
      </View>
    );
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load(true)}
          tintColor={colors.brand}
        />
      }
    >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.eyebrow}>CENTRAL DA PRODUTORA</Text>
            <Text style={styles.title}>
              {auth.activeAccount?.name ||
                payload.produtora?.nome ||
                "Produtora"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.edit}
            onPress={() => onNavigate("profile_management")}
          >
            <Ionicons name="create-outline" size={19} color={colors.ink} />
          </TouchableOpacity>
        </View>
        <Text style={styles.description}>
          Operação, campeonatos, comercial e financeiro em um único painel.
        </Text>
      </View>
      <View style={styles.tabs}>
        {(
          [
            ["overview", "Resumo"],
            ["championships", "Campeonatos"],
            ["sellers", "Vendedores"],
            ["finance", "Financeiro"],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <TouchableOpacity
            key={id}
            style={[styles.tab, tab === id && styles.tabActive]}
            onPress={() => setTab(id)}
          >
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {feedback ? <Text style={styles.success}>{feedback}</Text> : null}
      {!loading && tab === "overview" ? (
        <View style={styles.section}>
          <View style={styles.metrics}>
            <Metric value={championships.length} label="Campeonatos" />
            <Metric value={activeSellers.length} label="Vendedores" />
            <Metric
              value={Number(notifications.nao_lidas || 0)}
              label="Pendências"
            />
            <Metric
              value={cents(wallet.carteira?.saldo_disponivel_centavos)}
              label="Disponível"
              small
            />
          </View>
          <View style={styles.quick}>
            <Quick
              icon="add-circle-outline"
              label="Criar campeonato"
              onPress={() => onManageChampionship?.(null)}
            />
            <Quick
              icon="person-add-outline"
              label="Convidar vendedor"
              onPress={() => void invite()}
            />
            <Quick
              icon="wallet-outline"
              label="Abrir carteira"
              onPress={() => onNavigate("wallet")}
            />
            <Quick
              icon="notifications-outline"
              label="Pendências"
              onPress={() => onNavigate("invites")}
            />
          </View>
          <Text style={styles.sectionTitle}>ATENÇÃO AGORA</Text>
          {Number(notifications.nao_lidas || 0) > 0 ? (
            <TouchableOpacity
              style={styles.alert}
              onPress={() => onNavigate("invites")}
            >
              <Ionicons name="alert-circle-outline" size={21} color={colors.warning} />
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>
                  {notifications.nao_lidas} notificações pendentes
                </Text>
                <Text style={styles.meta}>
                  Convites, aprovações e avisos operacionais.
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <Empty text="Nenhuma pendência urgente." />
          )}
          {invites.length ? (
            <View style={styles.alert}>
              <Ionicons
                name="person-add-outline"
                size={21}
                color={colors.brand}
              />
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>
                  {invites.length} convites de vendedor aguardando
                </Text>
                <Text style={styles.meta}>
                  Compartilhe novamente se necessário.
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
      {!loading && tab === "championships" ? (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.primary}
            onPress={() => onManageChampionship?.(null)}
          >
            <Ionicons name="add" size={19} color={colors.onBrand} />
            <Text style={styles.primaryText}>Novo campeonato</Text>
          </TouchableOpacity>
          {championships.map((item: any, index: number) => (
            <TouchableOpacity
              key={String(item.id || index)}
              style={styles.row}
              onPress={() => onManageChampionship?.(String(item.id))}
            >
              {item.logo_url ? (
                <Image
                  source={{ uri: externalUrl(item.logo_url) }}
                  style={styles.logo}
                />
              ) : (
                <View style={[styles.logo, styles.fallback]}>
                  <Ionicons
                    name="trophy-outline"
                    size={20}
                    color={colors.brand}
                  />
                </View>
              )}
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>{item.nome || "Campeonato"}</Text>
                <Text style={styles.meta}>
                  {[item.tipo, item.status, item.aprovacao_status]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </TouchableOpacity>
          ))}
          {!championships.length ? (
            <Empty text="Nenhum campeonato criado." />
          ) : null}
        </View>
      ) : null}
      {!loading && tab === "sellers" ? (
        <View style={styles.section}>
          <View style={styles.sellerHead}>
            <View>
              <Text style={styles.sectionTitle}>EQUIPE COMERCIAL</Text>
              <Text style={styles.meta}>
                {activeSellers.length} ativos · {invites.length} convites
                pendentes
              </Text>
            </View>
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => void invite()}
              disabled={busy === "invite"}
            >
              {busy === "invite" ? (
                <ActivityIndicator size="small" color={colors.onBrand} />
              ) : (
                <Ionicons name="person-add" size={18} color={colors.onBrand} />
              )}
            </TouchableOpacity>
          </View>
          {sellers.map((seller: any, index: number) => {
            const manager = seller.managers || {};
            return (
              <View key={String(seller.id || index)} style={styles.sellerCard}>
                <View style={styles.rowBorderless}>
                  {manager.avatar_url ? (
                    <Image
                      source={{ uri: externalUrl(manager.avatar_url) }}
                      style={styles.logo}
                    />
                  ) : (
                    <View style={[styles.logo, styles.fallback]}>
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color={colors.brand}
                      />
                    </View>
                  )}
                  <View style={styles.copy}>
                    <Text style={styles.rowTitle}>
                      {seller.nome_publico || manager.nome || "Vendedor"}
                    </Text>
                    <Text style={styles.meta}>
                      {seller.status} · {(seller.campeonatos || []).length}{" "}
                      campeonatos
                    </Text>
                  </View>
                </View>
                <View style={styles.sellerStats}>
                  <Text style={styles.meta}>
                    Limite: {seller.limite_vagas_atual ?? "livre"}
                  </Text>
                  <Text style={styles.meta}>
                    Usadas: {seller.vagas_usadas || 0}
                  </Text>
                  <Text style={styles.meta}>
                    Comissão:{" "}
                    {seller.comissao_bps_atual != null
                      ? `${Number(seller.comissao_bps_atual) / 100}%`
                      : "padrão"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.assignmentToggle}
                  onPress={() =>
                    setExpandedSellerId((current) =>
                      current === String(seller.manager_id)
                        ? null
                        : String(seller.manager_id),
                    )
                  }
                >
                  <Text style={styles.assignmentToggleText}>
                    {expandedSellerId === String(seller.manager_id)
                      ? "Ocultar campeonatos"
                      : "Gerenciar campeonatos"}
                  </Text>
                  <Ionicons
                    name={
                      expandedSellerId === String(seller.manager_id)
                        ? "chevron-up"
                        : "chevron-down"
                    }
                    size={16}
                    color={colors.ink}
                  />
                </TouchableOpacity>
                {expandedSellerId === String(seller.manager_id) ? (
                  <View style={styles.assignmentList}>
                    {championships.map(
                      (championship: any, championshipIndex: number) => {
                        const championshipId = String(
                          championship.id || championshipIndex,
                        );
                        const assigned = (seller.campeonatos || []).some(
                          (link: any) =>
                            String(link.campeonato_id) ===
                              String(championship.id) &&
                            !["cancelado", "inativo"].includes(
                              String(link.status),
                            ),
                        );
                        const busyKey = `seller-champ:${String(
                          seller.manager_id,
                        )}:${String(championship.id)}`;
                        return (
                          <View
                            key={championshipId}
                            style={styles.assignmentRow}
                          >
                            <View style={styles.copy}>
                              <Text
                                style={styles.assignmentName}
                                numberOfLines={1}
                              >
                                {championship.nome || "Campeonato"}
                              </Text>
                              <Text style={styles.meta}>
                                {assigned
                                  ? "Vendedor liberado"
                                  : "Sem acesso comercial"}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[
                                styles.assignmentButton,
                                assigned && styles.assignmentButtonDanger,
                              ]}
                              disabled={busy === busyKey}
                              onPress={() =>
                                void toggleSellerChampionship(
                                  seller,
                                  championship,
                                )
                              }
                            >
                              {busy === busyKey ? (
                                <ActivityIndicator
                                  size="small"
                                  color={assigned ? colors.danger : colors.onBrand}
                                />
                              ) : (
                                <Text
                                  style={[
                                    styles.assignmentButtonText,
                                    assigned &&
                                      styles.assignmentButtonTextDanger,
                                  ]}
                                >
                                  {assigned ? "Remover" : "Liberar"}
                                </Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        );
                      },
                    )}
                    {!championships.length ? (
                      <Empty text="Nenhum campeonato disponível para vincular." />
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.action}
                    disabled={busy === String(seller.manager_id)}
                    onPress={() => void toggleSeller(seller)}
                  >
                    <Text style={styles.actionText}>
                      {seller.status === "ativo" ? "Pausar" : "Reativar"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.remove}
                    onPress={() => removeSeller(seller)}
                  >
                    <Text style={styles.removeText}>Remover</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          {!sellers.length ? <Empty text="Nenhum vendedor vinculado." /> : null}
        </View>
      ) : null}
      {!loading && tab === "finance" ? (
        <View style={styles.section}>
          <View style={styles.balance}>
            <Text style={styles.balanceLabel}>SALDO DISPONÍVEL</Text>
            <Text style={styles.balanceValue}>
              {cents(wallet.carteira?.saldo_disponivel_centavos)}
            </Text>
            <Text style={styles.balanceBlocked}>
              Bloqueado: {cents(wallet.carteira?.saldo_bloqueado_centavos)}
            </Text>
          </View>
          <View style={styles.metrics}>
            <Metric value={cents(totals.credits)} label="Créditos" small />
            <Metric value={cents(totals.sales)} label="Pagamentos" small />
            <Metric value={withdrawals.length} label="Saques" />
          </View>
          <TouchableOpacity
            style={styles.primary}
            onPress={() => onNavigate("wallet")}
          >
            <Ionicons name="wallet-outline" size={19} color={colors.ink} />
            <Text style={styles.primaryText}>Carteira e comprovantes</Text>
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>ÚLTIMOS LANÇAMENTOS</Text>
          {movements.slice(0, 8).map((item: any, index: number) => (
            <View key={String(item.id || index)} style={styles.row}>
              <View>
                <Ionicons
                  name={item.direcao === "debito" ? "arrow-up" : "arrow-down"}
                  size={20}
                  color={item.direcao === "debito" ? colors.danger : colors.success}
                />
              </View>
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>
                  {item.descricao || item.tipo || "Lançamento"}
                </Text>
                <Text style={styles.meta}>{item.status || "registrado"}</Text>
              </View>
              <Text style={styles.money}>{cents(item.valor_centavos)}</Text>
            </View>
          ))}
          {!movements.length ? (
            <Empty text="Nenhum lançamento financeiro." />
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
function Metric({
  value,
  label,
  small,
}: {
  value: any;
  label: string;
  small?: boolean;
}) {
  return (
    <View style={styles.metric}>
      <Text
        style={[styles.metricValue, small && styles.metricSmall]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}
function Quick({
  icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickItem} onPress={onPress}>
      <Ionicons name={icon} size={23} color={colors.brand} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 30,
    backgroundColor: colors.background,
  },
  hero: {
    padding: spacing.lg,
    backgroundColor: colors.brandDark,
    borderBottomWidth: 4,
    borderBottomColor: colors.brand,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: colors.brand,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 21,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  description: { marginTop: 8, color: colors.muted, fontSize: 11 },
  edit: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
  },
  tabs: {
    margin: spacing.md,
    marginBottom: 8,
    flexDirection: "row",
    gap: 6,
  },
  tab: {
    flex: 1,
    minHeight: 39,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
  },
  tabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  tabTextActive: { color: colors.onBrand },
  loading: { minHeight: 65, alignItems: "center", justifyContent: "center" },
  error: {
    marginHorizontal: spacing.md,
    padding: 10,
    color: colors.danger,
    backgroundColor: "rgba(224,122,122,.13)",
    fontWeight: "800",
  },
  success: {
    marginHorizontal: spacing.md,
    padding: 10,
    color: colors.success,
    backgroundColor: "rgba(101,185,130,.13)",
    fontWeight: "800",
  },
  section: { marginHorizontal: spacing.md, gap: 8 },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 1,
    backgroundColor: colors.line,
    borderRadius: 10,
    overflow: "hidden",
  },
  metric: {
    width: "49%",
    flexGrow: 1,
    padding: 10,
    backgroundColor: colors.surface,
  },
  metricValue: { color: colors.ink, fontSize: 21, fontWeight: "900" },
  metricSmall: { fontSize: 14 },
  metricLabel: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 7.5,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  quick: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  quickItem: {
    width: "48.8%",
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  quickText: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  sectionTitle: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  alert: {
    minHeight: 65,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 10,
    backgroundColor: "rgba(212,165,87,.13)",
    borderLeftWidth: 3,
    borderLeftColor: colors.brand,
  },
  copy: { flex: 1 },
  rowTitle: {
    color: colors.ink,
    fontSize: 10.5,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  meta: { marginTop: 3, color: colors.muted, fontSize: 8.5, fontWeight: "700" },
  primary: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.brand,
  },
  primaryText: {
    color: colors.onBrand,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowBorderless: { flexDirection: "row", alignItems: "center", gap: 9 },
  logo: { width: 46, height: 46, borderRadius: 6, backgroundColor: colors.surfaceRaised },
  fallback: { alignItems: "center", justifyContent: "center" },
  sellerHead: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  smallButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  sellerCard: {
    gap: 8,
    padding: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sellerStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 8,
    backgroundColor: colors.surfaceRaised,
  },
  assignmentToggle: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  assignmentToggleText: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  assignmentList: {
    gap: 5,
    padding: 8,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  assignmentRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  assignmentName: {
    color: colors.ink,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  assignmentButton: {
    minWidth: 74,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
    backgroundColor: colors.brand,
  },
  assignmentButtonDanger: {
    backgroundColor: "rgba(224,122,122,.13)",
    borderWidth: 1,
    borderColor: colors.danger,
  },
  assignmentButtonText: {
    color: colors.onBrand,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  assignmentButtonTextDanger: { color: colors.danger },
  actions: { flexDirection: "row", gap: 7 },
  action: {
    flex: 1,
    alignItems: "center",
    padding: 9,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  actionText: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  remove: {
    flex: 1,
    alignItems: "center",
    padding: 9,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  removeText: {
    color: colors.danger,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  balance: {
    padding: 16,
    backgroundColor: colors.brandDark,
    borderBottomWidth: 3,
    borderBottomColor: colors.brand,
  },
  balanceLabel: { color: colors.muted, fontSize: 8, fontWeight: "900" },
  balanceValue: {
    marginTop: 5,
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
  },
  balanceBlocked: { marginTop: 5, color: colors.muted, fontSize: 9 },
  money: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  empty: {
    minHeight: 70,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    backgroundColor: colors.surface,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
});
