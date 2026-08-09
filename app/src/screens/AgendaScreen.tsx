import { useCallback, useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { AgendaItem, agendaContextIds, agendaDateLabel, agendaDescription, agendaTitle } from '@/lib/agenda'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { DirectoryHero } from '@/screens/DirectoryHero'
import { colors, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

type AgendaScope='me'|'campeonato'|'equipe'
type Draft={id?:string;titulo:string;descricao:string;data_evento:string;horario_inicio:string;horario_fim:string;tipo:string;visibilidade:string}

const blankDraft=():Draft=>({
  titulo:'',descricao:'',data_evento:new Date().toISOString().slice(0,10),
  horario_inicio:'18:00',horario_fim:'',tipo:'livre',visibilidade:'privada',
})

function monthName(year:number,month:number){
  return new Date(year,month-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})
}
function shiftMonth(year:number,month:number,delta:number){
  const date=new Date(year,month-1+delta,1)
  return {year:date.getFullYear(),month:date.getMonth()+1}
}

export function AgendaScreen({ onNavigate, selectedChampionship, selectedTeamId, onSelectChampionship, onSelectTeam }: ScreenProps) {
  const auth=useAuth()
  const today=new Date()
  const [year,setYear]=useState(today.getFullYear())
  const [month,setMonth]=useState(today.getMonth()+1)
  const [scope,setScope]=useState<AgendaScope>(auth.session?'me':selectedChampionship?'campeonato':selectedTeamId?'equipe':'me')
  const [items,setItems]=useState<AgendaItem[]>([])
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [feedback,setFeedback]=useState<string|null>(null)
  const [editorOpen,setEditorOpen]=useState(false)
  const [draft,setDraft]=useState<Draft>(blankDraft())

  const scopeId=scope==='campeonato'?selectedChampionship?.id||null:scope==='equipe'?selectedTeamId||null:null
  const canUseScope=scope==='me'?Boolean(auth.session):Boolean(scopeId)
  const contextLabel=scope==='me'?'Minha agenda':scope==='campeonato'?(selectedChampionship?.name||'Campeonato'):'Equipe selecionada'

  useEffect(()=>{
    if(scope==='me'&&!auth.session){
      if(selectedChampionship)setScope('campeonato')
      else if(selectedTeamId)setScope('equipe')
    }
  },[auth.session,scope,selectedChampionship,selectedTeamId])

  const load=useCallback(async()=>{
    if(!canUseScope){setItems([]);setLoading(false);return}
    setLoading(true)
    try{
      const response=await mobileApi.agendaScoped({scope,scopeId,year,month},auth.session?.access_token)
      setItems((response.items as AgendaItem[])||[])
      setError(null)
    }catch(err:any){setError(err?.message||'Não foi possível carregar a agenda.')}
    finally{setLoading(false)}
  },[auth.session?.access_token,canUseScope,month,scope,scopeId,year])

  useEffect(()=>{void load()},[load])

  const grouped=useMemo(()=>{
    const map=new Map<string,AgendaItem[]>()
    for(const item of items){
      const key=String(item.data||item.data_jogo||item.date||'sem-data').slice(0,10)
      map.set(key,[...(map.get(key)||[]),item])
    }
    return [...map.entries()]
  },[items])

  function moveMonth(delta:number){
    const next=shiftMonth(year,month,delta)
    setYear(next.year);setMonth(next.month)
  }

  function openNew(){
    if(!auth.session){setError('Faça login para criar compromissos pessoais.');return}
    const next=blankDraft()
    next.visibilidade=scope==='campeonato'?'campeonato':scope==='equipe'?'equipe':'privada'
    setDraft(next);setEditorOpen(true);setFeedback(null)
  }

  function openEdit(item:AgendaItem){
    if(!item.editable)return
    setDraft({
      id:String(item.id||''),
      titulo:agendaTitle(item),
      descricao:String(item.descricao||''),
      data_evento:String(item.data||item.data_jogo||new Date().toISOString().slice(0,10)).slice(0,10),
      horario_inicio:String(item.horario_inicio||item.horario||'18:00').slice(0,5),
      horario_fim:String(item.horario_fim||'').slice(0,5),
      tipo:String(item.tipo||'livre'),
      visibilidade:String(item.visibilidade||'privada'),
    })
    setEditorOpen(true);setFeedback(null)
  }

  async function saveDraft(){
    if(!auth.session||saving)return
    if(!draft.titulo.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(draft.data_evento)||!/^\d{2}:\d{2}$/.test(draft.horario_inicio)){
      setError('Preencha título, data e horário corretamente.');return
    }
    setSaving(true);setError(null);setFeedback(null)
    const body={
      titulo:draft.titulo.trim(),descricao:draft.descricao.trim()||null,
      data_evento:draft.data_evento,horario_inicio:draft.horario_inicio,
      horario_fim:draft.horario_fim||null,tipo:draft.tipo,visibilidade:draft.visibilidade,
      campeonato_id:scope==='campeonato'?scopeId:null,
      equipe_id:scope==='equipe'?scopeId:null,
    }
    try{
      if(draft.id)await mobileApi.updateAgendaEvent(draft.id,body,auth.session.access_token)
      else await mobileApi.createAgendaEvent(body,auth.session.access_token)
      setEditorOpen(false);setDraft(blankDraft());setFeedback(draft.id?'Evento atualizado.':'Evento criado.')
      await load()
    }catch(err:any){setError(err?.message||'Não foi possível salvar o evento.')}
    finally{setSaving(false)}
  }

  function removeDraft(){
    if(!draft.id||!auth.session)return
    Alert.alert('Excluir evento?',draft.titulo,[
      {text:'Cancelar',style:'cancel'},
      {text:'Excluir',style:'destructive',onPress:async()=>{
        setSaving(true)
        try{await mobileApi.deleteAgendaEvent(draft.id!,auth.session!.access_token);setEditorOpen(false);setFeedback('Evento excluído.');await load()}
        catch(err:any){setError(err?.message||'Não foi possível excluir o evento.')}
        finally{setSaving(false)}
      }},
    ])
  }

  function openItem(item:AgendaItem){
    const ids=agendaContextIds(item)
    if(ids.campeonatoId&&onSelectChampionship){
      onSelectChampionship({id:ids.campeonatoId,name:item.meta?.campeonato_nome||'Campeonato',mode:'',priceLabel:'',freeSlots:0})
      onNavigate('championship_public');return
    }
    if(ids.equipeId&&onSelectTeam){onSelectTeam(ids.equipeId);onNavigate('team_public');return}
    if(String(item.source)==='jogo'){onNavigate('my_championships');return}
    if(item.editable)openEdit(item)
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <DirectoryHero image={require('../../assets/directory-campeonatos.png')} eyebrow="Sua rotina competitiva" title="Agenda" description="Jogos, horários, treinos e compromissos no contexto certo." compact/>

      <View style={styles.scopeBar}>
        {auth.session?<ScopeButton label="Minha" active={scope==='me'} onPress={()=>setScope('me')}/>:null}
        <ScopeButton label="Campeonato" active={scope==='campeonato'} disabled={!selectedChampionship} onPress={()=>setScope('campeonato')}/>
        <ScopeButton label="Equipe" active={scope==='equipe'} disabled={!selectedTeamId} onPress={()=>setScope('equipe')}/>
      </View>

      {!canUseScope?<View style={styles.contextMissing}>
        <Ionicons name="calendar-outline" size={24} color={colors.muted}/>
        <Text style={styles.contextTitle}>Escolha um contexto</Text>
        <Text style={styles.contextText}>A agenda pública pode ser aberta por campeonato ou equipe sem exigir login.</Text>
        <View style={styles.contextActions}>
          <TouchableOpacity style={styles.secondary} onPress={()=>onNavigate('vacancies')}><Text style={styles.secondaryText}>Campeonatos</Text></TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={()=>onNavigate('team_directory')}><Text style={styles.secondaryText}>Equipes</Text></TouchableOpacity>
        </View>
      </View>:null}

      {canUseScope?<>
        <View style={styles.monthBar}>
          <TouchableOpacity style={styles.monthArrow} onPress={()=>moveMonth(-1)}><Ionicons name="chevron-back" size={18} color={colors.ink}/></TouchableOpacity>
          <View style={styles.monthCopy}><Text style={styles.contextEyebrow}>{contextLabel}</Text><Text style={styles.monthTitle}>{monthName(year,month)}</Text></View>
          <TouchableOpacity style={styles.monthArrow} onPress={()=>moveMonth(1)}><Ionicons name="chevron-forward" size={18} color={colors.ink}/></TouchableOpacity>
        </View>

        {auth.session?<TouchableOpacity style={styles.addButton} onPress={openNew}><Ionicons name="add" size={18} color={colors.surface}/><Text style={styles.addText}>Adicionar compromisso</Text></TouchableOpacity>:null}

        {editorOpen?<View style={styles.editor}>
          <Text style={styles.editorTitle}>{draft.id?'EDITAR EVENTO':'NOVO EVENTO'}</Text>
          <TextInput style={styles.input} value={draft.titulo} onChangeText={v=>setDraft(d=>({...d,titulo:v}))} placeholder="Título" placeholderTextColor="#8a857e"/>
          <TextInput style={[styles.input,styles.textarea]} value={draft.descricao} onChangeText={v=>setDraft(d=>({...d,descricao:v}))} placeholder="Descrição" placeholderTextColor="#8a857e" multiline/>
          <View style={styles.inline}>
            <TextInput style={[styles.input,styles.flex]} value={draft.data_evento} onChangeText={v=>setDraft(d=>({...d,data_evento:v}))} placeholder="AAAA-MM-DD" placeholderTextColor="#8a857e"/>
            <TextInput style={styles.smallInput} value={draft.horario_inicio} onChangeText={v=>setDraft(d=>({...d,horario_inicio:v}))} placeholder="18:00" placeholderTextColor="#8a857e"/>
            <TextInput style={styles.smallInput} value={draft.horario_fim} onChangeText={v=>setDraft(d=>({...d,horario_fim:v}))} placeholder="Fim" placeholderTextColor="#8a857e"/>
          </View>
          <Text style={styles.fieldLabel}>TIPO</Text>
          <View style={styles.chips}>{['livre','treino','reuniao','scrim','outro'].map(v=><Choice key={v} label={v} active={draft.tipo===v} onPress={()=>setDraft(d=>({...d,tipo:v}))}/>)}</View>
          <Text style={styles.fieldLabel}>VISIBILIDADE</Text>
          <View style={styles.chips}>{['privada','equipe','campeonato','publica'].map(v=><Choice key={v} label={v} active={draft.visibilidade===v} onPress={()=>setDraft(d=>({...d,visibilidade:v}))}/>)}</View>
          <View style={styles.editorActions}>
            <TouchableOpacity style={styles.secondary} onPress={()=>setEditorOpen(false)}><Text style={styles.secondaryText}>Cancelar</Text></TouchableOpacity>
            {draft.id?<TouchableOpacity style={styles.danger} onPress={removeDraft}><Text style={styles.dangerText}>Excluir</Text></TouchableOpacity>:null}
            <TouchableOpacity style={styles.primary} disabled={saving} onPress={()=>void saveDraft()}><Text style={styles.primaryText}>{saving?'Salvando...':'Salvar'}</Text></TouchableOpacity>
          </View>
        </View>:null}

        {loading?<View style={styles.loading}><ActivityIndicator color={colors.brand}/><Text style={styles.loadingText}>Carregando agenda...</Text></View>:null}
        {error?<Text style={styles.warning}>{error}</Text>:null}
        {feedback?<Text style={styles.success}>{feedback}</Text>:null}

        {!loading&&items.length===0?<View style={styles.empty}><Ionicons name="calendar-outline" size={24} color={colors.muted}/><Text style={styles.emptyText}>Nada agendado neste mês.</Text></View>:null}

        <View style={styles.groups}>
          {grouped.map(([date,dayItems])=><View key={date} style={styles.dayGroup}>
            <View style={styles.dayHeader}><Text style={styles.day}>{date==='sem-data'?'SEM DATA':date.split('-').reverse().join('/')}</Text><Text style={styles.dayCount}>{dayItems.length}</Text></View>
            {dayItems.map((item,index)=>{
              const isGame=String(item.source)==='jogo'
              return <TouchableOpacity key={String(item.id||`${agendaTitle(item)}-${index}`)} style={styles.row} onPress={()=>openItem(item)}>
                <View style={[styles.colorRail,{backgroundColor:item.cor||colors.brand}]}/>
                <View style={styles.dateBox}><Ionicons name={isGame?'game-controller-outline':'calendar-outline'} size={19} color={colors.brand}/></View>
                <View style={styles.copy}><Text style={styles.date} numberOfLines={1}>{agendaDateLabel(item)}</Text><Text style={styles.title} numberOfLines={1}>{agendaTitle(item)}</Text><Text style={styles.meta} numberOfLines={2}>{agendaDescription(item)}</Text></View>
                {item.editable?<Ionicons name="create-outline" size={17} color={colors.muted}/>:<Ionicons name="chevron-forward" size={17} color={colors.muted}/>}
              </TouchableOpacity>
            })}
          </View>)}
        </View>
      </>:null}
    </ScrollView>
  )
}

function ScopeButton({label,active,disabled,onPress}:{label:string;active:boolean;disabled?:boolean;onPress:()=>void}){
  return <TouchableOpacity disabled={disabled} style={[styles.scopeButton,active&&styles.scopeActive,disabled&&styles.disabled]} onPress={onPress}><Text style={[styles.scopeText,active&&styles.scopeTextActive]}>{label}</Text></TouchableOpacity>
}
function Choice({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){
  return <TouchableOpacity style={[styles.choice,active&&styles.choiceActive]} onPress={onPress}><Text style={[styles.choiceText,active&&styles.choiceTextActive]}>{label}</Text></TouchableOpacity>
}

const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:colors.background},content:{paddingBottom:spacing.lg},
  scopeBar:{marginHorizontal:spacing.md,marginTop:spacing.md,flexDirection:'row',gap:1,backgroundColor:colors.line},
  scopeButton:{flex:1,minHeight:38,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface},scopeActive:{backgroundColor:colors.brandDark},disabled:{opacity:.35},
  scopeText:{color:colors.muted,fontSize:8,fontWeight:'900',textTransform:'uppercase'},scopeTextActive:{color:colors.surface},
  contextMissing:{margin:spacing.md,padding:18,alignItems:'center',gap:7,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},
  contextTitle:{color:colors.ink,fontSize:13,fontWeight:'900',textTransform:'uppercase'},contextText:{color:colors.muted,fontSize:9,lineHeight:14,textAlign:'center'},
  contextActions:{flexDirection:'row',gap:6,marginTop:4},monthBar:{marginHorizontal:spacing.md,marginTop:8,minHeight:64,flexDirection:'row',alignItems:'center',backgroundColor:'#e8e2d8'},
  monthArrow:{width:48,alignSelf:'stretch',alignItems:'center',justifyContent:'center'},monthCopy:{flex:1,alignItems:'center'},contextEyebrow:{color:colors.brand,fontSize:7,fontWeight:'900',textTransform:'uppercase'},
  monthTitle:{marginTop:2,color:colors.ink,fontSize:14,fontWeight:'900',textTransform:'uppercase'},addButton:{marginHorizontal:spacing.md,marginTop:7,minHeight:42,flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand},
  addText:{color:colors.surface,fontSize:8,fontWeight:'900',textTransform:'uppercase'},editor:{margin:spacing.md,gap:7,padding:10,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},
  editorTitle:{color:colors.ink,fontSize:10,fontWeight:'900'},input:{minHeight:40,paddingHorizontal:9,color:colors.ink,backgroundColor:'#f2eee7',borderWidth:1,borderColor:colors.line,fontWeight:'800'},
  textarea:{minHeight:62,textAlignVertical:'top',paddingTop:9},inline:{flexDirection:'row',gap:5},flex:{flex:1},smallInput:{width:66,minHeight:40,paddingHorizontal:7,color:colors.ink,backgroundColor:'#f2eee7',borderWidth:1,borderColor:colors.line,fontWeight:'800'},
  fieldLabel:{marginTop:2,color:colors.muted,fontSize:7,fontWeight:'900'},chips:{flexDirection:'row',flexWrap:'wrap',gap:4},choice:{paddingHorizontal:8,paddingVertical:7,backgroundColor:'#eee9e1'},choiceActive:{backgroundColor:colors.brandDark},
  choiceText:{color:colors.ink,fontSize:6.5,fontWeight:'900',textTransform:'uppercase'},choiceTextActive:{color:colors.surface},editorActions:{flexDirection:'row',gap:5},
  primary:{flex:1,minHeight:40,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand},primaryText:{color:colors.surface,fontSize:8,fontWeight:'900',textTransform:'uppercase'},
  secondary:{minHeight:38,paddingHorizontal:10,alignItems:'center',justifyContent:'center',backgroundColor:'#eee9e1'},secondaryText:{color:colors.ink,fontSize:7,fontWeight:'900',textTransform:'uppercase'},
  danger:{minHeight:38,paddingHorizontal:10,alignItems:'center',justifyContent:'center',backgroundColor:'#fff1f1'},dangerText:{color:'#b42318',fontSize:7,fontWeight:'900',textTransform:'uppercase'},
  loading:{minHeight:54,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},loadingText:{color:colors.muted,fontSize:11,fontWeight:'700'},
  warning:{marginHorizontal:spacing.md,marginTop:7,padding:10,backgroundColor:'#fff7ed',color:'#9a3412',fontSize:10,fontWeight:'800'},
  success:{marginHorizontal:spacing.md,marginTop:7,padding:10,backgroundColor:'#effaf3',color:'#166534',fontSize:10,fontWeight:'800'},
  empty:{margin:spacing.md,minHeight:68,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#e7e1d8'},emptyText:{color:colors.muted,fontSize:11,fontWeight:'800'},
  groups:{margin:spacing.md,gap:7},dayGroup:{gap:1,backgroundColor:colors.line},dayHeader:{minHeight:30,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:9,backgroundColor:colors.brandDark},
  day:{color:colors.surface,fontSize:8,fontWeight:'900'},dayCount:{color:colors.brand,fontSize:8,fontWeight:'900'},
  row:{minHeight:70,flexDirection:'row',alignItems:'center',gap:9,paddingRight:9,paddingVertical:7,backgroundColor:'#e8e2d8'},colorRail:{alignSelf:'stretch',width:4},
  dateBox:{width:42,height:42,alignItems:'center',justifyContent:'center',backgroundColor:'#f6f1e9',borderWidth:1,borderColor:'rgba(17,24,39,.07)'},copy:{flex:1,minWidth:0},
  date:{color:colors.brand,fontSize:8,fontWeight:'900',textTransform:'uppercase'},title:{marginTop:2,color:colors.ink,fontSize:12,fontWeight:'900',textTransform:'uppercase'},meta:{marginTop:3,color:'#706b64',fontSize:8.5,fontWeight:'700'},
})
