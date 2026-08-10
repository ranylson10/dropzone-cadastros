import { useCallback, useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import {
  isActionableNotification,
  NotificationFilter,
  NotificationItem,
  notificationCategory,
  notificationDate,
  notificationMatchesFilter,
} from '@/lib/notifications'
import { colors, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

const FILTERS:NotificationFilter[]=['todas','nao_lidas','acoes','lidas']

export function InvitesScreen({ onBack }: ScreenProps) {
  const auth=useAuth()
  const accessToken=auth.session?.access_token
  const [items,setItems]=useState<NotificationItem[]>([])
  const [unread,setUnread]=useState(0)
  const [filter,setFilter]=useState<NotificationFilter>('todas')
  const [loading,setLoading]=useState(true)
  const [refreshing,setRefreshing]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [message,setMessage]=useState<string|null>(null)
  const [busyId,setBusyId]=useState<string|null>(null)
  const [bulkBusy,setBulkBusy]=useState(false)

  const load=useCallback(async(refresh=false)=>{
    refresh?setRefreshing(true):setLoading(true)
    try{
      const response=await mobileApi.notifications(accessToken)
      setItems((response.items as NotificationItem[])||[])
      setUnread(Number(response.nao_lidas||0))
      setError(null)
    }catch(err:any){
      setItems([]);setUnread(0);setError(err?.message||'Não foi possível carregar o correio.')
    }finally{
      setLoading(false);setRefreshing(false)
    }
  },[accessToken])

  useEffect(()=>{void load()},[load])

  const visibleItems=useMemo(()=>items.filter(item=>notificationMatchesFilter(item,filter)),[filter,items])
  const actionableCount=useMemo(()=>items.filter(isActionableNotification).length,[items])
  const readCount=useMemo(()=>items.filter(item=>item.status==='lida').length,[items])

  async function respond(item:NotificationItem,action:'aceitar'|'recusar'){
    const id=String(item.id||'')
    if(!id)return
    setBusyId(id);setMessage(null)
    try{
      const response=await mobileApi.respondNotification(id,action,accessToken)
      setMessage(response.mensagem||(action==='aceitar'?'Convite aceito.':'Convite recusado.'))
      await load()
    }catch(err:any){setMessage(err?.message||'Não foi possível responder agora.')}
    finally{setBusyId(null)}
  }

  async function setStatus(item:NotificationItem,status:'lida'|'nao_lida'){
    const id=String(item.id||'')
    if(!id)return
    setBusyId(id);setMessage(null)
    try{
      await mobileApi.updateNotification(id,status,accessToken)
      await load()
    }catch(err:any){setMessage(err?.message||'Não foi possível atualizar a notificação.')}
    finally{setBusyId(null)}
  }

  function archive(item:NotificationItem){
    const id=String(item.id||'')
    if(!id)return
    Alert.alert('Arquivar notificação?',item.titulo||'Notificação',[
      {text:'Cancelar',style:'cancel'},
      {text:'Arquivar',onPress:async()=>{
        setBusyId(id)
        try{await mobileApi.archiveNotification(id,accessToken);setMessage('Notificação arquivada.');await load()}
        catch(err:any){setMessage(err?.message||'Não foi possível arquivar.')}
        finally{setBusyId(null)}
      }},
    ])
  }

  async function markAllRead(includeActionable=false){
    setBulkBusy(true);setMessage(null)
    try{
      await mobileApi.markAllNotificationsRead(includeActionable,accessToken)
      setMessage(includeActionable?'Todas as notificações foram marcadas como lidas.':'Avisos sem ação pendente foram marcados como lidos.')
      await load()
    }catch(err:any){setMessage(err?.message||'Não foi possível marcar as notificações.')}
    finally{setBulkBusy(false)}
  }

  function archiveRead(){
    Alert.alert('Arquivar notificações lidas?','As notificações já lidas sairão da caixa principal.',[
      {text:'Cancelar',style:'cancel'},
      {text:'Arquivar',onPress:async()=>{
        setBulkBusy(true)
        try{await mobileApi.archiveAllReadNotifications(accessToken);setMessage('Notificações lidas arquivadas.');await load()}
        catch(err:any){setMessage(err?.message||'Não foi possível arquivar as lidas.')}
        finally{setBulkBusy(false)}
      }},
    ])
  }

  return <ScrollView
    style={styles.page}
    contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void load(true)}/>}
  >
    <View style={styles.header}>
      <TouchableOpacity style={styles.back} onPress={onBack}><Ionicons name="chevron-back" size={20} color={colors.surface}/></TouchableOpacity>
      <View style={styles.headerCopy}><Text style={styles.eyebrow}>CENTRAL</Text><Text style={styles.headerTitle}>NOTIFICAÇÕES</Text><Text style={styles.headerText}>Convites, pedidos, escalações e avisos em um só lugar.</Text></View>
    </View>

    <View style={styles.metrics}>
      <Metric label="Não lidas" value={unread}/>
      <Metric label="Ações" value={actionableCount}/>
      <Metric label="Lidas" value={readCount}/>
    </View>

    <View style={styles.filters}>
      {FILTERS.map(value=><TouchableOpacity key={value} style={[styles.filter,filter===value&&styles.filterActive]} onPress={()=>setFilter(value)}><Text style={[styles.filterText,filter===value&&styles.filterTextActive]}>{value.replace('_',' ')}</Text></TouchableOpacity>)}
    </View>

    <View style={styles.bulk}>
      <TouchableOpacity disabled={bulkBusy||unread===0} style={[styles.bulkButton,(bulkBusy||unread===0)&&styles.disabled]} onPress={()=>void markAllRead(false)}><Ionicons name="checkmark-done-outline" size={16} color={colors.ink}/><Text style={styles.bulkText}>Ler avisos</Text></TouchableOpacity>
      <TouchableOpacity disabled={bulkBusy||readCount===0} style={[styles.bulkButton,(bulkBusy||readCount===0)&&styles.disabled]} onPress={archiveRead}><Ionicons name="archive-outline" size={16} color={colors.ink}/><Text style={styles.bulkText}>Arquivar lidas</Text></TouchableOpacity>
    </View>

    {loading?<View style={styles.loading}><ActivityIndicator color={colors.brand}/><Text style={styles.muted}>Carregando notificações...</Text></View>:null}
    {error?<Text style={styles.warning}>{error}</Text>:null}
    {message?<Text style={styles.info}>{message}</Text>:null}

    {!loading&&!visibleItems.length?<View style={styles.empty}><Ionicons name="notifications-off-outline" size={28} color={colors.muted}/><Text style={styles.emptyTitle}>Nada aqui</Text><Text style={styles.muted}>Nenhuma notificação corresponde ao filtro atual.</Text></View>:null}

    <View style={styles.list}>
      {visibleItems.map((item,index)=>{
        const id=String(item.id||`${item.titulo||'notice'}-${index}`)
        const actionable=isActionableNotification(item)
        const unreadItem=item.status==='nao_lida'
        return <View key={id} style={[styles.notice,unreadItem&&styles.noticeUnread]}>
          <View style={styles.noticeHead}>
            <View style={[styles.iconBox,unreadItem&&styles.iconUnread]}><Ionicons name={actionable?'flash-outline':'notifications-outline'} size={17} color={unreadItem?colors.surface:colors.brand}/></View>
            <View style={styles.copy}>
              <View style={styles.categoryRow}><Text style={styles.category}>{notificationCategory(item)}</Text>{unreadItem?<View style={styles.unreadDot}/>:null}</View>
              <Text style={styles.noticeTitle}>{item.titulo||'Notificação'}</Text>
              <Text style={styles.noticeDate}>{notificationDate(item.created_at)} · {String(item.status||'registrada').replace('_',' ')}</Text>
            </View>
          </View>
          <Text style={styles.noticeBody}>{item.corpo||'Sem detalhes.'}</Text>

          {actionable?<View style={styles.actions}>
            <TouchableOpacity disabled={busyId===id} style={styles.accept} onPress={()=>void respond(item,'aceitar')}><Text style={styles.acceptText}>{busyId===id?'...':'Aceitar'}</Text></TouchableOpacity>
            <TouchableOpacity disabled={busyId===id} style={styles.refuse} onPress={()=>void respond(item,'recusar')}><Text style={styles.refuseText}>Recusar</Text></TouchableOpacity>
          </View>:null}

          <View style={styles.secondaryActions}>
            {!actionable?<TouchableOpacity disabled={busyId===id} style={styles.smallAction} onPress={()=>void setStatus(item,unreadItem?'lida':'nao_lida')}><Ionicons name={unreadItem?'checkmark-outline':'mail-unread-outline'} size={14} color={colors.ink}/><Text style={styles.smallActionText}>{unreadItem?'Marcar lida':'Marcar não lida'}</Text></TouchableOpacity>:null}
            <TouchableOpacity disabled={busyId===id} style={styles.smallAction} onPress={()=>archive(item)}><Ionicons name="archive-outline" size={14} color={colors.ink}/><Text style={styles.smallActionText}>Arquivar</Text></TouchableOpacity>
          </View>
        </View>
      })}
    </View>
  </ScrollView>
}

function Metric({label,value}:{label:string;value:number}){return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>}

const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:colors.background},content:{paddingBottom:spacing.xl},
  header:{minHeight:84,flexDirection:'row',gap:10,padding:12,backgroundColor:colors.brandDark,borderBottomLeftRadius:10,borderBottomRightRadius:10},
  back:{width:38,height:38,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.08)'},headerCopy:{flex:1},
  eyebrow:{color:colors.brand,fontSize:8,fontWeight:'900',letterSpacing:1.6},headerTitle:{marginTop:2,color:colors.surface,fontSize:22,fontWeight:'900',letterSpacing:.4},headerText:{marginTop:5,color:'#c9ced6',fontSize:9,lineHeight:13,fontWeight:'700'},
  metrics:{marginHorizontal:spacing.md,marginTop:-22,flexDirection:'row',gap:1,backgroundColor:colors.line},
  metric:{flex:1,minHeight:62,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface},metricValue:{color:colors.ink,fontSize:18,fontWeight:'900'},metricLabel:{marginTop:2,color:colors.muted,fontSize:7,fontWeight:'900',textTransform:'uppercase'},
  filters:{margin:spacing.md,marginBottom:6,flexDirection:'row',gap:4,flexWrap:'wrap'},filter:{paddingHorizontal:9,paddingVertical:7,backgroundColor:'#e8e2d8'},filterActive:{backgroundColor:colors.brandDark},
  filterText:{color:colors.ink,fontSize:7,fontWeight:'900',textTransform:'uppercase'},filterTextActive:{color:colors.surface},
  bulk:{marginHorizontal:spacing.md,flexDirection:'row',gap:5},bulkButton:{flex:1,minHeight:38,flexDirection:'row',gap:5,alignItems:'center',justifyContent:'center',backgroundColor:'#e8e2d8'},bulkText:{color:colors.ink,fontSize:7,fontWeight:'900',textTransform:'uppercase'},disabled:{opacity:.4},
  loading:{minHeight:64,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center'},muted:{color:colors.muted,fontSize:9,fontWeight:'700'},
  warning:{margin:spacing.md,padding:10,color:'#9a3412',backgroundColor:'#fff7ed',fontSize:9,fontWeight:'800'},info:{marginHorizontal:spacing.md,marginTop:7,padding:10,color:'#166534',backgroundColor:'#effaf3',fontSize:9,fontWeight:'800'},
  empty:{margin:spacing.md,padding:12,borderRadius:10,alignItems:'center',gap:6,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},emptyTitle:{color:colors.ink,fontSize:12,fontWeight:'900',textTransform:'uppercase'},
  list:{margin:spacing.md,marginTop:8,gap:6},notice:{padding:10,gap:8,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},noticeUnread:{borderLeftWidth:4,borderLeftColor:colors.brand},
  noticeHead:{flexDirection:'row',gap:8},iconBox:{width:34,height:34,alignItems:'center',justifyContent:'center',backgroundColor:'#eee9e1'},iconUnread:{backgroundColor:colors.brand},copy:{flex:1},
  categoryRow:{flexDirection:'row',alignItems:'center',gap:5},category:{color:colors.brand,fontSize:6.5,fontWeight:'900',textTransform:'uppercase'},unreadDot:{width:6,height:6,borderRadius:3,backgroundColor:colors.brand},
  noticeTitle:{marginTop:2,color:colors.ink,fontSize:11,fontWeight:'900'},noticeDate:{marginTop:2,color:colors.muted,fontSize:7,fontWeight:'800'},noticeBody:{color:colors.muted,fontSize:9,lineHeight:14},
  actions:{flexDirection:'row',gap:5},accept:{flex:1,minHeight:38,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand},acceptText:{color:colors.surface,fontSize:8,fontWeight:'900',textTransform:'uppercase'},
  refuse:{flex:1,minHeight:38,alignItems:'center',justifyContent:'center',backgroundColor:'#eee9e1'},refuseText:{color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},
  secondaryActions:{flexDirection:'row',gap:5,flexWrap:'wrap'},smallAction:{minHeight:32,flexDirection:'row',gap:4,alignItems:'center',justifyContent:'center',paddingHorizontal:8,backgroundColor:'#f2eee7'},smallActionText:{color:colors.ink,fontSize:6.5,fontWeight:'900',textTransform:'uppercase'},
})
