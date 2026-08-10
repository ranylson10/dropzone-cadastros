import { useCallback, useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  ActivityIndicator,
  Alert,
  Image,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { externalUrl } from '@/config/env'
import { mobileApi } from '@/lib/api'
import { colors, spacing } from '@/theme/tokens'

type Props={championshipId:string;token?:string|null}
type AssignmentType='principal'|'alternativa'
type Point={x:number;y:number}
type EditorMode='territory'|'label'
type Size={width:number;height:number}
const TEAM_COLORS=['#d6b84b','#ff4655','#2f80ed','#27ae60','#9b51e0','#f2994a','#00a7a7','#111827']

function clamp(value:number,min=0,max=1){return Math.min(max,Math.max(min,value))}
function normalPoint(value:any):Point|null{
  const x=Number(value?.x),y=Number(value?.y)
  if(!Number.isFinite(x)||!Number.isFinite(y))return null
  return {x:clamp(x),y:clamp(y)}
}
function parsePolygon(value:any):Point[]{
  if(!Array.isArray(value))return []
  return value.map(normalPoint).filter(Boolean) as Point[]
}
function rgba(hex:string,opacity:number){
  const clean=String(hex||'#d6b84b').replace('#','')
  const normalized=clean.length===3?clean.split('').map(x=>x+x).join(''):clean.padEnd(6,'0').slice(0,6)
  const r=parseInt(normalized.slice(0,2),16)||0
  const g=parseInt(normalized.slice(2,4),16)||0
  const b=parseInt(normalized.slice(4,6),16)||0
  return `rgba(${r},${g},${b},${clamp(opacity,.1,.9)})`
}

export function ChampionshipCallsPanel({championshipId,token}:Props){
  const [data,setData]=useState<any>({mapas:[],calls:[],equipes:[],vinculos:[]})
  const [mapCode,setMapCode]=useState('')
  const [callId,setCallId]=useState('')
  const [name,setName]=useState('')
  const [note,setNote]=useState('')
  const [polygon,setPolygon]=useState<Point[]>([])
  const [label,setLabel]=useState<Point|null>(null)
  const [editorMode,setEditorMode]=useState<EditorMode>('territory')
  const [mapSize,setMapSize]=useState<Size>({width:1,height:1})
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [feedback,setFeedback]=useState('')

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const result=await mobileApi.championshipCalls(championshipId,token)
      setData(result)
      setMapCode(current=>current||String(result.mapas?.[0]?.codigo||''))
      setError('')
    }catch(err:any){setError(err?.message||'Não foi possível carregar as calls.')}
    finally{setLoading(false)}
  },[championshipId,token])

  useEffect(()=>{void load()},[load])

  const map=useMemo(()=>data.mapas?.find((row:any)=>String(row.codigo)===mapCode)||null,[data.mapas,mapCode])
  const calls=useMemo(()=>(data.calls||[]).filter((row:any)=>String(row.mapa_codigo)===mapCode),[data.calls,mapCode])
  const selectedCall=useMemo(()=>calls.find((row:any)=>String(row.id)===callId)||null,[calls,callId])
  const assignments=useMemo(()=>(data.vinculos||[]).filter((row:any)=>String(row.call_id)===callId),[data.vinculos,callId])

  useEffect(()=>{
    if(callId&&!calls.some((row:any)=>String(row.id)===callId)){
      setCallId('');setName('');setNote('');setPolygon([]);setLabel(null)
    }
  },[callId,calls])

  async function action(work:()=>Promise<any>,message:string){
    setBusy(true);setError('');setFeedback('')
    try{await work();setFeedback(message);await load()}
    catch(err:any){setError(err?.message||'Não foi possível concluir a ação.')}
    finally{setBusy(false)}
  }

  async function create(){
    if(!mapCode||!name.trim()){setError('Escolha o mapa e informe o nome da call.');return}
    await action(()=>mobileApi.createChampionshipCall(championshipId,{
      mapa_codigo:mapCode,nome:name.trim(),observacao:note.trim()||null,
      poligono:polygon.length>=3?polygon:null,
      label_x:label?.x??null,label_y:label?.y??null,
    },token),'Call criada.')
    setName('');setNote('');setPolygon([]);setLabel(null)
  }

  async function save(){
    if(!selectedCall||!name.trim())return
    await action(()=>mobileApi.updateChampionshipCall(championshipId,{
      call_id:selectedCall.id,nome:name.trim(),observacao:note.trim()||null,
      poligono:polygon,label_x:label?.x??null,label_y:label?.y??null,
    },token),'Call e território atualizados.')
  }

  function selectCall(row:any){
    setCallId(String(row.id))
    setName(String(row.nome||''))
    setNote(String(row.observacao||''))
    setPolygon(parsePolygon(row.poligono))
    const x=Number(row.label_x),y=Number(row.label_y)
    setLabel(Number.isFinite(x)&&Number.isFinite(y)?{x:clamp(x),y:clamp(y)}:null)
    setFeedback('')
  }

  function removeCall(row:any){
    Alert.alert('Excluir call?',String(row.nome||'Call'),[
      {text:'Cancelar',style:'cancel'},
      {text:'Excluir',style:'destructive',onPress:()=>void action(()=>mobileApi.deleteChampionshipCall(championshipId,String(row.id),token),'Call excluída.')},
    ])
  }

  async function assign(team:any,type:AssignmentType,appearance?:{cor?:string;opacidade?:number}){
    if(!selectedCall){setError('Selecione uma call primeiro.');return}
    const current=assignments.find((row:any)=>String(row.campeonato_equipe_id)===String(team.id)&&row.tipo===type)
    await action(()=>mobileApi.assignChampionshipCall(championshipId,{
      call_id:selectedCall.id,
      campeonato_equipe_id:team.id,
      tipo:type,
      permitir_conflito:false,
      cor:appearance?.cor||current?.cor||'#d6b84b',
      opacidade:appearance?.opacidade??current?.opacidade??0.42,
    },token),current?'Território atualizado.':type==='principal'?'Call principal definida.':'Call alternativa definida.')
  }

  function removeAssignment(row:any){
    void action(()=>mobileApi.deleteChampionshipCallAssignment(championshipId,String(row.id),token),'Vínculo removido.')
  }

  function onMapLayout(event:LayoutChangeEvent){
    const {width,height}=event.nativeEvent.layout
    if(width>0&&height>0)setMapSize({width,height})
  }

  function onMapPress(event:NativeSyntheticEvent<any>){
    if(!selectedCall)return
    const locationX=Number(event.nativeEvent.locationX)
    const locationY=Number(event.nativeEvent.locationY)
    if(!Number.isFinite(locationX)||!Number.isFinite(locationY))return
    const point={x:clamp(locationX/mapSize.width),y:clamp(locationY/mapSize.height)}
    if(editorMode==='label')setLabel(point)
    else setPolygon(current=>[...current,point])
  }

  async function shareTerritory(){
    if(!selectedCall)return
    const payload={call:selectedCall.nome,mapa:map?.nome||mapCode,poligono:polygon,label}
    await Share.share({title:`Call ${selectedCall.nome}`,message:JSON.stringify(payload)})
  }

  const canSavePolygon=polygon.length===0||polygon.length>=3

  if(loading&&!data.mapas?.length)return <View style={styles.loading}><ActivityIndicator color={colors.brand}/></View>

  return <View style={styles.root}>
    {error?<Text style={[styles.message,styles.error]}>{error}</Text>:null}
    {feedback?<Text style={styles.message}>{feedback}</Text>:null}

    <Text style={styles.title}>MAPA</Text>
    <View style={styles.chips}>
      {(data.mapas||[]).map((row:any)=>{
        const code=String(row.codigo),active=code===mapCode
        return <TouchableOpacity key={row.id||code} style={[styles.chip,active&&styles.chipActive]} onPress={()=>{setMapCode(code);setCallId('');setName('');setNote('');setPolygon([]);setLabel(null)}}><Text style={[styles.chipText,active&&styles.chipTextActive]}>{row.nome}</Text></TouchableOpacity>
      })}
    </View>

    <Text style={styles.title}>{selectedCall?'TERRITÓRIO INTERATIVO':'MAPA DE CALLS'}</Text>
    <View style={styles.mapCard}>
      <Pressable onLayout={onMapLayout} onPress={onMapPress} disabled={!selectedCall} style={styles.mapCanvas}>
        {map?.imagem_url?<Image source={{uri:externalUrl(map.imagem_url)}} style={StyleSheet.absoluteFill} resizeMode="cover"/>:<View style={[StyleSheet.absoluteFill,styles.mapMissing]}><Ionicons name="map-outline" size={40} color={colors.muted}/></View>}
        {calls.map((row:any)=>{
          const points=parsePolygon(row.poligono)
          const active=String(row.id)===callId
          const callAssignments=(data.vinculos||[]).filter((v:any)=>String(v.call_id)===String(row.id))
          const paint=callAssignments[0]
          const cor=paint?.cor||row.cor||'#d6b84b'
          const opacity=Number(paint?.opacidade||0.42)
          const lx=Number.isFinite(Number(row.label_x))?Number(row.label_x):(points[0]?.x??0.5)
          const ly=Number.isFinite(Number(row.label_y))?Number(row.label_y):(points[0]?.y??0.5)
          return <View key={`overlay-${row.id}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
            {points.map((point,index)=><View key={`${row.id}-${index}`} style={[styles.savedPoint,{left:`${point.x*100}%`,top:`${point.y*100}%`,backgroundColor:rgba(cor,opacity),borderColor:cor}]} />)}
            <View style={[styles.callLabel,{left:`${clamp(lx)*100}%`,top:`${clamp(ly)*100}%`,backgroundColor:active?colors.brandDark:cor}]}><Text style={styles.callLabelText}>{row.nome}</Text></View>
          </View>
        })}
        {selectedCall?<View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {polygon.map((point,index)=><View key={`edit-${index}`} style={[styles.editPoint,{left:`${point.x*100}%`,top:`${point.y*100}%`}]}><Text style={styles.editPointText}>{index+1}</Text></View>)}
          {label?<View style={[styles.labelPin,{left:`${label.x*100}%`,top:`${label.y*100}%`}]}><Ionicons name="location" size={22} color={colors.brand}/></View>:null}
        </View>:null}
      </Pressable>
      <View style={styles.mapCaption}><Text style={styles.mapName}>{map?.nome||mapCode||'Mapa'}</Text><Text style={styles.meta}>{calls.length} calls · {selectedCall?`${polygon.length} pontos no território`:'toque em uma call para editar'}</Text></View>
    </View>

    {selectedCall?<View style={styles.card}>
      <View style={styles.segment}>
        <TouchableOpacity style={[styles.segmentItem,editorMode==='territory'&&styles.segmentActive]} onPress={()=>setEditorMode('territory')}><Text style={[styles.segmentText,editorMode==='territory'&&styles.segmentTextActive]}>Desenhar território</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.segmentItem,editorMode==='label'&&styles.segmentActive]} onPress={()=>setEditorMode('label')}><Text style={[styles.segmentText,editorMode==='label'&&styles.segmentTextActive]}>Posicionar nome</Text></TouchableOpacity>
      </View>
      <Text style={styles.help}>{editorMode==='territory'?'Toque no mapa em sequência para marcar os vértices. Mínimo de 3 pontos.':'Toque no mapa onde o nome/logo da call deve aparecer.'}</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondary} onPress={()=>setPolygon(current=>current.slice(0,-1))} disabled={!polygon.length}><Text style={styles.secondaryText}>Desfazer ponto</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={()=>setPolygon([])} disabled={!polygon.length}><Text style={styles.secondaryText}>Limpar área</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={()=>setLabel(null)} disabled={!label}><Text style={styles.secondaryText}>Limpar nome</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={()=>void shareTerritory()}><Text style={styles.secondaryText}>Compartilhar JSON</Text></TouchableOpacity>
      </View>
      {!canSavePolygon?<Text style={styles.validation}>O território precisa de pelo menos 3 pontos ou deve ficar vazio.</Text>:null}
    </View>:null}

    <Text style={styles.title}>{selectedCall?'EDITAR CALL':'NOVA CALL'}</Text>
    <View style={styles.card}>
      <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Nome da call" placeholderTextColor="#8a857e"/>
      <TextInput value={note} onChangeText={setNote} style={[styles.input,styles.textarea]} multiline placeholder="Observação opcional" placeholderTextColor="#8a857e"/>
      <View style={styles.actions}>
        {selectedCall?<TouchableOpacity style={styles.secondary} onPress={()=>{setCallId('');setName('');setNote('');setPolygon([]);setLabel(null)}}><Text style={styles.secondaryText}>Nova</Text></TouchableOpacity>:null}
        <TouchableOpacity style={[styles.primary,!canSavePolygon&&styles.disabled]} disabled={busy||!canSavePolygon} onPress={()=>void (selectedCall?save():create())}><Text style={styles.primaryText}>{selectedCall?'Salvar tudo':'Criar call'}</Text></TouchableOpacity>
      </View>
    </View>

    <Text style={styles.title}>CALLS DE {String(map?.nome||mapCode||'MAPA').toUpperCase()}</Text>
    <View style={styles.list}>
      {calls.map((row:any)=>{
        const active=String(row.id)===callId
        const count=(data.vinculos||[]).filter((v:any)=>String(v.call_id)===String(row.id)).length
        return <View key={row.id} style={[styles.callRow,active&&styles.callRowActive]}>
          <TouchableOpacity style={styles.callMain} onPress={()=>selectCall(row)}>
            <View style={[styles.dot,{backgroundColor:String(row.cor||'#d6b84b')}]} />
            <View style={styles.copy}><Text style={styles.rowTitle}>{row.nome}</Text><Text style={styles.meta}>{row.observacao||`${count} equipes vinculadas`} · {parsePolygon(row.poligono).length} pontos</Text></View>
            <Ionicons name="chevron-forward" size={17} color={colors.muted}/>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconDanger} onPress={()=>removeCall(row)}><Ionicons name="trash-outline" size={16} color="#b42318"/></TouchableOpacity>
        </View>
      })}
      {!calls.length?<Text style={styles.empty}>Nenhuma call cadastrada neste mapa.</Text>:null}
    </View>

    {selectedCall?<>
      <Text style={styles.title}>EQUIPES — {String(selectedCall.nome).toUpperCase()}</Text>
      <View style={styles.list}>
        {(data.equipes||[]).map((team:any)=>{
          const principal=assignments.find((row:any)=>String(row.campeonato_equipe_id)===String(team.id)&&row.tipo==='principal')
          const alternative=assignments.find((row:any)=>String(row.campeonato_equipe_id)===String(team.id)&&row.tipo==='alternativa')
          const teamName=team.nome_exibicao||team.equipe_lines?.nome||team.equipes?.nome||'Equipe'
          const tag=team.equipe_lines?.tag||team.equipes?.tag||''
          const appearance=principal||alternative
          const currentColor=String(appearance?.cor||'#d6b84b')
          const currentOpacity=Number(appearance?.opacidade||0.42)
          const appearanceType:AssignmentType=principal?'principal':'alternativa'
          return <View key={team.id} style={styles.teamBlock}>
            <View style={styles.teamRow}>
              <View style={styles.slot}><Text style={styles.slotText}>{team.slot_numero||'—'}</Text></View>
              <View style={styles.copy}><Text style={styles.rowTitle}>{teamName}</Text><Text style={styles.meta}>{tag||'Line participante'}</Text></View>
              {principal?<TouchableOpacity style={styles.badgeActive} onPress={()=>removeAssignment(principal)}><Text style={styles.badgeActiveText}>Principal ×</Text></TouchableOpacity>:<TouchableOpacity style={styles.badge} onPress={()=>void assign(team,'principal')}><Text style={styles.badgeText}>Principal</Text></TouchableOpacity>}
              {alternative?<TouchableOpacity style={styles.badgeAltActive} onPress={()=>removeAssignment(alternative)}><Text style={styles.badgeAltText}>Alt. ×</Text></TouchableOpacity>:<TouchableOpacity style={styles.badge} onPress={()=>void assign(team,'alternativa')}><Text style={styles.badgeText}>Alt.</Text></TouchableOpacity>}
            </View>
            {appearance?<View style={styles.appearance}>
              <Text style={styles.appearanceLabel}>COR</Text>
              <View style={styles.colorRow}>{TEAM_COLORS.map(c=><TouchableOpacity key={c} style={[styles.colorSwatch,{backgroundColor:c},currentColor.toLowerCase()===c.toLowerCase()&&styles.colorSelected]} onPress={()=>void assign(team,appearanceType,{cor:c,opacidade:currentOpacity})}/>)}</View>
              <Text style={styles.appearanceLabel}>OPACIDADE {Math.round(currentOpacity*100)}%</Text>
              <View style={styles.opacityRow}>
                {[.2,.42,.6,.8].map(op=><TouchableOpacity key={op} style={[styles.opacityChip,Math.abs(currentOpacity-op)<.01&&styles.opacityChipActive]} onPress={()=>void assign(team,appearanceType,{cor:currentColor,opacidade:op})}><Text style={[styles.opacityText,Math.abs(currentOpacity-op)<.01&&styles.opacityTextActive]}>{Math.round(op*100)}%</Text></TouchableOpacity>)}
              </View>
            </View>:null}
          </View>
        })}
      </View>
      <View style={styles.notice}><Ionicons name="information-circle-outline" size={17} color={colors.brand}/><Text style={styles.noticeText}>Os pontos e a posição da label são normalizados de 0 a 1, então continuam alinhados mesmo quando o mapa muda de tamanho no aparelho.</Text></View>
    </>:null}
  </View>
}

const styles=StyleSheet.create({
  root:{marginHorizontal:spacing.md,gap:8},loading:{minHeight:64,alignItems:'center',justifyContent:'center'},
  message:{padding:10,color:'#166534',backgroundColor:'#effaf3',fontWeight:'800'},error:{color:'#9a3412',backgroundColor:'#fff7ed'},
  title:{marginTop:8,color:colors.ink,fontSize:10,fontWeight:'900',letterSpacing:1},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:5},chip:{paddingHorizontal:10,paddingVertical:8,backgroundColor:'#eee9e1'},chipActive:{backgroundColor:colors.brandDark},
  chipText:{color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},chipTextActive:{color:colors.surface},
  mapCard:{overflow:'hidden',backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},mapCanvas:{width:'100%',aspectRatio:1.55,overflow:'hidden',backgroundColor:'#ddd7ce'},
  mapMissing:{alignItems:'center',justifyContent:'center'},mapCaption:{padding:9},mapName:{color:colors.ink,fontSize:12,fontWeight:'900',textTransform:'uppercase'},meta:{marginTop:2,color:colors.muted,fontSize:8,fontWeight:'700'},
  savedPoint:{position:'absolute',width:14,height:14,marginLeft:-7,marginTop:-7,borderRadius:7,borderWidth:2},
  editPoint:{position:'absolute',width:22,height:22,marginLeft:-11,marginTop:-11,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand,borderWidth:2,borderColor:colors.surface},
  editPointText:{color:colors.surface,fontSize:7,fontWeight:'900'},callLabel:{position:'absolute',maxWidth:105,marginLeft:-5,marginTop:-11,paddingHorizontal:5,paddingVertical:3},
  callLabelText:{color:colors.surface,fontSize:6,fontWeight:'900',textTransform:'uppercase'},labelPin:{position:'absolute',marginLeft:-11,marginTop:-22},
  card:{gap:7,padding:9,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:9},segment:{flexDirection:'row',gap:1,backgroundColor:colors.line},
  segmentItem:{flex:1,minHeight:36,alignItems:'center',justifyContent:'center',backgroundColor:'#eee9e1'},segmentActive:{backgroundColor:colors.brandDark},
  segmentText:{color:colors.ink,fontSize:7,fontWeight:'900',textTransform:'uppercase'},segmentTextActive:{color:colors.surface},help:{color:colors.muted,fontSize:8,lineHeight:12},
  input:{minHeight:40,paddingHorizontal:9,borderRadius:7,color:colors.ink,backgroundColor:'#f2eee7',borderWidth:1,borderColor:colors.line,fontWeight:'800'},textarea:{minHeight:70,textAlignVertical:'top',paddingTop:10},
  actions:{flexDirection:'row',flexWrap:'wrap',gap:5},primary:{flexGrow:1,minHeight:42,paddingHorizontal:14,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand},disabled:{opacity:.45},
  primaryText:{color:colors.surface,fontSize:8,fontWeight:'900',textTransform:'uppercase'},secondary:{minHeight:36,paddingHorizontal:9,alignItems:'center',justifyContent:'center',backgroundColor:'#eee9e1'},
  secondaryText:{color:colors.ink,fontSize:7,fontWeight:'900',textTransform:'uppercase'},validation:{padding:8,color:'#9a3412',fontSize:8,fontWeight:'800',backgroundColor:'#fff7ed'},
  list:{gap:1,backgroundColor:colors.line},callRow:{flexDirection:'row',backgroundColor:colors.surface},callRowActive:{borderLeftWidth:3,borderLeftColor:colors.brand},
  callMain:{flex:1,minHeight:58,flexDirection:'row',alignItems:'center',gap:8,padding:8},dot:{width:10,height:36},copy:{flex:1},rowTitle:{color:colors.ink,fontSize:9,fontWeight:'900',textTransform:'uppercase'},
  iconDanger:{width:42,alignItems:'center',justifyContent:'center',backgroundColor:'#fff1f1'},empty:{padding:16,color:colors.muted,textAlign:'center',backgroundColor:colors.surface},
  teamBlock:{backgroundColor:colors.surface},teamRow:{minHeight:58,flexDirection:'row',alignItems:'center',gap:5,padding:7},slot:{width:32,height:32,alignItems:'center',justifyContent:'center',backgroundColor:colors.brandDark},
  slotText:{color:colors.surface,fontSize:9,fontWeight:'900'},badge:{minHeight:30,paddingHorizontal:7,alignItems:'center',justifyContent:'center',backgroundColor:'#eee9e1'},badgeText:{color:colors.ink,fontSize:6.5,fontWeight:'900',textTransform:'uppercase'},
  badgeActive:{minHeight:30,paddingHorizontal:7,alignItems:'center',justifyContent:'center',backgroundColor:colors.brandDark},badgeActiveText:{color:colors.surface,fontSize:6.5,fontWeight:'900',textTransform:'uppercase'},
  badgeAltActive:{minHeight:30,paddingHorizontal:7,alignItems:'center',justifyContent:'center',backgroundColor:'#fff7ed'},badgeAltText:{color:'#9a3412',fontSize:6.5,fontWeight:'900',textTransform:'uppercase'},
  appearance:{paddingHorizontal:8,paddingBottom:9,gap:5,borderTopWidth:1,borderTopColor:colors.line},appearanceLabel:{marginTop:6,color:colors.muted,fontSize:6.5,fontWeight:'900'},
  colorRow:{flexDirection:'row',flexWrap:'wrap',gap:5},colorSwatch:{width:25,height:25,borderWidth:2,borderColor:colors.surface},colorSelected:{borderColor:colors.ink},
  opacityRow:{flexDirection:'row',gap:4},opacityChip:{paddingHorizontal:8,paddingVertical:6,backgroundColor:'#eee9e1'},opacityChipActive:{backgroundColor:colors.brandDark},
  opacityText:{color:colors.ink,fontSize:6.5,fontWeight:'900'},opacityTextActive:{color:colors.surface},
  notice:{flexDirection:'row',gap:7,padding:10,backgroundColor:'#f2eee7'},noticeText:{flex:1,color:colors.muted,fontSize:8,lineHeight:12,fontWeight:'700'},
})
