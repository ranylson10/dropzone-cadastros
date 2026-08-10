import { useCallback, useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Alert, Linking, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { externalUrl } from '@/config/env'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { colors, spacing } from '@/theme/tokens'

export function BroadcastDeskPanel(){
  const auth=useAuth()
  const token=auth.session?.access_token
  const [data,setData]=useState<any>(null)
  const [key,setKey]=useState('')
  const [displayName,setDisplayName]=useState('')
  const [deskName,setDeskName]=useState('Mesa Stream')
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [feedback,setFeedback]=useState('')

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const next=await mobileApi.broadcastMe(token)
      setData(next)
      setDeskName(String(next?.desk?.nome||'Mesa Stream'))
      setError('')
    }catch(err:any){
      setData(null)
      setError(err?.message||'Não foi possível carregar sua mesa Broadcast.')
    }finally{
      setLoading(false)
    }
  },[token])

  useEffect(()=>{void load()},[load])

  async function action(work:()=>Promise<any>,message:string){
    setBusy(true);setError('');setFeedback('')
    try{
      await work()
      setFeedback(message)
      await load()
    }catch(err:any){
      setError(err?.message||'Não foi possível concluir a ação.')
    }finally{
      setBusy(false)
    }
  }

  async function redeem(){
    if(key.trim().length<8){setError('Informe uma chave Stream válida.');return}
    if(!displayName.trim()){setError('Informe um nome para identificar o campeonato.');return}
    await action(()=>mobileApi.broadcastRedeemKey({key_token:key.trim(),display_name:displayName.trim()},token),'Campeonato adicionado à sua mesa.')
    setKey('');setDisplayName('')
  }

  function selectChampionship(championshipId:string){
    void action(()=>mobileApi.broadcastEnsureDesk(championshipId,token),'Campeonato selecionado para a transmissão.')
  }

  function removeLink(row:any){
    Alert.alert('Remover campeonato?','Ele sairá da sua lista de transmissão.',[
      {text:'Cancelar',style:'cancel'},
      {text:'Remover',style:'destructive',onPress:()=>void action(()=>mobileApi.broadcastRemoveLink(String(row.id),token),'Campeonato removido da mesa.')},
    ])
  }

  function regenerate(kind:'controller'|'obs'){
    const body=kind==='controller'?{regenerate_controller_token:true}:{regenerate_obs_token:true}
    Alert.alert('Regenerar link?',`O link ${kind==='controller'?'do controlador':'do OBS'} atual deixará de funcionar.`,[
      {text:'Cancelar',style:'cancel'},
      {text:'Regenerar',style:'destructive',onPress:()=>void action(()=>mobileApi.broadcastUpdateDesk(body,token),'Novo link gerado.')},
    ])
  }

  function closeDesk(){
    Alert.alert('Encerrar mesa?','Os links atuais de controlador e OBS serão invalidados.',[
      {text:'Cancelar',style:'cancel'},
      {text:'Encerrar',style:'destructive',onPress:()=>void action(()=>mobileApi.broadcastCloseDesk(token),'Mesa encerrada. Uma nova será criada no próximo acesso.')},
    ])
  }

  async function openUrl(url:string){
    const ok=await Linking.canOpenURL(url)
    if(ok) await Linking.openURL(url)
    else setError('Não foi possível abrir este endereço.')
  }

  const desk=data?.desk||null
  const links=Array.isArray(data?.links)?data.links:[]
  const selectedId=String(desk?.campeonato_id||'')
  const selected=useMemo(()=>links.find((row:any)=>String(row.campeonato_id)===selectedId)||null,[links,selectedId])

  if(loading&&!data)return <View style={styles.loading}><ActivityIndicator color={colors.brand}/><Text style={styles.muted}>Sincronizando mesa Broadcast...</Text></View>

  const controllerUrl=desk?.controller_token?externalUrl(`/broadcast/control/${desk.controller_token}`):''
  const obsUrl=desk?.obs_token?externalUrl(`/broadcast/obs/${desk.obs_token}`):''

  return <View style={styles.root}>
    {error?<Text style={[styles.message,styles.error]}>{error}</Text>:null}
    {feedback?<Text style={styles.message}>{feedback}</Text>:null}

    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <View>
          <Text style={styles.eyebrow}>CENTRAL BROADCAST</Text>
          <Text style={styles.heroTitle}>{data?.profile?.nome||data?.profile?.username||'Mesa Stream'}</Text>
          <Text style={styles.heroMeta}>Perfil {String(data?.profile?.papel||'stream').toUpperCase()} · {links.length} campeonato(s)</Text>
        </View>
        <View style={styles.liveBadge}><Ionicons name="radio-outline" size={17} color={colors.surface}/><Text style={styles.liveText}>{desk?'MESA ATIVA':'SEM MESA'}</Text></View>
      </View>
      <View style={styles.heroDivider}/>
      <Text style={styles.heroLabel}>TRANSMITINDO AGORA</Text>
      <Text style={styles.heroValue}>{selected?.campeonato?.nome||selected?.display_name||'Nenhum campeonato selecionado'}</Text>
    </View>

    <Text style={styles.sectionKicker}>ACESSO DE CAMPEONATO</Text>
    <View style={styles.card}>
      <Text style={styles.title}>Resgatar chave Stream</Text>
      <Text style={styles.meta}>Use a chave fornecida pelo organizador para adicionar o campeonato à sua lista privada.</Text>
      <TextInput value={key} onChangeText={setKey} style={styles.input} autoCapitalize="none" placeholder="Chave Stream" placeholderTextColor={colors.muted}/>
      <TextInput value={displayName} onChangeText={setDisplayName} style={styles.input} placeholder="Nome na sua mesa" placeholderTextColor={colors.muted}/>
      <TouchableOpacity style={styles.primary} disabled={busy} onPress={()=>void redeem()}><Ionicons name="key-outline" size={17} color={colors.surface}/><Text style={styles.primaryText}>Resgatar chave</Text></TouchableOpacity>
    </View>

    <Text style={styles.sectionKicker}>CAMPEONATOS AUTORIZADOS</Text>
    {links.length?links.map((row:any)=>{
      const active=String(row.campeonato_id)===selectedId
      return <View key={row.id} style={[styles.card,active&&styles.activeCard]}>
        <View style={styles.rowHead}>
          <View style={{flex:1}}>
            <Text style={styles.rowTitle}>{row.display_name||row.campeonato?.nome||'Campeonato'}</Text>
            <Text style={styles.meta}>{row.campeonato?.nome||'Evento'} · {Number(row.scenes_count||0)} cena(s)</Text>
          </View>
          {active?<View style={styles.onAir}><Text style={styles.onAirText}>NO AR</Text></View>:null}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondary} disabled={busy||active} onPress={()=>selectChampionship(String(row.campeonato_id))}><Text style={styles.secondaryText}>{active?'Selecionado':'Transmitir'}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.danger} disabled={busy} onPress={()=>removeLink(row)}><Text style={styles.dangerText}>Remover</Text></TouchableOpacity>
        </View>
      </View>
    }):<View style={styles.empty}><Text style={styles.muted}>Nenhum campeonato autorizado ainda.</Text></View>}

    <Text style={styles.sectionKicker}>MESA DE CONTROLE</Text>
    <View style={styles.card}>
      <TextInput value={deskName} onChangeText={setDeskName} style={styles.input} placeholder="Nome da mesa" placeholderTextColor={colors.muted}/>
      <TouchableOpacity style={styles.secondaryWide} disabled={busy||!desk} onPress={()=>void action(()=>mobileApi.broadcastUpdateDesk({nome:deskName.trim()||'Mesa Stream'},token),'Nome da mesa atualizado.')}><Text style={styles.secondaryText}>Salvar nome da mesa</Text></TouchableOpacity>

      <View style={styles.linkBox}>
        <Text style={styles.linkLabel}>CONTROLADOR</Text>
        <Text style={styles.linkValue} numberOfLines={1}>{controllerUrl||'Indisponível'}</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondary} disabled={!controllerUrl} onPress={()=>void openUrl(controllerUrl)}><Text style={styles.secondaryText}>Abrir</Text></TouchableOpacity>
          <TouchableOpacity style={styles.secondary} disabled={!controllerUrl} onPress={()=>void Share.share({title:'Controlador Broadcast',message:controllerUrl})}><Text style={styles.secondaryText}>Compartilhar</Text></TouchableOpacity>
          <TouchableOpacity style={styles.warning} disabled={!desk||busy} onPress={()=>regenerate('controller')}><Text style={styles.warningText}>Regenerar</Text></TouchableOpacity>
        </View>
      </View>

      <View style={styles.linkBox}>
        <Text style={styles.linkLabel}>OBS BROWSER SOURCE</Text>
        <Text style={styles.linkValue} numberOfLines={1}>{obsUrl||'Indisponível'}</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondary} disabled={!obsUrl} onPress={()=>void openUrl(obsUrl)}><Text style={styles.secondaryText}>Preview</Text></TouchableOpacity>
          <TouchableOpacity style={styles.secondary} disabled={!obsUrl} onPress={()=>void Share.share({title:'OBS Browser Source',message:obsUrl})}><Text style={styles.secondaryText}>Compartilhar OBS</Text></TouchableOpacity>
          <TouchableOpacity style={styles.warning} disabled={!desk||busy} onPress={()=>regenerate('obs')}><Text style={styles.warningText}>Regenerar</Text></TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.dangerWide} disabled={!desk||busy} onPress={closeDesk}><Ionicons name="power-outline" size={17} color="#b42318"/><Text style={styles.dangerText}>Encerrar mesa e invalidar links</Text></TouchableOpacity>
    </View>

    <View style={styles.security}><Ionicons name="shield-checkmark-outline" size={20} color="#166534"/><View style={{flex:1}}><Text style={styles.securityTitle}>ACESSO PRIVADO</Text><Text style={styles.securityText}>Somente campeonatos resgatados por este perfil podem ser selecionados na mesa. Controlador e OBS usam tokens próprios e podem ser regenerados.</Text></View></View>
  </View>
}

const styles=StyleSheet.create({
  root:{gap:8},
  loading:{minHeight:120,alignItems:'center',justifyContent:'center',gap:8},
  muted:{color:colors.muted,fontSize:9,fontWeight:'700'},
  message:{padding:10,color:'#166534',backgroundColor:'#effaf3',fontWeight:'800'},
  error:{color:'#9a3412',backgroundColor:'#fff7ed'},
  hero:{gap:10,padding:14,backgroundColor:'#0b1320',borderBottomWidth:3,borderBottomColor:colors.brand},
  heroTop:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:10},
  eyebrow:{color:colors.gold,fontSize:8,fontWeight:'900',letterSpacing:1.2},
  heroTitle:{marginTop:4,color:colors.surface,fontSize:20,fontWeight:'900',textTransform:'uppercase'},
  heroMeta:{marginTop:3,color:'#aeb6c0',fontSize:8,fontWeight:'700'},
  liveBadge:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:8,paddingVertical:6,backgroundColor:colors.brand},
  liveText:{color:colors.surface,fontSize:7,fontWeight:'900'},
  heroDivider:{height:1,backgroundColor:'#273244'},
  heroLabel:{color:'#7f8a99',fontSize:7,fontWeight:'900',letterSpacing:1},
  heroValue:{color:colors.surface,fontSize:12,fontWeight:'900'},
  sectionKicker:{marginTop:7,color:colors.brand,fontSize:8,fontWeight:'900',letterSpacing:1.1},
  card:{gap:8,padding:11,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},
  activeCard:{borderLeftWidth:4,borderLeftColor:colors.brand},
  title:{color:colors.ink,fontSize:13,fontWeight:'900'},
  meta:{color:colors.muted,fontSize:8,lineHeight:13,fontWeight:'700'},
  input:{minHeight:42,paddingHorizontal:9,color:colors.ink,backgroundColor:'#f2eee7',borderWidth:1,borderColor:colors.line,fontWeight:'800'},
  primary:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,backgroundColor:colors.brand},
  primaryText:{color:colors.surface,fontSize:8,fontWeight:'900',textTransform:'uppercase'},
  rowHead:{flexDirection:'row',alignItems:'center',gap:8},
  rowTitle:{color:colors.ink,fontSize:10,fontWeight:'900',textTransform:'uppercase'},
  onAir:{paddingHorizontal:7,paddingVertical:5,backgroundColor:colors.brand},
  onAirText:{color:colors.surface,fontSize:7,fontWeight:'900'},
  actions:{flexDirection:'row',flexWrap:'wrap',gap:5},
  secondary:{minHeight:34,paddingHorizontal:9,alignItems:'center',justifyContent:'center',backgroundColor:'#eee9e1'},
  secondaryWide:{minHeight:40,alignItems:'center',justifyContent:'center',backgroundColor:'#eee9e1'},
  secondaryText:{color:colors.ink,fontSize:7,fontWeight:'900',textTransform:'uppercase'},
  warning:{minHeight:34,paddingHorizontal:9,alignItems:'center',justifyContent:'center',backgroundColor:'#fff7ed'},
  warningText:{color:'#9a3412',fontSize:7,fontWeight:'900',textTransform:'uppercase'},
  danger:{minHeight:34,paddingHorizontal:9,alignItems:'center',justifyContent:'center',backgroundColor:'#fff1f1'},
  dangerWide:{minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,backgroundColor:'#fff1f1',borderWidth:1,borderColor:'#fecaca'},
  dangerText:{color:'#b42318',fontSize:7,fontWeight:'900',textTransform:'uppercase'},
  empty:{padding:14,alignItems:'center',backgroundColor:'#eee9e1'},
  linkBox:{gap:7,padding:9,backgroundColor:'#f2eee7'},
  linkLabel:{color:colors.brand,fontSize:7,fontWeight:'900',letterSpacing:.9},
  linkValue:{color:colors.ink,fontSize:8,fontWeight:'800'},
  security:{flexDirection:'row',gap:9,padding:12,backgroundColor:'#effaf3',borderWidth:1,borderColor:'#b7d8c0'},
  securityTitle:{color:'#166534',fontSize:8,fontWeight:'900',letterSpacing:.9},
  securityText:{marginTop:3,color:colors.ink,fontSize:8,lineHeight:13,fontWeight:'700'},
})
