import { useCallback, useEffect, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { externalUrl } from "@/config/env";
import { mobileApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, spacing } from "@/theme/tokens";
import { ScreenProps } from "@/types/dropzone";
import { ChampionshipSettingsPanel } from "@/screens/ChampionshipSettingsPanel";
import { ChampionshipRulebookPanel } from "@/screens/ChampionshipRulebookPanel";
import { ChampionshipTeamsPanel } from "@/screens/ChampionshipTeamsPanel";
import { ChampionshipGamesPanel } from "@/screens/ChampionshipGamesPanel";
import { ChampionshipScorerPanel } from "@/screens/ChampionshipScorerPanel";
import { ChampionshipFinalizationPanel } from "@/screens/ChampionshipFinalizationPanel";
import { ChampionshipStreamPanel } from "@/screens/ChampionshipStreamPanel";
import { ChampionshipCallsPanel } from "@/screens/ChampionshipCallsPanel";
import { MobileStructureGroupPanel } from "@/screens/MobileStructureGroupPanel";
import { useMobileLifecycleScope } from "../hooks/useMobileLifecycleScope";
import { championshipSession } from "../lib/championship-session";

type Tab =
  | "overview"
  | "settings"
  | "rulebook"
  | "structure"
  | "games"
  | "scorer"
  | "teams"
  | "final"
  | "stream"
  | "calls";
const types = ["copa", "liga", "diario", "xtreino", "confronto"];
export function ChampionshipManagementScreen(props: ScreenProps) {
  const auth = useAuth();
  const accountScope = useMobileLifecycleScope(JSON.stringify([props.selectedAdminChampionshipId || '__admin__', auth.activeAccount?.id || null, auth.activeProfileType]));
  return accountScope.ready && accountScope.actor
    ? <ManagementContent key={accountScope.key} {...props} accountScope={accountScope} />
    : <Text>Entre para administrar campeonatos.</Text>;
}
function ManagementContent({
  selectedAdminChampionshipId,
  onSelectChampionship,
  accountScope,
}: ScreenProps & {accountScope: ReturnType<typeof useMobileLifecycleScope>}) {
  const auth = useAuth(),
    token = auth.session?.access_token;
  const [items, setItems] = useState<any[]>([]),
    [selectedId, setSelectedId] = useState<string | null>(
      selectedAdminChampionshipId === "__create__"
        ? null
        : selectedAdminChampionshipId || null,
    ),
    [detail, setDetail] = useState<{key:string;structure:any;summary:any} | null>(null),
    [tab, setCurrentTab] = useState<Tab>("overview"),
    [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState(""),
    [creating, setCreating] = useState(
      selectedAdminChampionshipId === "__create__",
    );
  const [name, setName] = useState(""),
    [type, setType] = useState("copa"),
    [logo, setLogo] = useState(""),
    [slots, setSlots] = useState("12"),
    [players, setPlayers] = useState("4"),
    [price, setPrice] = useState("0"),
    [platform, setPlatform] = useState("mobile"),
    [server, setServer] = useState("Brasil");
  const [phaseName, setPhaseName] = useState(""),
    [phaseFinal, setPhaseFinal] = useState(false),
    [finalSlots, setFinalSlots] = useState("12");
  const scope = useMobileLifecycleScope(selectedId || '__list__');
  const latestSelection = useRef(selectedId); latestSelection.current = selectedId;
  const listGeneration = useRef(0), detailGeneration = useRef(0), mutation = useRef(false), dialog = useRef<object | null>(null);
  const detailCurrent = detail?.key === scope.key;
  const structure = detailCurrent ? detail.structure : null, summary = detailCurrent ? detail.summary : null;
  const current = () => { if (!accountScope.isCurrent() || !scope.actor || !scope.isCurrent()) throw new Error('A conta ou o campeonato mudou. Atualize o painel.'); };
  useEffect(() => { setCurrentTab('overview'); setPhaseName(''); setPhaseFinal(false); setFinalSlots('12'); setError(''); setFeedback(''); setBusy(false); dialog.current = null; }, [scope.key]);
  const tipo = type;
  function setTab(next: Tab) {
    const permission =
      summary?.permission ||
      structure?.permission ||
      items.find((item) => String(item.id) === selectedId)?.permission ||
      {};
    const allowed =
      next === "overview" ||
      (next === "structure" && permission.canOrganizeGroups) ||
      (next === "games" && permission.canManageGames) ||
      (next === "scorer" && permission.canScore) ||
      (next === "teams" &&
        (permission.canManage ||
          permission.canRemove ||
          permission.canGenerateToken)) ||
      ((["settings", "rulebook", "final", "stream", "calls"] as Tab[]).includes(
        next,
      ) &&
        permission.canManage);
    if (!allowed) {
      setError(
        "Seu perfil não tem permissão para usar esta área deste campeonato.",
      );
      setCurrentTab("overview");
      return;
    }
    setError("");
    setCurrentTab(next);
  }
  const loadList = useCallback(
    async (refresh = false) => {
      const request = ++listGeneration.current;
      if (!latestSelection.current) { refresh ? setRefreshing(true) : setLoading(true); }
      try {
        const session = await championshipSession(accountScope.actor!);
        if (!accountScope.isCurrent()) return;
        const result = await mobileApi.championshipAdminList(session.token);
        await championshipSession(accountScope.actor!);
        if (!accountScope.isCurrent() || request !== listGeneration.current) return;
        setItems(result.items || []);
        if (!latestSelection.current) setError("");
      } catch (err: any) {
        if (!accountScope.isCurrent() || request !== listGeneration.current) return;
        if (!latestSelection.current) setError(err?.message || "Não foi possível carregar os campeonatos.");
      } finally {
        if (accountScope.isCurrent() && request === listGeneration.current && !latestSelection.current) { setLoading(false); setRefreshing(false); }
      }
    },
    [accountScope.key],
  );
  const loadDetail = useCallback(
    async (id: string, refresh = false) => {
      if (!scope.actor || id !== selectedId || !accountScope.isCurrent() || !scope.isCurrent()) return;
      const request = ++detailGeneration.current;
      refresh ? setRefreshing(true) : setLoading(true);
      try {
        const session = await championshipSession(scope.actor); current();
        const [s, d] = await Promise.all([
          mobileApi.championshipStructure(id, session.token),
          mobileApi.championshipAdminSummary(id, session.token),
        ]);
        await championshipSession(scope.actor); current();
        if (request !== detailGeneration.current) return;
        setDetail({key:scope.key,structure:s,summary:d});
        setError("");
      } catch (err: any) {
        if (!accountScope.isCurrent() || !scope.isCurrent() || request !== detailGeneration.current) return;
        setError(err?.message || "Não foi possível carregar a administração.");
      } finally {
        if (accountScope.isCurrent() && scope.isCurrent() && request === detailGeneration.current) { setLoading(false); setRefreshing(false); }
      }
    },
    [scope.key, accountScope.key, selectedId],
  );
  useEffect(() => {
    void loadList();
    return () => { listGeneration.current++; };
  }, [loadList]);
  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    return () => { detailGeneration.current++; };
  }, [selectedId, loadDetail]);
  async function chooseLogo() {
    if (mutation.current || !accountScope.isCurrent() || !scope.isCurrent()) return;
    mutation.current = true; setBusy(true);
    try {
    current();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    current();
    if (!permission.granted) {
      setError("Permita acesso à galeria.");
      return;
    }
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    current();
    if (pick.canceled) return;
      const png = await ImageManipulator.manipulateAsync(
        pick.assets[0].uri,
        [{ resize: { width: 900 } }],
        {
          format: ImageManipulator.SaveFormat.PNG,
          compress: 0.86,
          base64: true,
        },
      );
      current();
      if (!png.base64) throw new Error("Falha ao preparar a imagem.");
      setLogo(`data:image/png;base64,${png.base64}`);
      setFeedback(
        "Logo pronta. Ela será enviada somente ao criar o campeonato.",
      );
    } catch (err: any) {
      if (accountScope.isCurrent() && scope.isCurrent()) setError(err?.message || "Não foi possível preparar a logo.");
    } finally {
      mutation.current = false;
      if (accountScope.isCurrent() && scope.isCurrent()) setBusy(false);
    }
  }
  async function create() {
    if (mutation.current || !accountScope.isCurrent() || !scope.isCurrent()) return;
    if (auth.activeProfileType !== "produtora") {
      setError(
        "Você ainda não tem um perfil de produtora. Crie ou selecione uma produtora antes de criar campeonatos.",
      );
      return;
    }
    if (!name.trim() || !logo) {
      setError("Informe o nome e escolha a logo.");
      return;
    }
    mutation.current = true; setBusy(true);
    try {
      const session = await championshipSession(scope.actor!); current();
      let logoUrl = logo;
      if (logoUrl.startsWith("data:image/")) {
        const uploaded = await mobileApi.uploadChampionshipImage(
          { file_name: "campeonato.png", data_url: logoUrl },
          session.token,
        );
        current();
        logoUrl = uploaded.url;
        setLogo(logoUrl);
      }
      const writeSession = await championshipSession(scope.actor!); current();
      await mobileApi.createChampionship(
        {
          nome: name.trim(),
          tipo,
          logo_url: logoUrl,
          banner_url: "",
          premiacao: "0",
          valor_inscricao: price,
          descricao_premiacao: "",
          divisao_premiacao: "",
          numero_vagas: slots,
          numero_fases: "1",
          nomes_fases: ["Fase 1"],
          formato: type,
          plataforma: platform.trim().toLowerCase(),
          servidor: server,
          tipo_premiacao: "sem_premiacao",
          tem_trofeu: false,
          tem_live: false,
          vagas_por_equipe: players,
          jogadores_por_vaga: players,
          permite_jogador_multiplas_equipes: false,
          permite_troca_jogadores: true,
          data_limite_trocas: "",
          data_limite_inscricao: "",
          aceita_novas_inscricoes_equipes: true,
          contatos_whatsapp: [],
          pagamento_pix_ativo: true,
          pagamento_cartao_ativo: true,
          pagamento_paypal_ativo: false,
          pagamento_whatsapp_ativo: true,
          cartao_max_parcelas: "1",
          paypal_moedas: ["BRL"],
          cor_principal: "#ff4655",
          cor_secundaria: "#17191d",
          bg_opacidade: "18",
          bg_image_url: "",
          cor_texto_clara: "#ffffff",
          cor_texto_escura: "#17191d",
          recurso_export: true,
          recurso_stream: true,
          recurso_rulebook: true,
          recurso_stats: true,
          recurso_broadcast: false,
          nome_historico: "",
          numero_edicao: "1",
          temporada: "",
          titulo_publico: name.trim(),
          origem_criacao: "novo",
          campeonato_origem_id: "",
          franquia_origem_id: "",
          liga_usa_divisoes: false,
          liga_nome_agrupamento: "Divisões",
          liga_divisoes: [],
        },
        writeSession.token,
      );
      await championshipSession(scope.actor!); current();
      setCreating(false);
      setName("");
      setLogo("");
      setFeedback(
        "Campeonato criado. Ele seguirá o fluxo de aprovação e pagamento do sistema.",
      );
      await loadList(true);
    } catch (err: any) {
      if (accountScope.isCurrent() && scope.isCurrent()) setError(err?.message || "Não foi possível criar o campeonato.");
    } finally {
      mutation.current = false;
      if (accountScope.isCurrent() && scope.isCurrent()) setBusy(false);
    }
  }
  async function structureAction(
    method: "POST" | "PATCH" | "DELETE",
    body: any,
    message: string,
  ) {
    if (!selectedId || !detailCurrent || mutation.current || !accountScope.isCurrent() || !scope.isCurrent()) return;
    if (
      !summary?.permission?.canOrganizeGroups &&
      !structure?.permission?.canOrganizeGroups
    ) {
      setError(
        "Seu perfil pode visualizar este campeonato, mas não tem autorização para alterar fases ou grupos. Peça ao organizador para liberar a permissão “organizar grupos”.",
      );
      return;
    }
    mutation.current = true; setBusy(true);
    try {
      const session = await championshipSession(scope.actor!); current();
      await mobileApi.championshipStructureAction(
        selectedId,
        method,
        body,
        session.token,
      );
      await championshipSession(scope.actor!); current();
      setFeedback(message);
      await loadDetail(selectedId, true);
    } catch (err: any) {
      if (accountScope.isCurrent() && scope.isCurrent()) setError(err?.message || "Não foi possível alterar a estrutura.");
    } finally {
      mutation.current = false;
      if (accountScope.isCurrent() && scope.isCurrent()) setBusy(false);
    }
  }
  function confirmDelete(entity: 'phase' | 'group', id: string, name: string) {
    if (busy || mutation.current || !detailCurrent || !accountScope.isCurrent() || !scope.isCurrent()) return;
    const confirmation = {}; dialog.current = confirmation;
    Alert.alert(entity === 'phase' ? 'Excluir fase?' : 'Excluir grupo?', name, [
      {text:'Cancelar',style:'cancel',onPress:()=>{if(dialog.current===confirmation)dialog.current=null;}},
      {text:'Excluir',style:'destructive',onPress:()=>{if(dialog.current!==confirmation||!accountScope.isCurrent()||!scope.isCurrent())return;dialog.current=null;void structureAction('DELETE',{entity,id},entity==='phase'?'Fase excluída.':'Grupo excluído.');}},
    ]);
  }
  if (!selectedId)
    return (
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadList(true)}
            tintColor={colors.brand}
          />
        }
      >
        <Header title="Campeonatos" subtitle="Criação e administração" />
        {error ? <Message text={error} error /> : null}
        {feedback ? <Message text={feedback} /> : null}
        {auth.activeProfileType === "produtora" ? (
          <TouchableOpacity
            style={styles.primary}
            onPress={() => setCreating(!creating)}
          >
            <Ionicons
              name={creating ? "close" : "add"}
              size={19}
              color={colors.onBrand}
            />
            <Text style={styles.primaryText}>
              {creating ? "Cancelar" : "Criar campeonato"}
            </Text>
          </TouchableOpacity>
        ) : null}
        {creating ? (
          <View style={styles.form}>
            <TouchableOpacity
              style={styles.logoPicker}
              accessibilityRole="button"
              accessibilityLabel="Escolher logo do campeonato"
              disabled={busy}
              onPress={() => void chooseLogo()}
            >
              {logo ? (
                <Image
                  source={{
                    uri: logo.startsWith("data:image/")
                      ? logo
                      : externalUrl(logo),
                  }}
                  style={styles.createLogo}
                />
              ) : (
                <View style={[styles.createLogo, styles.fallback]}>
                  <Ionicons
                    name="image-outline"
                    size={28}
                    color={colors.brand}
                  />
                </View>
              )}
              <Text style={styles.link}>Escolher logo</Text>
            </TouchableOpacity>
            <Field label="Nome" value={name} onChangeText={setName} />
            <Text style={styles.label}>TIPO</Text>
            <View style={styles.options}>
              {types.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.option, type === item && styles.optionActive]}
                  onPress={() => setType(item)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      type === item && styles.optionTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.columns}>
              <FieldBox label="Vagas" value={slots} onChangeText={setSlots} />
              <FieldBox
                label="Jogadores/vaga"
                value={players}
                onChangeText={setPlayers}
              />
              <FieldBox
                label="Inscrição"
                value={price}
                onChangeText={setPrice}
              />
            </View>
            <Field
              label="Plataforma"
              value={platform}
              onChangeText={setPlatform}
            />
            <Field label="Servidor" value={server} onChangeText={setServer} />
            <TouchableOpacity
              style={styles.primary}
              disabled={busy}
              onPress={() => void create()}
            >
              {busy ? (
                <ActivityIndicator color={colors.onBrand} />
              ) : (
                <Text style={styles.primaryText}>Criar campeonato</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
        {loading ? <Loading /> : null}
        <View style={styles.list}>
          {items.map((item) => (
            <TouchableOpacity
              key={String(item.id)}
              style={styles.row}
              accessibilityRole="button"
              accessibilityLabel={`Administrar ${item.nome}`}
              onPress={() => {
                setSelectedId(String(item.id));
                setTab("overview");
              }}
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
                <Text style={styles.rowTitle}>{item.nome}</Text>
                <Text style={styles.meta}>
                  {item.tipo} · {item.status} ·{" "}
                  {item.aprovacao_status || "análise"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  const championship =
      structure?.campeonato ||
      items.find((item) => String(item.id) === selectedId) ||
      {},
    phases = structure?.fases || [],
    groups = structure?.grupos || [],
    games = structure?.jogos || [],
    slotsRows = structure?.slots || [];
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadDetail(selectedId, true)}
          tintColor={colors.brand}
        />
      }
    >
      <View style={styles.detailHeader}>
        <TouchableOpacity
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Voltar à lista de campeonatos"
          onPress={() => {
            setSelectedId(null);
            setDetail(null);
          }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>ADMINISTRAÇÃO</Text>
          <Text style={styles.detailTitle}>
            {championship.nome || "Campeonato"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.publicButton}
          onPress={() =>
            onSelectChampionship?.({
              id: selectedId,
              name: championship.nome || "Campeonato",
              mode: championship.tipo || "competitivo",
              logoUrl: championship.logo_url || null,
              bannerUrl: championship.banner_url || null,
              priceLabel: "Ver campeonato",
              freeSlots: 0,
            })
          }
        >
          <Ionicons name="eye-outline" size={18} color={colors.ink} />
        </TouchableOpacity>
      </View>
      <View style={styles.tabs}>
        {(
          [
            ["overview", "Resumo"],
            ["settings", "Config."],
            ["rulebook", "Regulamento"],
            ["structure", "Estrutura"],
            ["games", "Jogos"],
            ["scorer", "Pontuador"],
            ["teams", "Equipes"],
            ["final", "Final"],
            ["stream", "Stream"],
            ...(String(championship.tipo || "").toLowerCase() === "xtreino"
              ? [["calls", "Calls"] as [Tab, string]]
              : []),
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
      {error ? <Message text={error} error /> : null}
      {feedback ? <Message text={feedback} /> : null}
      {loading ? <Loading /> : null}
      {!loading && detailCurrent && tab === "overview" ? (
        <View style={styles.section}>
          <View style={styles.metrics}>
            <Metric
              value={summary?.metrics?.equipes ?? summary?.equipes ?? 0}
              label="Equipes"
            />
            <Metric value={phases.length} label="Fases" />
            <Metric value={groups.length} label="Grupos" />
            <Metric value={games.length} label="Jogos" />
          </View>
          <Text style={styles.sectionTitle}>CAPACIDADE</Text>
          <MetricRow label="Slots criados" value={slotsRows.length} />
          <MetricRow
            label="Slots ocupados"
            value={
              slotsRows.filter((s: any) => s.equipe_id || s.line_id).length
            }
          />
          <MetricRow
            label="Aprovação"
            value={championship.aprovacao_status || "Em análise"}
          />
        </View>
      ) : null}
      {!loading && detailCurrent && tab === "settings" ? (
        <ChampionshipSettingsPanel
          championshipId={selectedId}
          token={token}
          onSaved={() => void loadDetail(selectedId, true)}
        />
      ) : null}
      {!loading && detailCurrent && tab === "rulebook" ? (
        <ChampionshipRulebookPanel championshipId={selectedId} token={token} />
      ) : null}
      {!loading && detailCurrent && tab === "structure" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOVA FASE</Text>
          <Field
            label="Nome da fase"
            value={phaseName}
            onChangeText={setPhaseName}
          />
          <Text style={styles.label}>TIPO DA FASE</Text>
          <View style={styles.options}>
            <TouchableOpacity
              style={[styles.option, !phaseFinal && styles.optionActive]}
              onPress={() => setPhaseFinal(false)}
            >
              <Text
                style={[
                  styles.optionText,
                  !phaseFinal && styles.optionTextActive,
                ]}
              >
                Fase normal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.option, phaseFinal && styles.optionActive]}
              disabled={phases.some(
                (phase: any) => phase.tipo === "grande_final",
              )}
              onPress={() => {
                setPhaseFinal(true);
                if (!phaseName.trim()) setPhaseName("Grande Final");
              }}
            >
              <Text
                style={[
                  styles.optionText,
                  phaseFinal && styles.optionTextActive,
                ]}
              >
                Grande Final
              </Text>
            </TouchableOpacity>
          </View>
          {phaseFinal ? (
            <Field
              label="Slots do Grupo da Final"
              value={finalSlots}
              onChangeText={setFinalSlots}
            />
          ) : null}
          <TouchableOpacity
            style={styles.primary}
            disabled={busy || (!phaseName.trim() && !phaseFinal)}
            onPress={() =>
              void structureAction(
                "POST",
                {
                  action: "create_phase",
                  nome: phaseName || "Grande Final",
                  ordem: phases.length + 1,
                  grande_final: phaseFinal,
                  final_slots: Number(finalSlots || 12),
                },
                phaseFinal
                  ? "Grande Final e Grupo da Final criados."
                  : "Fase criada.",
              )
            }
          >
            <Text style={styles.primaryText}>Criar fase</Text>
          </TouchableOpacity>
          {phases.map((phase: any) => (
            <View key={phase.id} style={styles.entity}>
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>{phase.nome}</Text>
                <Text style={styles.meta}>
                  Ordem {phase.ordem}
                  {phase.tipo === "grande_final"
                    ? " · Grande Final · Grupo da Final"
                    : ""}
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Excluir fase ${phase.nome}`}
                disabled={busy}
                onPress={() => confirmDelete('phase', phase.id, phase.nome)}
              >
                <Ionicons name="trash-outline" size={18} color="#b42318" />
              </TouchableOpacity>
            </View>
          ))}
          <MobileStructureGroupPanel championshipId={selectedId} />
          {groups.map((group: any) => (
            <View key={group.id} style={styles.entity}>
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>{group.nome}</Text>
                <Text style={styles.meta}>
                  {group.slots_total || group.slots} slots ·{" "}
                  {group.slots_ocupados || 0} ocupados
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Excluir grupo ${group.nome}`}
                disabled={busy}
                onPress={() => confirmDelete('group', group.id, group.nome)}
              >
                <Ionicons name="trash-outline" size={18} color="#b42318" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}
      {!loading && detailCurrent && tab === "games" ? (
        <ChampionshipGamesPanel
          championshipId={selectedId}
          phases={phases}
          groups={groups}
          token={token}
          onChanged={() => loadDetail(selectedId, true)}
        />
      ) : null}
      {!loading && detailCurrent && tab === "scorer" ? (
        <ChampionshipScorerPanel championshipId={selectedId} token={token} />
      ) : null}
      {!loading && detailCurrent && tab === "teams" ? (
        <ChampionshipTeamsPanel
          championshipId={selectedId}
          token={token}
          actorId={auth.user?.id}
          onChanged={() => loadDetail(selectedId, true)}
        />
      ) : null}
      {!loading && detailCurrent && tab === "final" ? (
        <ChampionshipFinalizationPanel
          championshipId={selectedId}
          token={token}
        />
      ) : null}
      {!loading && detailCurrent && tab === "stream" ? (
        <ChampionshipStreamPanel championshipId={selectedId} token={token} />
      ) : null}
      {!loading && detailCurrent && tab === "calls" ? (
        <ChampionshipCallsPanel championshipId={selectedId} token={token} />
      ) : null}
    </ScrollView>
  );
}
function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.header}>
      <Ionicons name="trophy-outline" size={31} color={colors.brand} />
      <View>
        <Text style={styles.eyebrow}>{subtitle}</Text>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
    </View>
  );
}
function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}
function Message({ text, error }: { text: string; error?: boolean }) {
  return (
    <Text style={[styles.message, error && styles.messageError]}>{text}</Text>
  );
}
function Field(props: any) {
  return (
    <View>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={props.label}
        style={styles.input}
        placeholderTextColor="#8a857e"
      />
    </View>
  );
}
function FieldBox(props: any) {
  return (
    <View style={styles.fieldBox}>
      <Field {...props} />
    </View>
  );
}
function Metric({ value, label }: { value: any; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}
function MetricRow({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricRowLabel}>{label}</Text>
      <Text style={styles.metricRowValue}>{value}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  header: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    backgroundColor: colors.brandDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand,
  },
  eyebrow: {
    color: colors.brand,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  headerTitle: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  primary: {
    margin: spacing.md,
    marginBottom: 0,
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
  form: {
    margin: spacing.md,
    marginBottom: 0,
    gap: 8,
    padding: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  logoPicker: { alignItems: "center", gap: 5 },
  createLogo: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
  },
  fallback: { alignItems: "center", justifyContent: "center" },
  link: {
    color: colors.brand,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  label: {
    marginBottom: 5,
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  input: {
    minHeight: 42,
    paddingHorizontal: 10,
    color: colors.ink,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    fontWeight: "700",
  },
  columns: { flexDirection: "row", gap: 6 },
  fieldBox: { flex: 1 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  option: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 6,
  },
  optionActive: { backgroundColor: colors.brand },
  optionText: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  optionTextActive: { color: colors.onBrand },
  loading: { minHeight: 60, alignItems: "center", justifyContent: "center" },
  message: {
    margin: spacing.md,
    marginBottom: 0,
    padding: 10,
    color: colors.success,
    backgroundColor: "rgba(101, 185, 130, .12)",
    fontWeight: "800",
  },
  messageError: {
    color: colors.danger,
    backgroundColor: "rgba(224, 122, 122, .12)",
  },
  list: { margin: spacing.md, gap: 6, backgroundColor: "transparent" },
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
  },
  copy: { flex: 1 },
  rowTitle: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  meta: { marginTop: 3, color: colors.muted, fontSize: 8.5, fontWeight: "700" },
  detailHeader: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.brandDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  detailTitle: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  publicButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabs: {
    margin: spacing.md,
    marginBottom: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tab: {
    width: "31.9%",
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
  },
  tabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  tabTextActive: { color: colors.onBrand },
  section: { marginHorizontal: spacing.md, gap: 8 },
  metrics: { flexDirection: "row", gap: 6 },
  metric: {
    flex: 1,
    padding: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  metricValue: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  metricLabel: {
    color: colors.muted,
    fontSize: 7,
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
  metricRow: {
    minHeight: 40,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  metricRowLabel: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  metricRowValue: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  inline: { flexDirection: "row" },
  inlineInput: { flex: 1 },
  add: {
    width: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  entity: {
    minHeight: 52,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  slot: {
    width: 32,
    height: 32,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandDark,
  },
  slotText: { color: colors.ink, fontWeight: "900" },
  empty: {
    padding: 16,
    color: colors.muted,
    textAlign: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
});
