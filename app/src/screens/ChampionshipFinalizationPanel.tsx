import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { mobileApi } from "@/lib/api";
import { MobileLifecyclePanel } from "./MobileLifecyclePanel";
import { useMobileLifecycleScope } from "../hooks/useMobileLifecycleScope";
import { championshipSession } from "../lib/championship-session";
import { colors, spacing } from "@/theme/tokens";

type Props = { championshipId: string; token?: string | null };
type PrizeType = "colocacao" | "mvp" | "outro";

const money = (value: any) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export function ChampionshipFinalizationPanel({
  championshipId,
  token,
}: Props) {
  const scope = useMobileLifecycleScope(championshipId);
  return <View><MobileLifecyclePanel championshipId={championshipId} />{scope.ready && scope.actor ? <FinalizationContent key={scope.key} championshipId={championshipId} scope={scope} /> : <Text>Entre para consultar as premiações.</Text>}</View>;
}

function FinalizationContent({championshipId,scope}:{championshipId:string;scope:ReturnType<typeof useMobileLifecycleScope>}) {
  const generation = useRef(0), mutation = useRef(false), dialog = useRef<object | null>(null);
  const current = () => { if (!scope.actor || !scope.isCurrent()) throw new Error('A conta ou o campeonato mudou. Atualize o painel.'); };
  const [structure, setStructure] = useState<any>(null);
  const [ranking, setRanking] = useState<any[]>([]);
  const [mvp, setMvp] = useState<any[]>([]);
  const [stageId, setStageId] = useState("");
  const [type, setType] = useState<PrizeType>("colocacao");
  const [position, setPosition] = useState("1");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const session = await championshipSession(scope.actor!); current();
      const [advanced, teams, players] = await Promise.all([
        mobileApi.championshipAdvancedStructure(championshipId, session.token),
        mobileApi.championshipFinalTeams(championshipId),
        mobileApi.championshipFinalMvp(championshipId),
      ]);
      await championshipSession(scope.actor!); current();
      if (request !== generation.current) return;
      setStructure(advanced);
      setRanking(Array.isArray(teams?.equipes) ? teams.equipes : []);
      setMvp(Array.isArray(players?.jogadores) ? players.jogadores : []);
      const stages = Array.isArray(advanced?.stages) ? advanced.stages : [];
      setStageId((current) =>
        current && stages.some((row: any) => String(row.id) === current)
          ? current
          : String(stages[stages.length - 1]?.id || ""),
      );
      setError("");
    } catch (err: any) {
      if (!scope.isCurrent() || request !== generation.current) return;
      setError(
        err?.message ||
          "Não foi possível carregar o encerramento do campeonato.",
      );
    } finally {
      if (scope.isCurrent() && request === generation.current) setLoading(false);
    }
  }, [championshipId, scope.key]);

  useEffect(() => {
    void load();
    return () => { generation.current++; };
  }, [load]);

  const prizes = useMemo(
    () =>
      Array.isArray(structure?.prizes)
        ? structure.prizes.filter(
            (row: any) => !stageId || String(row.etapa_id) === stageId,
          )
        : [],
    [structure, stageId],
  );

  async function action(body: Record<string, unknown>, message: string) {
    if (!scope.isCurrent() || mutation.current) return false;
    mutation.current = true;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const session = await championshipSession(scope.actor!); current();
      const response = await mobileApi.championshipAdvancedAction(
        championshipId,
        body,
        session.token,
      );
      await championshipSession(scope.actor!); current();
      setStructure(response);
      setFeedback(message);
      await load();
      return scope.isCurrent();
    } catch (err: any) {
      if (scope.isCurrent()) setError(err?.message || "Não foi possível concluir a ação. Confira o estado antes de repetir.");
      return false;
    } finally {
      mutation.current = false;
      if (scope.isCurrent()) setBusy(false);
    }
  }

  async function createPrize() {
    if (!stageId) {
      setError("Selecione uma etapa para registrar a premiação.");
      return;
    }
    if (
      type === "colocacao" &&
      (!Number.isInteger(Number(position)) || Number(position) < 1)
    ) {
      setError("Informe uma colocação válida.");
      return;
    }
    const confirmed = await action(
      {
        action: "create_prize",
        stage_id: stageId,
        prize_type: type,
        position: type === "colocacao" ? Number(position) : null,
        title: title.trim() || null,
        value: value === "" ? null : Number(value),
        description: description.trim() || null,
      },
      "Premiação registrada.",
    );
    if (confirmed && scope.isCurrent()) { setTitle(""); setValue(""); setDescription(""); }
  }

  function removePrize(id: string) {
    if (!scope.isCurrent() || busy) return;
    const confirmation = {}; dialog.current = confirmation;
    Alert.alert("Excluir premiação?", "Este item será removido da etapa.", [
      { text: "Cancelar", style: "cancel", onPress: () => { if (dialog.current === confirmation) dialog.current = null; } },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          if (dialog.current !== confirmation || !scope.isCurrent()) return;
          dialog.current = null;
          void action(
            {
              action: "delete",
              table: "campeonato_etapa_premiacoes",
              row_id: id,
            },
            "Premiação removida.",
          );
        },
      },
    ]);
  }
  return (
    <View style={styles.root}>
      {loading && !structure ? <ActivityIndicator color={colors.brand} /> : null}
      {error ? (
        <Text style={[styles.message, styles.error]}>{error}</Text>
      ) : null}
      {feedback ? <Text style={styles.message}>{feedback}</Text> : null}
      <Text style={styles.title}>CLASSIFICAÇÃO FINAL</Text>
      <View style={styles.list}>
        {ranking.slice(0, 12).map((row: any, index: number) => (
          <View
            key={row.campeonato_equipe_id || row.equipe_id || index}
            style={styles.rank}
          >
            <Text style={styles.place}>{row.colocacao || index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>
                {row.equipe_nome || row.line_nome || row.nome || "Equipe"}
              </Text>
              <Text style={styles.meta}>
                {row.booyahs || 0} BOOYAH · {row.abates || 0} KILLS
              </Text>
            </View>
            <Text style={styles.points}>
              {Number(row.pontos_total || 0)} PTS
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.title}>MVP</Text>
      <View style={styles.list}>
        {mvp.slice(0, 5).map((row: any, index: number) => (
          <View
            key={row.campeonato_jogador_id || row.jogador_id || index}
            style={styles.rank}
          >
            <Text style={styles.place}>{row.colocacao || index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{row.nick || "Jogador"}</Text>
              <Text style={styles.meta}>
                {row.abates || 0} K · {row.dano || 0} DMG ·{" "}
                {row.assistencias || 0} AST · {row.revives || 0} REV
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.title}>PREMIAÇÕES POR ETAPA</Text>
      <View style={styles.chips}>
        {(structure?.stages || []).map((stage: any) => (
          <TouchableOpacity
            key={stage.id}
            style={[
              styles.chip,
              stageId === String(stage.id) && styles.chipActive,
            ]}
            onPress={() => setStageId(String(stage.id))}
          >
            <Text
              style={[
                styles.chipText,
                stageId === String(stage.id) && styles.chipTextActive,
              ]}
            >
              {stage.nome}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {stageId ? (
        <View style={styles.form}>
          <View style={styles.chips}>
            {(["colocacao", "mvp", "outro"] as PrizeType[]).map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.chip, type === item && styles.chipActive]}
                onPress={() => setType(item)}
              >
                <Text
                  style={[
                    styles.chipText,
                    type === item && styles.chipTextActive,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {type === "colocacao" ? (
            <Field
              label="Posição"
              value={position}
              onChangeText={setPosition}
              numeric
            />
          ) : null}
          <Field label="Título" value={title} onChangeText={setTitle} />
          <Field label="Valor" value={value} onChangeText={setValue} numeric />
          <Field
            label="Descrição"
            value={description}
            onChangeText={setDescription}
          />
          <TouchableOpacity
            style={styles.primary}
            disabled={busy}
            onPress={() => void createPrize()}
          >
            {busy ? (
              <ActivityIndicator color={colors.onBrand} />
            ) : (
              <>
                <Ionicons
                  name="gift-outline"
                  size={17}
                  color={colors.onBrand}
                />
                <Text style={styles.primaryText}>Adicionar premiação</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.empty}>
          Cadastre uma edição/etapa na estrutura avançada para usar premiações
          detalhadas.
        </Text>
      )}
      <View style={styles.list}>
        {prizes.map((prize: any) => (
          <View key={prize.id} style={styles.prize}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>
                {prize.tipo === "colocacao"
                  ? `${prize.posicao}º lugar`
                  : String(prize.tipo || "prêmio").toUpperCase()}{" "}
                {prize.titulo ? `· ${prize.titulo}` : ""}
              </Text>
              <Text style={styles.meta}>
                {prize.valor != null
                  ? money(prize.valor)
                  : "Sem valor definido"}
                {prize.descricao ? ` · ${prize.descricao}` : ""}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.danger}
              accessibilityRole="button"
              accessibilityLabel={`Excluir premiação ${prize.titulo || prize.posicao || prize.id}`}
              onPress={() => removePrize(String(prize.id))}
            >
              <Ionicons name="trash-outline" size={16} color="#b42318" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  numeric = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  numeric?: boolean;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? "numeric" : "default"}
        style={styles.input}
        placeholderTextColor="#8a857e"
      />
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
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  eyebrow: {
    color: colors.brand,
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1,
  },
  statusTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  title: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  meta: { color: colors.muted, fontSize: 8, fontWeight: "700" },
  list: { gap: 6 },
  rank: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  place: { width: 30, color: colors.brand, fontSize: 18, fontWeight: "900" },
  rowTitle: {
    color: colors.ink,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  points: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 8,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 6,
  },
  chipActive: { backgroundColor: colors.brand },
  chipText: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  chipTextActive: { color: colors.onBrand },
  form: {
    gap: 7,
    padding: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
  },
  label: {
    marginBottom: 4,
    color: colors.ink,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  input: {
    minHeight: 38,
    paddingHorizontal: 8,
    color: colors.ink,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    fontWeight: "800",
  },
  primary: {
    minHeight: 40,
    borderRadius: 8,
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
  secondary: {
    minHeight: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  secondaryText: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  prize: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  danger: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(224, 122, 122, .12)",
    borderRadius: 6,
  },
  empty: {
    padding: 12,
    color: colors.muted,
    fontSize: 8,
    textAlign: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  finalBox: {
    gap: 7,
    padding: 10,
    backgroundColor: colors.brandDark,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  finalTitle: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  note: { color: colors.muted, fontSize: 8, lineHeight: 12 },
});
