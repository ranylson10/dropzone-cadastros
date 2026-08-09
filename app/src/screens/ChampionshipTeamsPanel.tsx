import { useCallback, useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { colors, spacing } from '@/theme/tokens'

type Props = {
  championshipId: string
  token?: string | null
  onChanged?: () => void | Promise<void>
}

export function ChampionshipTeamsPanel({ championshipId, token, onChanged }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [groupId, setGroupId] = useState('')
  const [sourceSlotId, setSourceSlotId] = useState('')
  const [targetAddSlotId, setTargetAddSlotId] = useState('')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [reviewRequestId, setReviewRequestId] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await mobileApi.championshipAdminTeams(championshipId, token)
      setData(response)
      setError('')
      const groups = collectGroups(response?.vagas || [])
      setGroupId((current) => current || String(groups[0]?.id || ''))
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar equipes e slots.')
    } finally {
      setLoading(false)
    }
  }, [championshipId, token])

  useEffect(() => { void load() }, [load])

  const slots = useMemo(() => Array.isArray(data?.vagas) ? data.vagas : [], [data])
  const groups = useMemo(() => collectGroups(slots), [slots])
  const visibleSlots = useMemo(() => groupId ? slots.filter((slot: any) => String(slot.grupo_id || '') === groupId) : slots, [slots, groupId])
  const source = useMemo(() => slots.find((slot: any) => String(slot.id) === sourceSlotId) || null, [slots, sourceSlotId])
  const requests = useMemo(() => Array.isArray(data?.solicitacoes) ? data.solicitacoes : [], [data])
  const pendingRequests = useMemo(() => requests.filter((item:any) => item.status === 'pendente'), [requests])
  const reviewRequest = useMemo(() => requests.find((item:any) => String(item.id) === reviewRequestId) || null, [requests, reviewRequestId])

  async function refreshAll(message?: string) {
    if (message) setFeedback(message)
    setSourceSlotId('')
    setTargetAddSlotId('')
    setQuery('')
    setResults([])
    setReviewRequestId('')
    setRejectReason('')
    await load()
    await onChanged?.()
  }

  async function approveRequest(target: any) {
    if (!reviewRequest || isOccupied(target)) return
    setBusy(true); setError(''); setFeedback('')
    try {
      const result = await mobileApi.reviewChampionshipEntry(championshipId, { participacao_id: reviewRequest.id, action: 'approve', slot_id: target.id }, token)
      await refreshAll(result?.mensagem || 'Inscrição aprovada.')
    } catch (err: any) { setError(err?.message || 'Não foi possível aprovar a inscrição.') }
    finally { setBusy(false) }
  }

  async function rejectRequest(item: any) {
    setBusy(true); setError(''); setFeedback('')
    try {
      const result = await mobileApi.reviewChampionshipEntry(championshipId, { participacao_id: item.id, action: 'reject', motivo: rejectReason.trim() || undefined }, token)
      await refreshAll(result?.mensagem || 'Inscrição rejeitada.')
    } catch (err: any) { setError(err?.message || 'Não foi possível rejeitar a inscrição.') }
    finally { setBusy(false) }
  }

  async function moveOrSwap(target: any) {
    if (!source || String(source.id) === String(target.id)) return
    const targetOccupied = Boolean(target.line_id || target.equipe_id || target.campeonato_equipe)
    const mode = targetOccupied ? 'swap' : 'move'
    Alert.alert(
      targetOccupied ? 'Trocar posições?' : 'Mover line?',
      `${source.line_nome || source.equipe_nome || 'Line'} → ${target.grupo?.nome || 'Grupo'} / slot ${slotLabel(target)}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: targetOccupied ? 'Trocar' : 'Mover', onPress: () => void executeMove(source.id, target.id, mode) },
      ],
    )
  }

  async function executeMove(sourceId: string, targetId: string, mode: 'move' | 'swap') {
    setBusy(true); setError(''); setFeedback('')
    try {
      const result = await mobileApi.moveChampionshipSlot(championshipId, { source_slot_id: sourceId, target_slot_id: targetId, mode }, token)
      await refreshAll(result?.mensagem || (mode === 'swap' ? 'Posições trocadas.' : 'Line movida.'))
    } catch (err: any) {
      setError(err?.message || 'Não foi possível reorganizar os slots.')
    } finally { setBusy(false) }
  }

  function remove(slot: any) {
    const participationId = String(slot?.campeonato_equipe?.id || slot?.participacao_id || '')
    if (!participationId) {
      setError('A participação deste slot não foi localizada.')
      return
    }
    Alert.alert('Remover inscrição?', `${slot.line_nome || slot.equipe_nome || 'Esta line'} será retirada do campeonato e o slot ficará livre.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => void executeRemove(participationId) },
    ])
  }

  async function executeRemove(participationId: string) {
    setBusy(true); setError(''); setFeedback('')
    try {
      await mobileApi.removeChampionshipParticipation(championshipId, participationId, token)
      await refreshAll('Inscrição removida e slot liberado.')
    } catch (err: any) { setError(err?.message || 'Não foi possível remover a inscrição.') }
    finally { setBusy(false) }
  }

  async function search() {
    const clean = query.trim()
    if (clean.length < 2) { setResults([]); return }
    setSearching(true); setError('')
    try {
      const response = await mobileApi.searchChampionshipTeams(championshipId, clean, token)
      setResults(Array.isArray(response?.equipes) ? response.equipes : [])
    } catch (err: any) { setError(err?.message || 'Não foi possível pesquisar equipes.') }
    finally { setSearching(false) }
  }

  async function addLine(equipe: any, line: any) {
    if (!targetAddSlotId) return
    setBusy(true); setError(''); setFeedback('')
    try {
      const result = await mobileApi.addChampionshipTeamToSlot(championshipId, {
        slot_id: targetAddSlotId,
        equipe_id: equipe.id,
        line_id: line.id,
      }, token)
      await refreshAll(result?.mensagem || 'Line adicionada ao campeonato.')
    } catch (err: any) { setError(err?.message || 'Não foi possível adicionar a line.') }
    finally { setBusy(false) }
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.brand}/></View>

  return <View style={styles.root}>
    <View style={styles.metrics}>
      <Metric value={slots.length} label="Slots" />
      <Metric value={slots.filter(isOccupied).length} label="Ocupados" />
      <Metric value={slots.filter((slot: any) => !isOccupied(slot)).length} label="Livres" />
    </View>

    {error ? <Text style={[styles.message, styles.error]}>{error}</Text> : null}
    {feedback ? <Text style={styles.message}>{feedback}</Text> : null}

    <View style={styles.queueHeader}><Text style={styles.title}>INSCRIÇÕES PARA ANÁLISE</Text><View style={styles.queueCount}><Text style={styles.queueCountText}>{pendingRequests.length}</Text></View></View>
    {pendingRequests.length ? <View style={styles.queue}>
      {pendingRequests.map((item:any) => <View key={item.id} style={[styles.requestCard, reviewRequestId === String(item.id) && styles.requestCardActive]}>
        <View style={styles.copy}><Text style={styles.rowTitle}>{item.line?.nome || item.nome_exibicao || 'Line'}</Text><Text style={styles.meta}>{item.equipe?.nome || 'Equipe'} · aguardando aprovação</Text></View>
        <TouchableOpacity style={styles.reviewButton} disabled={busy} onPress={() => { setReviewRequestId(String(item.id)); setSourceSlotId(''); setTargetAddSlotId('') }}><Text style={styles.reviewButtonText}>{reviewRequestId === String(item.id) ? 'Escolha o slot' : 'Aprovar'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.rejectButton} disabled={busy} onPress={() => void rejectRequest(item)}><Text style={styles.rejectButtonText}>Rejeitar</Text></TouchableOpacity>
      </View>)}
      <TextInput value={rejectReason} onChangeText={setRejectReason} placeholder="Motivo da rejeição (opcional)" placeholderTextColor="#8a857e" style={styles.input}/>
      {reviewRequest ? <View style={styles.selection}><View style={{flex:1}}><Text style={styles.selectionLabel}>APROVAÇÃO MANUAL</Text><Text style={styles.selectionName}>{reviewRequest.line?.nome || reviewRequest.nome_exibicao || 'Line'}</Text><Text style={styles.selectionMeta}>Toque em um slot livre abaixo para aprovar e posicionar a line.</Text></View><TouchableOpacity style={styles.iconButton} onPress={() => setReviewRequestId('')}><Ionicons name="close" size={18} color={colors.ink}/></TouchableOpacity></View> : null}
    </View> : <Text style={styles.emptySmall}>Nenhuma inscrição pendente.</Text>}

    <Text style={styles.title}>GRUPO</Text>
    <View style={styles.chips}>
      {groups.map((group: any) => <TouchableOpacity key={group.id} style={[styles.chip, groupId === String(group.id) && styles.chipActive]} onPress={() => { setGroupId(String(group.id)); setSourceSlotId('') }}>
        <Text style={[styles.chipText, groupId === String(group.id) && styles.chipTextActive]}>{group.nome}</Text>
      </TouchableOpacity>)}
    </View>

    {source ? <View style={styles.selection}>
      <View style={{flex:1}}><Text style={styles.selectionLabel}>ORIGEM SELECIONADA</Text><Text style={styles.selectionName}>{source.line_nome || source.equipe_nome || 'Line'}</Text><Text style={styles.selectionMeta}>Toque em outro slot para mover ou trocar.</Text></View>
      <TouchableOpacity style={styles.iconButton} onPress={() => setSourceSlotId('')}><Ionicons name="close" size={18} color={colors.ink}/></TouchableOpacity>
    </View> : null}

    <View style={styles.list}>
      {visibleSlots.map((slot: any) => {
        const occupied = isOccupied(slot)
        const selected = sourceSlotId === String(slot.id)
        return <TouchableOpacity key={slot.id} activeOpacity={0.8} disabled={busy} style={[styles.slotRow, selected && styles.slotRowSelected]} onPress={() => reviewRequest ? void approveRequest(slot) : source ? void moveOrSwap(slot) : occupied ? setSourceSlotId(String(slot.id)) : setTargetAddSlotId(String(slot.id))}>
          <View style={[styles.slotBadge, occupied ? styles.slotOccupied : styles.slotFree]}><Text style={styles.slotBadgeText}>{slotLabel(slot)}</Text></View>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>{occupied ? (slot.line_nome || slot.equipe_nome || 'Line inscrita') : 'Slot livre'}</Text>
            <Text style={styles.meta}>{slot.grupo?.nome || groups.find((g: any) => String(g.id) === String(slot.grupo_id))?.nome || 'Grupo'}{occupied && slot.equipe_nome ? ` · ${slot.equipe_nome}` : ''}</Text>
          </View>
          {occupied ? <>
            <TouchableOpacity style={styles.smallAction} onPress={() => setSourceSlotId(String(slot.id))}><Ionicons name="move-outline" size={17} color={colors.ink}/></TouchableOpacity>
            <TouchableOpacity style={styles.smallAction} onPress={() => remove(slot)}><Ionicons name="trash-outline" size={17} color="#b42318"/></TouchableOpacity>
          </> : <TouchableOpacity style={styles.addAction} onPress={() => reviewRequest ? void approveRequest(slot) : setTargetAddSlotId(String(slot.id))}><Ionicons name={reviewRequest ? 'checkmark' : 'add'} size={18} color={colors.surface}/><Text style={styles.addActionText}>{reviewRequest ? 'Aprovar' : 'Adicionar'}</Text></TouchableOpacity>}
        </TouchableOpacity>
      })}
    </View>

    {targetAddSlotId ? <View style={styles.searchBox}>
      <View style={styles.searchHeader}><View style={{flex:1}}><Text style={styles.title}>ADICIONAR LINE</Text><Text style={styles.meta}>Destino: slot {slotLabel(slots.find((slot:any)=>String(slot.id)===targetAddSlotId))}</Text></View><TouchableOpacity style={styles.iconButton} onPress={() => { setTargetAddSlotId(''); setResults([]); setQuery('') }}><Ionicons name="close" size={18} color={colors.ink}/></TouchableOpacity></View>
      <View style={styles.searchLine}><TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => void search()} placeholder="Nome ou tag da equipe" placeholderTextColor="#8a857e" style={styles.input}/><TouchableOpacity style={styles.searchButton} onPress={() => void search()}><Ionicons name="search" size={18} color={colors.surface}/></TouchableOpacity></View>
      {searching ? <ActivityIndicator color={colors.brand}/> : null}
      {results.map((team:any) => <View key={team.id} style={styles.teamCard}>
        <View style={styles.teamHead}>{team.logo_url ? <Image source={{uri:team.logo_url}} style={styles.logo}/> : <View style={[styles.logo, styles.logoFallback]}><Ionicons name="shield-outline" size={20} color={colors.muted}/></View>}<View style={styles.copy}><Text style={styles.rowTitle}>{team.nome}</Text><Text style={styles.meta}>{team.tag || 'Sem tag'} · {team.lines_livres || 0} line(s) livre(s)</Text></View></View>
        {(team.lines || []).map((line:any) => <View key={line.id} style={styles.lineRow}><View style={styles.copy}><Text style={styles.lineName}>{line.nome}</Text><Text style={styles.meta}>{line.ja_inscrita ? `Já inscrita${line.slot_letra ? ` · slot ${line.slot_letra}` : ''}` : 'Disponível'}</Text></View><TouchableOpacity disabled={line.ja_inscrita || busy} style={[styles.useButton, line.ja_inscrita && styles.disabled]} onPress={() => void addLine(team,line)}><Text style={styles.useButtonText}>{line.ja_inscrita ? 'Inscrita' : 'Usar'}</Text></TouchableOpacity></View>)}
        {!team.lines?.length ? <Text style={styles.emptySmall}>Esta equipe ainda não possui line ativa. Crie a line no painel da equipe antes de inscrever.</Text> : null}
      </View>)}
      {!searching && query.trim().length >= 2 && !results.length ? <Text style={styles.emptySmall}>Nenhuma equipe encontrada.</Text> : null}
    </View> : null}

    <Text style={styles.note}>A organização é manual: inscrições pendentes só ocupam vaga depois da aprovação e da escolha explícita de um slot. O app não distribui equipes automaticamente.</Text>
  </View>
}

function isOccupied(slot: any) { return Boolean(slot?.line_id || slot?.equipe_id || slot?.campeonato_equipe) }
function slotLabel(slot: any) { return String(slot?.slot_letra || slot?.slot_numero || '—') }
function collectGroups(slots: any[]) {
  const map = new Map<string, any>()
  for (const slot of slots || []) {
    const id = String(slot?.grupo_id || slot?.grupo?.id || '')
    if (!id || map.has(id)) continue
    map.set(id, { id, nome: slot?.grupo?.nome || `Grupo ${map.size + 1}` })
  }
  return [...map.values()]
}
function Metric({value,label}:{value:any;label:string}) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View> }

const styles = StyleSheet.create({
  root:{marginHorizontal:spacing.md,gap:8},queueHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},queueCount:{minWidth:26,height:22,paddingHorizontal:7,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand},queueCountText:{color:colors.surface,fontSize:9,fontWeight:'900'},queue:{gap:6},requestCard:{flexDirection:'row',alignItems:'center',gap:6,padding:8,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},requestCardActive:{borderColor:colors.brand,borderWidth:2},reviewButton:{paddingHorizontal:9,paddingVertical:8,backgroundColor:colors.brandDark},reviewButtonText:{color:colors.surface,fontSize:7,fontWeight:'900',textTransform:'uppercase'},rejectButton:{paddingHorizontal:9,paddingVertical:8,backgroundColor:'#fff1f1'},rejectButtonText:{color:'#b42318',fontSize:7,fontWeight:'900',textTransform:'uppercase'},loading:{minHeight:100,alignItems:'center',justifyContent:'center'},metrics:{flexDirection:'row',gap:1,backgroundColor:colors.line},metric:{flex:1,padding:9,backgroundColor:colors.surface},metricValue:{color:colors.ink,fontSize:20,fontWeight:'900'},metricLabel:{color:colors.muted,fontSize:7,fontWeight:'900',textTransform:'uppercase'},message:{padding:10,color:'#166534',backgroundColor:'#effaf3',fontWeight:'800'},error:{color:'#9a3412',backgroundColor:'#fff7ed'},title:{marginTop:8,color:colors.ink,fontSize:10,fontWeight:'900',letterSpacing:1},chips:{flexDirection:'row',flexWrap:'wrap',gap:5},chip:{paddingHorizontal:10,paddingVertical:8,backgroundColor:'#eee9e1'},chipActive:{backgroundColor:colors.brandDark},chipText:{color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},chipTextActive:{color:colors.surface},selection:{flexDirection:'row',alignItems:'center',gap:8,padding:10,backgroundColor:'#fff7ed',borderWidth:1,borderColor:'#fed7aa'},selectionLabel:{color:'#9a3412',fontSize:7,fontWeight:'900'},selectionName:{marginTop:2,color:colors.ink,fontSize:11,fontWeight:'900',textTransform:'uppercase'},selectionMeta:{marginTop:2,color:colors.muted,fontSize:8},iconButton:{width:36,height:36,alignItems:'center',justifyContent:'center',backgroundColor:'#eee9e1'},list:{gap:5},slotRow:{minHeight:58,flexDirection:'row',alignItems:'center',gap:8,padding:7,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},slotRowSelected:{borderColor:colors.brand,borderWidth:2},slotBadge:{width:38,height:38,alignItems:'center',justifyContent:'center'},slotOccupied:{backgroundColor:colors.brandDark},slotFree:{backgroundColor:'#e7efe8'},slotBadgeText:{color:colors.ink,fontWeight:'900'},copy:{flex:1},rowTitle:{color:colors.ink,fontSize:10,fontWeight:'900',textTransform:'uppercase'},meta:{marginTop:2,color:colors.muted,fontSize:8,fontWeight:'700'},smallAction:{width:34,height:34,alignItems:'center',justifyContent:'center',backgroundColor:'#f2eee7'},addAction:{minHeight:34,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:8,backgroundColor:colors.brand},addActionText:{color:colors.surface,fontSize:7,fontWeight:'900',textTransform:'uppercase'},searchBox:{gap:8,padding:10,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},searchHeader:{flexDirection:'row',alignItems:'center'},searchLine:{flexDirection:'row'},input:{flex:1,minHeight:42,paddingHorizontal:10,color:colors.ink,backgroundColor:'#f2eee7',borderWidth:1,borderColor:colors.line,fontWeight:'700'},searchButton:{width:44,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand},teamCard:{gap:6,padding:8,backgroundColor:'#f8f5ef',borderWidth:1,borderColor:colors.line},teamHead:{flexDirection:'row',alignItems:'center',gap:8},logo:{width:38,height:38,borderRadius:4,backgroundColor:'#eee9e1'},logoFallback:{alignItems:'center',justifyContent:'center'},lineRow:{minHeight:42,flexDirection:'row',alignItems:'center',gap:8,paddingLeft:6,borderTopWidth:1,borderTopColor:colors.line},lineName:{color:colors.ink,fontSize:9,fontWeight:'900',textTransform:'uppercase'},useButton:{paddingHorizontal:10,paddingVertical:8,backgroundColor:colors.brandDark},useButtonText:{color:colors.surface,fontSize:7,fontWeight:'900',textTransform:'uppercase'},disabled:{opacity:.35},emptySmall:{paddingVertical:8,color:colors.muted,fontSize:8,textAlign:'center'},note:{marginTop:4,padding:10,color:colors.muted,fontSize:8,lineHeight:12,backgroundColor:'#eee9e1'},
})
