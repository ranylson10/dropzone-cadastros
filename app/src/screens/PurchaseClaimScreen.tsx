import { useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Image, Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { PaymentMethod, paymentMethodLabel, VacancyPaymentResult } from '@/lib/payments'
import { ActionCard, ScreenShell } from '@/screens/components'
import { colors, radius, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

export function PurchaseClaimScreen({ onBack, onNavigate, selectedChampionship }: ScreenProps) {
  const auth = useAuth()
  const championship = selectedChampionship
  const token = auth.session?.access_token
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [loading, setLoading] = useState(false)
  const [claimLoading, setClaimLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [payment, setPayment] = useState<VacancyPaymentResult | null>(null)
  const [claimContext, setClaimContext] = useState<any>(null)
  const [teamId, setTeamId] = useState('')
  const [lineId, setLineId] = useState('')
  const [newLineName, setNewLineName] = useState('')
  const [slotId, setSlotId] = useState('')
  const [claimResult, setClaimResult] = useState<any>(null)
  const checkoutUrl = payment?.payment?.paypal_approval_url || payment?.payment?.invoice_url || ''

  async function startPayment() {
    if (!championship) return
    setLoading(true)
    setError(null)
    setFeedback('')
    try {
      const response = await mobileApi.createVacancyPayment({ campeonato_id: championship.id, method }, token)
      setPayment(response)
      setClaimContext(null)
      setClaimResult(null)
      const url = response.payment?.paypal_approval_url || response.payment?.invoice_url
      if (url) await Linking.openURL(url)
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar o pagamento.')
    } finally {
      setLoading(false)
    }
  }

  async function refreshClaimContext(nextTeamId?: string) {
    const purchaseToken = payment?.compra?.token
    if (!purchaseToken || claimLoading) return
    setClaimLoading(true)
    setError(null)
    setFeedback('')
    try {
      const result = await mobileApi.vacancyClaimContext(purchaseToken, nextTeamId || teamId || null, token)
      setClaimContext(result)
      const resolvedTeamId = String(nextTeamId || result.equipe_selecionada_id || result.equipes?.[0]?.id || '')
      setTeamId(resolvedTeamId)
      setLineId('')
      setNewLineName('')
      setSlotId('')
      if (result.consumido) setFeedback('Esta compra já foi utilizada e a vaga está confirmada.')
      else if (result.liberado) setFeedback('Pagamento confirmado. Escolha equipe, line e slot.')
      else setFeedback('Pagamento ainda não confirmado. Atualize novamente após a confirmação.')
    } catch (err:any) {
      setError(err?.message || 'Não foi possível atualizar a inscrição.')
    } finally {
      setClaimLoading(false)
    }
  }

  async function selectTeam(id:string) {
    setTeamId(id)
    setLineId('')
    setNewLineName('')
    setSlotId('')
    await refreshClaimContext(id)
  }

  async function finishClaim() {
    const purchaseToken = payment?.compra?.token
    if (!purchaseToken || !teamId || !slotId || (!lineId && !newLineName.trim()) || claimLoading) return
    setClaimLoading(true)
    setError(null)
    setFeedback('')
    try {
      const result = await mobileApi.claimVacancyPurchase({
        token:purchaseToken,
        equipe_id:teamId,
        slot_id:slotId,
        line_id:lineId || null,
        nome_line:lineId ? null : newLineName.trim(),
      }, token)
      setClaimResult(result)
      setFeedback(result?.mensagem || 'Vaga confirmada no campeonato.')
      await refreshClaimContext(teamId)
    } catch (err:any) {
      setError(err?.message || 'Não foi possível concluir a inscrição.')
    } finally {
      setClaimLoading(false)
    }
  }

  if (!championship) {
    return (
      <ScreenShell eyebrow="Compra" title="Escolha uma vaga" onBack={onBack}>
        <ActionCard title="Nenhum campeonato selecionado" description="Volte para a vitrine e escolha uma vaga." cta="Ver vagas" onPress={() => onNavigate('vacancies')} />
      </ScreenShell>
    )
  }

  const teams = Array.isArray(claimContext?.equipes) ? claimContext.equipes : []
  const lines = Array.isArray(claimContext?.lines) ? claimContext.lines : []
  const slots = Array.isArray(claimContext?.slots_livres) ? claimContext.slots_livres : []
  const liberated = Boolean(claimContext?.liberado)
  const consumed = Boolean(claimContext?.consumido)
  const canFinish = liberated && teamId && slotId && Boolean(lineId || newLineName.trim())

  return (
    <ScreenShell eyebrow="Garantir vaga" title={championship.name} onBack={onBack}>
      <View style={styles.hero}>
        {championship.bannerUrl ? <Image source={{ uri: championship.bannerUrl }} style={styles.heroImage} /> : null}
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          {championship.logoUrl ? <Image source={{ uri: championship.logoUrl }} style={styles.logo} /> : null}
          <Text style={styles.mode}>{championship.mode}</Text>
          <Text style={styles.name}>{championship.name}</Text>
          <View style={styles.pills}>
            <Pill label="inscrição" value={championship.priceLabel} />
            <Pill label="prêmio" value={championship.prizeLabel || '-'} />
            <Pill label="vagas" value={String(championship.freeSlots)} />
          </View>
        </View>
      </View>

      <View style={styles.paymentCard}>
        <Text style={styles.sectionTitle}>1 · Pagamento</Text>
        <View style={styles.methodRow}>
          {(['pix', 'cartao', 'paypal'] as PaymentMethod[]).map((item) => (
            <TouchableOpacity key={item} style={[styles.method, method === item && styles.methodActive]} onPress={() => setMethod(item)}>
              <Text style={[styles.methodText, method === item && styles.methodTextActive]}>{paymentMethodLabel[item]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {error ? <Text style={styles.warning}>{error}</Text> : null}
        {feedback ? <Text style={styles.success}>{feedback}</Text> : null}
        <TouchableOpacity style={styles.primary} disabled={loading} onPress={startPayment}>
          {loading ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>{payment ? 'Atualizar cobrança' : 'Gerar pagamento'}</Text>}
        </TouchableOpacity>
      </View>

      {payment ? (
        <View style={styles.result}>
          <Text style={styles.resultKicker}>Pagamento criado</Text>
          <Text style={styles.token}>Token {payment.compra.token}</Text>
          <Text style={styles.resultLine}>Status: {payment.compra.status}</Text>
          <Text style={styles.resultLine}>Valor: {(payment.compra.valor_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
          {payment.payment?.pix_payload ? <Text style={styles.copyBox} selectable>{payment.payment.pix_payload}</Text> : null}
          <View style={styles.resultActions}>
            {checkoutUrl ? <TouchableOpacity style={styles.secondary} onPress={() => Linking.openURL(checkoutUrl)}><Text style={styles.secondaryText}>Abrir pagamento</Text></TouchableOpacity> : null}
            <TouchableOpacity style={styles.secondaryDark} disabled={claimLoading} onPress={() => void refreshClaimContext()}>
              {claimLoading ? <ActivityIndicator color={colors.surface}/> : <Text style={styles.secondaryDarkText}>Verificar pagamento</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {payment && liberated && !consumed ? (
        <View style={styles.claimCard}>
          <Text style={styles.sectionTitle}>2 · Confirmar participação</Text>
          <Text style={styles.claimHint}>Use a equipe que você controla. Cada vaga exige uma line livre neste campeonato.</Text>

          <Text style={styles.label}>EQUIPE</Text>
          <View style={styles.choices}>
            {teams.map((team:any)=><Choice key={String(team.id)} label={team.nome || team.tag || 'Equipe'} active={String(team.id)===teamId} onPress={()=>void selectTeam(String(team.id))}/>)}
          </View>
          {!teams.length ? <ActionCard title="Nenhuma equipe controlável" description="Crie uma equipe ou aceite acesso de staff antes de concluir a vaga." cta="Abrir equipes" onPress={()=>onNavigate('team_roster')}/> : null}

          {teamId ? <>
            <Text style={styles.label}>LINE</Text>
            <View style={styles.choices}>
              {lines.map((line:any)=><Choice key={String(line.id)} label={line.nome || line.tag || 'Line'} active={String(line.id)===lineId} onPress={()=>{setLineId(String(line.id));setNewLineName('')}}/>)}
              <Choice label="Criar nova line" active={!lineId && Boolean(newLineName)} onPress={()=>setLineId('')}/>
            </View>
            {!lineId ? <TextInput value={newLineName} onChangeText={setNewLineName} style={styles.input} placeholder="Nome real da nova line" placeholderTextColor={colors.muted} maxLength={40}/> : null}

            <Text style={styles.label}>SLOT · {claimContext?.grupo?.nome || 'GRUPO LIBERADO'}</Text>
            <View style={styles.choices}>
              {slots.map((slot:any)=><Choice key={String(slot.id)} label={`Slot ${slot.slot_letra || slot.slot_numero}`} active={String(slot.id)===slotId} onPress={()=>setSlotId(String(slot.id))}/>)}
            </View>
            {!slots.length ? <Text style={styles.warning}>Não há slot livre no grupo liberado. Atualize o pagamento para buscar a próxima vaga disponível.</Text> : null}

            <TouchableOpacity style={[styles.primary,!canFinish&&styles.disabled]} disabled={!canFinish||claimLoading} onPress={()=>void finishClaim()}>
              {claimLoading ? <ActivityIndicator color={colors.surface}/> : <Text style={styles.primaryText}>Confirmar vaga no campeonato</Text>}
            </TouchableOpacity>
          </> : null}
        </View>
      ) : null}

      {consumed || claimResult ? (
        <View style={styles.completed}>
          <Ionicons name="checkmark-circle" size={28} color="#166534"/>
          <View style={styles.completedCopy}>
            <Text style={styles.completedTitle}>INSCRIÇÃO CONFIRMADA</Text>
            <Text style={styles.completedText}>{claimResult?.mensagem || 'Sua vaga já foi vinculada a uma line no campeonato.'}</Text>
          </View>
          <TouchableOpacity style={styles.completedButton} onPress={()=>onNavigate('my_championships')}><Text style={styles.completedButtonText}>Meus campeonatos</Text></TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.steps}>
        <Step number="1" text="Pague pelo método escolhido" active />
        <Step number="2" text="Confirme ou escolha a equipe" active={liberated} />
        <Step number="3" text="Escolha line e slot" active={liberated} />
        <Step number="4" text="Escalone o elenco dentro do prazo" active={consumed} />
      </View>
    </ScreenShell>
  )
}

function Choice({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}) {
  return <TouchableOpacity style={[styles.choice,active&&styles.choiceActive]} onPress={onPress}><Text style={[styles.choiceText,active&&styles.choiceTextActive]} numberOfLines={1}>{label}</Text></TouchableOpacity>
}

function Pill(props: { label: string; value: string }) {
  return <View style={styles.pill}><Text style={styles.pillValue} numberOfLines={1}>{props.value}</Text><Text style={styles.pillLabel}>{props.label}</Text></View>
}

function Step(props: { number: string; text: string; active?: boolean }) {
  return <View style={styles.step}><Text style={[styles.stepNumber, props.active && styles.stepNumberActive]}>{props.number}</Text><Text style={styles.stepText}>{props.text}</Text></View>
}

const styles = StyleSheet.create({
  hero: { minHeight: 230, backgroundColor: colors.brandDark, overflow: 'hidden' },
  heroImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: undefined, height: undefined },
  heroOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(8,12,18,.58)' },
  heroContent: { flex: 1, justifyContent: 'flex-end', padding: spacing.md, gap: spacing.sm },
  logo: { width: 58, height: 58, backgroundColor: 'rgba(255,255,255,.9)' },
  mode: { color: colors.gold, fontSize: typography.tiny, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  name: { color: colors.surface, fontSize: 28, lineHeight: 31, fontWeight: '900', textTransform: 'uppercase' },
  pills: { flexDirection: 'row', gap: spacing.sm },
  pill: { flex: 1, backgroundColor: 'rgba(255,255,255,.1)', padding: spacing.sm },
  pillValue: { color: colors.surface, fontSize: typography.caption, fontWeight: '900' },
  pillLabel: { color: '#cbd5e1', fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  paymentCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: typography.subtitle, fontWeight: '900', textTransform: 'uppercase' },
  methodRow: { flexDirection: 'row', gap: spacing.sm },
  method: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.background },
  methodActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  methodText: { color: colors.ink, fontSize: typography.caption, fontWeight: '900' },
  methodTextActive: { color: colors.surface },
  warning: { backgroundColor: '#fff7ed', color: '#9a3412', fontWeight: '800', padding: spacing.md },
  success: { backgroundColor:'#effaf3',color:'#166534',fontWeight:'800',padding:spacing.md },
  primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  primaryText: { color: colors.surface, fontWeight: '900', textTransform: 'uppercase' },
  disabled:{opacity:.45},
  result: { backgroundColor: colors.brandDark, padding: spacing.md, gap: spacing.sm, borderBottomWidth: 3, borderBottomColor: colors.brand },
  resultKicker: { color: colors.gold, fontSize: typography.tiny, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  token: { color: colors.surface, fontSize: typography.subtitle, fontWeight: '900' },
  resultLine: { color: '#d6dae2', fontWeight: '700' },
  copyBox: { backgroundColor: colors.surface, color: colors.ink, fontSize: typography.caption, fontWeight: '800', padding: spacing.md },
  resultActions: { flexDirection: 'row', gap: spacing.sm },
  secondary: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  secondaryText: { color: colors.ink, fontWeight: '900', textTransform: 'uppercase', fontSize: typography.caption },
  secondaryDark: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  secondaryDarkText: { color: colors.surface, fontWeight: '900', textTransform: 'uppercase', fontSize: typography.caption },
  claimCard:{padding:spacing.md,gap:10,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},
  claimHint:{color:colors.muted,fontSize:9,lineHeight:14,fontWeight:'700'},
  label:{color:colors.ink,fontSize:8,fontWeight:'900',letterSpacing:1,marginTop:3},
  choices:{flexDirection:'row',flexWrap:'wrap',gap:5},
  choice:{maxWidth:'100%',minHeight:35,justifyContent:'center',paddingHorizontal:9,backgroundColor:'#eee9e1',borderWidth:1,borderColor:colors.line},
  choiceActive:{backgroundColor:colors.brandDark,borderColor:colors.brandDark},
  choiceText:{color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},
  choiceTextActive:{color:colors.surface},
  input:{minHeight:45,paddingHorizontal:11,color:colors.ink,backgroundColor:'#f2eee7',borderWidth:1,borderColor:colors.line,fontSize:11,fontWeight:'700'},
  completed:{gap:9,padding:13,backgroundColor:'#effaf3',borderWidth:1,borderColor:'#9bc7aa'},
  completedCopy:{gap:3},
  completedTitle:{color:'#166534',fontSize:11,fontWeight:'900',letterSpacing:1},
  completedText:{color:colors.ink,fontSize:9,lineHeight:14,fontWeight:'700'},
  completedButton:{alignSelf:'flex-start',paddingHorizontal:11,paddingVertical:8,backgroundColor:colors.brandDark},
  completedButtonText:{color:colors.surface,fontSize:8,fontWeight:'900',textTransform:'uppercase'},
  steps: { gap: 6 },
  step: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: spacing.sm },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.background, color: colors.ink, textAlign: 'center', textAlignVertical: 'center', fontWeight: '900' },
  stepNumberActive: { backgroundColor: colors.brand, color: colors.surface },
  stepText: { flex: 1, color: colors.ink, fontWeight: '800' },
})
