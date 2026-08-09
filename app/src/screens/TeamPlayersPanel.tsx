import { useCallback, useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Alert, Image, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { externalUrl } from '@/config/env'
import { mobileApi } from '@/lib/api'
import { colors, spacing } from '@/theme/tokens'

export function TeamPlayersPanel({
  teamId,
  players,
  lines,
  registrations,
  accessToken,
  canInvite,
}:{
  teamId:string
  players:any[]
  lines:any[]
  registrations:any[]
  accessToken?:string|null
  canInvite:boolean
}){
  const [invites,setInvites]=useState<any[]>([])
  const [selectedLineId,setSelectedLineId]=useState('')
  const [selectedRegistrationId,setSelectedRegistrationId]=useState('')
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(false)
  const [feedback,setFeedback]=useState('')
  const [error,setError]=useState('')

  const selectedLine=useMemo(()=>lines.find(item=>String(item.id)===selectedLineId)||null,[lines,selectedLineId])
  const eligibleRegistrations=useMemo(
    ()=>registrations.filter(item=>!selectedLineId||String(item.line_id||item.line?.id||'')===selectedLineId),
    [registrations,selectedLineId],
  )

  const loadInvites=useCallback(async()=>{
    if(!accessToken||!teamId||!canInvite){setInvites([]);return}
    setLoading(true);setError('')
    try{
      const response=await mobileApi.teamRosterInvites(teamId,selectedLineId||null,accessToken)
      setInvites(Array.isArray(response.invites)?response.invites:[])
    }catch(err:any){setError(err?.message||'Não foi possível carregar os convites de elenco.')}
    finally{setLoading(false)}
  },[accessToken,canInvite,selectedLineId,teamId])

  useEffect(()=>{void loadInvites()},[loadInvites])

  useEffect(()=>{
    if(selectedRegistrationId&&!eligibleRegistrations.some(item=>String(item.id)===selectedRegistrationId)){
      setSelectedRegistrationId('')
    }
  },[eligibleRegistrations,selectedRegistrationId])

  async function createInvite(){
    if(!accessToken||busy)return
    setBusy(true);setError('');setFeedback('')
    try{
      const result=await mobileApi.createTeamRosterInvite({
        equipe_id:teamId,
        line_id:selectedLineId||null,
        campeonato_equipe_id:selectedRegistrationId||null,
      },accessToken)
      setFeedback('Convite criado. Compartilhe com o jogador que deve entrar.')
      await Share.share({message:result.texto||result.url,url:result.url})
      await loadInvites()
    }catch(err:any){setError(err?.message||'Não foi possível gerar o convite.')}
    finally{setBusy(false)}
  }

  async function shareInvite(item:any){
    const url=item.url||externalUrl(`/equipe/entrar/${item.token}`)
    await Share.share({message:`Convite para entrar na equipe: ${url}`,url})
  }

  function renew(item:any){
    Alert.alert('Renovar convite?','A validade será estendida por mais 7 dias.',[
      {text:'Cancelar',style:'cancel'},
      {text:'Renovar',onPress:()=>void (async()=>{
        setBusy(true);setError('');setFeedback('')
        try{
          await mobileApi.renewTeamRosterInvite(teamId,String(item.id),accessToken)
          setFeedback('Convite renovado por 7 dias.')
          await loadInvites()
        }catch(err:any){setError(err?.message||'Não foi possível renovar o convite.')}
        finally{setBusy(false)}
      })()},
    ])
  }

  function cancel(item:any){
    Alert.alert('Cancelar convite?','Este link deixará de poder ser usado.',[
      {text:'Manter',style:'cancel'},
      {text:'Cancelar convite',style:'destructive',onPress:()=>void (async()=>{
        setBusy(true);setError('');setFeedback('')
        try{
          await mobileApi.cancelTeamRosterInvite(teamId,String(item.id),accessToken)
          setFeedback('Convite cancelado.')
          await loadInvites()
        }catch(err:any){setError(err?.message||'Não foi possível cancelar o convite.')}
        finally{setBusy(false)}
      })()},
    ])
  }

  return <View style={styles.wrap}>
    {feedback?<Text style={styles.success}>{feedback}</Text>:null}
    {error?<Text style={styles.error}>{error}</Text>:null}

    <View style={styles.card}>
      <Text style={styles.eyebrow}>ELENCO ATUAL</Text>
      <Text style={styles.title}>{players.length} {players.length===1?'jogador':'jogadores'}</Text>
      {!players.length?<Empty text="O elenco desta equipe está vazio."/>:players.map((item,index)=><PlayerRow key={String(item.id||item.jogador_id||index)} item={item}/>)}
    </View>

    {canInvite?<View style={styles.card}>
      <Text style={styles.eyebrow}>CONVIDAR JOGADOR</Text>
      <Text style={styles.title}>Gerar convite de elenco</Text>
      <Text style={styles.hint}>O link pode adicionar o jogador à equipe, a uma line específica e, quando selecionado, à formação do campeonato.</Text>

      <Text style={styles.label}>LINE DE DESTINO</Text>
      <View style={styles.choices}>
        <Choice label="Somente equipe" active={!selectedLineId} onPress={()=>{setSelectedLineId('');setSelectedRegistrationId('')}}/>
        {lines.map(line=><Choice key={line.id} label={line.nome||line.tag||'Line'} active={String(line.id)===selectedLineId} onPress={()=>{setSelectedLineId(String(line.id));setSelectedRegistrationId('')}}/>)}
      </View>

      {selectedLineId&&eligibleRegistrations.length?<><Text style={styles.label}>CAMPEONATO (OPCIONAL)</Text><View style={styles.choices}>
        <Choice label="Sem campeonato" active={!selectedRegistrationId} onPress={()=>setSelectedRegistrationId('')}/>
        {eligibleRegistrations.map(item=><Choice key={item.id} label={item.campeonato?.nome||item.campeonato_nome||'Campeonato'} active={String(item.id)===selectedRegistrationId} onPress={()=>setSelectedRegistrationId(String(item.id))}/>)}
      </View></>:null}

      <TouchableOpacity disabled={busy} style={[styles.primary,busy&&styles.disabled]} onPress={()=>void createInvite()}>
        {busy?<ActivityIndicator color="#fff"/>:<><Ionicons name="person-add-outline" size={17} color="#fff"/><Text style={styles.primaryText}>Gerar e compartilhar</Text></>}
      </TouchableOpacity>
      {selectedLine?<Text style={styles.destination}>Destino atual: {selectedLine.nome||selectedLine.tag||'Line selecionada'}{selectedRegistrationId?' + campeonato':''}</Text>:<Text style={styles.destination}>Destino atual: equipe, sem line específica</Text>}
    </View>:<View style={styles.readOnly}><Ionicons name="information-circle-outline" size={18} color={colors.brand}/><Text style={styles.readOnlyText}>Seu acesso permite visualizar o elenco, mas não gerar convites de jogador.</Text></View>}

    {canInvite?<View style={styles.card}>
      <Text style={styles.eyebrow}>CONVITES ATIVOS</Text>
      <Text style={styles.title}>{invites.length} {invites.length===1?'link':'links'}</Text>
      {loading?<View style={styles.loading}><ActivityIndicator color={colors.brand}/><Text style={styles.hint}>Atualizando convites...</Text></View>:null}
      {!loading&&!invites.length?<Empty text="Nenhum convite ativo para este destino."/>:invites.map(item=><View key={item.id} style={styles.inviteRow}>
        <View style={styles.inviteIcon}><Ionicons name="link-outline" size={18} color={colors.brand}/></View>
        <View style={styles.copy}>
          <Text style={styles.name}>{item.expired?'Expirado':'Convite ativo'}</Text>
          <Text style={styles.meta} numberOfLines={1}>{item.token}</Text>
          <Text style={styles.meta}>{item.expira_em?`Expira em ${formatDate(item.expira_em)}`:'Sem validade informada'}</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={()=>void shareInvite(item)}><Ionicons name="share-social-outline" size={18} color={colors.ink}/></TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} disabled={busy} onPress={()=>renew(item)}><Ionicons name="refresh-outline" size={18} color={colors.ink}/></TouchableOpacity>
        <TouchableOpacity style={styles.iconDanger} disabled={busy} onPress={()=>cancel(item)}><Ionicons name="trash-outline" size={17} color="#9a3412"/></TouchableOpacity>
      </View>)}
    </View>:null}
  </View>
}

function PlayerRow({item}:{item:any}){
  const source=item.jogador||item
  const image=source.avatar_url||source.foto_url
  const title=source.nome||source.nick||source.username||item.nome_exibicao||'Jogador'
  const id=source.id_jogo||item.id_jogo
  const role=source.funcao||item.funcao
  return <View style={styles.playerRow}>
    {image?<Image source={{uri:externalUrl(image)}} style={styles.avatar}/>:<View style={[styles.avatar,styles.avatarFallback]}><Text style={styles.avatarText}>{String(title).slice(0,1).toUpperCase()}</Text></View>}
    <View style={styles.copy}><Text style={styles.name}>{title}</Text><Text style={styles.meta}>{role||'Função não informada'} · ID {id||'pendente'}</Text></View>
  </View>
}

function Choice({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){
  return <TouchableOpacity style={[styles.choice,active&&styles.choiceActive]} onPress={onPress}><Text style={[styles.choiceText,active&&styles.choiceTextActive]} numberOfLines={1}>{label}</Text></TouchableOpacity>
}

function Empty({text}:{text:string}){
  return <View style={styles.empty}><Ionicons name="file-tray-outline" size={23} color={colors.muted}/><Text style={styles.emptyText}>{text}</Text></View>
}

function formatDate(value:string){
  const date=new Date(value)
  return Number.isNaN(date.getTime())?value:date.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'})
}

const styles=StyleSheet.create({
  wrap:{gap:spacing.md},
  card:{padding:13,gap:9,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},
  eyebrow:{color:colors.brand,fontSize:8,fontWeight:'900',letterSpacing:1.3},
  title:{color:colors.ink,fontSize:15,fontWeight:'900',textTransform:'uppercase'},
  hint:{color:colors.muted,fontSize:9,lineHeight:14},
  label:{color:colors.ink,fontSize:8,fontWeight:'900',letterSpacing:.8,marginTop:2},
  choices:{flexDirection:'row',flexWrap:'wrap',gap:5},
  choice:{maxWidth:'100%',paddingHorizontal:9,paddingVertical:8,backgroundColor:'#eee9e1',borderWidth:1,borderColor:colors.line},
  choiceActive:{backgroundColor:colors.brandDark,borderColor:colors.brandDark},
  choiceText:{color:colors.ink,fontSize:7,fontWeight:'900',textTransform:'uppercase'},
  choiceTextActive:{color:'#fff'},
  primary:{minHeight:47,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,backgroundColor:colors.brand},
  primaryText:{color:'#fff',fontSize:10,fontWeight:'900',textTransform:'uppercase'},
  disabled:{opacity:.5},
  destination:{color:colors.muted,fontSize:8,fontWeight:'700'},
  success:{padding:10,color:'#166534',backgroundColor:'#effaf3',fontSize:9,fontWeight:'800'},
  error:{padding:10,color:'#9a3412',backgroundColor:'#fff7ed',fontSize:9,fontWeight:'800'},
  readOnly:{flexDirection:'row',gap:8,padding:10,backgroundColor:'#e9e3d9'},
  readOnlyText:{flex:1,color:colors.ink,fontSize:9,lineHeight:14,fontWeight:'700'},
  playerRow:{minHeight:55,flexDirection:'row',alignItems:'center',gap:9,paddingVertical:8,borderTopWidth:1,borderTopColor:colors.line},
  inviteRow:{minHeight:60,flexDirection:'row',alignItems:'center',gap:7,paddingVertical:8,borderTopWidth:1,borderTopColor:colors.line},
  avatar:{width:40,height:40,borderRadius:20,backgroundColor:'#e8e2d9'},
  avatarFallback:{alignItems:'center',justifyContent:'center'},
  avatarText:{color:colors.brandDark,fontSize:13,fontWeight:'900'},
  inviteIcon:{width:36,height:36,alignItems:'center',justifyContent:'center',backgroundColor:'#fff0f2'},
  copy:{flex:1,minWidth:0},name:{color:colors.ink,fontSize:10,fontWeight:'900'},meta:{marginTop:2,color:colors.muted,fontSize:8},
  iconButton:{width:32,height:32,alignItems:'center',justifyContent:'center',backgroundColor:'#f2eee7',borderWidth:1,borderColor:colors.line},
  iconDanger:{width:32,height:32,alignItems:'center',justifyContent:'center',backgroundColor:'#fff7ed',borderWidth:1,borderColor:'#fed7aa'},
  empty:{minHeight:70,alignItems:'center',justifyContent:'center',gap:5},
  emptyText:{color:colors.muted,fontSize:9,textAlign:'center'},
  loading:{minHeight:45,flexDirection:'row',alignItems:'center',gap:7},
})
