import { useCallback, useEffect, useMemo, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { externalUrl } from "@/config/env";
import { mobileApi } from "@/lib/api";
import { colors, spacing } from "@/theme/tokens";

type Props = { championshipId: string; token?: string | null };
type ViewMode = "setup" | "overlays" | "live";

export function ChampionshipStreamPanel({ championshipId, token }: Props) {
  const [view, setView] = useState<ViewMode>("setup");
  const [keyRow, setKeyRow] = useState<any>(null);
  const [pack, setPack] = useState<any>(null);
  const [overlays, setOverlays] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [context, setContext] = useState<any>(null);
  const [broadcast, setBroadcast] = useState<any>(null);
  const [name, setName] = useState("Overlay");
  const [keyLabel, setKeyLabel] = useState("Chave Stream");
  const [bgType, setBgType] = useState<"none" | "image" | "video">("none");
  const [bgUrl, setBgUrl] = useState("");
  const [activeGameId, setActiveGameId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [keyRes, packRes, overlayRes, contextRes, broadcastRes] =
        await Promise.all([
          mobileApi.championshipStreamKey(championshipId, token),
          mobileApi.championshipStreamPack(championshipId, token),
          mobileApi.championshipStreamOverlays(championshipId, token),
          mobileApi.championshipStreamData(championshipId, "context", token),
          mobileApi.broadcastMe(token).catch(() => null),
        ]);
      const currentPack = packRes?.pack || {};
      setKeyRow(keyRes?.key || null);
      setKeyLabel(String(keyRes?.key?.label || "Chave Stream"));
      setPack(currentPack);
      setOverlays(
        Array.isArray(overlayRes?.overlays) ? overlayRes.overlays : [],
      );
      setGames(Array.isArray(packRes?.jogos) ? packRes.jogos : []);
      setSelected(
        Array.isArray(currentPack?.selected_overlay_ids)
          ? currentPack.selected_overlay_ids.map(String)
          : [],
      );
      setBgType(
        (["none", "image", "video"].includes(String(currentPack?.bg_type))
          ? String(currentPack.bg_type)
          : "none") as "none" | "image" | "video",
      );
      setBgUrl(String(currentPack?.bg_url || ""));
      setActiveGameId(String(currentPack?.active_jogo_id || ""));
      setContext(contextRes?.context || null);
      setBroadcast(broadcastRes);
      setError("");
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar a transmissão.");
    } finally {
      setLoading(false);
    }
  }, [championshipId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(work: () => Promise<any>, message: string) {
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      await work();
      setFeedback(message);
      await load();
    } catch (err: any) {
      setError(err?.message || "Não foi possível concluir a ação.");
    } finally {
      setBusy(false);
    }
  }

  const currentBroadcastDesk = useMemo(() => {
    const desk = broadcast?.desk;
    if (!desk || String(desk.campeonato_id || "") !== championshipId)
      return null;
    return desk;
  }, [broadcast, championshipId]);

  const activeGame =
    games.find((row: any) => String(row.id) === activeGameId) || null;

  async function ensureKey(regenerate = false) {
    await action(
      () =>
        mobileApi.ensureChampionshipStreamKey(
          championshipId,
          { label: keyLabel.trim() || "Chave Stream", regenerate },
          token,
        ),
      regenerate ? "Chave regenerada." : "Chave Stream pronta.",
    );
  }

  function revokeKey() {
    Alert.alert(
      "Revogar chave Stream?",
      "A chave atual deixará de funcionar para novos vínculos de transmissão.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Revogar",
          style: "destructive",
          onPress: () =>
            void action(
              () =>
                mobileApi.revokeChampionshipStreamKey(championshipId, token),
              "Chave revogada.",
            ),
        },
      ],
    );
  }

  async function savePack() {
    if (bgType !== "none" && !bgUrl.trim()) {
      setError("Informe a URL do fundo ou selecione sem fundo.");
      return;
    }
    await action(
      () =>
        mobileApi.saveChampionshipStreamPack(
          championshipId,
          {
            selected_overlay_ids: selected,
            bg_type: bgType,
            bg_url: bgType === "none" ? null : bgUrl.trim(),
            active_jogo_id: activeGameId || null,
          },
          token,
        ),
      "Pacote de transmissão salvo.",
    );
  }

  async function createOverlay() {
    if (!name.trim()) {
      setError("Informe um nome para o overlay.");
      return;
    }
    await action(
      () =>
        mobileApi.createChampionshipStreamOverlay(
          championshipId,
          { name: name.trim(), template: "custom", blocks: [] },
          token,
        ),
      "Overlay criado.",
    );
    setName("Overlay");
  }

  function removeOverlay(row: any) {
    Alert.alert("Excluir overlay?", String(row.name || "Overlay"), [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () =>
          void action(
            () =>
              mobileApi.deleteChampionshipStreamOverlay(
                championshipId,
                String(row.id),
                token,
              ),
            "Overlay removido.",
          ),
      },
    ]);
  }

  async function renameOverlay(row: any) {
    const next = `${String(row.name || "Overlay")} 2`;
    await action(
      () =>
        mobileApi.updateChampionshipStreamOverlay(
          championshipId,
          String(row.id),
          { name: next },
          token,
        ),
      "Overlay renomeado.",
    );
  }

  function toggleOverlay(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  async function shareText(title: string, message: string) {
    await Share.share({ title, message });
  }

  async function openUrl(url: string) {
    const ok = await Linking.canOpenURL(url);
    if (!ok) {
      setError("Não foi possível abrir este endereço.");
      return;
    }
    await Linking.openURL(url);
  }

  if (loading && !pack)
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );

  return (
    <View style={styles.root}>
      {error ? (
        <Text style={[styles.message, styles.error]}>{error}</Text>
      ) : null}
      {feedback ? <Text style={styles.message}>{feedback}</Text> : null}

      <View style={styles.nav}>
        <Nav
          label="Config."
          active={view === "setup"}
          onPress={() => setView("setup")}
        />
        <Nav
          label="Overlays"
          active={view === "overlays"}
          onPress={() => setView("overlays")}
        />
        <Nav
          label="Ao vivo"
          active={view === "live"}
          onPress={() => setView("live")}
        />
      </View>

      {view === "setup" ? (
        <>
          <Text style={styles.title}>CHAVE PARA O STREAM</Text>
          <View style={styles.card}>
            <Text style={styles.meta}>
              Compartilhe esta chave somente com o profissional de Stream que
              vai transmitir o campeonato.
            </Text>
            <TextInput
              value={keyLabel}
              onChangeText={setKeyLabel}
              style={styles.input}
              placeholder="Nome da chave"
              placeholderTextColor="#8a857e"
            />
            {keyRow?.key_token ? (
              <View style={styles.tokenBox}>
                <Text style={styles.token}>{keyRow.key_token}</Text>
              </View>
            ) : (
              <Text style={styles.emptyInline}>Nenhuma chave ativa.</Text>
            )}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.secondary}
                disabled={busy}
                onPress={() => void ensureKey(false)}
              >
                <Text style={styles.secondaryText}>
                  {keyRow ? "Garantir chave" : "Criar chave"}
                </Text>
              </TouchableOpacity>
              {keyRow ? (
                <TouchableOpacity
                  style={styles.secondary}
                  disabled={busy}
                  onPress={() =>
                    void action(
                      () =>
                        mobileApi.renameChampionshipStreamKey(
                          championshipId,
                          keyLabel.trim() || "Chave Stream",
                          token,
                        ),
                      "Nome da chave atualizado.",
                    )
                  }
                >
                  <Text style={styles.secondaryText}>Renomear</Text>
                </TouchableOpacity>
              ) : null}
              {keyRow ? (
                <TouchableOpacity
                  style={styles.secondary}
                  disabled={busy}
                  onPress={() =>
                    void shareText(
                      "Chave Stream",
                      `Chave Stream — ${keyLabel}\n${keyRow.key_token}`,
                    )
                  }
                >
                  <Text style={styles.secondaryText}>Compartilhar</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {keyRow ? (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.warning}
                  disabled={busy}
                  onPress={() => void ensureKey(true)}
                >
                  <Text style={styles.warningText}>Regenerar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.danger}
                  disabled={busy}
                  onPress={revokeKey}
                >
                  <Text style={styles.dangerText}>Revogar</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <Text style={styles.title}>PACOTE DA TRANSMISSÃO</Text>
          <View style={styles.card}>
            <Text style={styles.label}>JOGO ATIVO</Text>
            <View style={styles.chips}>
              <TouchableOpacity
                style={[styles.chip, !activeGameId && styles.chipActive]}
                onPress={() => setActiveGameId("")}
              >
                <Text
                  style={[
                    styles.chipText,
                    !activeGameId && styles.chipTextActive,
                  ]}
                >
                  AUTO
                </Text>
              </TouchableOpacity>
              {games.map((game: any) => (
                <TouchableOpacity
                  key={game.id}
                  style={[
                    styles.chip,
                    activeGameId === String(game.id) && styles.chipActive,
                  ]}
                  onPress={() => setActiveGameId(String(game.id))}
                >
                  <Text
                    style={[
                      styles.chipText,
                      activeGameId === String(game.id) && styles.chipTextActive,
                    ]}
                  >
                    {game.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>FUNDO</Text>
            <View style={styles.chips}>
              {(["none", "image", "video"] as const).map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, bgType === item && styles.chipActive]}
                  onPress={() => setBgType(item)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      bgType === item && styles.chipTextActive,
                    ]}
                  >
                    {item === "none"
                      ? "SEM FUNDO"
                      : item === "image"
                        ? "IMAGEM"
                        : "VÍDEO"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {bgType !== "none" ? (
              <TextInput
                value={bgUrl}
                onChangeText={setBgUrl}
                style={styles.input}
                autoCapitalize="none"
                placeholder="https://..."
                placeholderTextColor="#8a857e"
              />
            ) : null}
            <Text style={styles.label}>OVERLAYS NO PACK</Text>
            {overlays.length ? (
              overlays.map((row: any) => {
                const id = String(row.id);
                const on = selected.includes(id);
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.selectRow, on && styles.selectRowActive]}
                    onPress={() => toggleOverlay(id)}
                  >
                    <Ionicons
                      name={on ? "checkbox" : "square-outline"}
                      size={18}
                      color={on ? colors.brand : colors.muted}
                    />
                    <Text style={styles.rowTitle}>{row.name}</Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.emptyInline}>Crie um overlay primeiro.</Text>
            )}
            <TouchableOpacity
              style={styles.primary}
              disabled={busy}
              onPress={() => void savePack()}
            >
              <Ionicons name="save-outline" size={17} color={colors.surface} />
              <Text style={styles.primaryText}>Salvar pacote</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      {view === "overlays" ? (
        <>
          <Text style={styles.title}>NOVO OVERLAY</Text>
          <View style={styles.card}>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="Nome do overlay"
              placeholderTextColor="#8a857e"
            />
            <TouchableOpacity
              style={styles.primary}
              disabled={busy}
              onPress={() => void createOverlay()}
            >
              <Ionicons name="add" size={18} color={colors.surface} />
              <Text style={styles.primaryText}>Criar overlay</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>OVERLAYS DO CAMPEONATO</Text>
          <View style={styles.list}>
            {overlays.map((row: any) => {
              const liveUrl = externalUrl(`/stream/live/${row.share_token}`);
              const editorUrl = externalUrl(
                `/campeonatos/${championshipId}/stream/overlays/${row.id}`,
              );
              return (
                <View key={row.id} style={styles.card}>
                  <View style={styles.rowHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{row.name}</Text>
                      <Text style={styles.meta}>
                        {row.template || "custom"} · {row.license_kind || "own"}
                      </Text>
                    </View>
                    <Ionicons
                      name="layers-outline"
                      size={20}
                      color={colors.brand}
                    />
                  </View>
                  <Text style={styles.url} numberOfLines={1}>
                    {liveUrl}
                  </Text>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.secondary}
                      onPress={() => void openUrl(editorUrl)}
                    >
                      <Text style={styles.secondaryText}>Editor web</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondary}
                      onPress={() => void openUrl(liveUrl)}
                    >
                      <Text style={styles.secondaryText}>Preview</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondary}
                      onPress={() =>
                        void shareText("Browser Source OBS", liveUrl)
                      }
                    >
                      <Text style={styles.secondaryText}>Compartilhar URL</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.secondary}
                      onPress={() => void renameOverlay(row)}
                    >
                      <Text style={styles.secondaryText}>Renomear rápido</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.danger}
                      onPress={() => removeOverlay(row)}
                    >
                      <Text style={styles.dangerText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      {view === "live" ? (
        <>
          <Text style={styles.title}>CONTEXTO AO VIVO</Text>
          <View style={styles.card}>
            <Metric
              label="Jogo ativo"
              value={
                activeGame?.nome || context?.active_jogo?.nome || "Automático"
              }
            />
            <Metric
              label="Queda atual"
              value={
                context?.current_partida?.numero_partida
                  ? `Q${context.current_partida.numero_partida}`
                  : "—"
              }
            />
            <Metric
              label="Mapa"
              value={
                context?.current_partida?.mapa_nome ||
                context?.current_partida?.mapa_codigo ||
                "—"
              }
            />
            <Metric label="Overlays no pack" value={selected.length} />
          </View>
          <Text style={styles.title}>MESA BROADCAST</Text>
          {currentBroadcastDesk ? (
            <View style={styles.card}>
              <Text style={styles.meta}>
                Este login possui uma mesa Broadcast ligada a este campeonato.
              </Text>
              <TouchableOpacity
                style={styles.primary}
                onPress={() =>
                  void openUrl(
                    externalUrl(
                      `/broadcast/control/${currentBroadcastDesk.controller_token}`,
                    ),
                  )
                }
              >
                <Text style={styles.primaryText}>Abrir controlador</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryWide}
                onPress={() =>
                  void shareText(
                    "OBS Browser Source",
                    externalUrl(
                      `/broadcast/obs/${currentBroadcastDesk.obs_token}`,
                    ),
                  )
                }
              >
                <Text style={styles.secondaryText}>Compartilhar URL OBS</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.meta}>
                A mesa Broadcast pertence ao perfil Stream. O organizador gera a
                chave acima; o Stream resgata a chave e recebe os próprios links
                de controlador e OBS.
              </Text>
            </View>
          )}
          <View style={styles.card}>
            <Text style={styles.note}>
              OBS/vMix: use a URL pública de um overlay como Browser Source
              quando quiser uma cena fixa. Para troca remota de cenas, use a
              mesa Broadcast com controller_token + obs_token.
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

function Nav({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.navItem, active && styles.navActive]}
      onPress={onPress}
    >
      <Text style={[styles.navText, active && styles.navTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
function Metric({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginHorizontal: spacing.md, gap: 8 },
  loading: { minHeight: 64, alignItems: "center", justifyContent: "center" },
  message: {
    padding: 10,
    color: colors.success,
    backgroundColor: "rgba(101, 185, 130, .12)",
    fontWeight: "800",
  },
  error: { color: colors.danger, backgroundColor: "rgba(224, 122, 122, .12)" },
  nav: { flexDirection: "row", gap: 6 },
  navItem: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
  },
  navActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  navText: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  navTextActive: { color: colors.onBrand },
  title: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  card: {
    gap: 7,
    padding: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
  },
  meta: { color: colors.muted, fontSize: 8, lineHeight: 12, fontWeight: "700" },
  input: {
    minHeight: 40,
    paddingHorizontal: 9,
    borderRadius: 7,
    color: colors.ink,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
    fontWeight: "800",
  },
  tokenBox: { padding: 10, backgroundColor: colors.brandDark },
  token: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  secondary: {
    minHeight: 34,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  secondaryWide: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  secondaryText: {
    color: colors.ink,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  warning: {
    minHeight: 34,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212, 165, 87, .12)",
  },
  warningText: {
    color: colors.warning,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  danger: {
    minHeight: 34,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(224, 122, 122, .12)",
  },
  dangerText: {
    color: colors.danger,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  label: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 8,
    backgroundColor: colors.surfaceRaised,
  },
  chipActive: { backgroundColor: colors.brand },
  chipText: {
    color: colors.ink,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  chipTextActive: { color: colors.onBrand },
  selectRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 8,
    backgroundColor: colors.surfaceRaised,
  },
  selectRowActive: { borderLeftWidth: 3, borderLeftColor: colors.brand },
  rowTitle: {
    color: colors.ink,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  primary: {
    minHeight: 44,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  primaryText: {
    color: colors.onBrand,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  emptyInline: {
    padding: 10,
    color: colors.muted,
    fontSize: 8,
    textAlign: "center",
    backgroundColor: colors.surfaceRaised,
  },
  list: { gap: 6 },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  url: {
    padding: 7,
    color: colors.muted,
    fontSize: 7,
    backgroundColor: colors.surfaceRaised,
  },
  metric: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  metricLabel: { color: colors.muted, fontSize: 8, fontWeight: "800" },
  metricValue: {
    flex: 1,
    color: colors.ink,
    fontSize: 9,
    fontWeight: "900",
    textAlign: "right",
  },
  note: { color: colors.muted, fontSize: 8, lineHeight: 13 },
});
