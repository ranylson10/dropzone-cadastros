import { ComponentProps, useEffect, useMemo, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  executeDetailedQuickTokenAction,
  executeQuickTokenAction,
  QuickTokenResult,
  reloadQuickTokenPayload,
  supportsDetailedQuickTokenAction,
  supportsNativeQuickTokenAction,
} from "@/lib/api";
import { MobileAccount } from "@/lib/auth";
import {
  PLAYER_ROLES,
  profileLabel,
  quickTokenPreferredProfile,
  quickTokenRequiredProfiles,
} from "@/lib/profileParity";
import { colors, spacing } from "@/theme/tokens";
import { ProfileType } from "@/types/dropzone";

const icons: Record<
  QuickTokenResult["kind"],
  ComponentProps<typeof Ionicons>["name"]
> = {
  team_championship_invite: "trophy-outline",
  group_registration: "grid-outline",
  lineup: "people-outline",
  player_registration: "person-add-outline",
  team_roster_invite: "shield-checkmark-outline",
  seller_invite: "cash-outline",
};

export function TokenActionScreen(props: {
  result: QuickTokenResult | null;
  onBack: () => void;
  accessToken?: string | null;
  requireLogin: () => void;
  accounts?: MobileAccount[];
  onCreateProfile?: (profileType: ProfileType) => void;
  onCompleted?: (result: QuickTokenResult, response: any) => void;
}) {
  const result = props.result;
  const requiredProfiles = result
    ? quickTokenRequiredProfiles(result.kind)
    : [];
  const preferredProfile = result
    ? quickTokenPreferredProfile(result.kind)
    : "jogador";
  const hasRequiredProfile = requiredProfiles.some((type) =>
    (props.accounts || []).some((account) => account.profile_type === type),
  );
  const [payload, setPayload] = useState<any>(result?.payload || {});
  const [busy, setBusy] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [equipeId, setEquipeId] = useState("");
  const [lineId, setLineId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [newLineName, setNewLineName] = useState("");
  const [participationId, setParticipationId] = useState("");
  const [nick, setNick] = useState("");
  const [gameId, setGameId] = useState("");
  const [role, setRole] = useState("support");

  useEffect(() => {
    setPayload(result?.payload || {});
    setDone(false);
    setMessage("");
    setEquipeId("");
    setLineId("");
    setSlotId("");
    setNewLineName("");
    setParticipationId("");
    const player = result?.payload?.jogador;
    setNick(String(player?.nome || player?.nick || ""));
    setGameId(String(player?.id_jogo || ""));
    setRole(String(player?.funcao || "support"));
  }, [result]);

  useEffect(() => {
    if (!result || !props.accessToken || !hasRequiredProfile) return;
    let active = true;
    setLoadingContext(true);
    void reloadQuickTokenPayload(
      result,
      props.accessToken,
      equipeId || undefined,
    )
      .then((next) => {
        if (active) setPayload(next);
      })
      .catch((err) => {
        if (active)
          setMessage(
            err?.message || "Não foi possível carregar os dados do token.",
          );
      })
      .finally(() => {
        if (active) setLoadingContext(false);
      });
    return () => {
      active = false;
    };
  }, [result?.kind, result?.token, props.accessToken, hasRequiredProfile]);

  const teams = useMemo(
    () =>
      Array.isArray(payload?.equipes_disponiveis)
        ? payload.equipes_disponiveis
        : [],
    [payload],
  );
  const lines = useMemo(
    () =>
      Array.isArray(payload?.lines_disponiveis)
        ? payload.lines_disponiveis
        : Array.isArray(payload?.lines)
          ? payload.lines
          : [],
    [payload],
  );
  const slots = useMemo(
    () =>
      Array.isArray(payload?.vagas)
        ? payload.vagas.filter((row: any) => !row.ocupada)
        : [],
    [payload],
  );
  const playerTeams = useMemo(
    () => (Array.isArray(payload?.equipes) ? payload.equipes : []),
    [payload],
  );

  useEffect(() => {
    if (!equipeId && teams.length === 1) setEquipeId(String(teams[0].id || ""));
    if (!participationId && playerTeams.length === 1)
      setParticipationId(
        String(playerTeams[0].campeonato_equipe_id || playerTeams[0].id || ""),
      );
  }, [equipeId, participationId, playerTeams, teams]);

  if (!result) {
    return (
      <View style={styles.center}>
        <Ionicons name="key-outline" size={28} color={colors.muted} />
        <Text style={styles.emptyTitle}>Nenhum token selecionado</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={props.onBack}>
          <Text style={styles.secondaryText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const resolvedResult: QuickTokenResult = result;
  const directAction = supportsNativeQuickTokenAction(resolvedResult.kind);
  const detailedAction = supportsDetailedQuickTokenAction(resolvedResult.kind);
  const nativeAction = directAction || detailedAction;

  async function selectTeam(id: string) {
    setEquipeId(id);
    setLineId("");
    setNewLineName("");
    setMessage("");
    if (!props.accessToken) return;
    setLoadingContext(true);
    try {
      const next = await reloadQuickTokenPayload(
        resolvedResult,
        props.accessToken,
        id,
      );
      setPayload(next);
    } catch (err: any) {
      setMessage(
        err?.message || "Não foi possível carregar as lines desta equipe.",
      );
    } finally {
      setLoadingContext(false);
    }
  }

  async function executeDirect() {
    if (!props.accessToken) {
      props.requireLogin();
      return;
    }
    if (!hasRequiredProfile) {
      props.onCreateProfile?.(preferredProfile);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await executeQuickTokenAction(
        resolvedResult,
        props.accessToken,
      );
      finish(response);
    } catch (err: any) {
      setMessage(err?.message || "Não foi possível concluir esta ação.");
    } finally {
      setBusy(false);
    }
  }

  async function executeDetailed() {
    if (!props.accessToken) {
      props.requireLogin();
      return;
    }
    if (!hasRequiredProfile) {
      props.onCreateProfile?.(preferredProfile);
      return;
    }
    const body: Record<string, unknown> = {};

    if (
      resolvedResult.kind === "team_championship_invite" ||
      resolvedResult.kind === "group_registration"
    ) {
      if (teams.length > 1 && !equipeId) {
        setMessage("Selecione a equipe que vai entrar.");
        return;
      }
      if (!lineId && !newLineName.trim()) {
        setMessage(
          "Selecione uma line existente ou informe o nome de uma nova line.",
        );
        return;
      }
      if (equipeId) body.equipe_id = equipeId;
      if (lineId) body.line_id = lineId;
      if (!lineId && newLineName.trim()) body.nome_line = newLineName.trim();
      if (slotId) body.slot_id = slotId;
    }

    if (resolvedResult.kind === "player_registration") {
      if (!participationId) {
        setMessage("Selecione a equipe/line em que o jogador será inscrito.");
        return;
      }
      if (!nick.trim() || !gameId.trim()) {
        setMessage("Nick e ID de jogo são obrigatórios.");
        return;
      }
      body.campeonato_equipe_id = participationId;
      body.nick = nick.trim();
      body.id_jogo = gameId.trim();
      body.funcao = role.trim() || "support";
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await executeDetailedQuickTokenAction(
        resolvedResult,
        body,
        props.accessToken,
      );
      finish(response);
    } catch (err: any) {
      setMessage(err?.message || "Não foi possível concluir esta inscrição.");
    } finally {
      setBusy(false);
    }
  }

  function finish(response: any) {
    setDone(true);
    setMessage(
      response?.mensagem ||
        (resolvedResult.kind === "lineup"
          ? response?.already_registered
            ? "Você já estava nesta escalação."
            : "Você entrou na escalação."
          : resolvedResult.kind === "team_roster_invite"
            ? "Convite aceito. Você agora faz parte da equipe."
            : resolvedResult.kind === "seller_invite"
              ? "Convite de vendedor aceito."
              : resolvedResult.kind === "player_registration"
                ? "Jogador inscrito no campeonato."
                : "Inscrição concluída."),
    );
    props.onCompleted?.(resolvedResult, response);
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <TouchableOpacity
          style={styles.back}
          onPress={props.onBack}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={21} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.heroIcon}>
          <Ionicons name={icons[resolvedResult.kind]} size={30} color={colors.onBrand} />
        </View>
        <Text style={styles.kicker}>TOKEN RECONHECIDO</Text>
        <Text style={styles.title}>{resolvedResult.title}</Text>
        <Text style={styles.description}>{resolvedResult.description}</Text>
      </View>

      <View style={styles.tokenCard}>
        <Text style={styles.label}>TOKEN</Text>
        <Text style={styles.token} selectable>
          {resolvedResult.token}
        </Text>
      </View>

      <View style={styles.steps}>
        <Step ok label="Token reconhecido" />
        <Step
          ok={Boolean(props.accessToken)}
          label={props.accessToken ? "Login confirmado" : "Login necessário"}
        />
        <Step
          ok={Boolean(props.accessToken && hasRequiredProfile)}
          label={
            hasRequiredProfile
              ? `Perfil compatível: ${requiredProfiles.map((type) => profileLabel[type]).join(" / ")}`
              : `Perfil necessário: ${profileLabel[preferredProfile]}`
          }
        />
      </View>

      {!props.accessToken ? (
        <TouchableOpacity
          style={styles.gateButton}
          onPress={props.requireLogin}
        >
          <Ionicons name="log-in-outline" size={19} color={colors.onBrand} />
          <Text style={styles.gateButtonText}>Entrar para continuar</Text>
        </TouchableOpacity>
      ) : null}
      {props.accessToken && !hasRequiredProfile ? (
        <View style={styles.profileGate}>
          <Text style={styles.profileGateTitle}>
            Crie o perfil necessário para este token
          </Text>
          <Text style={styles.hint}>
            O cadastro usa os mesmos campos e regras do site.
          </Text>
          <TouchableOpacity
            style={[
              styles.gateButton,
              { marginHorizontal: 0, marginBottom: 0 },
            ]}
            onPress={() => props.onCreateProfile?.(preferredProfile)}
          >
            <Ionicons name="person-add-outline" size={19} color={colors.onBrand} />
            <Text style={styles.gateButtonText}>
              Criar perfil de {profileLabel[preferredProfile]}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="eye-outline" size={18} color={colors.ink} />
          <Text style={styles.infoText}>
            Confira o destino e os dados antes de confirmar.
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons
            name="phone-portrait-outline"
            size={18}
            color={colors.ink}
          />
          <Text style={styles.infoText}>
            {nativeAction
              ? "Este fluxo pode ser concluído diretamente no app."
              : "Fluxo indisponível para ação nativa."}
          </Text>
        </View>
      </View>

      {detailedAction &&
      !done &&
      Boolean(props.accessToken) &&
      hasRequiredProfile ? (
        <View style={styles.form}>
          {resolvedResult.kind === "team_championship_invite" ||
          resolvedResult.kind === "group_registration" ? (
            <>
              <Text style={styles.formTitle}>EQUIPE</Text>
              <View style={styles.choices}>
                {teams.map((team: any) => (
                  <Choice
                    key={team.id}
                    label={[team.nome, team.tag].filter(Boolean).join(" · ")}
                    active={String(team.id) === equipeId}
                    onPress={() => void selectTeam(String(team.id))}
                  />
                ))}
              </View>
              {teams.length === 0 ? (
                <Text style={styles.hint}>
                  {payload?.autenticado === false
                    ? "Entre para carregar as equipes que você controla."
                    : "Nenhuma equipe controlável disponível."}
                </Text>
              ) : null}

              {loadingContext ? (
                <View style={styles.inlineLoading}>
                  <ActivityIndicator color={colors.brand} />
                  <Text style={styles.hint}>Carregando lines...</Text>
                </View>
              ) : null}

              <Text style={styles.formTitle}>LINE</Text>
              <Text style={styles.hint}>
                Somente lines ainda não inscritas neste campeonato aparecem
                aqui. Uma mesma line não pode ocupar duas vagas.
              </Text>
              <View style={styles.choices}>
                {lines.map((line: any) => (
                  <Choice
                    key={line.id}
                    label={line.nome || line.tag || "Line"}
                    active={String(line.id) === lineId}
                    onPress={() => {
                      setLineId(String(line.id));
                      setNewLineName("");
                    }}
                  />
                ))}
              </View>
              <TextInput
                value={newLineName}
                onChangeText={(value) => {
                  setNewLineName(value);
                  if (value) setLineId("");
                }}
                style={styles.input}
                placeholder="Ou crie uma nova line pelo nome"
                placeholderTextColor={colors.muted}
              />

              {slots.length ? (
                <>
                  <Text style={styles.formTitle}>SLOT</Text>
                  <Text style={styles.hint}>
                    Pode deixar automático ou escolher um slot livre.
                  </Text>
                  <View style={styles.choices}>
                    <Choice
                      label="Automático"
                      active={!slotId}
                      onPress={() => setSlotId("")}
                    />
                    {slots.map((slot: any) => (
                      <Choice
                        key={slot.slot_id || slot.id}
                        label={`Slot ${slot.slot_letra || slot.letra || slot.slot_numero || slot.numero || "—"}`}
                        active={String(slot.slot_id || slot.id) === slotId}
                        onPress={() =>
                          setSlotId(String(slot.slot_id || slot.id))
                        }
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          ) : null}

          {resolvedResult.kind === "player_registration" ? (
            <>
              <Text style={styles.formTitle}>EQUIPE / LINE</Text>
              <View style={styles.choices}>
                {playerTeams.map((team: any) => {
                  const id = String(team.campeonato_equipe_id || team.id || "");
                  return (
                    <Choice
                      key={id}
                      label={[
                        team.line_nome || team.nome || team.equipe_nome,
                        team.tag,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      active={id === participationId}
                      onPress={() => setParticipationId(id)}
                    />
                  );
                })}
              </View>
              <Text style={styles.formTitle}>DADOS DO JOGADOR</Text>
              <TextInput
                value={nick}
                onChangeText={setNick}
                style={styles.input}
                placeholder="Nick"
                placeholderTextColor={colors.muted}
              />
              <TextInput
                value={gameId}
                onChangeText={setGameId}
                style={styles.input}
                placeholder="ID do jogo"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.hint}>Função</Text>
              <View style={styles.choices}>
                {PLAYER_ROLES.map((value) => (
                  <Choice
                    key={value}
                    label={value}
                    active={role === value}
                    onPress={() => setRole(value)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      {message ? (
        <View style={[styles.result, done && styles.resultOk]}>
          <Ionicons
            name={done ? "checkmark-circle" : "alert-circle-outline"}
            size={19}
            color={done ? colors.success : colors.danger}
          />
          <Text style={[styles.resultText, done && styles.resultTextOk]}>
            {message}
          </Text>
        </View>
      ) : null}

      {done ? (
        <TouchableOpacity style={styles.primaryButton} onPress={props.onBack}>
          <Text style={styles.primaryText}>Concluir</Text>
          <Ionicons name="checkmark" size={20} color={colors.onBrand} />
        </TouchableOpacity>
      ) : nativeAction && Boolean(props.accessToken) && hasRequiredProfile ? (
        <TouchableOpacity
          disabled={busy || loadingContext}
          style={[
            styles.primaryButton,
            (busy || loadingContext) && styles.disabled,
          ]}
          onPress={() =>
            void (detailedAction ? executeDetailed() : executeDirect())
          }
        >
          {busy ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <Text style={styles.primaryText}>
              {props.accessToken
                ? detailedAction
                  ? "Confirmar inscrição"
                  : "Aceitar no app"
                : "Entrar para continuar"}
            </Text>
          )}
          {!busy ? (
            <Ionicons name="arrow-forward" size={20} color={colors.onBrand} />
          ) : null}
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.secondaryButton} onPress={props.onBack}>
        <Text style={styles.secondaryText}>Voltar ao início</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Step({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.step}>
      <Ionicons
        name={ok ? "checkmark-circle" : "ellipse-outline"}
        size={17}
        color={ok ? colors.success : colors.muted}
      />
      <Text style={[styles.stepText, ok && styles.stepTextOk]}>{label}</Text>
    </View>
  );
}

function Choice({
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
      style={[styles.choice, active && styles.choiceActive]}
      onPress={onPress}
    >
      <Text
        style={[styles.choiceText, active && styles.choiceTextActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.background,
    padding: 20,
  },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  hero: {
    backgroundColor: colors.brandDark,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.brand,
  },
  back: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    marginBottom: 10,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
    marginBottom: 8,
  },
  kicker: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 3,
  },
  description: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 5 },
  tokenCard: {
    margin: 12,
    marginBottom: 7,
    padding: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  label: {
    color: colors.brand,
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  token: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginTop: 3,
  },
  steps: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 10,
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  step: { flexDirection: "row", alignItems: "center", gap: 7 },
  stepText: { color: colors.muted, fontSize: 8, fontWeight: "800" },
  stepTextOk: { color: colors.success },
  profileGate: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 10,
    gap: 6,
    backgroundColor: "rgba(212,165,87,.13)",
    borderRadius: 9,
    borderLeftWidth: 3,
    borderLeftColor: colors.brand,
  },
  profileGateTitle: {
    color: colors.ink,
    fontSize: 9.5,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  gateButton: {
    marginHorizontal: 12,
    marginBottom: 8,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 8,
    backgroundColor: colors.brand,
  },
  gateButtonText: {
    color: colors.onBrand,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  infoCard: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 10,
    gap: 8,
    borderRadius: 9,
    backgroundColor: colors.surfaceRaised,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoText: {
    flex: 1,
    color: colors.muted,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "700",
  },
  form: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 10,
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  formTitle: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 7.5,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  choice: {
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: colors.surfaceRaised,
  },
  choiceActive: { backgroundColor: colors.brand },
  choiceText: {
    color: colors.ink,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  choiceTextActive: { color: colors.onBrand },
  input: {
    minHeight: 40,
    paddingHorizontal: 9,
    color: colors.ink,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    fontSize: 9.5,
    fontWeight: "800",
  },
  hint: {
    color: colors.muted,
    fontSize: 7.5,
    lineHeight: 11,
    fontWeight: "700",
  },
  inlineLoading: {
    minHeight: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  result: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 8,
    backgroundColor: "rgba(224,122,122,.13)",
  },
  resultOk: { backgroundColor: "rgba(101,185,130,.13)" },
  resultText: {
    flex: 1,
    color: colors.danger,
    fontSize: 8.5,
    lineHeight: 12,
    fontWeight: "800",
  },
  resultTextOk: { color: colors.success },
  primaryButton: {
    marginHorizontal: 12,
    minHeight: 46,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    backgroundColor: colors.brand,
  },
  disabled: { opacity: 0.55 },
  primaryText: {
    color: colors.onBrand,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  secondaryButton: {
    marginHorizontal: 12,
    marginTop: 7,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  secondaryText: {
    color: colors.ink,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
});
