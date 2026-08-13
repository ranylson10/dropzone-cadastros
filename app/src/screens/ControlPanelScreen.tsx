import { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { externalUrl } from "@/config/env";
import { useAuth } from "@/lib/auth";
import { colors, spacing } from "@/theme/tokens";
import { MobileRoute, ProfileType, ScreenProps } from "@/types/dropzone";

type IconName = ComponentProps<typeof Ionicons>["name"];
type Action = {
  title: string;
  description: string;
  icon: IconName;
  route: MobileRoute;
  primary?: boolean;
};
const labels: Record<ProfileType, string> = {
  jogador: "Jogador",
  equipe: "Equipe",
  produtora: "Produtora",
  manager: "Manager / vendedor",
  broadcast: "Transmissão",
};
const panels: Record<ProfileType, Action[]> = {
  equipe: [
    {
      title: "Gerenciar equipe",
      description: "Elenco, lines, staff e dados públicos.",
      icon: "shield-checkmark-outline",
      route: "team_roster",
      primary: true,
    },
    {
      title: "Escalações",
      description: "Monte os jogadores de cada campeonato.",
      icon: "people-circle-outline",
      route: "lineup",
    },
    {
      title: "Meus campeonatos",
      description: "Inscrições, vagas e ações da equipe.",
      icon: "trophy-outline",
      route: "my_championships",
    },
    {
      title: "Agenda",
      description: "Jogos, prazos e próximos compromissos.",
      icon: "calendar-outline",
      route: "agenda",
    },
    {
      title: "Convites",
      description: "Jogadores, staff e solicitações.",
      icon: "mail-unread-outline",
      route: "invites",
    },
    {
      title: "Carteira",
      description: "Pagamentos, compras e comprovantes.",
      icon: "wallet-outline",
      route: "wallet",
    },
  ],
  jogador: [
    {
      title: "Central do jogador",
      description: "Equipe, line, agenda, escalações e desempenho.",
      icon: "person-circle-outline",
      route: "player_dashboard",
      primary: true,
    },
    {
      title: "Minha agenda",
      description: "Jogos, chamadas e prazos de escalação.",
      icon: "calendar-outline",
      route: "agenda",
    },
    {
      title: "Meus campeonatos",
      description: "Participações e inscrições ativas.",
      icon: "trophy-outline",
      route: "my_championships",
    },
    {
      title: "Convites",
      description: "Propostas de equipe e confirmações.",
      icon: "mail-unread-outline",
      route: "invites",
    },
    {
      title: "Ranking",
      description: "Desempenho e classificação individual.",
      icon: "podium-outline",
      route: "rank",
    },
    {
      title: "Buscar equipes",
      description: "Organizações e lines públicas.",
      icon: "people-outline",
      route: "team_directory",
    },
  ],
  produtora: [
    {
      title: "Central da produtora",
      description: "Resumo financeiro e operacional.",
      icon: "business-outline",
      route: "producer_overview",
      primary: true,
    },
    {
      title: "Administrar campeonatos",
      description: "Criação, estrutura, jogos e inscrições.",
      icon: "trophy-outline",
      route: "championship_management",
    },
    {
      title: "Agenda operacional",
      description: "Jogos e tarefas dos campeonatos.",
      icon: "calendar-outline",
      route: "agenda",
    },
    {
      title: "Carteira",
      description: "Receitas, saldos e saques.",
      icon: "wallet-outline",
      route: "wallet",
    },
    {
      title: "Equipe comercial",
      description: "Managers, vendedores e convites.",
      icon: "person-add-outline",
      route: "invites",
    },
    {
      title: "Vitrine pública",
      description: "Campeonatos publicados.",
      icon: "storefront-outline",
      route: "vacancies",
    },
  ],
  manager: [
    {
      title: "Minhas vendas",
      description: "Conversões, comissões e resultados.",
      icon: "cash-outline",
      route: "seller_sales",
      primary: true,
    },
    {
      title: "Equipes gerenciadas",
      description: "Equipes em que você faz parte da staff.",
      icon: "shield-outline",
      route: "team_roster",
    },
    {
      title: "Campeonatos",
      description: "Eventos autorizados, estrutura e jogos.",
      icon: "trophy-outline",
      route: "championship_management",
    },
    {
      title: "Agenda",
      description: "Prazos sob sua responsabilidade.",
      icon: "calendar-outline",
      route: "agenda",
    },
    {
      title: "Convites",
      description: "Vínculos e solicitações pendentes.",
      icon: "mail-unread-outline",
      route: "invites",
    },
    {
      title: "Carteira",
      description: "Comissões, saldos e comprovantes.",
      icon: "wallet-outline",
      route: "wallet",
    },
  ],
  broadcast: [
    {
      title: "Agenda de transmissões",
      description: "Partidas e horários programados.",
      icon: "videocam-outline",
      route: "agenda",
      primary: true,
    },
    {
      title: "Campeonatos",
      description: "Estrutura, equipes e classificação.",
      icon: "trophy-outline",
      route: "my_championships",
    },
    {
      title: "Convites",
      description: "Autorizações e acessos recebidos.",
      icon: "mail-unread-outline",
      route: "invites",
    },
    {
      title: "Diretório público",
      description: "Navegue pelos eventos ativos.",
      icon: "globe-outline",
      route: "vacancies",
    },
    {
      title: "Ranking",
      description: "Classificações para a transmissão.",
      icon: "podium-outline",
      route: "rank",
    },
    {
      title: "Lili",
      description: "Encontre funções rapidamente.",
      icon: "sparkles-outline",
      route: "lili",
    },
  ],
};

export function ControlPanelScreen({
  onNavigate,
  onSelectPlayer,
  onManageTeam,
}: ScreenProps) {
  const auth = useAuth(),
    account = auth.activeAccount,
    type = auth.activeProfileType,
    image = externalUrl(account?.image_url || ""),
    data: any = account?.data || {};
  function open(action: Action) {
    if (action.route === "player_public" && account?.id)
      return onSelectPlayer?.(account.id);
    if (action.route === "team_roster" && type === "equipe" && account?.id)
      return onManageTeam?.(account.id);
    onNavigate(action.route);
  }
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.identity}>
          {image ? (
            <Image source={{ uri: image }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.fallback]}>
              <Text style={styles.initial}>
                {String(account?.name || "DZ")
                  .slice(0, 2)
                  .toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>PAINEL · {labels[type]}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {account?.name || "Meu perfil"}
            </Text>
            <Text style={styles.handle}>
              {account?.username
                ? `@${account.username}`
                : "Central de controle DropZone"}
            </Text>
          </View>
        </View>
        <Text style={styles.intro}>
          Tudo que este perfil precisa para operar no competitivo, organizado
          por prioridade.
        </Text>
        <TouchableOpacity
          style={styles.editProfile}
          onPress={() => onNavigate("profile_management")}
        >
          <Ionicons name="create-outline" size={16} color={colors.ink} />
          <Text style={styles.editProfileText}>Editar perfil</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.statusRow}>
        <Status
          icon="checkmark-circle-outline"
          label="Perfil"
          value={String(data.status || "Ativo")}
        />
        <Status
          icon="notifications-outline"
          label="Pendências"
          value="Convites"
        />
        <Status icon="calendar-outline" label="Próximo" value="Agenda" />
      </View>
      <View style={styles.heading}>
        <Text style={styles.kicker}>CONTROLES</Text>
        <Text style={styles.title}>O que você quer fazer?</Text>
      </View>
      <View style={styles.grid}>
        {panels[type].map((action) => (
          <TouchableOpacity
            key={action.title}
            style={[styles.card, action.primary && styles.primary]}
            onPress={() => open(action)}
          >
            <View
              style={[styles.iconBox, action.primary && styles.primaryIcon]}
            >
              <Ionicons
                name={action.icon}
                size={24}
                color={action.primary ? colors.onBrand : colors.brand}
              />
            </View>
            <Text style={[styles.cardTitle, action.primary && styles.light]}>
              {action.title}
            </Text>
            <Text
              style={[styles.description, action.primary && styles.lightMuted]}
            >
              {action.description}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={action.primary ? colors.ink : colors.brand}
            />
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.help} onPress={() => onNavigate("lili")}>
        <Ionicons name="sparkles-outline" size={22} color={colors.brand} />
        <View style={styles.helpCopy}>
          <Text style={styles.helpTitle}>Não encontrou uma função?</Text>
          <Text style={styles.helpText}>
            Peça ajuda à Lili para chegar à ação certa.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </TouchableOpacity>
    </ScrollView>
  );
}
function Status({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.status}>
      <Ionicons name={icon} size={17} color={colors.brand} />
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  hero: {
    padding: 14,
    backgroundColor: colors.brandDark,
    borderBottomWidth: 2,
    borderBottomColor: colors.brand,
  },
  identity: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: colors.brandDark,
  },
  fallback: { alignItems: "center", justifyContent: "center" },
  initial: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  heroCopy: { flex: 1 },
  eyebrow: {
    color: colors.brand,
    fontSize: 7.5,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  name: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  handle: { marginTop: 2, color: colors.muted, fontSize: 9.5, fontWeight: "700" },
  intro: { marginTop: 9, color: colors.muted, fontSize: 10, lineHeight: 14 },
  editProfile: {
    alignSelf: "flex-start",
    marginTop: 9,
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,.07)",
  },
  editProfileText: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  statusRow: { margin: 12, marginBottom: 0, flexDirection: "row", gap: 6 },
  status: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statusLabel: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  statusValue: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 9,
    fontWeight: "900",
  },
  heading: { margin: 12, marginBottom: 7 },
  kicker: {
    color: colors.brand,
    fontSize: 7.5,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  grid: {
    paddingHorizontal: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  card: {
    width: "48.8%",
    minHeight: 132,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  primary: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandDark,
  },
  primaryIcon: { backgroundColor: colors.brand },
  cardTitle: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  light: { color: colors.surface },
  description: {
    flex: 1,
    marginTop: 4,
    color: colors.muted,
    fontSize: 8.5,
    lineHeight: 12,
    fontWeight: "600",
  },
  lightMuted: { color: colors.muted },
  help: {
    margin: 12,
    marginTop: 13,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  helpCopy: { flex: 1 },
  helpTitle: { color: colors.ink, fontSize: 9.5, fontWeight: "900" },
  helpText: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 8.5,
    lineHeight: 12,
    fontWeight: "700",
  },
});
