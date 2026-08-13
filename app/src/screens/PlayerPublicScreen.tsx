import { useEffect, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { externalUrl } from "@/config/env";
import { mobileApi } from "@/lib/api";
import { DirectoryHero } from "@/screens/DirectoryHero";
import { colors, spacing } from "@/theme/tokens";
import { ScreenProps } from "@/types/dropzone";

export function PlayerPublicScreen({
  selectedPlayerId,
  onSelectChampionship,
  onSelectTeam,
}: ScreenProps) {
  const [data, setData] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    if (!selectedPlayerId) return;
    setLoading(true);
    mobileApi
      .publicPlayer(selectedPlayerId)
      .then(setData)
      .catch((err) =>
        setError(err?.message || "Não foi possível carregar o jogador."),
      )
      .finally(() => setLoading(false));
  }, [selectedPlayerId]);
  const player = data?.player || {},
    participations = data?.participations || [],
    photo = externalUrl(player.avatar_url || player.foto_url || "");
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <DirectoryHero
        image={require("../../assets/directory-rank.png")}
        eyebrow={player.funcao || "Jogador"}
        title={player.nick || player.nome || "Jogador"}
        description={[
          player.username ? `@${player.username}` : "",
          player.localidade,
          player.id_jogo ? `ID ${player.id_jogo}` : "",
        ]
          .filter(Boolean)
          .join(" · ")}
        compact
      />
      {photo ? (
        <View style={styles.identity}>
          <Image source={{ uri: photo }} style={styles.avatar} />
          <View style={styles.identityCopy}>
            <Text style={styles.name}>{player.nick || player.nome}</Text>
            <Text style={styles.meta}>
              {player.funcao || "Jogador competitivo"}
            </Text>
            {player.disponivel_recrutamento ? (
              <View style={styles.recruitBadge}>
                <Ionicons name="radio-button-on" size={10} color={colors.success} />
                <Text style={styles.recruitText}>
                  Disponível para recrutamento
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.meta}>Carregando perfil...</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading ? (
        <>
          <Text style={styles.title}>PARTICIPAÇÕES E AGENDA</Text>
          <View style={styles.list}>
            {participations.map((item: any, index: number) => {
              const champ = item.campeonato || {},
                team = item.equipe || {},
                line = item.line || {};
              return (
                <TouchableOpacity
                  key={String(item.id || index)}
                  style={styles.row}
                  onPress={() =>
                    champ.id &&
                    onSelectChampionship?.({
                      id: String(champ.id),
                      name: champ.nome || "Campeonato",
                      mode: champ.tipo || "competitivo",
                      logoUrl: champ.logo_url || null,
                      bannerUrl: champ.banner_url || null,
                      priceLabel: "Ver campeonato",
                      freeSlots: 0,
                    })
                  }
                >
                  <View style={[styles.icon, styles.fallback]}>
                    <Ionicons
                      name="trophy-outline"
                      size={19}
                      color={colors.brand}
                    />
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.name}>
                      {champ.nome || "Campeonato"}
                    </Text>
                    <Text style={styles.meta}>
                      {[
                        team.nome,
                        line.nome,
                        item.funcao,
                        item.capitao ? "Capitão" : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </TouchableOpacity>
              );
            })}
          </View>
          {!participations.length ? (
            <Text style={styles.empty}>
              Nenhuma participação pública encontrada.
            </Text>
          ) : null}
        </>
      ) : null}
      {participations.find((x: any) => x.equipe?.id) ? (
        <TouchableOpacity
          style={styles.teamButton}
          onPress={() =>
            onSelectTeam?.(
              String(participations.find((x: any) => x.equipe?.id).equipe.id),
            )
          }
        >
          <Ionicons name="shield-outline" size={18} color={colors.onBrand} />
          <Text style={styles.teamButtonText}>Ver equipe atual</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.lg },
  identity: {
    margin: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  identityCopy: { flex: 1 },
  avatar: { width: 56, height: 56 },
  recruitBadge: {
    alignSelf: "flex-start",
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: "rgba(101,185,130,.13)",
  },
  recruitText: {
    color: colors.success,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  name: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  meta: { marginTop: 3, color: colors.muted, fontSize: 9, fontWeight: "700" },
  loading: {
    minHeight: 55,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  error: {
    marginHorizontal: spacing.md,
    padding: 10,
    color: colors.danger,
    backgroundColor: "rgba(224,122,122,.13)",
    fontWeight: "800",
  },
  title: {
    margin: spacing.md,
    marginBottom: 8,
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
  },
  list: { marginHorizontal: spacing.md, gap: 8 },
  row: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
  },
  icon: { width: 42, height: 42 },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  copy: { flex: 1 },
  empty: {
    marginHorizontal: spacing.md,
    padding: 15,
    textAlign: "center",
    color: colors.muted,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  teamButton: {
    margin: spacing.md,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.brand,
  },
  teamButtonText: {
    color: colors.onBrand,
    fontWeight: "900",
    textTransform: "uppercase",
  },
});
