import { useCallback, useEffect, useMemo, useState } from "react";
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
import { colors, spacing } from "@/theme/tokens";

type Props = {
  championshipId: string;
  phases: any[];
  groups: any[];
  token?: string | null;
  onChanged?: () => void | Promise<void>;
};

type RoundStatus =
  "rascunho" | "agendada" | "em_andamento" | "finalizada" | "cancelada";

const roundStatuses: RoundStatus[] = [
  "rascunho",
  "agendada",
  "em_andamento",
  "finalizada",
  "cancelada",
];

export function ChampionshipGamesPanel({
  championshipId,
  phases,
  groups,
  token,
  onChanged,
}: Props) {
  const [rounds, setRounds] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [maps, setMaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [roundNumber, setRoundNumber] = useState("1");
  const [roundName, setRoundName] = useState("");
  const [roundStart, setRoundStart] = useState("");
  const [roundEnd, setRoundEnd] = useState("");
  const [editingRoundId, setEditingRoundId] = useState("");
  const [gameName, setGameName] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [gameTime, setGameTime] = useState("");
  const [gameMatches, setGameMatches] = useState("4");
  const [gameRoundId, setGameRoundId] = useState("");
  const [gameGroupIds, setGameGroupIds] = useState<string[]>([]);
  const [gameMapCodes, setGameMapCodes] = useState<string[]>([]);
  const [gameType, setGameType] = useState<"normal" | "final">("normal");
  const [finalDay, setFinalDay] = useState("1");
  const [definesChampion, setDefinesChampion] = useState(false);
  const [finalDecisionMode, setFinalDecisionMode] = useState<
    "pontuacao_normal" | "booyah_ouro"
  >("pontuacao_normal");
  const [finalPointsLimit, setFinalPointsLimit] = useState("");
  const [finalAccumulationMode, setFinalAccumulationMode] = useState<
    "acumulado" | "bonus_por_ranking"
  >("acumulado");
  const [finalDecisiveGameId, setFinalDecisiveGameId] = useState("");
  const [finalBonusRanking, setFinalBonusRanking] = useState<
    Array<{ posicao: number; pontos_bonus: string }>
  >([{ posicao: 1, pontos_bonus: "" }]);
  const [editingGameId, setEditingGameId] = useState("");
  const [expandedGameId, setExpandedGameId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roundResponse, gameResponse, mapResponse] = await Promise.all([
        mobileApi.championshipRounds(championshipId, null, token),
        mobileApi.championshipGames(championshipId, token),
        mobileApi.mapCatalog(),
      ]);
      setRounds(
        Array.isArray(roundResponse?.rodadas) ? roundResponse.rodadas : [],
      );
      setGames(Array.isArray(gameResponse?.jogos) ? gameResponse.jogos : []);
      setMaps(Array.isArray(mapResponse?.mapas) ? mapResponse.mapas : []);
      setPhaseId((current) => current || String(phases?.[0]?.id || ""));
      setError("");
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar rodadas e jogos.");
    } finally {
      setLoading(false);
    }
  }, [championshipId, phases, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const phaseGroups = useMemo(
    () =>
      groups.filter((group: any) => String(group?.fase_id || "") === phaseId),
    [groups, phaseId],
  );
  const phaseRounds = useMemo(
    () =>
      rounds.filter((round: any) => String(round?.fase_id || "") === phaseId),
    [rounds, phaseId],
  );
  const selectedGame = useMemo(
    () => games.find((game: any) => String(game.id) === editingGameId) || null,
    [games, editingGameId],
  );
  const selectedPhase = useMemo(
    () =>
      phases.find((phase: any) => String(phase?.id || "") === phaseId) || null,
    [phases, phaseId],
  );
  const isFinalPhase = String(selectedPhase?.tipo || "") === "grande_final";

  useEffect(() => {
    if (!phaseId) return;
    setRoundNumber(
      String(
        Math.max(
          0,
          ...phaseRounds.map((round: any) => Number(round.numero || 0)),
        ) + 1,
      ),
    );
    setGameRoundId((current) =>
      phaseRounds.some((round: any) => String(round.id) === current)
        ? current
        : "",
    );
    setGameGroupIds((current) =>
      current.filter((id) =>
        phaseGroups.some((group: any) => String(group.id) === id),
      ),
    );
    const finalPhase =
      String(
        phases.find((phase: any) => String(phase?.id || "") === phaseId)
          ?.tipo || "",
      ) === "grande_final";
    setGameType(finalPhase ? "final" : "normal");
    if (!finalPhase) {
      setFinalDay("1");
      setDefinesChampion(false);
    }
  }, [phaseId, phaseRounds, phaseGroups, phases]);

  useEffect(() => {
    if (!isFinalPhase || !phaseId) return;
    let active = true;
    void mobileApi
      .championshipPhaseGameConfig(championshipId, phaseId, token)
      .then((result: any) => {
        if (!active) return;
        const config = result?.configuracao || {};
        setFinalDecisionMode(
          config.modo_decisao === "booyah_ouro"
            ? "booyah_ouro"
            : "pontuacao_normal",
        );
        setFinalPointsLimit(
          config.booyah_ouro_pontos_limite == null
            ? ""
            : String(config.booyah_ouro_pontos_limite),
        );
        setFinalAccumulationMode(
          config.modo_acumulacao === "bonus_por_ranking"
            ? "bonus_por_ranking"
            : "acumulado",
        );
        setFinalDecisiveGameId(String(config.jogo_decisivo_id || ""));
        setFinalBonusRanking(
          Array.isArray(config.bonus_ranking) && config.bonus_ranking.length
            ? config.bonus_ranking.map((item: any) => ({
                posicao: Number(item.posicao),
                pontos_bonus: String(item.pontos_bonus ?? ""),
              }))
            : [{ posicao: 1, pontos_bonus: "" }],
        );
      })
      .catch((err: any) => {
        if (active)
          setError(
            err?.message ||
              "Não foi possível carregar a regra da Grande Final.",
          );
      });
    return () => {
      active = false;
    };
  }, [championshipId, isFinalPhase, phaseId, token]);

  useEffect(() => {
    const amount = Math.max(1, Number(gameMatches || 1));
    const fallback = maps[0]?.codigo ? String(maps[0].codigo) : "";
    setGameMapCodes((current) =>
      Array.from({ length: amount }, (_, index) => current[index] || fallback),
    );
  }, [gameMatches, maps]);

  async function refresh(message?: string) {
    if (message) setFeedback(message);
    await load();
    await onChanged?.();
  }

  async function saveRound() {
    if (!phaseId || !roundNumber) return;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const body = {
        fase_id: phaseId,
        numero: Number(roundNumber),
        nome: roundName.trim() || null,
        data_inicio: roundStart || null,
        data_fim: roundEnd || null,
      };
      if (editingRoundId)
        await mobileApi.updateChampionshipRound(
          championshipId,
          editingRoundId,
          body,
          token,
        );
      else await mobileApi.createChampionshipRound(championshipId, body, token);
      resetRoundForm();
      await refresh(editingRoundId ? "Rodada atualizada." : "Rodada criada.");
    } catch (err: any) {
      setError(err?.message || "Não foi possível salvar a rodada.");
    } finally {
      setBusy(false);
    }
  }

  function editRound(round: any) {
    setEditingRoundId(String(round.id));
    setPhaseId(String(round.fase_id || ""));
    setRoundNumber(String(round.numero || 1));
    setRoundName(String(round.nome || ""));
    setRoundStart(String(round.data_inicio || ""));
    setRoundEnd(String(round.data_fim || ""));
  }

  function resetRoundForm() {
    setEditingRoundId("");
    setRoundName("");
    setRoundStart("");
    setRoundEnd("");
  }

  async function changeRoundStatus(round: any, status: RoundStatus) {
    setBusy(true);
    setError("");
    try {
      await mobileApi.updateChampionshipRound(
        championshipId,
        String(round.id),
        { status },
        token,
      );
      await refresh(`Rodada marcada como ${status.replace("_", " ")}.`);
    } catch (err: any) {
      setError(err?.message || "Não foi possível atualizar a rodada.");
    } finally {
      setBusy(false);
    }
  }

  function deleteRound(round: any) {
    Alert.alert("Excluir rodada?", round.nome || `Rodada ${round.numero}`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => void executeDeleteRound(round),
      },
    ]);
  }

  async function executeDeleteRound(round: any) {
    setBusy(true);
    setError("");
    try {
      await mobileApi.deleteChampionshipRound(
        championshipId,
        String(round.id),
        token,
      );
      await refresh("Rodada excluída.");
    } catch (err: any) {
      setError(err?.message || "Não foi possível excluir a rodada.");
    } finally {
      setBusy(false);
    }
  }

  function toggleGroup(id: string) {
    setGameGroupIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function setMap(index: number, code: string) {
    setGameMapCodes((current) =>
      current.map((value, i) => (i === index ? code : value)),
    );
  }

  function buildGameBody() {
    return {
      nome: gameName.trim(),
      fase_id: phaseId,
      rodada_id: gameRoundId || null,
      data_jogo: gameDate || null,
      horario: gameTime || null,
      numero_partidas: Number(gameMatches || 1),
      quedas: gameMapCodes.map((mapa_codigo, index) => ({
        numero: index + 1,
        mapa_codigo,
      })),
      grupos_ids: gameGroupIds,
      tipo_jogo: isFinalPhase ? "final" : gameType,
      dia_final:
        isFinalPhase || gameType === "final" ? Number(finalDay || 1) : null,
      define_campeao:
        isFinalPhase || gameType === "final" ? definesChampion : false,
      status: selectedGame?.status || "agendado",
    };
  }

  async function saveGame() {
    if (
      !phaseId ||
      !gameName.trim() ||
      !gameGroupIds.length ||
      gameMapCodes.some((code) => !code)
    ) {
      setError("Informe nome, fase, grupo e um mapa para cada queda.");
      return;
    }
    if (
      isFinalPhase &&
      finalDecisionMode === "booyah_ouro" &&
      (!Number(finalPointsLimit) || Number(finalPointsLimit) <= 0)
    ) {
      setError("Informe a pontuação mínima para ativar o Champion Point.");
      return;
    }
    if (
      isFinalPhase &&
      finalAccumulationMode === "bonus_por_ranking" &&
      !finalDecisiveGameId
    ) {
      setError("Selecione o jogo decisivo do Point Rush.");
      return;
    }
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      if (isFinalPhase)
        await mobileApi.updateChampionshipPhaseGameConfig(
          championshipId,
          phaseId,
          {
            modo_decisao: finalDecisionMode,
            modo_acumulacao: finalAccumulationMode,
            booyah_ouro_pontos_limite:
              finalDecisionMode === "booyah_ouro"
                ? Number(finalPointsLimit)
                : null,
            booyah_ouro_queda_minima: null,
            booyah_ouro_desempate_final: "maior_pontuacao",
            jogo_decisivo_id:
              finalAccumulationMode === "bonus_por_ranking"
                ? finalDecisiveGameId
                : null,
            bonus_ranking:
              finalAccumulationMode === "bonus_por_ranking"
                ? finalBonusRanking
                    .filter((item) => item.pontos_bonus !== "")
                    .map((item) => ({
                      posicao: item.posicao,
                      pontos_bonus: Number(item.pontos_bonus),
                    }))
                : [],
          },
          token,
        );
      if (editingGameId)
        await mobileApi.updateChampionshipGame(
          championshipId,
          editingGameId,
          buildGameBody(),
          token,
        );
      else
        await mobileApi.createChampionshipGame(
          championshipId,
          buildGameBody(),
          token,
        );
      resetGameForm();
      await refresh(
        editingGameId ? "Jogo atualizado." : "Jogo criado com quedas e mapas.",
      );
    } catch (err: any) {
      setError(err?.message || "Não foi possível salvar o jogo.");
    } finally {
      setBusy(false);
    }
  }

  async function applyPointRushBonus() {
    if (
      !phaseId ||
      finalAccumulationMode !== "bonus_por_ranking" ||
      !finalDecisiveGameId
    ) {
      setError("Configure e selecione o jogo decisivo do Point Rush.");
      return;
    }
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      await mobileApi.updateChampionshipPhaseGameConfig(
        championshipId,
        phaseId,
        {
          modo_decisao: finalDecisionMode,
          modo_acumulacao: finalAccumulationMode,
          booyah_ouro_pontos_limite:
            finalDecisionMode === "booyah_ouro"
              ? Number(finalPointsLimit)
              : null,
          booyah_ouro_queda_minima: null,
          booyah_ouro_desempate_final: "maior_pontuacao",
          jogo_decisivo_id: finalDecisiveGameId,
          bonus_ranking: finalBonusRanking
            .filter((item) => item.pontos_bonus !== "")
            .map((item) => ({
              posicao: item.posicao,
              pontos_bonus: Number(item.pontos_bonus),
            })),
        },
        token,
      );
      const result = await mobileApi.applyChampionshipPointRushBonus(
        championshipId,
        phaseId,
        token,
      );
      setFeedback(
        `Bônus do Point Rush aplicado a ${Number(result?.total || 0)} equipe(s).`,
      );
      await load();
    } catch (err: any) {
      setError(
        err?.message || "Não foi possível aplicar os bônus do Point Rush.",
      );
    } finally {
      setBusy(false);
    }
  }

  function editGame(game: any) {
    setEditingGameId(String(game.id));
    setPhaseId(String(game.fase_id || ""));
    setGameName(String(game.nome || ""));
    setGameDate(String(game.data_jogo || ""));
    setGameTime(String(game.horario || ""));
    setGameMatches(String(game.numero_partidas || game.quedas?.length || 1));
    setGameRoundId(String(game.rodada_id || ""));
    setGameGroupIds(
      (game.grupos || [])
        .map((item: any) =>
          String(item.grupo_id || item.campeonato_grupos?.id || ""),
        )
        .filter(Boolean),
    );
    setGameMapCodes(
      (game.quedas || [])
        .map((queda: any) => String(queda.mapa_codigo || ""))
        .filter(Boolean),
    );
    setGameType(String(game.tipo_jogo || "") === "final" ? "final" : "normal");
    setFinalDay(String(game.dia_final || 1));
    setDefinesChampion(Boolean(game.define_campeao));
  }

  function resetGameForm() {
    setEditingGameId("");
    setGameName("");
    setGameDate("");
    setGameTime("");
    setGameMatches("4");
    setGameRoundId("");
    setGameGroupIds([]);
    setGameMapCodes([]);
    setGameType(isFinalPhase ? "final" : "normal");
    setFinalDay("1");
    setDefinesChampion(false);
  }

  function deleteGame(game: any) {
    Alert.alert("Excluir jogo?", game.nome, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => void executeDeleteGame(game),
      },
    ]);
  }

  async function executeDeleteGame(game: any) {
    setBusy(true);
    setError("");
    try {
      await mobileApi.deleteChampionshipGame(
        championshipId,
        String(game.id),
        token,
      );
      await refresh("Jogo excluído.");
    } catch (err: any) {
      setError(err?.message || "Não foi possível excluir o jogo.");
    } finally {
      setBusy(false);
    }
  }

  async function updateFallMap(game: any, fall: any, code: string) {
    setBusy(true);
    setError("");
    try {
      await mobileApi.updateChampionshipFallMap(
        championshipId,
        String(game.id),
        String(fall.id),
        code,
        token,
      );
      await refresh("Mapa da queda atualizado.");
    } catch (err: any) {
      setError(err?.message || "Não foi possível alterar o mapa da queda.");
    } finally {
      setBusy(false);
    }
  }

  if (loading)
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

      <Text style={styles.title}>FASE OPERACIONAL</Text>
      <View style={styles.chips}>
        {phases.map((phase: any) => (
          <TouchableOpacity
            key={phase.id}
            style={[
              styles.chip,
              phaseId === String(phase.id) && styles.chipActive,
            ]}
            onPress={() => setPhaseId(String(phase.id))}
          >
            <Text
              style={[
                styles.chipText,
                phaseId === String(phase.id) && styles.chipTextActive,
              ]}
            >
              {phase.nome}
              {String(phase.tipo || "") === "grande_final"
                ? " · Grande Final"
                : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.title}>RODADAS</Text>
      <View style={styles.form}>
        <View style={styles.columns}>
          <Field
            label="Número"
            value={roundNumber}
            onChangeText={setRoundNumber}
          />
          <Field label="Nome" value={roundName} onChangeText={setRoundName} />
        </View>
        <View style={styles.columns}>
          <Field
            label="Início (AAAA-MM-DD)"
            value={roundStart}
            onChangeText={setRoundStart}
          />
          <Field
            label="Fim (AAAA-MM-DD)"
            value={roundEnd}
            onChangeText={setRoundEnd}
          />
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            disabled={busy || !phaseId}
            style={styles.primary}
            onPress={() => void saveRound()}
          >
            <Text style={styles.primaryText}>
              {editingRoundId ? "Salvar rodada" : "Criar rodada"}
            </Text>
          </TouchableOpacity>
          {editingRoundId ? (
            <TouchableOpacity style={styles.secondary} onPress={resetRoundForm}>
              <Text style={styles.secondaryText}>Cancelar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <View style={styles.list}>
        {phaseRounds.map((round: any) => (
          <View key={round.id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>
                  {round.nome || `Rodada ${round.numero}`}
                </Text>
                <Text style={styles.meta}>
                  #{round.numero} · {round.status || "rascunho"}
                  {round.data_inicio ? ` · ${round.data_inicio}` : ""}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.icon}
                onPress={() => editRound(round)}
              >
                <Ionicons name="create-outline" size={17} color={colors.ink} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.icon}
                onPress={() => deleteRound(round)}
              >
                <Ionicons name="trash-outline" size={17} color="#b42318" />
              </TouchableOpacity>
            </View>
            <View style={styles.statuses}>
              {roundStatuses.map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusChip,
                    round.status === status && styles.statusChipActive,
                  ]}
                  onPress={() => void changeRoundStatus(round, status)}
                >
                  <Text
                    style={[
                      styles.statusText,
                      round.status === status && styles.statusTextActive,
                    ]}
                  >
                    {status.replace("_", " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.title}>
        {editingGameId ? "EDITAR JOGO" : "NOVO JOGO"}
      </Text>
      <View style={styles.form}>
        <Field label="Nome" value={gameName} onChangeText={setGameName} />
        <View style={styles.columns}>
          <Field
            label="Data (AAAA-MM-DD)"
            value={gameDate}
            onChangeText={setGameDate}
          />
          <Field label="Horário" value={gameTime} onChangeText={setGameTime} />
        </View>
        <Field
          label="Quantidade de quedas"
          value={gameMatches}
          onChangeText={setGameMatches}
        />
        {isFinalPhase ? (
          <View style={styles.finalPanel}>
            <Text style={styles.finalPanelTitle}>GRANDE FINAL</Text>
            <Text style={styles.meta}>
              A final pode somar todos os dias ou usar Point Rush, em que os
              dias anteriores geram bônus por colocação para o jogo decisivo.
            </Text>
            <View style={styles.columns}>
              <Field
                label="Dia da final"
                value={finalDay}
                onChangeText={setFinalDay}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>FORMATO MULTI-DIA</Text>
                <View style={styles.chips}>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      finalAccumulationMode === "acumulado" &&
                        styles.chipActive,
                    ]}
                    onPress={() => setFinalAccumulationMode("acumulado")}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        finalAccumulationMode === "acumulado" &&
                          styles.chipTextActive,
                      ]}
                    >
                      Acumulada
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      finalAccumulationMode === "bonus_por_ranking" &&
                        styles.chipActive,
                    ]}
                    onPress={() =>
                      setFinalAccumulationMode("bonus_por_ranking")
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        finalAccumulationMode === "bonus_por_ranking" &&
                          styles.chipTextActive,
                      ]}
                    >
                      Point Rush
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <Text style={styles.label}>CRITÉRIO DO CAMPEÃO</Text>
            <View style={styles.chips}>
              <TouchableOpacity
                style={[
                  styles.chip,
                  finalDecisionMode === "pontuacao_normal" && styles.chipActive,
                ]}
                onPress={() => setFinalDecisionMode("pontuacao_normal")}
              >
                <Text
                  style={[
                    styles.chipText,
                    finalDecisionMode === "pontuacao_normal" &&
                      styles.chipTextActive,
                  ]}
                >
                  Pontuação
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.chip,
                  finalDecisionMode === "booyah_ouro" && styles.chipActive,
                ]}
                onPress={() => setFinalDecisionMode("booyah_ouro")}
              >
                <Text
                  style={[
                    styles.chipText,
                    finalDecisionMode === "booyah_ouro" &&
                      styles.chipTextActive,
                  ]}
                >
                  Champion Point
                </Text>
              </TouchableOpacity>
            </View>
            {finalDecisionMode === "booyah_ouro" ? (
              <>
                <Field
                  label="Pontuação mínima para ativar"
                  value={finalPointsLimit}
                  onChangeText={setFinalPointsLimit}
                />
                <Text style={styles.meta}>
                  Ao atingir a meta, a equipe fica elegível. BOOYAH posterior
                  fecha o título; se ninguém fechar até a última queda, vence a
                  maior pontuação.
                </Text>
              </>
            ) : null}
            {finalAccumulationMode === "bonus_por_ranking" ? (
              <>
                <Text style={styles.label}>JOGO DECISIVO</Text>
                <View style={styles.chips}>
                  {games
                    .filter(
                      (item: any) => String(item.fase_id || "") === phaseId,
                    )
                    .map((item: any) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.chip,
                          finalDecisiveGameId === String(item.id) &&
                            styles.chipActive,
                        ]}
                        onPress={() => setFinalDecisiveGameId(String(item.id))}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            finalDecisiveGameId === String(item.id) &&
                              styles.chipTextActive,
                          ]}
                        >
                          {item.nome} · D{item.dia_final || 1}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
                <Text style={styles.label}>BÔNUS POR COLOCAÇÃO</Text>
                {finalBonusRanking.map((item, index) => (
                  <View key={`${item.posicao}-${index}`} style={styles.columns}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>TOP {item.posicao}</Text>
                      <TextInput
                        style={styles.input}
                        value={item.pontos_bonus}
                        onChangeText={(value) =>
                          setFinalBonusRanking((current) =>
                            current.map((row, rowIndex) =>
                              rowIndex === index
                                ? { ...row, pontos_bonus: value }
                                : row,
                            ),
                          )
                        }
                        placeholder="Pontos"
                        placeholderTextColor="#8a857e"
                        keyboardType="numeric"
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.secondary}
                      onPress={() =>
                        setFinalBonusRanking((current) =>
                          current
                            .filter((_, rowIndex) => rowIndex !== index)
                            .map((row, rowIndex) => ({
                              ...row,
                              posicao: rowIndex + 1,
                            })),
                        )
                      }
                    >
                      <Text style={styles.secondaryText}>Remover</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.secondary}
                    onPress={() =>
                      setFinalBonusRanking((current) => [
                        ...current,
                        { posicao: current.length + 1, pontos_bonus: "" },
                      ])
                    }
                  >
                    <Text style={styles.secondaryText}>Adicionar top</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={busy}
                    style={styles.primary}
                    onPress={() => void applyPointRushBonus()}
                  >
                    <Text style={styles.primaryText}>Aplicar bônus</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        ) : null}
        <Text style={styles.label}>RODADA</Text>
        <View style={styles.chips}>
          <TouchableOpacity
            style={[styles.chip, !gameRoundId && styles.chipActive]}
            onPress={() => setGameRoundId("")}
          >
            <Text
              style={[styles.chipText, !gameRoundId && styles.chipTextActive]}
            >
              Sem rodada
            </Text>
          </TouchableOpacity>
          {phaseRounds.map((round: any) => (
            <TouchableOpacity
              key={round.id}
              style={[
                styles.chip,
                gameRoundId === String(round.id) && styles.chipActive,
              ]}
              onPress={() => setGameRoundId(String(round.id))}
            >
              <Text
                style={[
                  styles.chipText,
                  gameRoundId === String(round.id) && styles.chipTextActive,
                ]}
              >
                {round.nome || `R${round.numero}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>GRUPOS PARTICIPANTES</Text>
        <View style={styles.chips}>
          {phaseGroups.map((group: any) => {
            const active = gameGroupIds.includes(String(group.id));
            return (
              <TouchableOpacity
                key={group.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleGroup(String(group.id))}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {group.nome}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.label}>MAPA POR QUEDA</Text>
        {gameMapCodes.map((code, index) => (
          <View key={index} style={styles.mapRow}>
            <View style={styles.fallBadge}>
              <Text style={styles.fallText}>Q{index + 1}</Text>
            </View>
            <View style={styles.mapChips}>
              {maps.map((map: any) => {
                const active = code === String(map.codigo);
                return (
                  <TouchableOpacity
                    key={map.id || map.codigo}
                    style={[styles.mapChip, active && styles.mapChipActive]}
                    onPress={() => setMap(index, String(map.codigo))}
                  >
                    <Text
                      style={[styles.mapText, active && styles.mapTextActive]}
                    >
                      {map.nome}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
        <View style={styles.actions}>
          <TouchableOpacity
            disabled={busy}
            style={styles.primary}
            onPress={() => void saveGame()}
          >
            <Text style={styles.primaryText}>
              {editingGameId ? "Salvar jogo" : "Criar jogo"}
            </Text>
          </TouchableOpacity>
          {editingGameId ? (
            <TouchableOpacity style={styles.secondary} onPress={resetGameForm}>
              <Text style={styles.secondaryText}>Cancelar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <Text style={styles.title}>JOGOS E QUEDAS</Text>
      <View style={styles.list}>
        {games.map((game: any) => {
          const expanded = expandedGameId === String(game.id);
          return (
            <View key={game.id} style={styles.card}>
              <TouchableOpacity
                style={styles.cardHead}
                onPress={() =>
                  setExpandedGameId(expanded ? "" : String(game.id))
                }
              >
                <View style={styles.copy}>
                  <Text style={styles.rowTitle}>{game.nome}</Text>
                  <Text style={styles.meta}>
                    {[
                      game.tipo_jogo === "final"
                        ? `Grande Final · Dia ${game.dia_final || 1}${game.define_campeao ? " · decisivo" : ""}`
                        : null,
                      game.data_jogo,
                      game.horario,
                      `${game.numero_partidas || game.quedas?.length || 0} quedas`,
                      game.status,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <Ionicons
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={17}
                  color={colors.muted}
                />
              </TouchableOpacity>
              <View style={styles.actionsSmall}>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => editGame(game)}
                >
                  <Text style={styles.smallText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallButton, styles.dangerButton]}
                  onPress={() => deleteGame(game)}
                >
                  <Text style={[styles.smallText, styles.dangerText]}>
                    Excluir
                  </Text>
                </TouchableOpacity>
              </View>
              {expanded ? (
                <View style={styles.falls}>
                  {(game.quedas || []).map((fall: any) => (
                    <View key={fall.id} style={styles.fallRow}>
                      <View style={styles.fallBadge}>
                        <Text style={styles.fallText}>
                          Q{fall.numero_partida}
                        </Text>
                      </View>
                      <View style={styles.copy}>
                        <Text style={styles.rowTitle}>
                          {fall.mapa_nome || fall.mapa_codigo || "Mapa"}
                        </Text>
                        <Text style={styles.meta}>
                          {fall.status || "agendada"}
                          {fall.finalizada_em ? " · finalizada" : ""}
                        </Text>
                      </View>
                      {!fall.finalizada_em && fall.status !== "finalizada" ? (
                        <View style={styles.inlineMaps}>
                          {maps.map((map: any) =>
                            String(map.codigo) ===
                            String(fall.mapa_codigo) ? null : (
                              <TouchableOpacity
                                key={map.id || map.codigo}
                                style={styles.tinyMap}
                                onPress={() =>
                                  void updateFallMap(
                                    game,
                                    fall,
                                    String(map.codigo),
                                  )
                                }
                              >
                                <Text style={styles.tinyMapText}>
                                  {map.nome}
                                </Text>
                              </TouchableOpacity>
                            ),
                          )}
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      <Text style={styles.note}>
        Rodadas, jogos, grupos e mapas usam as APIs oficiais do campeonato. A
        Grande Final pode somar todos os dias ou usar Point Rush com bônus por
        colocação; Champion Point funciona nos dois formatos. Cada queda precisa
        de um mapa válido do catálogo.
      </Text>
    </View>
  );
}

function Field(props: any) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor="#8a857e"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginHorizontal: spacing.md, gap: 7 },
  loading: { minHeight: 72, alignItems: "center", justifyContent: "center" },
  message: {
    padding: 9,
    color: colors.success,
    backgroundColor: "rgba(101, 185, 130, .12)",
    borderRadius: 8,
    fontWeight: "800",
  },
  error: { color: colors.danger, backgroundColor: "rgba(224, 122, 122, .12)" },
  title: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 7,
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
    borderRadius: 10,
  },
  finalPanel: {
    gap: 7,
    padding: 9,
    backgroundColor: colors.surfaceRaised,
    borderLeftWidth: 3,
    borderLeftColor: colors.brand,
    borderRadius: 8,
  },
  finalPanelTitle: {
    color: colors.brand,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  columns: { flexDirection: "row", gap: 6 },
  label: {
    marginBottom: 5,
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  input: {
    minHeight: 40,
    paddingHorizontal: 10,
    color: colors.ink,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    fontWeight: "700",
  },
  actions: { flexDirection: "row", gap: 6 },
  primary: {
    minHeight: 40,
    borderRadius: 7,
    flex: 1,
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
  secondary: {
    minHeight: 40,
    borderRadius: 7,
    paddingHorizontal: 14,
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
  list: { gap: 6 },
  card: {
    padding: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  cardHead: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  copy: { flex: 1 },
  rowTitle: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  meta: { marginTop: 2, color: colors.muted, fontSize: 8, fontWeight: "700" },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  statuses: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 5 },
  statusChip: {
    paddingHorizontal: 7,
    paddingVertical: 6,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 6,
  },
  statusChipActive: { backgroundColor: colors.brand },
  statusText: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  statusTextActive: { color: colors.onBrand },
  mapRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  fallBadge: {
    width: 34,
    height: 34,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  fallText: { color: colors.onBrand, fontSize: 9, fontWeight: "900" },
  mapChips: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  mapChip: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 6,
  },
  mapChipActive: { backgroundColor: colors.brand },
  mapText: {
    color: colors.ink,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  mapTextActive: { color: colors.onBrand },
  actionsSmall: { flexDirection: "row", gap: 5, marginTop: 4 },
  smallButton: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 6,
  },
  smallText: {
    color: colors.ink,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  dangerButton: { backgroundColor: "rgba(224, 122, 122, .12)" },
  dangerText: { color: colors.danger },
  falls: {
    gap: 5,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  fallRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  inlineMaps: {
    maxWidth: "45%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 3,
  },
  tinyMap: {
    paddingHorizontal: 5,
    paddingVertical: 5,
    backgroundColor: colors.surfaceRaised,
  },
  tinyMapText: { color: colors.ink, fontSize: 6.5, fontWeight: "900" },
  note: {
    padding: 9,
    color: colors.muted,
    fontSize: 8,
    lineHeight: 12,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 8,
  },
});
