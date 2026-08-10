import { useCallback, useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { colors, spacing } from '@/theme/tokens'

type Props = {
  championshipId: string
  phases: any[]
  groups: any[]
  token?: string | null
  onChanged?: () => void | Promise<void>
}

type RoundStatus = 'rascunho' | 'agendada' | 'em_andamento' | 'finalizada' | 'cancelada'

const roundStatuses: RoundStatus[] = ['rascunho', 'agendada', 'em_andamento', 'finalizada', 'cancelada']

export function ChampionshipGamesPanel({ championshipId, phases, groups, token, onChanged }: Props) {
  const [rounds, setRounds] = useState<any[]>([])
  const [games, setGames] = useState<any[]>([])
  const [maps, setMaps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [phaseId, setPhaseId] = useState('')
  const [roundNumber, setRoundNumber] = useState('1')
  const [roundName, setRoundName] = useState('')
  const [roundStart, setRoundStart] = useState('')
  const [roundEnd, setRoundEnd] = useState('')
  const [editingRoundId, setEditingRoundId] = useState('')
  const [gameName, setGameName] = useState('')
  const [gameDate, setGameDate] = useState('')
  const [gameTime, setGameTime] = useState('')
  const [gameMatches, setGameMatches] = useState('4')
  const [gameRoundId, setGameRoundId] = useState('')
  const [gameGroupIds, setGameGroupIds] = useState<string[]>([])
  const [gameMapCodes, setGameMapCodes] = useState<string[]>([])
  const [gameType, setGameType] = useState<'normal' | 'final'>('normal')
  const [finalDay, setFinalDay] = useState('1')
  const [definesChampion, setDefinesChampion] = useState(false)
  const [editingGameId, setEditingGameId] = useState('')
  const [expandedGameId, setExpandedGameId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [roundResponse, gameResponse, mapResponse] = await Promise.all([
        mobileApi.championshipRounds(championshipId, null, token),
        mobileApi.championshipGames(championshipId, token),
        mobileApi.mapCatalog(),
      ])
      setRounds(Array.isArray(roundResponse?.rodadas) ? roundResponse.rodadas : [])
      setGames(Array.isArray(gameResponse?.jogos) ? gameResponse.jogos : [])
      setMaps(Array.isArray(mapResponse?.mapas) ? mapResponse.mapas : [])
      setPhaseId((current) => current || String(phases?.[0]?.id || ''))
      setError('')
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar rodadas e jogos.')
    } finally {
      setLoading(false)
    }
  }, [championshipId, phases, token])

  useEffect(() => { void load() }, [load])

  const phaseGroups = useMemo(() => groups.filter((group:any) => String(group?.fase_id || '') === phaseId), [groups, phaseId])
  const phaseRounds = useMemo(() => rounds.filter((round:any) => String(round?.fase_id || '') === phaseId), [rounds, phaseId])
  const selectedGame = useMemo(() => games.find((game:any) => String(game.id) === editingGameId) || null, [games, editingGameId])
  const selectedPhase = useMemo(() => phases.find((phase:any) => String(phase?.id || '') === phaseId) || null, [phases, phaseId])
  const isFinalPhase = String(selectedPhase?.tipo || '') === 'grande_final'

  useEffect(() => {
    if (!phaseId) return
    setRoundNumber(String(Math.max(0, ...phaseRounds.map((round:any) => Number(round.numero || 0))) + 1))
    setGameRoundId((current) => phaseRounds.some((round:any) => String(round.id) === current) ? current : '')
    setGameGroupIds((current) => current.filter((id) => phaseGroups.some((group:any) => String(group.id) === id)))
    const finalPhase = String(phases.find((phase:any) => String(phase?.id || '') === phaseId)?.tipo || '') === 'grande_final'
    setGameType(finalPhase ? 'final' : 'normal')
    if (!finalPhase) { setFinalDay('1'); setDefinesChampion(false) }
  }, [phaseId, phaseRounds, phaseGroups, phases])

  useEffect(() => {
    const amount = Math.max(1, Number(gameMatches || 1))
    const fallback = maps[0]?.codigo ? String(maps[0].codigo) : ''
    setGameMapCodes((current) => Array.from({ length: amount }, (_, index) => current[index] || fallback))
  }, [gameMatches, maps])

  async function refresh(message?: string) {
    if (message) setFeedback(message)
    await load()
    await onChanged?.()
  }

  async function saveRound() {
    if (!phaseId || !roundNumber) return
    setBusy(true); setError(''); setFeedback('')
    try {
      const body = { fase_id: phaseId, numero: Number(roundNumber), nome: roundName.trim() || null, data_inicio: roundStart || null, data_fim: roundEnd || null }
      if (editingRoundId) await mobileApi.updateChampionshipRound(championshipId, editingRoundId, body, token)
      else await mobileApi.createChampionshipRound(championshipId, body, token)
      resetRoundForm()
      await refresh(editingRoundId ? 'Rodada atualizada.' : 'Rodada criada.')
    } catch (err:any) { setError(err?.message || 'Não foi possível salvar a rodada.') }
    finally { setBusy(false) }
  }

  function editRound(round:any) {
    setEditingRoundId(String(round.id)); setPhaseId(String(round.fase_id || '')); setRoundNumber(String(round.numero || 1)); setRoundName(String(round.nome || '')); setRoundStart(String(round.data_inicio || '')); setRoundEnd(String(round.data_fim || ''))
  }

  function resetRoundForm() { setEditingRoundId(''); setRoundName(''); setRoundStart(''); setRoundEnd('') }

  async function changeRoundStatus(round:any, status:RoundStatus) {
    setBusy(true); setError('')
    try { await mobileApi.updateChampionshipRound(championshipId, String(round.id), { status }, token); await refresh(`Rodada marcada como ${status.replace('_',' ')}.`) }
    catch (err:any) { setError(err?.message || 'Não foi possível atualizar a rodada.') }
    finally { setBusy(false) }
  }

  function deleteRound(round:any) {
    Alert.alert('Excluir rodada?', round.nome || `Rodada ${round.numero}`, [{text:'Cancelar',style:'cancel'},{text:'Excluir',style:'destructive',onPress:()=>void executeDeleteRound(round)}])
  }

  async function executeDeleteRound(round:any) {
    setBusy(true); setError('')
    try { await mobileApi.deleteChampionshipRound(championshipId, String(round.id), token); await refresh('Rodada excluída.') }
    catch (err:any) { setError(err?.message || 'Não foi possível excluir a rodada.') }
    finally { setBusy(false) }
  }

  function toggleGroup(id:string) { setGameGroupIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current,id]) }

  function setMap(index:number, code:string) { setGameMapCodes((current) => current.map((value,i) => i === index ? code : value)) }

  function buildGameBody() {
    return {
      nome: gameName.trim(), fase_id: phaseId, rodada_id: gameRoundId || null,
      data_jogo: gameDate || null, horario: gameTime || null, numero_partidas: Number(gameMatches || 1),
      quedas: gameMapCodes.map((mapa_codigo,index) => ({ numero:index+1, mapa_codigo })),
      grupos_ids: gameGroupIds,
      tipo_jogo: isFinalPhase ? 'final' : gameType,
      dia_final: (isFinalPhase || gameType === 'final') ? Number(finalDay || 1) : null,
      define_campeao: (isFinalPhase || gameType === 'final') ? definesChampion : false,
      status: selectedGame?.status || 'agendado',
    }
  }

  async function saveGame() {
    if (!phaseId || !gameName.trim() || !gameGroupIds.length || gameMapCodes.some((code) => !code)) { setError('Informe nome, fase, grupo e um mapa para cada queda.'); return }
    setBusy(true); setError(''); setFeedback('')
    try {
      if (editingGameId) await mobileApi.updateChampionshipGame(championshipId, editingGameId, buildGameBody(), token)
      else await mobileApi.createChampionshipGame(championshipId, buildGameBody(), token)
      resetGameForm()
      await refresh(editingGameId ? 'Jogo atualizado.' : 'Jogo criado com quedas e mapas.')
    } catch (err:any) { setError(err?.message || 'Não foi possível salvar o jogo.') }
    finally { setBusy(false) }
  }

  function editGame(game:any) {
    setEditingGameId(String(game.id)); setPhaseId(String(game.fase_id || '')); setGameName(String(game.nome || '')); setGameDate(String(game.data_jogo || '')); setGameTime(String(game.horario || '')); setGameMatches(String(game.numero_partidas || game.quedas?.length || 1)); setGameRoundId(String(game.rodada_id || ''))
    setGameGroupIds((game.grupos || []).map((item:any) => String(item.grupo_id || item.campeonato_grupos?.id || '')).filter(Boolean))
    setGameMapCodes((game.quedas || []).map((queda:any) => String(queda.mapa_codigo || '')).filter(Boolean))
    setGameType(String(game.tipo_jogo || '') === 'final' ? 'final' : 'normal')
    setFinalDay(String(game.dia_final || 1))
    setDefinesChampion(Boolean(game.define_campeao))
  }

  function resetGameForm() { setEditingGameId(''); setGameName(''); setGameDate(''); setGameTime(''); setGameMatches('4'); setGameRoundId(''); setGameGroupIds([]); setGameMapCodes([]); setGameType(isFinalPhase?'final':'normal'); setFinalDay('1'); setDefinesChampion(false) }

  function deleteGame(game:any) {
    Alert.alert('Excluir jogo?', game.nome, [{text:'Cancelar',style:'cancel'},{text:'Excluir',style:'destructive',onPress:()=>void executeDeleteGame(game)}])
  }

  async function executeDeleteGame(game:any) {
    setBusy(true); setError('')
    try { await mobileApi.deleteChampionshipGame(championshipId, String(game.id), token); await refresh('Jogo excluído.') }
    catch (err:any) { setError(err?.message || 'Não foi possível excluir o jogo.') }
    finally { setBusy(false) }
  }

  async function updateFallMap(game:any, fall:any, code:string) {
    setBusy(true); setError('')
    try { await mobileApi.updateChampionshipFallMap(championshipId, String(game.id), String(fall.id), code, token); await refresh('Mapa da queda atualizado.') }
    catch (err:any) { setError(err?.message || 'Não foi possível alterar o mapa da queda.') }
    finally { setBusy(false) }
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.brand}/></View>

  return <View style={styles.root}>
    {error ? <Text style={[styles.message,styles.error]}>{error}</Text> : null}
    {feedback ? <Text style={styles.message}>{feedback}</Text> : null}

    <Text style={styles.title}>FASE OPERACIONAL</Text>
    <View style={styles.chips}>{phases.map((phase:any)=><TouchableOpacity key={phase.id} style={[styles.chip,phaseId===String(phase.id)&&styles.chipActive]} onPress={()=>setPhaseId(String(phase.id))}><Text style={[styles.chipText,phaseId===String(phase.id)&&styles.chipTextActive]}>{phase.nome}{String(phase.tipo||'')==='grande_final'?' · Grande Final':''}</Text></TouchableOpacity>)}</View>

    <Text style={styles.title}>RODADAS</Text>
    <View style={styles.form}>
      <View style={styles.columns}><Field label="Número" value={roundNumber} onChangeText={setRoundNumber}/><Field label="Nome" value={roundName} onChangeText={setRoundName}/></View>
      <View style={styles.columns}><Field label="Início (AAAA-MM-DD)" value={roundStart} onChangeText={setRoundStart}/><Field label="Fim (AAAA-MM-DD)" value={roundEnd} onChangeText={setRoundEnd}/></View>
      <View style={styles.actions}><TouchableOpacity disabled={busy||!phaseId} style={styles.primary} onPress={()=>void saveRound()}><Text style={styles.primaryText}>{editingRoundId?'Salvar rodada':'Criar rodada'}</Text></TouchableOpacity>{editingRoundId?<TouchableOpacity style={styles.secondary} onPress={resetRoundForm}><Text style={styles.secondaryText}>Cancelar</Text></TouchableOpacity>:null}</View>
    </View>
    <View style={styles.list}>{phaseRounds.map((round:any)=><View key={round.id} style={styles.card}><View style={styles.cardHead}><View style={styles.copy}><Text style={styles.rowTitle}>{round.nome || `Rodada ${round.numero}`}</Text><Text style={styles.meta}>#{round.numero} · {round.status || 'rascunho'}{round.data_inicio?` · ${round.data_inicio}`:''}</Text></View><TouchableOpacity style={styles.icon} onPress={()=>editRound(round)}><Ionicons name="create-outline" size={17} color={colors.ink}/></TouchableOpacity><TouchableOpacity style={styles.icon} onPress={()=>deleteRound(round)}><Ionicons name="trash-outline" size={17} color="#b42318"/></TouchableOpacity></View><View style={styles.statuses}>{roundStatuses.map(status=><TouchableOpacity key={status} style={[styles.statusChip,round.status===status&&styles.statusChipActive]} onPress={()=>void changeRoundStatus(round,status)}><Text style={[styles.statusText,round.status===status&&styles.statusTextActive]}>{status.replace('_',' ')}</Text></TouchableOpacity>)}</View></View>)}</View>

    <Text style={styles.title}>{editingGameId?'EDITAR JOGO':'NOVO JOGO'}</Text>
    <View style={styles.form}>
      <Field label="Nome" value={gameName} onChangeText={setGameName}/>
      <View style={styles.columns}><Field label="Data (AAAA-MM-DD)" value={gameDate} onChangeText={setGameDate}/><Field label="Horário" value={gameTime} onChangeText={setGameTime}/></View>
      <Field label="Quantidade de quedas" value={gameMatches} onChangeText={setGameMatches}/>
      {isFinalPhase?<View style={styles.finalPanel}><Text style={styles.finalPanelTitle}>GRANDE FINAL</Text><Text style={styles.meta}>Todos os jogos desta fase são jogos de final. Você pode distribuir a decisão em vários dias.</Text><View style={styles.columns}><Field label="Dia da final" value={finalDay} onChangeText={setFinalDay}/><View style={{flex:1}}><Text style={styles.label}>DECISÃO DO TÍTULO</Text><View style={styles.chips}><TouchableOpacity style={[styles.chip,!definesChampion&&styles.chipActive]} onPress={()=>setDefinesChampion(false)}><Text style={[styles.chipText,!definesChampion&&styles.chipTextActive]}>Acumula</Text></TouchableOpacity><TouchableOpacity style={[styles.chip,definesChampion&&styles.chipActive]} onPress={()=>setDefinesChampion(true)}><Text style={[styles.chipText,definesChampion&&styles.chipTextActive]}>Decisivo</Text></TouchableOpacity></View></View></View></View>:null}
      <Text style={styles.label}>RODADA</Text><View style={styles.chips}><TouchableOpacity style={[styles.chip,!gameRoundId&&styles.chipActive]} onPress={()=>setGameRoundId('')}><Text style={[styles.chipText,!gameRoundId&&styles.chipTextActive]}>Sem rodada</Text></TouchableOpacity>{phaseRounds.map((round:any)=><TouchableOpacity key={round.id} style={[styles.chip,gameRoundId===String(round.id)&&styles.chipActive]} onPress={()=>setGameRoundId(String(round.id))}><Text style={[styles.chipText,gameRoundId===String(round.id)&&styles.chipTextActive]}>{round.nome||`R${round.numero}`}</Text></TouchableOpacity>)}</View>
      <Text style={styles.label}>GRUPOS PARTICIPANTES</Text><View style={styles.chips}>{phaseGroups.map((group:any)=>{const active=gameGroupIds.includes(String(group.id));return <TouchableOpacity key={group.id} style={[styles.chip,active&&styles.chipActive]} onPress={()=>toggleGroup(String(group.id))}><Text style={[styles.chipText,active&&styles.chipTextActive]}>{group.nome}</Text></TouchableOpacity>})}</View>
      <Text style={styles.label}>MAPA POR QUEDA</Text>{gameMapCodes.map((code,index)=><View key={index} style={styles.mapRow}><View style={styles.fallBadge}><Text style={styles.fallText}>Q{index+1}</Text></View><View style={styles.mapChips}>{maps.map((map:any)=>{const active=code===String(map.codigo);return <TouchableOpacity key={map.id||map.codigo} style={[styles.mapChip,active&&styles.mapChipActive]} onPress={()=>setMap(index,String(map.codigo))}><Text style={[styles.mapText,active&&styles.mapTextActive]}>{map.nome}</Text></TouchableOpacity>})}</View></View>)}
      <View style={styles.actions}><TouchableOpacity disabled={busy} style={styles.primary} onPress={()=>void saveGame()}><Text style={styles.primaryText}>{editingGameId?'Salvar jogo':'Criar jogo'}</Text></TouchableOpacity>{editingGameId?<TouchableOpacity style={styles.secondary} onPress={resetGameForm}><Text style={styles.secondaryText}>Cancelar</Text></TouchableOpacity>:null}</View>
    </View>

    <Text style={styles.title}>JOGOS E QUEDAS</Text>
    <View style={styles.list}>{games.map((game:any)=>{const expanded=expandedGameId===String(game.id);return <View key={game.id} style={styles.card}><TouchableOpacity style={styles.cardHead} onPress={()=>setExpandedGameId(expanded?'':String(game.id))}><View style={styles.copy}><Text style={styles.rowTitle}>{game.nome}</Text><Text style={styles.meta}>{[game.tipo_jogo==='final'?`Grande Final · Dia ${game.dia_final||1}${game.define_campeao?' · decisivo':''}`:null,game.data_jogo,game.horario,`${game.numero_partidas||game.quedas?.length||0} quedas`,game.status].filter(Boolean).join(' · ')}</Text></View><Ionicons name={expanded?'chevron-up':'chevron-down'} size={17} color={colors.muted}/></TouchableOpacity><View style={styles.actionsSmall}><TouchableOpacity style={styles.smallButton} onPress={()=>editGame(game)}><Text style={styles.smallText}>Editar</Text></TouchableOpacity><TouchableOpacity style={[styles.smallButton,styles.dangerButton]} onPress={()=>deleteGame(game)}><Text style={[styles.smallText,styles.dangerText]}>Excluir</Text></TouchableOpacity></View>{expanded?<View style={styles.falls}>{(game.quedas||[]).map((fall:any)=><View key={fall.id} style={styles.fallRow}><View style={styles.fallBadge}><Text style={styles.fallText}>Q{fall.numero_partida}</Text></View><View style={styles.copy}><Text style={styles.rowTitle}>{fall.mapa_nome||fall.mapa_codigo||'Mapa'}</Text><Text style={styles.meta}>{fall.status||'agendada'}{fall.finalizada_em?' · finalizada':''}</Text></View>{!fall.finalizada_em&&fall.status!=='finalizada'?<View style={styles.inlineMaps}>{maps.map((map:any)=>String(map.codigo)===String(fall.mapa_codigo)?null:<TouchableOpacity key={map.id||map.codigo} style={styles.tinyMap} onPress={()=>void updateFallMap(game,fall,String(map.codigo))}><Text style={styles.tinyMapText}>{map.nome}</Text></TouchableOpacity>)}</View>:null}</View>)}</View>:null}</View>})}</View>
    <Text style={styles.note}>Rodadas, jogos, grupos e mapas usam as APIs oficiais do campeonato. A Grande Final pode ter jogos em vários dias; o Grupo da Final é único e o jogo decisivo é opcional para formatos acumulados/Champion Point. Cada queda precisa de um mapa válido do catálogo.</Text>
  </View>
}

function Field(props:any){return <View style={{flex:1}}><Text style={styles.label}>{props.label}</Text><TextInput {...props} style={styles.input} placeholderTextColor="#8a857e"/></View>}

const styles=StyleSheet.create({root:{marginHorizontal:spacing.md,gap:8},loading:{minHeight:100,alignItems:'center',justifyContent:'center'},message:{padding:10,color:'#166534',backgroundColor:'#effaf3',fontWeight:'800'},error:{color:'#9a3412',backgroundColor:'#fff7ed'},title:{marginTop:8,color:colors.ink,fontSize:10,fontWeight:'900',letterSpacing:1},chips:{flexDirection:'row',flexWrap:'wrap',gap:5},chip:{paddingHorizontal:9,paddingVertical:8,backgroundColor:'#eee9e1'},chipActive:{backgroundColor:colors.brandDark},chipText:{color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},chipTextActive:{color:colors.surface},form:{gap:8,padding:10,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},finalPanel:{gap:7,padding:9,backgroundColor:'#f2eee7',borderLeftWidth:3,borderLeftColor:colors.brand},finalPanelTitle:{color:colors.brand,fontSize:9,fontWeight:'900',letterSpacing:1},columns:{flexDirection:'row',gap:6},label:{marginBottom:5,color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},input:{minHeight:42,paddingHorizontal:10,color:colors.ink,backgroundColor:'#f2eee7',borderWidth:1,borderColor:colors.line,fontWeight:'700'},actions:{flexDirection:'row',gap:6},primary:{minHeight:42,flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand},primaryText:{color:colors.surface,fontSize:9,fontWeight:'900',textTransform:'uppercase'},secondary:{minHeight:42,paddingHorizontal:14,alignItems:'center',justifyContent:'center',backgroundColor:'#eee9e1'},secondaryText:{color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},list:{gap:6},card:{padding:8,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},cardHead:{minHeight:42,flexDirection:'row',alignItems:'center',gap:6},copy:{flex:1},rowTitle:{color:colors.ink,fontSize:10,fontWeight:'900',textTransform:'uppercase'},meta:{marginTop:2,color:colors.muted,fontSize:8,fontWeight:'700'},icon:{width:34,height:34,alignItems:'center',justifyContent:'center',backgroundColor:'#f2eee7'},statuses:{flexDirection:'row',flexWrap:'wrap',gap:4,marginTop:5},statusChip:{paddingHorizontal:7,paddingVertical:6,backgroundColor:'#eee9e1'},statusChipActive:{backgroundColor:colors.brandDark},statusText:{color:colors.muted,fontSize:7,fontWeight:'900',textTransform:'uppercase'},statusTextActive:{color:colors.surface},mapRow:{flexDirection:'row',alignItems:'flex-start',gap:6},fallBadge:{width:34,height:34,alignItems:'center',justifyContent:'center',backgroundColor:colors.brandDark},fallText:{color:colors.surface,fontSize:9,fontWeight:'900'},mapChips:{flex:1,flexDirection:'row',flexWrap:'wrap',gap:4},mapChip:{paddingHorizontal:8,paddingVertical:8,backgroundColor:'#eee9e1'},mapChipActive:{backgroundColor:colors.brand},mapText:{color:colors.ink,fontSize:7,fontWeight:'900',textTransform:'uppercase'},mapTextActive:{color:colors.surface},actionsSmall:{flexDirection:'row',gap:5,marginTop:4},smallButton:{paddingHorizontal:9,paddingVertical:7,backgroundColor:'#eee9e1'},smallText:{color:colors.ink,fontSize:7,fontWeight:'900',textTransform:'uppercase'},dangerButton:{backgroundColor:'#fff1f1'},dangerText:{color:'#b42318'},falls:{gap:5,marginTop:8,paddingTop:8,borderTopWidth:1,borderTopColor:colors.line},fallRow:{minHeight:48,flexDirection:'row',alignItems:'center',gap:7},inlineMaps:{maxWidth:'45%',flexDirection:'row',flexWrap:'wrap',justifyContent:'flex-end',gap:3},tinyMap:{paddingHorizontal:5,paddingVertical:5,backgroundColor:'#eee9e1'},tinyMapText:{color:colors.ink,fontSize:6.5,fontWeight:'900'},note:{padding:10,color:colors.muted,fontSize:8,lineHeight:12,backgroundColor:'#eee9e1'}})
