import { useCallback, useEffect, useMemo, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Alert,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { mobileApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  cents,
  compactDate,
  movementStatus,
  movementTitle,
  WalletMovement,
  WalletReceipt,
  WalletSummary,
} from "@/lib/wallet";
import { ActionCard, ScreenShell } from "@/screens/components";
import { colors, spacing, typography } from "@/theme/tokens";
import { ScreenProps } from "@/types/dropzone";

type ReceiptTarget = { id: string; tipo: "pagamento" | "saque" | "lancamento" };
type Tab = "extrato" | "pagamentos" | "saques" | "pix";
type PixType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";
type StatementFilter = "todos" | "entradas" | "saidas";
type TypedMovement = WalletMovement & { receiptTipo: ReceiptTarget["tipo"] };

export function WalletScreen({ onBack }: ScreenProps) {
  const auth = useAuth();
  const accessToken = auth.session?.access_token;
  const [tab, setTab] = useState<Tab>("extrato");
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [payments, setPayments] = useState<WalletMovement[]>([]);
  const [movements, setMovements] = useState<WalletMovement[]>([]);
  const [withdrawals, setWithdrawals] = useState<WalletMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<WalletReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [pixType, setPixType] = useState<PixType>("aleatoria");
  const [pixKey, setPixKey] = useState("");
  const [pixHolder, setPixHolder] = useState("");
  const [pixEditing, setPixEditing] = useState(false);
  const [pixSaving, setPixSaving] = useState(false);
  const [pixFeedback, setPixFeedback] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawFeedback, setWithdrawFeedback] = useState("");
  const [statementFilter, setStatementFilter] =
    useState<StatementFilter>("todos");
  const [statementSearch, setStatementSearch] = useState("");

  const loadWallet = useCallback(
    async (refresh = false) => {
      refresh ? setRefreshing(true) : setLoading(true);
      try {
        const response = await mobileApi.wallet(
          accessToken,
          auth.activeProfileType,
        );
        setWallet((response.carteira as WalletSummary) || null);
        setMovements((response.lancamentos as WalletMovement[]) || []);
        setPayments((response.pagamentos as WalletMovement[]) || []);
        setWithdrawals((response.saques as WalletMovement[]) || []);
        const nextWallet = (response.carteira as WalletSummary) || null;
        setPixType((nextWallet?.pix_tipo as PixType) || "aleatoria");
        setPixKey(String(nextWallet?.pix_chave || ""));
        setPixHolder(String(nextWallet?.pix_titular || ""));
        setError(null);
      } catch (err: any) {
        setWallet(null);
        setMovements([]);
        setPayments([]);
        setWithdrawals([]);
        setError(err?.message || "Não foi possível carregar a carteira.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, auth.activeProfileType],
  );

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const allItems = useMemo<TypedMovement[]>(() => {
    const typedPayments = payments.map((item) => ({
      ...item,
      receiptTipo: "pagamento" as const,
    }));
    const typedMovements = movements.map((item) => ({
      ...item,
      receiptTipo: "lancamento" as const,
    }));
    const typedWithdrawals = withdrawals.map((item) => ({
      ...item,
      receiptTipo: "saque" as const,
    }));
    return [...typedPayments, ...typedMovements, ...typedWithdrawals]
      .sort(
        (a, b) =>
          new Date(b.pago_em || b.created_at || 0).getTime() -
          new Date(a.pago_em || a.created_at || 0).getTime(),
      )
      .slice(0, 30);
  }, [movements, payments, withdrawals]);

  const visibleItems: TypedMovement[] =
    tab === "pagamentos"
      ? payments.map((item) => ({ ...item, receiptTipo: "pagamento" as const }))
      : tab === "saques"
        ? withdrawals.map((item) => ({
            ...item,
            receiptTipo: "saque" as const,
          }))
        : allItems;

  const filteredItems = useMemo(() => {
    const search = statementSearch.trim().toLowerCase();
    return visibleItems.filter((item) => {
      const isCredit =
        item.receiptTipo === "lancamento" && item.direcao === "credito";
      if (statementFilter === "entradas" && !isCredit) return false;
      if (statementFilter === "saidas" && isCredit) return false;
      if (!search) return true;
      return [
        movementTitle(item),
        movementStatus(item),
        item.billing_type,
        item.finalidade,
        item.tipo,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }, [statementFilter, statementSearch, visibleItems]);

  const statementGroups = useMemo(() => {
    const groups: Array<{ label: string; items: TypedMovement[] }> = [];
    for (const item of filteredItems) {
      const dateValue = item.pago_em || item.created_at;
      const date = dateValue ? new Date(dateValue) : null;
      const label =
        date && !Number.isNaN(date.getTime())
          ? date.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "Data a confirmar";
      const current = groups[groups.length - 1];
      if (current?.label === label) current.items.push(item);
      else groups.push({ label, items: [item] });
    }
    return groups;
  }, [filteredItems]);

  const totals = useMemo(() => {
    const creditos = movements
      .filter((item) => item.direcao === "credito")
      .reduce((sum, item) => sum + Number(item.valor_centavos || 0), 0);
    const debitosMov = movements
      .filter((item) => item.direcao === "debito")
      .reduce((sum, item) => sum + Number(item.valor_centavos || 0), 0);
    const pagamentos = payments.reduce(
      (sum, item) => sum + Number(item.valor_centavos || 0),
      0,
    );
    const saques = withdrawals
      .filter(
        (item) =>
          !["cancelado", "recusado"].includes(
            String(item.status || "").toLowerCase(),
          ),
      )
      .reduce((sum, item) => sum + Number(item.valor_centavos || 0), 0);
    const pending = [...payments, ...withdrawals].filter((item) =>
      [
        "pendente",
        "solicitado",
        "processando",
        "aguardando_pagamento",
      ].includes(String(item.status || "").toLowerCase()),
    ).length;
    return { creditos, debitos: debitosMov + pagamentos + saques, pending };
  }, [movements, payments, withdrawals]);

  function normalizePixKey(value: string, type: PixType) {
    const raw = value.trim();
    if (type === "cpf" || type === "cnpj" || type === "telefone")
      return raw.replace(/[^\d+]/g, "");
    return raw;
  }

  function validatePix() {
    const key = normalizePixKey(pixKey, pixType);
    if (!key || key.length < 5) return "Informe uma chave PIX válida.";
    if (pixType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key))
      return "Informe um e-mail válido.";
    if (pixType === "cpf" && key.replace(/\D/g, "").length !== 11)
      return "CPF deve ter 11 números.";
    if (pixType === "cnpj" && key.replace(/\D/g, "").length !== 14)
      return "CNPJ deve ter 14 números.";
    if (pixType === "telefone" && key.replace(/\D/g, "").length < 10)
      return "Informe um telefone válido com DDD.";
    return null;
  }

  async function savePix() {
    const validation = validatePix();
    if (validation) {
      setPixFeedback("");
      setError(validation);
      return;
    }
    setPixSaving(true);
    setError(null);
    setPixFeedback("");
    try {
      const response = await mobileApi.updateWalletPix(
        {
          pix_chave: normalizePixKey(pixKey, pixType),
          pix_tipo: pixType,
          pix_titular: pixHolder.trim() || null,
        },
        accessToken,
        auth.activeProfileType,
      );
      setWallet((current) => ({
        ...(current || {}),
        ...(response.carteira || {}),
      }));
      setPixEditing(false);
      setPixFeedback("Chave PIX atualizada com segurança.");
      await loadWallet(true);
    } catch (err: any) {
      setError(err?.message || "Não foi possível salvar a chave PIX.");
    } finally {
      setPixSaving(false);
    }
  }

  function removePix() {
    if (!wallet?.pix_chave || pixSaving) return;
    Alert.alert(
      "Remover chave PIX?",
      "A chave será desvinculada da carteira. O histórico financeiro não será apagado.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: () =>
            void (async () => {
              setPixSaving(true);
              setError(null);
              setPixFeedback("");
              try {
                const response = await mobileApi.removeWalletPix(
                  accessToken,
                  auth.activeProfileType,
                );
                setWallet((current) => ({
                  ...(current || {}),
                  ...(response.carteira || {}),
                }));
                setPixType("aleatoria");
                setPixKey("");
                setPixHolder("");
                setPixEditing(false);
                setPixFeedback("Chave PIX removida.");
                await loadWallet(true);
              } catch (err: any) {
                setError(
                  err?.message || "Não foi possível remover a chave PIX.",
                );
              } finally {
                setPixSaving(false);
              }
            })(),
        },
      ],
    );
  }

  function withdrawAmountCents() {
    const normalized = withdrawAmount
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const amount = Number(normalized);
    if (!Number.isFinite(amount)) return 0;
    return Math.round(amount * 100);
  }

  function withdrawalValidation() {
    const amount = withdrawAmountCents();
    if (!wallet?.pix_chave)
      return "Cadastre uma chave PIX antes de solicitar saque.";
    if (amount < 1000) return "Valor mínimo para saque: R$ 10,00.";
    if (amount > Number(wallet?.saldo_disponivel_centavos || 0))
      return "O valor solicitado é maior que o saldo disponível.";
    return null;
  }

  function requestWithdrawal() {
    const validation = withdrawalValidation();
    if (validation) {
      setWithdrawFeedback("");
      setError(validation);
      return;
    }
    const amount = withdrawAmountCents();
    Alert.alert(
      "Confirmar saque?",
      `${cents(amount)} será solicitado para a chave PIX ${wallet?.pix_chave}.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar saque",
          onPress: () =>
            void (async () => {
              setWithdrawSubmitting(true);
              setError(null);
              setWithdrawFeedback("");
              try {
                await mobileApi.requestWithdrawal(
                  {
                    valor_centavos: amount,
                    pix_chave: wallet?.pix_chave,
                    pix_tipo: wallet?.pix_tipo,
                    titular_nome: wallet?.pix_titular,
                  },
                  accessToken,
                  auth.activeProfileType,
                );
                setWithdrawAmount("");
                setWithdrawFeedback(
                  "Saque solicitado. Acompanhe o status abaixo.",
                );
                await loadWallet(true);
              } catch (err: any) {
                setError(err?.message || "Não foi possível solicitar o saque.");
              } finally {
                setWithdrawSubmitting(false);
              }
            })(),
        },
      ],
    );
  }

  function withdrawalStage(status?: string | null) {
    const value = String(status || "solicitado").toLowerCase();
    if (["pago", "concluido", "finalizado"].includes(value)) return 3;
    if (["processando", "aprovado", "em_processamento"].includes(value))
      return 2;
    if (["cancelado", "recusado", "falhou"].includes(value)) return -1;
    return 1;
  }

  async function shareReceipt(receiptData: WalletReceipt) {
    const lines = [
      "DROPZONE PAY · COMPROVANTE",
      `Valor: ${cents(receiptData.valor_centavos)}`,
      `Descrição: ${receiptData.descricao || "Movimento DropZone"}`,
      `Status: ${String(receiptData.status || "-").replaceAll("_", " ")}`,
      `Data: ${compactDate(receiptData.data_movimento)}`,
      receiptData.origem?.nome ? `Origem: ${receiptData.origem.nome}` : "",
      receiptData.destino?.nome ? `Destino: ${receiptData.destino.nome}` : "",
      receiptData.destino?.chave_pix
        ? `Chave PIX: ${receiptData.destino.chave_pix}`
        : "",
      `Autenticação: ${receiptData.autenticacao || receiptData.id || "-"}`,
    ].filter(Boolean);
    await Share.share({ message: lines.join("\n") });
  }

  async function openReceipt(target: ReceiptTarget) {
    setReceiptLoading(true);
    try {
      const response = await mobileApi.receipt(
        target.id,
        target.tipo,
        accessToken,
      );
      setReceipt(response.comprovante as WalletReceipt);
    } catch (err: any) {
      setReceipt({
        id: target.id,
        tipo: target.tipo,
        status: "indisponível",
        valor_centavos: 0,
        descricao: err?.message || "Comprovante indisponível agora.",
        autenticacao: target.id.replaceAll("-", "").slice(0, 24).toUpperCase(),
      });
    } finally {
      setReceiptLoading(false);
    }
  }

  const saldo = balanceVisible
    ? cents(wallet?.saldo_disponivel_centavos)
    : "R$ ••••••";
  const bloqueado = balanceVisible
    ? cents(wallet?.saldo_bloqueado_centavos)
    : "R$ ••••";

  return (
    <ScreenShell eyebrow="Conta digital" title="Carteira" onBack={onBack}>
      <View style={styles.bankCard}>
        <View style={styles.bankCardTop}>
          <View>
            <Text style={styles.bankBrand}>DROPZONE PAY</Text>
            <Text style={styles.accountLabel}>CONTA COMPETITIVA</Text>
          </View>
          <View style={styles.cardMark}>
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={colors.surface}
            />
          </View>
        </View>

        <View style={styles.balanceHead}>
          <View>
            <Text style={styles.balanceLabel}>Saldo disponível</Text>
            <Text style={styles.balanceValue}>{saldo}</Text>
          </View>
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setBalanceVisible((value) => !value)}
          >
            <Ionicons
              name={balanceVisible ? "eye-outline" : "eye-off-outline"}
              size={20}
              color={colors.surface}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.cardDivider} />
        <View style={styles.bankMetaRow}>
          <View style={styles.bankMeta}>
            <Text style={styles.bankMetaLabel}>SALDO BLOQUEADO</Text>
            <Text style={styles.bankMetaValue}>{bloqueado}</Text>
          </View>
          <View style={styles.bankMeta}>
            <Text style={styles.bankMetaLabel}>PIX</Text>
            <Text style={styles.bankMetaValue}>
              {wallet?.pix_chave ? "ATIVO" : "PENDENTE"}
            </Text>
          </View>
          <View style={styles.bankMeta}>
            <Text style={styles.bankMetaLabel}>PERFIL</Text>
            <Text style={styles.bankMetaValue} numberOfLines={1}>
              {String(auth.activeProfileType || "USUÁRIO").toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.quickActions}>
        <QuickAction
          icon="cash-outline"
          label="Saque"
          primary
          onPress={() => {
            setTab("saques");
            setWithdrawFeedback("");
          }}
        />
        <QuickAction
          icon="qr-code-outline"
          label="PIX"
          onPress={() => setTab("pix")}
        />
        <QuickAction
          icon="receipt-outline"
          label="Extrato"
          onPress={() => setTab("extrato")}
        />
        <QuickAction
          icon="refresh-outline"
          label={refreshing ? "Atualizando" : "Atualizar"}
          onPress={() => void loadWallet(true)}
        />
      </View>

      <View style={styles.insights}>
        <Insight
          icon="arrow-down-outline"
          label="Entradas"
          value={balanceVisible ? cents(totals.creditos) : "R$ ••••"}
          tone="positive"
        />
        <Insight
          icon="arrow-up-outline"
          label="Saídas"
          value={balanceVisible ? cents(totals.debitos) : "R$ ••••"}
        />
        <Insight
          icon="time-outline"
          label="Pendências"
          value={String(totals.pending)}
        />
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>MOVIMENTAÇÕES</Text>
          <Text style={styles.sectionTitle}>Sua atividade financeira</Text>
        </View>
        <Ionicons name="lock-closed-outline" size={17} color={colors.muted} />
      </View>

      <View style={styles.tabs}>
        {(
          [
            ["extrato", "Extrato"],
            ["pagamentos", "Pagamentos"],
            ["saques", "Saques"],
            ["pix", "PIX"],
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
          <Text style={styles.muted}>Sincronizando sua conta...</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}

      {tab === "pix" ? (
        <View style={styles.pixArea}>
          <View style={styles.pixCard}>
            <View style={styles.pixIcon}>
              <Ionicons
                name="qr-code-outline"
                size={23}
                color={colors.surface}
              />
            </View>
            <View style={styles.pixCopy}>
              <Text style={styles.pixKicker}>CHAVE PIX PARA RECEBIMENTOS</Text>
              <Text style={styles.pixValue} numberOfLines={2}>
                {wallet?.pix_chave || "Nenhuma chave cadastrada"}
              </Text>
              <Text style={styles.muted}>
                {wallet?.pix_chave
                  ? `${String(wallet.pix_tipo || "pix").toUpperCase()} · ${wallet.pix_titular || "Titular da conta"}`
                  : "Cadastre uma chave PIX para liberar solicitações de saque."}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.pixEditButton}
              onPress={() => setPixEditing(true)}
            >
              <Ionicons
                name={wallet?.pix_chave ? "pencil-outline" : "add-outline"}
                size={18}
                color={colors.ink}
              />
            </TouchableOpacity>
          </View>

          {pixFeedback ? (
            <Text style={styles.success}>{pixFeedback}</Text>
          ) : null}

          {pixEditing || !wallet?.pix_chave ? (
            <View style={styles.pixForm}>
              <View>
                <Text style={styles.formEyebrow}>GESTÃO DA CHAVE PIX</Text>
                <Text style={styles.formTitle}>
                  {wallet?.pix_chave
                    ? "Editar chave cadastrada"
                    : "Cadastrar chave PIX"}
                </Text>
                <Text style={styles.formHint}>
                  A chave é usada como destino das solicitações de saque desta
                  carteira.
                </Text>
              </View>

              <Text style={styles.fieldLabel}>TIPO DA CHAVE</Text>
              <View style={styles.pixTypes}>
                {(
                  [
                    ["cpf", "CPF"],
                    ["cnpj", "CNPJ"],
                    ["email", "E-mail"],
                    ["telefone", "Telefone"],
                    ["aleatoria", "Aleatória"],
                  ] as Array<[PixType, string]>
                ).map(([id, label]) => (
                  <TouchableOpacity
                    key={id}
                    style={[
                      styles.pixType,
                      pixType === id && styles.pixTypeActive,
                    ]}
                    onPress={() => setPixType(id)}
                  >
                    <Text
                      style={[
                        styles.pixTypeText,
                        pixType === id && styles.pixTypeTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>CHAVE PIX</Text>
              <TextInput
                value={pixKey}
                onChangeText={setPixKey}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={
                  pixType === "cpf" ||
                  pixType === "cnpj" ||
                  pixType === "telefone"
                    ? "phone-pad"
                    : pixType === "email"
                      ? "email-address"
                      : "default"
                }
                placeholder={
                  pixType === "email"
                    ? "nome@email.com"
                    : pixType === "telefone"
                      ? "+55 91 99999-9999"
                      : "Digite a chave PIX"
                }
                placeholderTextColor={colors.muted}
              />

              <Text style={styles.fieldLabel}>TITULAR</Text>
              <TextInput
                value={pixHolder}
                onChangeText={setPixHolder}
                style={styles.input}
                autoCapitalize="words"
                placeholder="Nome do titular"
                placeholderTextColor={colors.muted}
              />

              <View style={styles.pixFormActions}>
                {wallet?.pix_chave ? (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    disabled={pixSaving}
                    onPress={() => {
                      setPixEditing(false);
                      setPixType((wallet.pix_tipo as PixType) || "aleatoria");
                      setPixKey(String(wallet.pix_chave || ""));
                      setPixHolder(String(wallet.pix_titular || ""));
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.primaryButton}
                  disabled={pixSaving}
                  onPress={() => void savePix()}
                >
                  {pixSaving ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      Salvar chave PIX
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {wallet?.pix_chave && !pixEditing ? (
            <View style={styles.pixSecurity}>
              <Ionicons
                name="shield-checkmark-outline"
                size={19}
                color="#166534"
              />
              <View style={styles.pixSecurityCopy}>
                <Text style={styles.pixSecurityTitle}>CHAVE VINCULADA</Text>
                <Text style={styles.pixSecurityText}>
                  Esta chave será usada como destino padrão dos seus saques.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.removePixButton}
                disabled={pixSaving}
                onPress={removePix}
              >
                <Text style={styles.removePixText}>Remover</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}

      {tab === "saques" ? (
        <View style={styles.withdrawArea}>
          <View style={styles.withdrawCard}>
            <View style={styles.withdrawHead}>
              <View>
                <Text style={styles.formEyebrow}>SAQUE VIA PIX</Text>
                <Text style={styles.formTitle}>Transferir saldo</Text>
              </View>
              <View style={styles.availablePill}>
                <Text style={styles.availableLabel}>DISPONÍVEL</Text>
                <Text style={styles.availableValue}>
                  {balanceVisible
                    ? cents(wallet?.saldo_disponivel_centavos)
                    : "R$ ••••"}
                </Text>
              </View>
            </View>

            <Text style={styles.fieldLabel}>VALOR DO SAQUE</Text>
            <View style={styles.amountInputWrap}>
              <Text style={styles.currencyPrefix}>R$</Text>
              <TextInput
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                style={styles.amountInput}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={colors.muted}
              />
            </View>
            <Text style={styles.withdrawHint}>
              Mínimo R$ 10,00 · o saldo é reservado quando a solicitação é
              criada.
            </Text>

            <View style={styles.destinationCard}>
              <View style={styles.destinationIcon}>
                <Ionicons
                  name="flash-outline"
                  size={18}
                  color={colors.surface}
                />
              </View>
              <View style={styles.destinationCopy}>
                <Text style={styles.destinationLabel}>DESTINO PIX</Text>
                <Text style={styles.destinationValue} numberOfLines={1}>
                  {wallet?.pix_chave || "Chave PIX não cadastrada"}
                </Text>
                <Text style={styles.destinationMeta}>
                  {wallet?.pix_chave
                    ? `${String(wallet.pix_tipo || "pix").toUpperCase()} · ${wallet.pix_titular || "Titular da conta"}`
                    : "Abra a aba PIX e cadastre uma chave antes de sacar."}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.withdrawButton,
                (!wallet?.pix_chave || withdrawSubmitting) &&
                  styles.withdrawButtonDisabled,
              ]}
              disabled={!wallet?.pix_chave || withdrawSubmitting}
              onPress={requestWithdrawal}
            >
              {withdrawSubmitting ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.withdrawButtonText}>
                  Revisar e solicitar saque
                </Text>
              )}
            </TouchableOpacity>
            {withdrawFeedback ? (
              <Text style={styles.success}>{withdrawFeedback}</Text>
            ) : null}
          </View>

          {withdrawals.length ? (
            <View style={styles.withdrawHistory}>
              <View style={styles.withdrawHistoryHead}>
                <Text style={styles.sectionEyebrow}>ACOMPANHAMENTO</Text>
                <Text style={styles.historyCount}>
                  {withdrawals.length} solicitação(ões)
                </Text>
              </View>
              {withdrawals.slice(0, 10).map((item, index) => {
                const stage = withdrawalStage(item.status);
                const failed = stage < 0;
                return (
                  <TouchableOpacity
                    key={`withdraw-${item.id || index}`}
                    style={[
                      styles.withdrawItem,
                      index > 0 && styles.movementBorder,
                    ]}
                    onPress={() =>
                      item.id &&
                      openReceipt({ id: String(item.id), tipo: "saque" })
                    }
                  >
                    <View style={styles.withdrawItemTop}>
                      <View>
                        <Text style={styles.withdrawItemValue}>
                          {cents(item.valor_centavos)}
                        </Text>
                        <Text style={styles.movementMeta}>
                          {compactDate(item.created_at)} ·{" "}
                          {movementStatus(item)}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={colors.muted}
                      />
                    </View>
                    <View style={styles.timeline}>
                      <TimelineStep
                        label="Solicitado"
                        active={stage >= 1}
                        failed={failed}
                      />
                      <View
                        style={[
                          styles.timelineLine,
                          stage >= 2 && styles.timelineLineActive,
                        ]}
                      />
                      <TimelineStep
                        label="Processando"
                        active={stage >= 2}
                        failed={failed}
                      />
                      <View
                        style={[
                          styles.timelineLine,
                          stage >= 3 && styles.timelineLineActive,
                        ]}
                      />
                      <TimelineStep
                        label={failed ? "Interrompido" : "Pago"}
                        active={stage >= 3 || failed}
                        failed={failed}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      {receipt ? (
        <View style={styles.receipt}>
          <View style={styles.receiptHead}>
            <View>
              <Text style={styles.receiptKicker}>COMPROVANTE DROPZONE PAY</Text>
              <Text style={styles.receiptValue}>
                {cents(receipt.valor_centavos)}
              </Text>
            </View>
            <View style={styles.receiptActions}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => void shareReceipt(receipt)}
              >
                <Ionicons
                  name="share-social-outline"
                  size={18}
                  color={colors.surface}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setReceipt(null)}
              >
                <Ionicons name="close" size={20} color={colors.surface} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.receiptDivider} />
          <ReceiptLine
            label="Descrição"
            value={receipt.descricao || "Movimento DropZone"}
          />
          <ReceiptLine
            label="Status"
            value={String(receipt.status || "-").replaceAll("_", " ")}
          />
          <ReceiptLine
            label="Data"
            value={compactDate(receipt.data_movimento)}
          />
          {receipt.destino?.nome ? (
            <ReceiptLine label="Destino" value={receipt.destino.nome} />
          ) : null}
          {receipt.destino?.instituicao ? (
            <ReceiptLine
              label="Instituição destino"
              value={receipt.destino.instituicao}
            />
          ) : null}
          {receipt.destino?.chave_pix ? (
            <ReceiptLine label="Chave PIX" value={receipt.destino.chave_pix} />
          ) : null}
          {receipt.origem?.nome ? (
            <ReceiptLine label="Origem" value={receipt.origem.nome} />
          ) : null}
          {receipt.origem?.instituicao ? (
            <ReceiptLine
              label="Instituição origem"
              value={receipt.origem.instituicao}
            />
          ) : null}
          <View style={styles.authBox}>
            <Text style={styles.authLabel}>AUTENTICAÇÃO</Text>
            <Text style={styles.authCode} selectable>
              {receipt.autenticacao || receipt.id}
            </Text>
          </View>
        </View>
      ) : null}

      {receiptLoading ? (
        <Text style={styles.muted}>Abrindo comprovante...</Text>
      ) : null}

      {tab !== "pix" && tab !== "saques" ? (
        <View style={styles.statementArea}>
          <View style={styles.statementTools}>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={16} color={colors.muted} />
              <TextInput
                value={statementSearch}
                onChangeText={setStatementSearch}
                style={styles.searchInput}
                placeholder="Buscar no extrato"
                placeholderTextColor={colors.muted}
              />
              {statementSearch ? (
                <TouchableOpacity onPress={() => setStatementSearch("")}>
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={colors.muted}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.filterRow}>
              {(
                [
                  ["todos", "Todos"],
                  ["entradas", "Entradas"],
                  ["saidas", "Saídas"],
                ] as Array<[StatementFilter, string]>
              ).map(([id, label]) => (
                <TouchableOpacity
                  key={id}
                  style={[
                    styles.filterButton,
                    statementFilter === id && styles.filterButtonActive,
                  ]}
                  onPress={() => setStatementFilter(id)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      statementFilter === id && styles.filterTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {statementGroups.map((group) => (
            <View key={group.label} style={styles.statementGroup}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateHeaderText}>{group.label}</Text>
                <Text style={styles.dateHeaderCount}>{group.items.length}</Text>
              </View>
              <View style={styles.statement}>
                {group.items.map((item, index) => {
                  const credit =
                    item.receiptTipo === "lancamento" &&
                    item.direcao === "credito";
                  const amount = `${credit ? "+" : "-"} ${cents(item.valor_centavos)}`;
                  return (
                    <TouchableOpacity
                      key={`${item.receiptTipo}-${item.id}-${index}`}
                      style={[
                        styles.movement,
                        index > 0 && styles.movementBorder,
                      ]}
                      onPress={() =>
                        item.id &&
                        openReceipt({
                          id: String(item.id),
                          tipo: item.receiptTipo,
                        })
                      }
                    >
                      <View
                        style={[
                          styles.movementIcon,
                          credit && styles.movementIconPositive,
                        ]}
                      >
                        <Ionicons
                          name={credit ? "arrow-down-outline" : "card-outline"}
                          size={18}
                          color={credit ? "#166534" : colors.ink}
                        />
                      </View>
                      <View style={styles.movementText}>
                        <Text style={styles.movementTitle} numberOfLines={1}>
                          {movementTitle(item)}
                        </Text>
                        <Text style={styles.movementMeta}>
                          {compactDate(item.pago_em || item.created_at)} ·{" "}
                          {movementStatus(item)}
                        </Text>
                      </View>
                      <View style={styles.amountColumn}>
                        <Text
                          style={[
                            styles.movementValue,
                            credit && styles.movementValuePositive,
                          ]}
                        >
                          {balanceVisible ? amount : "R$ ••••"}
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={colors.muted}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {!loading && filteredItems.length === 0 ? (
            <ActionCard
              title="Nenhum resultado"
              description={
                statementSearch || statementFilter !== "todos"
                  ? "Ajuste a busca ou os filtros do extrato."
                  : "Pagamentos, comissões, repasses e saques aparecem aqui."
              }
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.security}>
        <Ionicons name="shield-checkmark-outline" size={20} color="#166534" />
        <View style={styles.securityCopy}>
          <Text style={styles.securityTitle}>AMBIENTE PROTEGIDO</Text>
          <Text style={styles.securityText}>
            Sua carteira usa autenticação da conta ativa e os comprovantes são
            consultados diretamente no histórico financeiro.
          </Text>
        </View>
      </View>
    </ScreenShell>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickIcon, primary && styles.quickIconPrimary]}>
        <Ionicons
          name={icon}
          size={20}
          color={primary ? colors.surface : colors.ink}
        />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Insight({
  icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  tone?: "positive";
}) {
  return (
    <View style={styles.insight}>
      <View style={styles.insightTop}>
        <Ionicons
          name={icon}
          size={15}
          color={tone === "positive" ? "#166534" : colors.muted}
        />
        <Text style={styles.insightLabel}>{label}</Text>
      </View>
      <Text style={styles.insightValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function TimelineStep({
  label,
  active,
  failed,
}: {
  label: string;
  active: boolean;
  failed?: boolean;
}) {
  return (
    <View style={styles.timelineStep}>
      <View
        style={[
          styles.timelineDot,
          active && styles.timelineDotActive,
          failed && active && styles.timelineDotFailed,
        ]}
      />
      <Text
        style={[
          styles.timelineLabel,
          active && styles.timelineLabelActive,
          failed && active && styles.timelineLabelFailed,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function ReceiptLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.receiptLine}>
      <Text style={styles.receiptLineLabel}>{label}</Text>
      <Text style={styles.receiptLineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bankCard: {
    backgroundColor: colors.brandDark,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 14,
    borderRadius: 12,
  },
  bankCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bankBrand: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  accountLabel: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  cardMark: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  balanceHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  balanceLabel: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  balanceValue: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -1,
  },
  eyeButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceRaised,
  },
  cardDivider: { height: 1, backgroundColor: colors.line },
  bankMetaRow: { flexDirection: "row", gap: spacing.sm },
  bankMeta: { flex: 1, minWidth: 0 },
  bankMetaLabel: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  bankMetaValue: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  quickAction: { flex: 1, alignItems: "center", gap: 6 },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  quickIconPrimary: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  quickLabel: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  insights: { flexDirection: "row", gap: 7 },
  insight: {
    flex: 1,
    minWidth: 0,
    padding: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  insightTop: { flexDirection: "row", alignItems: "center", gap: 4 },
  insightLabel: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  insightValue: {
    marginTop: 7,
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionEyebrow: {
    color: colors.brand,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  sectionTitle: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  tabs: {
    flexDirection: "row",
    gap: 6,
  },
  tab: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
  },
  tabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  tabTextActive: { color: colors.onBrand },
  loading: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  muted: {
    color: colors.muted,
    fontSize: 9,
    lineHeight: 14,
    fontWeight: "700",
  },
  warning: {
    backgroundColor: "rgba(212, 165, 87, .12)",
    color: colors.warning,
    fontWeight: "800",
    padding: spacing.md,
  },
  pixArea: { gap: 9 },
  pixCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  pixEditButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pixForm: {
    gap: 8,
    padding: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  formEyebrow: {
    color: colors.brand,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  formTitle: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  formHint: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 8,
    lineHeight: 13,
    fontWeight: "700",
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  pixTypes: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  pixType: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 9,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
  },
  pixTypeActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  pixTypeText: { color: colors.ink, fontSize: 8, fontWeight: "900" },
  pixTypeTextActive: { color: colors.onBrand },
  input: {
    minHeight: 42,
    paddingHorizontal: 10,
    color: colors.ink,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    fontSize: 11,
    fontWeight: "700",
  },
  pixFormActions: { flexDirection: "row", gap: 7 },
  primaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  primaryButtonText: {
    color: colors.onBrand,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  secondaryButton: {
    minWidth: 96,
    minHeight: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  pixSecurity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    backgroundColor: "#effaf3",
    borderWidth: 1,
    borderColor: "#b7d8c0",
    borderRadius: 8,
  },
  pixSecurityCopy: { flex: 1 },
  pixSecurityTitle: {
    color: "#166534",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  pixSecurityText: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 8,
    fontWeight: "700",
  },
  removePixButton: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  removePixText: {
    color: "#9a3412",
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  success: {
    backgroundColor: "#effaf3",
    color: "#166534",
    fontWeight: "800",
    padding: spacing.md,
  },
  pixIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b1320",
  },
  pixCopy: { flex: 1, gap: 4 },
  pixKicker: {
    color: colors.brand,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  pixValue: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  withdrawArea: { gap: 9 },
  withdrawCard: {
    gap: 9,
    padding: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  withdrawHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  availablePill: {
    alignItems: "flex-end",
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: "#eee9e1",
    borderRadius: 7,
  },
  availableLabel: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  availableValue: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
  },
  amountInputWrap: {
    minHeight: 50,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: "#f2eee7",
    borderWidth: 1,
    borderColor: colors.line,
  },
  currencyPrefix: { color: colors.muted, fontSize: 14, fontWeight: "900" },
  amountInput: {
    flex: 1,
    paddingHorizontal: 8,
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  withdrawHint: { color: colors.muted, fontSize: 8, fontWeight: "700" },
  destinationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 9,
    backgroundColor: "#eee9e1",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  destinationIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b1320",
  },
  destinationCopy: { flex: 1, minWidth: 0 },
  destinationLabel: {
    color: colors.brand,
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  destinationValue: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
  },
  destinationMeta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 8,
    fontWeight: "700",
  },
  withdrawButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  withdrawButtonDisabled: { opacity: 0.5 },
  withdrawButtonText: {
    color: colors.surface,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  withdrawHistory: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    overflow: "hidden",
  },
  withdrawHistoryHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    backgroundColor: "#eee9e1",
  },
  historyCount: { color: colors.muted, fontSize: 8, fontWeight: "800" },
  withdrawItem: { padding: 11, gap: 10 },
  withdrawItemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  withdrawItemValue: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  timeline: { flexDirection: "row", alignItems: "flex-start" },
  timelineStep: { width: 62, alignItems: "center", gap: 4 },
  timelineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#d4cec5",
    borderWidth: 2,
    borderColor: "#eee9e1",
  },
  timelineDotActive: { backgroundColor: "#0b1320", borderColor: "#0b1320" },
  timelineDotFailed: { backgroundColor: "#9a3412", borderColor: "#9a3412" },
  timelineLine: {
    flex: 1,
    height: 2,
    marginTop: 4,
    backgroundColor: "#d4cec5",
  },
  timelineLineActive: { backgroundColor: "#0b1320" },
  timelineLabel: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: "800",
    textAlign: "center",
  },
  timelineLabelActive: { color: colors.ink },
  timelineLabelFailed: { color: "#9a3412" },
  receipt: {
    backgroundColor: "#0b1320",
    padding: spacing.md,
    gap: 8,
    borderBottomWidth: 3,
    borderBottomColor: colors.brand,
    borderRadius: 10,
  },
  receiptHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  receiptActions: { flexDirection: "row", gap: 6 },
  receiptKicker: {
    color: colors.gold,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  receiptValue: {
    marginTop: 4,
    color: colors.surface,
    fontSize: 22,
    fontWeight: "900",
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#394456",
  },
  receiptDivider: { height: 1, backgroundColor: "#273244" },
  receiptLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  receiptLineLabel: { color: "#8994a3", fontSize: 8, fontWeight: "800" },
  receiptLineValue: {
    flex: 1,
    color: colors.surface,
    fontSize: 9,
    fontWeight: "800",
    textAlign: "right",
    textTransform: "capitalize",
  },
  authBox: {
    marginTop: 3,
    padding: 9,
    backgroundColor: "#111c2d",
    borderRadius: 7,
  },
  authLabel: {
    color: "#8994a3",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1,
  },
  authCode: {
    marginTop: 4,
    color: colors.surface,
    fontSize: 9,
    fontWeight: "900",
  },
  statementArea: { gap: 9 },
  statementTools: { gap: 7 },
  searchWrap: {
    minHeight: 40,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 10, fontWeight: "700" },
  filterRow: { flexDirection: "row", gap: 5 },
  filterButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eee9e1",
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterButtonActive: { backgroundColor: "#0b1320", borderColor: "#0b1320" },
  filterText: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  filterTextActive: { color: colors.surface },
  statementGroup: { gap: 5 },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 3,
  },
  dateHeaderText: {
    color: colors.ink,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  dateHeaderCount: {
    minWidth: 24,
    textAlign: "center",
    paddingVertical: 3,
    backgroundColor: "#ddd7ce",
    color: colors.muted,
    fontSize: 7,
    fontWeight: "900",
  },
  statement: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  movement: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 10,
  },
  movementBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  movementIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eee9e1",
  },
  movementIconPositive: { backgroundColor: "#effaf3" },
  movementText: { flex: 1, minWidth: 0 },
  movementTitle: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  movementMeta: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 8,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  amountColumn: { alignItems: "flex-end", gap: 5 },
  movementValue: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  movementValuePositive: { color: "#166534" },
  security: {
    flexDirection: "row",
    gap: 9,
    padding: 12,
    backgroundColor: "#effaf3",
    borderWidth: 1,
    borderColor: "#b7d8c0",
  },
  securityCopy: { flex: 1 },
  securityTitle: {
    color: "#166534",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  securityText: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 8,
    lineHeight: 13,
    fontWeight: "700",
  },
});
