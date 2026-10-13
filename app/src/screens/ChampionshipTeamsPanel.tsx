import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { mobileApi } from "@/lib/api";
import { usePagedDirectory } from "@/hooks/usePagedDirectory";
import { DirectoryStatus } from "@/components/DirectoryStatus";
import { readPendingMobileSlotTransfer, type SlotTransferAttempt, type SlotTransferIntent } from "@/lib/slot-transfer-attempt";
import { discardMobileChampionshipAttempt } from "@/lib/championship-discard";
import { slotMovementBoardExpected } from "../../../backend/src/campeonatos/slot-movement-contract";
import { colors, spacing } from "@/theme/tokens";
import { participationAttempts, writeMobileParticipation, type ParticipationAttempt, type ParticipationIntent } from "@/lib/participation-write";

type Props = {
  championshipId: string;
  token?: string | null;
  actorId?: string;
  onChanged?: () => void | Promise<void>;
};

export function ChampionshipTeamsPanel({
  championshipId,
  token,
  actorId,
  onChanged,
}: Props) {
  const resourceIdentity = JSON.stringify([championshipId, actorId]);
  const resourceRevision = useRef({identity:resourceIdentity,revision:0});
  if (resourceRevision.current.identity !== resourceIdentity) resourceRevision.current = {identity:resourceIdentity,revision:resourceRevision.current.revision+1};
  const resourceScope = JSON.stringify([resourceIdentity,resourceRevision.current.revision]);
  const tokenRef = useRef(token); tokenRef.current = token;
  const currentResource = useRef(resourceScope);
  currentResource.current = resourceScope;
  const loadGeneration = useRef(0);
  const moveLock = useRef<{scope:string} | null>(null);
  const [pendingMove, setPendingMove] = useState<SlotTransferAttempt | null>(null);
  const [pendingParticipation, setPendingParticipation] = useState<ParticipationAttempt | null>(null);
  const [snapshot, setSnapshot] = useState<{ scope: string; data: any } | null>(null);
  const data = snapshot?.scope === resourceScope ? snapshot.data : null;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [groupId, setGroupId] = useState("");
  const [sourceSlotId, setSourceSlotId] = useState("");
  const [targetAddSlotId, setTargetAddSlotId] = useState("");
  const [query, setQuery] = useState("");
  const searchPage = usePagedDirectory<any>(`/api/campeonatos/${encodeURIComponent(championshipId)}/equipes/busca`, query, {
    enabled: Boolean(targetAddSlotId) && query.trim().length >= 2 && Boolean(data), authenticated: true, accessToken: token, itemsKey: "equipes", limit: 30, scopeKey: targetAddSlotId,
  });
  const results = searchPage.items;
  const [reviewRequestId, setReviewRequestId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [entryOrigin, setEntryOrigin] = useState("");

  const load = useCallback(async () => {
    if (currentResource.current !== resourceScope) return;
    const generation = ++loadGeneration.current;
    setLoading(true);
    try {
      const response = await mobileApi.championshipAdminTeams(
        championshipId,
        tokenRef.current,
      );
      if (generation !== loadGeneration.current || currentResource.current !== resourceScope) return;
      setSnapshot({ scope: resourceScope, data: response });
      setError("");
      const groups = collectGroups(response?.vagas || []);
      setGroupId((current) => current || String(groups[0]?.id || ""));
    } catch (err: any) {
      if (generation !== loadGeneration.current || currentResource.current !== resourceScope) return;
      setError(err?.message || "Não foi possível carregar equipes e slots.");
    } finally {
      if (generation === loadGeneration.current && currentResource.current === resourceScope) setLoading(false);
    }
  }, [championshipId, resourceScope]);

  useEffect(() => {
    currentResource.current = resourceScope;
    setBusy(false);setPendingMove(null);setPendingParticipation(null);
    setGroupId(""); setSourceSlotId(""); setTargetAddSlotId(""); setQuery(""); setReviewRequestId(""); setRejectReason(""); setError(""); setFeedback("");
    if (actorId) void readPendingMobileSlotTransfer(actorId,championshipId).then(attempt => {
      if (currentResource.current === resourceScope) setPendingMove(attempt);
    }).catch(err => { if (currentResource.current === resourceScope) setError(err.message); });
    if (actorId) void participationAttempts.read(actorId,championshipId).then(attempt => {
      if (currentResource.current === resourceScope) setPendingParticipation(attempt);
    }).catch(err => { if (currentResource.current === resourceScope) setError(err.message); });
    void load();
    return () => { loadGeneration.current++; currentResource.current = ''; };
  }, [load,actorId,championshipId,resourceScope]);

  const slots = useMemo(
    () => (Array.isArray(data?.vagas) ? data.vagas : []),
    [data],
  );
  const groups = useMemo(() => collectGroups(slots), [slots]);
  const visibleSlots = useMemo(
    () =>
      groupId
        ? slots.filter((slot: any) => String(slot.grupo_id || "") === groupId)
        : slots,
    [slots, groupId],
  );
  const source = useMemo(
    () => slots.find((slot: any) => String(slot.id) === sourceSlotId) || null,
    [slots, sourceSlotId],
  );
  const requests = useMemo(
    () => (Array.isArray(data?.solicitacoes) ? data.solicitacoes : []),
    [data],
  );
  const pendingRequests = useMemo(
    () => requests.filter((item: any) => item.status === "pendente"),
    [requests],
  );
  const reviewRequest = useMemo(
    () =>
      requests.find((item: any) => String(item.id) === reviewRequestId) || null,
    [requests, reviewRequestId],
  );
  const leagueOrigins = useMemo(() => {
    const group = groups.find((item: any) => String(item.id) === groupId);
    const division = data?.liga?.divisoes?.find((item: any) => String(item.nome || "").trim().toLowerCase() === String(group?.nome || "").trim().toLowerCase());
    return [...new Set<string>((division?.entradas || []).filter((item: any) => Number(item.quantidade) > 0).map((item: any) => String(item.tipo)))];
  }, [data,groups,groupId]);
  useEffect(() => { setEntryOrigin(""); }, [groupId,targetAddSlotId,reviewRequestId,resourceScope]);

  async function refreshAll(message?: string) {
    if (currentResource.current !== resourceScope) return;
    if (message) setFeedback(message);
    setSourceSlotId("");
    setTargetAddSlotId("");
    setQuery("");
    setReviewRequestId("");
    setRejectReason("");
    await load();
    if (currentResource.current !== resourceScope) return;
    await onChanged?.();
  }

  async function approveRequest(target: any) {
    if (!reviewRequest || isOccupied(target) || isReserved(target)) return;
    if (data?.liga && !entryOrigin) { setError("Selecione a origem da vaga da Liga antes de aprovar.");return; }
    await executeParticipation("PATCH", { mode: "review_request", participacao_id: reviewRequest.id, action: "approve",
      slot_id: target.id, origem_entrada: entryOrigin || undefined, expected: reviewRequest.participation_expected }, undefined, "Inscrição aprovada.");
  }

  async function rejectRequest(item: any) {
    await executeParticipation("PATCH", { mode: "review_request", participacao_id: item.id, action: "reject",
      motivo: rejectReason.trim() || undefined, expected: item.participation_expected }, undefined, "Inscrição rejeitada.");
  }

  async function executeParticipation(method: ParticipationIntent['method'], body: Record<string, unknown>, removalId?: string, message = "Inscrição confirmada.") {
    if (!data || currentResource.current !== resourceScope || moveLock.current?.scope === resourceScope) return;
    const operation = { scope: resourceScope }; moveLock.current = operation;
    setBusy(true);setError("");setFeedback("");
    try {
      const result = await writeMobileParticipation(championshipId,data,method,body,token,actorId,removalId);
      if (currentResource.current !== resourceScope) return;
      const remaining = actorId ? await participationAttempts.read(actorId,championshipId) : null;
      if (currentResource.current !== resourceScope) return;
      setPendingParticipation(remaining);
      await refreshAll(result?.mensagem || message);
    } catch (err: any) {
      if (currentResource.current === resourceScope) {
        setError(err?.message || "Não foi possível confirmar a inscrição.");
        if (actorId) try {
          const attempt = await participationAttempts.read(actorId,championshipId);
          if (currentResource.current === resourceScope) setPendingParticipation(attempt);
        } catch { /* Retain the error if storage cannot be read. */ }
      }
    } finally {
      if (moveLock.current === operation) moveLock.current = null;
      if (currentResource.current === resourceScope) setBusy(false);
    }
  }

  async function moveOrSwap(target: any) {
    if (!source || String(source.id) === String(target.id) || isReserved(target)) return;
    if (data?.slot_movement_mode === 'atomic') try {
      slotMovementBoardExpected([source, ...(isOccupied(target) ? [target] : [])].map(slot => ({...slot, participacao_id:slot.campeonato_equipe?.id || slot.participacao_id})));
    } catch (err: any) { setError(err?.message || "Atualize os slots antes de confirmar.");return; }
    const targetOccupied = Boolean(
      target.line_id || target.equipe_id || target.campeonato_equipe,
    );
    const mode = targetOccupied ? "swap" : "move";
    Alert.alert(
      targetOccupied ? "Trocar posições?" : "Mover line?",
      `${source.line_nome || source.equipe_nome || "Line"} → ${target.grupo?.nome || "Grupo"} / slot ${slotLabel(target)}`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: targetOccupied ? "Trocar" : "Mover",
          onPress: () => void executeMove({
            source_slot_id: String(source.id),target_slot_id: String(target.id),mode,
            source_participation_id: String(source.campeonato_equipe?.id || source.participacao_id || ""),
            target_participation_id: mode === "swap" ? String(target.campeonato_equipe?.id || target.participacao_id || "") : null,
          }),
        },
      ],
    );
  }

  async function executeMove(
    intent: SlotTransferIntent,
  ) {
    if (currentResource.current !== resourceScope || moveLock.current?.scope === resourceScope) return;
    if (!data) return;
    const operation = {scope:resourceScope}; moveLock.current = operation;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const result = await mobileApi.moveChampionshipSlot(
        championshipId,
        intent,
        data,
        token,
        actorId,
      );
      if (currentResource.current !== resourceScope) return;
      const remaining = actorId ? await readPendingMobileSlotTransfer(actorId,championshipId) : null;
      if (currentResource.current !== resourceScope) return;
      setPendingMove(remaining);
      await refreshAll(
        result?.mensagem ||
          (intent.mode === "swap" ? "Posições trocadas." : "Line movida."),
      );
    } catch (err: any) {
      if (currentResource.current === resourceScope) {
        setError(err?.message || "Não foi possível reorganizar os slots.");
        if (actorId) try {
          const attempt = await readPendingMobileSlotTransfer(actorId,championshipId);
          if (currentResource.current === resourceScope) setPendingMove(attempt);
        } catch { /* Keep the error and fail closed if storage is unavailable. */ }
      }
    } finally {
      if (moveLock.current === operation) moveLock.current = null;
      if (currentResource.current === resourceScope) setBusy(false);
    }
  }

  async function discardAttempt(family: 'participation' | 'movement', attempt: ParticipationAttempt | SlotTransferAttempt) {
    if (!actorId || currentResource.current !== resourceScope || moveLock.current?.scope === resourceScope) return;
    const operation = {scope:resourceScope}; moveLock.current = operation;setBusy(true);setError("");
    try {
      await discardMobileChampionshipAttempt(championshipId,actorId,family,attempt);
      if (currentResource.current !== resourceScope) return;
      if (family === 'participation') setPendingParticipation(null);else setPendingMove(null);
      await load();
    } catch (err: any) { if (currentResource.current === resourceScope) setError(err?.message || "Não foi possível encerrar a tentativa no aparelho."); }
    finally { if (moveLock.current === operation) moveLock.current = null;if (currentResource.current === resourceScope) setBusy(false); }
  }

  function remove(slot: any) {
    const participationId = String(
      slot?.campeonato_equipe?.id || slot?.participacao_id || "",
    );
    if (!participationId) {
      setError("A participação deste slot não foi localizada.");
      return;
    }
    Alert.alert(
      "Remover inscrição?",
      `${slot.line_nome || slot.equipe_nome || "Esta line"} será retirada do campeonato e o slot ficará livre.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: () => void executeParticipation("DELETE", { expected: slot.participation_expected }, participationId, "Inscrição removida e slot liberado."),
        },
      ],
    );
  }

  async function addLine(equipe: any, line: any) {
    if (!targetAddSlotId) return;
    if (data?.liga && !entryOrigin) { setError("Selecione a origem da vaga da Liga antes de adicionar.");return; }
    await executeParticipation("POST", { slot_id: targetAddSlotId, equipe_id: equipe.id, line_id: line.id, origem_entrada: entryOrigin || undefined }, undefined, "Line adicionada ao campeonato.");
  }

  if (loading)
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );

  return (
    <View style={styles.root}>
      <View style={styles.metrics}>
        <Metric value={slots.length} label="Slots" />
        <Metric value={slots.filter(isOccupied).length} label="Ocupados" />
        <Metric
          value={slots.filter((slot: any) => !isOccupied(slot) && !isReserved(slot)).length}
          label="Livres"
        />
      </View>

      {error ? (
        <Text style={[styles.message, styles.error]}>{error}</Text>
      ) : null}
      {feedback ? <Text style={styles.message}>{feedback}</Text> : null}
      {pendingParticipation ? <View style={{ gap: spacing.sm }}>
        <Text style={styles.message}>Há uma inscrição aguardando confirmação. Confira o acompanhamento antes de iniciar outra.</Text>
        <TouchableOpacity accessibilityRole="button" style={[styles.reviewButton,{minHeight:44,justifyContent:"center"}]} disabled={busy || data?.participation_write_mode !== "atomic"}
          onPress={() => void executeParticipation(pendingParticipation.method,pendingParticipation.body,pendingParticipation.participationId || undefined)}>
          <Text style={styles.reviewButtonText}>Confirmar tentativa anterior</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={[styles.reviewButton,{minHeight:44,justifyContent:"center"}]} disabled={busy}
          onPress={() => Alert.alert("Encerrar tentativa?","Após conferir o acompanhamento, você pode encerrar esta tentativa no aparelho. Uma inscrição já confirmada no servidor permanece válida.",[
            {text:"Voltar",style:"cancel"},{text:"Já conferi",onPress:() => {
              void discardAttempt('participation',pendingParticipation);
            }},
          ])}>
          <Text style={styles.reviewButtonText}>Encerrar tentativa após conferir</Text>
        </TouchableOpacity>
      </View> : null}

      {pendingMove ? <View style={{ gap: spacing.sm }}>
        <Text style={styles.message}>Há uma movimentação aguardando confirmação. Confira os slots antes de iniciar outra.</Text>
        <TouchableOpacity accessibilityRole="button" style={[styles.reviewButton,{minHeight:44,justifyContent:"center"}]} disabled={busy || data?.slot_movement_mode !== "atomic"}
          onPress={() => void executeMove(pendingMove.body)}>
          <Text style={styles.reviewButtonText}>Confirmar resultado da movimentação anterior</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={[styles.reviewButton,{minHeight:44,justifyContent:"center"}]} disabled={busy}
          onPress={() => Alert.alert("Encerrar tentativa?","Depois de conferir os slots, você pode encerrar esta tentativa no aparelho. Isso não desfaz uma movimentação já realizada.",[
            {text:"Voltar",style:"cancel"},{text:"Já conferi os slots",onPress:() => {
              void discardAttempt('movement',pendingMove);
            }},
          ])}>
          <Text style={styles.reviewButtonText}>Encerrar tentativa após conferir os slots</Text>
        </TouchableOpacity>
      </View> : null}

      <View style={styles.queueHeader}>
        <Text style={styles.title}>INSCRIÇÕES PARA ANÁLISE</Text>
        <View style={styles.queueCount}>
          <Text style={styles.queueCountText}>{pendingRequests.length}</Text>
        </View>
      </View>
      {pendingRequests.length ? (
        <View style={styles.queue}>
          {pendingRequests.map((item: any) => (
            <View
              key={item.id}
              style={[
                styles.requestCard,
                reviewRequestId === String(item.id) && styles.requestCardActive,
              ]}
            >
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>
                  {item.line?.nome || item.nome_exibicao || "Line"}
                </Text>
                <Text style={styles.meta}>
                  {item.equipe?.nome || "Equipe"} · aguardando aprovação
                </Text>
              </View>
              <TouchableOpacity
                style={styles.reviewButton}
                disabled={busy}
                onPress={() => {
                  setReviewRequestId(String(item.id));
                  setSourceSlotId("");
                  setTargetAddSlotId("");
                }}
              >
                <Text style={styles.reviewButtonText}>
                  {reviewRequestId === String(item.id)
                    ? "Escolha o slot"
                    : "Aprovar"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectButton}
                disabled={busy}
                onPress={() => void rejectRequest(item)}
              >
                <Text style={styles.rejectButtonText}>Rejeitar</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TextInput
            value={rejectReason}
            onChangeText={setRejectReason}
            placeholder="Motivo da rejeição (opcional)"
            placeholderTextColor="#8a857e"
            style={styles.input}
          />
          {reviewRequest ? (
            <View style={styles.selection}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectionLabel}>APROVAÇÃO MANUAL</Text>
                <Text style={styles.selectionName}>
                  {reviewRequest.line?.nome ||
                    reviewRequest.nome_exibicao ||
                    "Line"}
                </Text>
                <Text style={styles.selectionMeta}>
                  Toque em um slot livre abaixo para aprovar e posicionar a
                  line.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setReviewRequestId("")}
              >
                <Ionicons name="close" size={18} color={colors.ink} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.emptySmall}>Nenhuma inscrição pendente.</Text>
      )}

      <Text style={styles.title}>GRUPO</Text>
      {data?.liga && (reviewRequest || targetAddSlotId) ? <View style={{ gap: spacing.sm }}>
        <Text style={styles.message}>Selecione a origem da vaga da Liga.</Text>
        <View style={styles.chips}>{leagueOrigins.map(origin => <TouchableOpacity key={origin} accessibilityRole="button"
          accessibilityLabel={`Origem ${origin.replaceAll("_"," ")}`} disabled={busy} onPress={() => setEntryOrigin(origin)}
          style={[styles.chip,entryOrigin === origin && styles.chipActive]}>
          <Text style={styles.chipText}>{origin.replaceAll("_"," ")}{entryOrigin === origin ? " ✓" : ""}</Text>
        </TouchableOpacity>)}</View>
      </View> : null}
      <View style={styles.chips}>
        {groups.map((group: any) => (
          <TouchableOpacity
            key={group.id}
            style={[
              styles.chip,
              groupId === String(group.id) && styles.chipActive,
            ]}
            onPress={() => {
              setGroupId(String(group.id));
              setSourceSlotId("");
            }}
          >
            <Text
              style={[
                styles.chipText,
                groupId === String(group.id) && styles.chipTextActive,
              ]}
            >
              {group.nome}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {source ? (
        <View style={styles.selection}>
          <View style={{ flex: 1 }}>
            <Text style={styles.selectionLabel}>ORIGEM SELECIONADA</Text>
            <Text style={styles.selectionName}>
              {source.line_nome || source.equipe_nome || "Line"}
            </Text>
            <Text style={styles.selectionMeta}>
              Toque em outro slot para mover ou trocar.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setSourceSlotId("")}
          >
            <Ionicons name="close" size={18} color={colors.ink} />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.list}>
        {visibleSlots.map((slot: any) => {
          const occupied = isOccupied(slot);
          const selected = sourceSlotId === String(slot.id);
          return (
            <TouchableOpacity
              key={slot.id}
              activeOpacity={0.8}
              disabled={busy || isReserved(slot) || (!isOccupied(slot) && data?.permission?.canManage === false)}
              style={[styles.slotRow, selected && styles.slotRowSelected]}
              onPress={() =>
                reviewRequest
                  ? void approveRequest(slot)
                  : source
                    ? void moveOrSwap(slot)
                    : occupied
                      ? setSourceSlotId(String(slot.id))
                      : setTargetAddSlotId(String(slot.id))
              }
            >
              <View
                style={[
                  styles.slotBadge,
                  occupied ? styles.slotOccupied : styles.slotFree,
                ]}
              >
                <Text style={styles.slotBadgeText}>{slotLabel(slot)}</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>
                  {occupied
                    ? slot.line_nome || slot.equipe_nome || "Line inscrita"
                    : isReserved(slot) ? "Slot reservado" : "Slot livre"}
                </Text>
                <Text style={styles.meta}>
                  {slot.grupo?.nome ||
                    groups.find(
                      (g: any) => String(g.id) === String(slot.grupo_id),
                    )?.nome ||
                    "Grupo"}
                  {occupied && slot.equipe_nome ? ` · ${slot.equipe_nome}` : ""}
                </Text>
              </View>
              {occupied ? (
                <>
                  <TouchableOpacity
                    style={styles.smallAction}
                    onPress={() => setSourceSlotId(String(slot.id))}
                  >
                    <Ionicons
                      name="move-outline"
                      size={17}
                      color={colors.ink}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.smallAction}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover ${slot.line_nome || slot.equipe_nome || "inscrição"}`}
                    disabled={busy || data?.permission?.canRemove === false}
                    onPress={() => remove(slot)}
                  >
                    <Ionicons name="trash-outline" size={17} color="#b42318" />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.addAction}
                  onPress={() =>
                    reviewRequest
                      ? void approveRequest(slot)
                      : setTargetAddSlotId(String(slot.id))
                  }
                >
                  <Ionicons
                    name={reviewRequest ? "checkmark" : "add"}
                    size={18}
                    color={colors.onBrand}
                  />
                  <Text style={styles.addActionText}>
                    {reviewRequest ? "Aprovar" : "Adicionar"}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {targetAddSlotId ? (
        <View style={styles.searchBox}>
          <View style={styles.searchHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>ADICIONAR LINE</Text>
              <Text style={styles.meta}>
                Destino: slot{" "}
                {slotLabel(
                  slots.find(
                    (slot: any) => String(slot.id) === targetAddSlotId,
                  ),
                )}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                setTargetAddSlotId("");
                            setQuery("");
              }}
            >
              <Ionicons name="close" size={18} color={colors.ink} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchLine}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void searchPage.refresh()}
              placeholder="Nome ou tag da equipe"
              placeholderTextColor="#8a857e"
              style={styles.input}
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={() => void searchPage.refresh()}
            >
              <Ionicons name="search" size={18} color={colors.onBrand} />
            </TouchableOpacity>
          </View>
          {results.map((team: any) => (
            <View key={team.id} style={styles.teamCard}>
              <View style={styles.teamHead}>
                {team.logo_url ? (
                  <Image source={{ uri: team.logo_url }} style={styles.logo} />
                ) : (
                  <View style={[styles.logo, styles.logoFallback]}>
                    <Ionicons
                      name="shield-outline"
                      size={20}
                      color={colors.muted}
                    />
                  </View>
                )}
                <View style={styles.copy}>
                  <Text style={styles.rowTitle}>{team.nome}</Text>
                  <Text style={styles.meta}>
                    {team.tag || "Sem tag"} · {team.lines_livres || 0} line(s)
                    livre(s)
                  </Text>
                </View>
              </View>
              {(team.lines || []).map((line: any) => (
                <View key={line.id} style={styles.lineRow}>
                  <View style={styles.copy}>
                    <Text style={styles.lineName}>{line.nome}</Text>
                    <Text style={styles.meta}>
                      {line.ja_inscrita
                        ? `Já inscrita${line.slot_letra ? ` · slot ${line.slot_letra}` : ""}`
                        : "Disponível"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    disabled={line.ja_inscrita || busy}
                    style={[
                      styles.useButton,
                      line.ja_inscrita && styles.disabled,
                    ]}
                    onPress={() => void addLine(team, line)}
                  >
                    <Text style={styles.useButtonText}>
                      {line.ja_inscrita ? "Inscrita" : "Usar"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
              {!team.lines?.length ? (
                <Text style={styles.emptySmall}>
                  Esta equipe ainda não possui line ativa. Crie a line no painel
                  da equipe antes de inscrever.
                </Text>
              ) : null}
            </View>
          ))}
          {query.trim().length >= 2 ? <DirectoryStatus page={searchPage} empty="Nenhuma equipe encontrada." /> : <Text style={styles.emptySmall}>Digite pelo menos 2 caracteres.</Text>}
        </View>
      ) : null}

      <Text style={styles.note}>
        A organização é manual: inscrições pendentes só ocupam vaga depois da
        aprovação e da escolha explícita de um slot. O app não distribui equipes
        automaticamente.
      </Text>
    </View>
  );
}

function isOccupied(slot: any) {
  return Boolean(slot?.line_id || slot?.equipe_id || slot?.campeonato_equipe);
}
function isReserved(slot: any) {
  return !isOccupied(slot) && (Boolean(slot?.convite) || ["reservado","reservada","bloqueado","bloqueada"].includes(String(slot?.status || "")));
}
function slotLabel(slot: any) {
  return String(slot?.slot_letra || slot?.slot_numero || "—");
}
function collectGroups(slots: any[]) {
  const map = new Map<string, any>();
  for (const slot of slots || []) {
    const id = String(slot?.grupo_id || slot?.grupo?.id || "");
    if (!id || map.has(id)) continue;
    map.set(id, { id, nome: slot?.grupo?.nome || `Grupo ${map.size + 1}` });
  }
  return [...map.values()];
}
function Metric({ value, label }: { value: any; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginHorizontal: spacing.md, gap: 8 },
  queueHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  queueCount: {
    minWidth: 26,
    height: 22,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  queueCountText: { color: colors.onBrand, fontSize: 9, fontWeight: "900" },
  queue: { gap: 6 },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  requestCardActive: { borderColor: colors.brand, borderWidth: 2 },
  reviewButton: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: colors.brand,
    borderRadius: 7,
  },
  reviewButtonText: {
    color: colors.onBrand,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  rejectButton: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: "rgba(224, 122, 122, .12)",
    borderRadius: 7,
  },
  rejectButtonText: {
    color: colors.danger,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  loading: { minHeight: 72, alignItems: "center", justifyContent: "center" },
  metrics: {
    flexDirection: "row",
    gap: 6,
  },
  metric: { flex: 1, padding: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8 },
  metricValue: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  metricLabel: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
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
  selection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 9,
    backgroundColor: "rgba(212, 165, 87, .12)",
    borderWidth: 1,
    borderColor: "rgba(212, 165, 87, .4)",
    borderRadius: 8,
  },
  selectionLabel: { color: colors.warning, fontSize: 7, fontWeight: "900" },
  selectionName: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  selectionMeta: { marginTop: 2, color: colors.muted, fontSize: 8 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  list: { gap: 5 },
  slotRow: {
    minHeight: 54,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  slotRowSelected: { borderColor: colors.brand, borderWidth: 2 },
  slotBadge: {
    width: 36,
    height: 36,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  slotOccupied: { backgroundColor: colors.brandDark },
  slotFree: { backgroundColor: colors.surfaceRaised },
  slotBadgeText: { color: colors.ink, fontWeight: "900" },
  copy: { flex: 1 },
  rowTitle: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  meta: { marginTop: 2, color: colors.muted, fontSize: 8, fontWeight: "700" },
  smallAction: {
    width: 32,
    height: 32,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  addAction: {
    minHeight: 34,
    borderRadius: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    backgroundColor: colors.brand,
  },
  addActionText: {
    color: colors.onBrand,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  searchBox: {
    gap: 7,
    padding: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  searchHeader: { flexDirection: "row", alignItems: "center" },
  searchLine: { flexDirection: "row" },
  input: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 10,
    color: colors.ink,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    fontWeight: "700",
  },
  searchButton: {
    width: 42,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  teamCard: {
    gap: 6,
    padding: 8,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  teamHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 38, height: 38, borderRadius: 8, backgroundColor: colors.surfaceSoft },
  logoFallback: { alignItems: "center", justifyContent: "center" },
  lineRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 6,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  lineName: {
    color: colors.ink,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  useButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.brand,
    borderRadius: 7,
  },
  useButtonText: {
    color: colors.onBrand,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  disabled: { opacity: 0.35 },
  emptySmall: {
    paddingVertical: 8,
    color: colors.muted,
    fontSize: 8,
    textAlign: "center",
  },
  note: {
    marginTop: 4,
    padding: 9,
    color: colors.muted,
    fontSize: 8,
    lineHeight: 12,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 8,
  },
});
