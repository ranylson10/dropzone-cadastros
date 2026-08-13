import { useCallback, useEffect, useMemo, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { externalUrl } from "@/config/env";
import { mobileApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cents, compactDate } from "@/lib/wallet";
import { colors, spacing } from "@/theme/tokens";
import { ScreenProps } from "@/types/dropzone";

type Tab = "overview" | "sales" | "championships" | "links" | "finance";
export function SellerSalesScreen({
  onNavigate,
  onManageTeam,
  onManageChampionship,
  onSelectPlayer,
}: ScreenProps) {
  const auth = useAuth(),
    managerId =
      auth.activeAccount?.profile_type === "manager"
        ? auth.activeAccount.id
        : "",
    token = auth.session?.access_token;
  const [sales, setSales] = useState<any[]>([]),
    [portfolio, setPortfolio] = useState<any>({}),
    [links, setLinks] = useState<any>({}),
    [wallet, setWallet] = useState<any>({}),
    [notifications, setNotifications] = useState<any>({}),
    [tab, setTab] = useState<Tab>("overview"),
    [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState(""),
    [saleCamp, setSaleCamp] = useState(""),
    [quantity, setQuantity] = useState("1"),
    [method, setMethod] = useState<"pix" | "cartao" | "paypal">("pix"),
    [buyer, setBuyer] = useState("");
  const load = useCallback(
    async (refresh = false) => {
      if (!managerId) return;
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");
      try {
        const [
          saleResult,
          portfolioResult,
          linkResult,
          walletResult,
          noticeResult,
        ] = await Promise.all([
          mobileApi.sellerSales(managerId, token),
          mobileApi.managerChampionships(managerId, token),
          mobileApi.managerLinks(managerId, token),
          mobileApi.wallet(token, "manager"),
          mobileApi.notifications(token),
        ]);
        setSales(saleResult.sales || []);
        setPortfolio(portfolioResult);
        setLinks(linkResult);
        setWallet(walletResult);
        setNotifications(noticeResult);
        if (!saleCamp)
          setSaleCamp(
            String(
              portfolioResult.campeonatos?.find(
                (x: any) => x.status === "ativo",
              )?.campeonato_id || "",
            ),
          );
      } catch (err: any) {
        setError(
          err?.message || "Não foi possível carregar o painel do manager.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [managerId, token, saleCamp],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const championships = (portfolio.campeonatos || []).filter(
      (item: any) =>
        item.status === "ativo" &&
        Number(item.vagas_disponiveis_venda || 0) > 0,
    ),
    teams = links.equipes || [],
    producers = links.produtoras || [],
    players = links.jogadores || [],
    paid = sales.filter((x) =>
      ["pago", "liberado", "consumido"].includes(String(x.status)),
    ),
    volume = paid.reduce((sum, x) => sum + Number(x.valor_centavos || 0), 0),
    commissions =
      wallet.lancamentos?.filter((x: any) =>
        String(x.tipo || x.descricao || "")
          .toLowerCase()
          .includes("comiss"),
      ) || [];
  const permissions = useMemo(
    () => ({
      manageTeams: teams.filter((x: any) => x.permissoes?.pode_editar).length,
      scale: teams.filter((x: any) => x.permissoes?.pode_escalar).length,
      manageChampionships: championships.filter(
        (x: any) =>
          x.permissoes?.organizar_grupos || x.permissoes?.pontuar_tabela,
      ).length,
    }),
    [teams, championships],
  );
  async function createSale() {
    if (!saleCamp) return;
    setBusy(true);
    setError("");
    try {
      const result = await mobileApi.createSellerSale(
        managerId,
        {
          campeonato_id: saleCamp,
          quantidade_vagas: Number(quantity || 1),
          method,
          comprador_nome: buyer,
        },
        token,
      );
      setFeedback(result.mensagem || "Cobrança criada.");
      await Share.share({
        message:
          result.mensagem || result.sale?.payment_url || result.sale?.claim_url,
      });
      setBuyer("");
      await load(true);
    } catch (err: any) {
      setError(err?.message || "Não foi possível gerar a venda.");
    } finally {
      setBusy(false);
    }
  }
  async function toggleAd(item: any) {
    setBusy(true);
    try {
      await mobileApi.updateManagerChampionship(
        managerId,
        { campeonato_id: item.campeonato_id, anunciar: !item.anunciando },
        token,
      );
      setFeedback(
        item.anunciando
          ? "Campeonato removido da vitrine."
          : "Campeonato adicionado à vitrine.",
      );
      await load(true);
    } catch (err: any) {
      setError(err?.message || "Não foi possível atualizar a vitrine.");
    } finally {
      setBusy(false);
    }
  }
  if (!managerId)
    return (
      <View style={styles.center}>
        <Ionicons name="briefcase-outline" size={31} color={colors.brand} />
        <Text style={styles.emptyText}>
          Selecione seu perfil de manager no menu superior.
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
            <Text style={styles.eyebrow}>MANAGER E VENDEDOR</Text>
            <Text style={styles.title}>
              {portfolio.manager?.nome_publico_vendas ||
                auth.activeAccount?.name ||
                "Manager"}
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
          Vendas, vínculos, permissões e comissões em uma única central.
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {(
          [
            ["overview", "Resumo"],
            ["sales", "Vendas"],
            ["championships", "Campeonatos"],
            ["links", "Vínculos"],
            ["finance", "Comissões"],
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
      </ScrollView>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : null}
      {error ? <Message text={error} error /> : null}
      {feedback ? <Message text={feedback} /> : null}
      {!loading && tab === "overview" ? (
        <View style={styles.section}>
          <View style={styles.metrics}>
            <Metric value={sales.length} label="Vendas" />
            <Metric value={paid.length} label="Pagas" />
            <Metric value={cents(volume)} label="Volume" small />
            <Metric
              value={Number(notifications.nao_lidas || 0)}
              label="Pendências"
            />
          </View>
          <View style={styles.quick}>
            <Quick
              icon="cash-outline"
              label="Nova venda"
              onPress={() => setTab("sales")}
            />
            <Quick
              icon="trophy-outline"
              label="Campeonatos"
              onPress={() => setTab("championships")}
            />
            <Quick
              icon="people-outline"
              label="Equipes"
              onPress={() => setTab("links")}
            />
            <Quick
              icon="wallet-outline"
              label="Carteira"
              onPress={() => onNavigate("wallet")}
            />
          </View>
          <Text style={styles.sectionTitle}>SUAS PERMISSÕES</Text>
          <View style={styles.permissionGrid}>
            <Permission
              value={permissions.manageTeams}
              label="Equipes editáveis"
            />
            <Permission value={permissions.scale} label="Escalações" />
            <Permission
              value={permissions.manageChampionships}
              label="Campeonatos operacionais"
            />
          </View>
          {Number(notifications.nao_lidas || 0) > 0 ? (
            <TouchableOpacity
              style={styles.alert}
              onPress={() => onNavigate("invites")}
            >
              <Ionicons
                name="notifications-outline"
                size={21}
                color={colors.brand}
              />
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>
                  {notifications.nao_lidas} pendências
                </Text>
                <Text style={styles.meta}>Convites, permissões e avisos.</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {!loading && tab === "sales" ? (
        <View style={styles.section}>
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>GERAR VENDA ASSISTIDA</Text>
            <Text style={styles.label}>CAMPEONATO</Text>
            <View style={styles.options}>
              {championships
                .filter((x: any) => x.status === "ativo")
                .map((item: any) => (
                  <TouchableOpacity
                    key={String(item.campeonato_id)}
                    style={[
                      styles.option,
                      saleCamp === String(item.campeonato_id) &&
                        styles.optionActive,
                    ]}
                    onPress={() => setSaleCamp(String(item.campeonato_id))}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        saleCamp === String(item.campeonato_id) &&
                          styles.optionTextActive,
                      ]}
                    >
                      {item.campeonatos?.nome || "Campeonato"}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
            <View style={styles.columns}>
              <View style={styles.column}>
                <Text style={styles.label}>QUANTIDADE</Text>
                <TextInput
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </View>
              <View style={styles.column}>
                <Text style={styles.label}>COMPRADOR</Text>
                <TextInput
                  value={buyer}
                  onChangeText={setBuyer}
                  placeholder="Nome opcional"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              </View>
            </View>
            <Text style={styles.label}>PAGAMENTO</Text>
            <View style={styles.options}>
              {(["pix", "cartao", "paypal"] as const).map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.option,
                    method === item && styles.optionActive,
                  ]}
                  onPress={() => setMethod(item)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      method === item && styles.optionTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.primary}
              disabled={!saleCamp || busy}
              onPress={() => void createSale()}
            >
              {busy ? (
                <ActivityIndicator color={colors.onBrand} />
              ) : (
                <>
                  <Ionicons
                    name="link-outline"
                    size={18}
                    color={colors.onBrand}
                  />
                  <Text style={styles.primaryText}>
                    Gerar e compartilhar cobrança
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionTitle}>HISTÓRICO DE VENDAS</Text>
          {sales.map((sale: any, index: number) => (
            <TouchableOpacity
              key={String(sale.id || index)}
              style={styles.row}
              onPress={() => {
                const target = sale.vagas_restantes
                  ? sale.claim_url
                  : sale.payment_url || sale.claim_url;
                if (target) void Linking.openURL(externalUrl(target));
              }}
            >
              <View style={[styles.logo, styles.fallback]}>
                <Ionicons
                  name="receipt-outline"
                  size={20}
                  color={colors.brand}
                />
              </View>
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>
                  {sale.campeonato?.nome || "Venda de vaga"}
                </Text>
                <Text style={styles.meta}>
                  {sale.status} · {sale.quantidade_vagas || 1} vaga(s) ·{" "}
                  {compactDate(sale.created_at)}
                </Text>
              </View>
              <Text style={styles.money}>{cents(sale.valor_centavos)}</Text>
            </TouchableOpacity>
          ))}
          {!sales.length ? <Empty text="Nenhuma venda registrada." /> : null}
        </View>
      ) : null}
      {!loading && tab === "championships" ? (
        <View style={styles.section}>
          {championships.map((item: any, index: number) => {
            const camp = item.campeonatos || {},
              perms = item.permissoes || {};
            return (
              <View key={String(item.id || index)} style={styles.card}>
                <View style={styles.rowBorderless}>
                  {camp.logo_url ? (
                    <Image
                      source={{ uri: externalUrl(camp.logo_url) }}
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
                    <Text style={styles.rowTitle}>
                      {camp.nome || "Campeonato"}
                    </Text>
                    <Text style={styles.meta}>
                      {item.status} · {item.vagas_usadas || 0}/
                      {item.limite_vagas || "∞"} vagas · comissão{" "}
                      {item.comissao_bps != null
                        ? `${Number(item.comissao_bps) / 100}%`
                        : "padrão"}
                    </Text>
                  </View>
                </View>
                <View style={styles.chips}>
                  {Object.entries(perms)
                    .filter(([, v]) => v === true)
                    .slice(0, 5)
                    .map(([key]) => (
                      <Text key={key} style={styles.chip}>
                        {key.replaceAll("_", " ")}
                      </Text>
                    ))}
                </View>
                <View style={styles.actions}>
                  {perms.organizar_grupos ||
                  perms.pontuar_tabela ||
                  perms.ver_estrutura ? (
                    <TouchableOpacity
                      style={styles.actionPrimary}
                      onPress={() =>
                        onManageChampionship?.(String(item.campeonato_id))
                      }
                    >
                      <Text style={styles.actionPrimaryText}>Administrar</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={styles.action}
                    onPress={() => void toggleAd(item)}
                  >
                    <Text style={styles.actionText}>
                      {item.anunciando ? "Ocultar da vitrine" : "Anunciar"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          {!championships.length ? (
            <Empty text="Nenhum campeonato liberado para este manager." />
          ) : null}
        </View>
      ) : null}
      {!loading && tab === "links" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EQUIPES GERENCIADAS</Text>
          {teams.map((item: any, index: number) => (
            <Target
              key={item.vinculo_id || index}
              item={item}
              icon="shield-outline"
              onPress={() =>
                item.alvo?.id && onManageTeam?.(String(item.alvo.id))
              }
            />
          ))}
          {!teams.length ? <Empty text="Nenhuma equipe vinculada." /> : null}
          <Text style={styles.sectionTitle}>PRODUTORAS</Text>
          {producers.map((item: any, index: number) => (
            <Target
              key={item.vinculo_id || index}
              item={item}
              icon="business-outline"
            />
          ))}
          {!producers.length ? (
            <Empty text="Nenhuma produtora vinculada." />
          ) : null}
          <Text style={styles.sectionTitle}>JOGADORES ASSESSORADOS</Text>
          {players.map((item: any, index: number) => (
            <Target
              key={item.vinculo_id || index}
              item={item}
              icon="person-outline"
              onPress={() =>
                item.alvo?.id && onSelectPlayer?.(String(item.alvo.id))
              }
            />
          ))}
          {!players.length ? <Empty text="Nenhum jogador vinculado." /> : null}
        </View>
      ) : null}
      {!loading && tab === "finance" ? (
        <View style={styles.section}>
          <View style={styles.balance}>
            <Text style={styles.balanceLabel}>COMISSÕES DISPONÍVEIS</Text>
            <Text style={styles.balanceValue}>
              {cents(wallet.carteira?.saldo_disponivel_centavos)}
            </Text>
            <Text style={styles.balanceMeta}>
              Bloqueado: {cents(wallet.carteira?.saldo_bloqueado_centavos)}
            </Text>
          </View>
          <View style={styles.metrics}>
            <Metric value={commissions.length} label="Lançamentos" />
            <Metric
              value={cents(
                commissions.reduce(
                  (sum: number, x: any) => sum + Number(x.valor_centavos || 0),
                  0,
                ),
              )}
              label="Comissões"
              small
            />
            <Metric value={(wallet.saques || []).length} label="Saques" />
          </View>
          <TouchableOpacity
            style={styles.primary}
            onPress={() => onNavigate("wallet")}
          >
            <Ionicons name="wallet-outline" size={18} color={colors.ink} />
            <Text style={styles.primaryText}>Carteira, PIX e saques</Text>
          </TouchableOpacity>
          {commissions.slice(0, 12).map((item: any, index: number) => (
            <View key={String(item.id || index)} style={styles.row}>
              <Ionicons name="cash-outline" size={21} color={colors.success} />
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>
                  {item.descricao || "Comissão"}
                </Text>
                <Text style={styles.meta}>
                  {item.status || "registrada"} · {compactDate(item.created_at)}
                </Text>
              </View>
              <Text style={styles.money}>{cents(item.valor_centavos)}</Text>
            </View>
          ))}
          {!commissions.length ? (
            <Empty text="Nenhuma comissão lançada ainda." />
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
function Target({
  item,
  icon,
  onPress,
}: {
  item: any;
  icon: any;
  onPress?: () => void;
}) {
  const target = item.alvo || {};
  return (
    <TouchableOpacity disabled={!onPress} style={styles.row} onPress={onPress}>
      {target.logo_url || target.avatar_url ? (
        <Image
          source={{ uri: externalUrl(target.logo_url || target.avatar_url) }}
          style={styles.logo}
        />
      ) : (
        <View style={[styles.logo, styles.fallback]}>
          <Ionicons name={icon} size={20} color={colors.brand} />
        </View>
      )}
      <View style={styles.copy}>
        <Text style={styles.rowTitle}>{target.nome || "Perfil"}</Text>
        <Text style={styles.meta}>
          {Object.entries(item.permissoes || {})
            .filter(([, v]) => v)
            .map(([k]) => k.replace("pode_", ""))
            .join(" · ") || "Visualização"}
        </Text>
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      ) : null}
    </TouchableOpacity>
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
function Permission({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.permission}>
      <Text style={styles.permissionValue}>{value}</Text>
      <Text style={styles.permissionLabel}>{label}</Text>
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
function Message({ text, error }: { text: string; error?: boolean }) {
  return (
    <Text style={[styles.message, error && styles.messageError]}>{text}</Text>
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
    padding: 12,
    backgroundColor: colors.brandDark,
    borderBottomWidth: 2,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
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
    marginTop: 3,
    color: colors.ink,
    fontSize: 17,
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
  tabs: { padding: spacing.md, paddingBottom: 8, gap: 5 },
  tab: {
    minWidth: 86,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
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
  message: {
    marginHorizontal: spacing.md,
    marginBottom: 8,
    padding: 10,
    color: colors.success,
    backgroundColor: "rgba(101,185,130,.13)",
    fontWeight: "800",
  },
  messageError: { color: colors.danger, backgroundColor: "rgba(224,122,122,.13)" },
  section: { marginHorizontal: spacing.md, gap: 8 },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 1,
    backgroundColor: colors.line,
  },
  metric: {
    width: "49%",
    flexGrow: 1,
    padding: 10,
    backgroundColor: colors.surface,
  },
  metricValue: { color: colors.ink, fontSize: 16, fontWeight: "900" },
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
    minHeight: 58,
    borderRadius: 9,
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
  permissionGrid: {
    flexDirection: "row",
    gap: 1,
    backgroundColor: colors.line,
  },
  permission: { flex: 1, padding: 9, backgroundColor: colors.surface },
  permissionValue: { color: colors.brand, fontSize: 18, fontWeight: "900" },
  permissionLabel: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 7,
    fontWeight: "800",
  },
  alert: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 9,
    backgroundColor: "rgba(212,165,87,.13)",
  },
  copy: { flex: 1 },
  rowTitle: {
    color: colors.ink,
    fontSize: 10.5,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  meta: { marginTop: 3, color: colors.muted, fontSize: 8.5, fontWeight: "700" },
  form: {
    gap: 8,
    padding: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  label: { color: colors.ink, fontSize: 8, fontWeight: "900" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  option: {
    paddingHorizontal: 9,
    paddingVertical: 8,
    backgroundColor: colors.surfaceRaised,
  },
  optionActive: { backgroundColor: colors.brand },
  optionText: { color: colors.ink, fontSize: 8, fontWeight: "900" },
  optionTextActive: { color: colors.onBrand },
  columns: { flexDirection: "row", gap: 7 },
  column: { flex: 1 },
  input: {
    minHeight: 40,
    paddingHorizontal: 9,
    borderRadius: 7,
    color: colors.ink,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  primary: {
    minHeight: 42,
    borderRadius: 8,
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
    minHeight: 56,
    borderRadius: 8,
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
  money: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  card: {
    gap: 8,
    padding: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  chip: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    color: colors.brand,
    fontSize: 7,
    fontWeight: "900",
    backgroundColor: colors.brandDark,
    textTransform: "uppercase",
  },
  actions: { flexDirection: "row", gap: 6 },
  actionPrimary: {
    flex: 1,
    alignItems: "center",
    padding: 9,
    backgroundColor: colors.brand,
  },
  actionPrimaryText: {
    color: colors.onBrand,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
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
  balance: {
    padding: 12,
    backgroundColor: colors.brandDark,
    borderBottomWidth: 2,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomColor: colors.brand,
  },
  balanceLabel: { color: colors.muted, fontSize: 8, fontWeight: "900" },
  balanceValue: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  balanceMeta: { marginTop: 5, color: colors.muted, fontSize: 9 },
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
