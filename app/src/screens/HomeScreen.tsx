import { useEffect, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { mobileApi, QuickTokenResult, resolveQuickToken } from '@/lib/api'
import { MobileAccount } from '@/lib/auth'
import { useChampionshipCommerce } from '@/lib/useChampionshipCommerce'
import { toChampionshipCard, VacancyApiItem } from '@/lib/vacancies'
import { ChampionshipVacancyCard } from '@/screens/ChampionshipVacancyCard'
import { colors, spacing } from '@/theme/tokens'
import { ChampionshipCard, MobileRoute } from '@/types/dropzone'

const dateKey=(item:VacancyApiItem)=>`${item.proxima_data||'9999-12-31'}T${item.proximo_horario||'23:59'}`
export function HomeScreen(props:{onNavigate:(route:MobileRoute)=>void;accounts?:MobileAccount[];accessToken?:string|null;onSelectChampionship?:(championship:ChampionshipCard)=>void;onCreateChampionship?:()=>void;onTokenResolved?:(result:QuickTokenResult)=>void;requireAuth?:(action?:()=>void)=>boolean}){
  const [vacancies,setVacancies]=useState<VacancyApiItem[]>([]),[loadingVacancies,setLoadingVacancies]=useState(true),[tokenValue,setTokenValue]=useState(''),[tokenLoading,setTokenLoading]=useState(false),[tokenError,setTokenError]=useState('')
  const commerce=useChampionshipCommerce(props.requireAuth)
  useEffect(()=>{let mounted=true;mobileApi.vacancies().then(payload=>{if(!mounted)return;setVacancies(((payload.announcements as VacancyApiItem[])||[]).filter(item=>Number(item.vagas_livres||0)>0).sort((a,b)=>dateKey(a).localeCompare(dateKey(b))).slice(0,5))}).catch(()=>mounted&&setVacancies([])).finally(()=>mounted&&setLoadingVacancies(false));return()=>{mounted=false}},[])
  async function submitToken(){if(!tokenValue.trim()||tokenLoading)return;setTokenLoading(true);setTokenError('');try{const result=await resolveQuickToken(tokenValue,props.accessToken);props.onTokenResolved?.(result);setTokenValue(result.token)}catch(error:any){setTokenError(error?.message||'Token não reconhecido.')}finally{setTokenLoading(false)}}
  return <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <View style={styles.intro}><Text style={styles.kicker}>DROPZONE COMPETITIVE</Text><Text style={styles.title}>O que você quer fazer?</Text><Text style={styles.subtitle}>Acesse o próximo passo do seu campeonato sem procurar em menus.</Text><View style={styles.heroActions}><TouchableOpacity style={styles.primary} onPress={()=>props.onNavigate('vacancies')}><Ionicons name="ticket-outline" size={23} color={colors.onBrand}/><View style={{flex:1}}><Text style={styles.primaryTitle}>Encontrar vaga</Text><Text style={styles.primaryMeta}>Campeonatos com inscrição aberta</Text></View><Ionicons name="arrow-forward" size={19} color={colors.onBrand}/></TouchableOpacity><TouchableOpacity style={styles.secondary} onPress={()=>props.onCreateChampionship?.()}><Ionicons name="add-circle-outline" size={22} color={colors.brandLight}/><Text style={styles.secondaryText}>Criar campeonato</Text></TouchableOpacity></View></View>
    <View style={styles.tokenSection}><View style={styles.tokenHead}><Ionicons name="key-outline" size={20} color={colors.brand}/><View><Text style={styles.sectionKicker}>ACESSO POR TOKEN</Text><Text style={styles.sectionTitle}>Convite ou inscrição guiada</Text></View></View><Text style={styles.tokenDescription}>Cole um token ou link. O app identifica o acesso e leva você para o próximo passo correto.</Text><View style={styles.tokenRow}><TextInput value={tokenValue} onChangeText={value=>{setTokenValue(value);setTokenError('')}} placeholder="Token ou link completo" placeholderTextColor={colors.muted} style={styles.tokenInput} autoCapitalize="characters" autoCorrect={false} onSubmitEditing={()=>void submitToken()}/><TouchableOpacity style={styles.tokenButton} onPress={()=>void submitToken()} disabled={tokenLoading||!tokenValue.trim()}>{tokenLoading?<ActivityIndicator color={colors.onBrand}/>:<Ionicons name="arrow-forward" size={21} color={colors.onBrand}/>}</TouchableOpacity></View>{tokenError?<Text style={styles.error}>{tokenError}</Text>:null}</View>
    <View style={styles.vacancySection}><View style={[styles.sectionHead,styles.vacancyHead]}><View><Text style={styles.sectionKicker}>VAGAS ABERTAS</Text><Text style={styles.sectionTitle}>Próximos campeonatos</Text></View><TouchableOpacity onPress={()=>props.onNavigate('vacancies')}><Text style={styles.link}>Ver todos ›</Text></TouchableOpacity></View>{loadingVacancies?<View style={styles.loading}><ActivityIndicator color={colors.brand}/><Text style={styles.muted}>Buscando vagas...</Text></View>:null}{!loadingVacancies&&!vacancies.length?<Text style={styles.empty}>Nenhuma vaga aberta agora.</Text>:null}<View style={styles.cards}>{vacancies.map(item=>{const id=String(item.id||'');return <ChampionshipVacancyCard key={id||item.nome} item={item} favorite={commerce.wishlistIds.has(id)} inCart={commerce.cartIds.has(id)} onOpen={()=>props.onSelectChampionship?.(toChampionshipCard(item))} onWishlist={()=>commerce.toggleWishlist(id)} onCart={()=>commerce.addCart(id)}/>})}</View></View>
  </ScrollView>
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:colors.background},
  content:{paddingBottom:spacing.xxl},
  intro:{paddingHorizontal:12,paddingTop:18,paddingBottom:16,backgroundColor:colors.surface},
  kicker:{color:colors.brand,fontSize:7,fontWeight:'900',letterSpacing:1.35},
  title:{marginTop:3,color:colors.ink,fontSize:21,lineHeight:24,fontWeight:'900',textTransform:'uppercase'},
  subtitle:{marginTop:4,color:colors.muted,fontSize:9,lineHeight:13},
  heroActions:{marginTop:10,flexDirection:'row',gap:6},
  primary:{minHeight:44,flex:1,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:10,borderRadius:9,backgroundColor:colors.brand},
  primaryTitle:{color:colors.onBrand,fontSize:9,fontWeight:'900',textTransform:'uppercase'},
  primaryMeta:{marginTop:1,color:'#5b5121',fontSize:7},
  secondary:{minHeight:44,paddingHorizontal:11,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,borderRadius:6,backgroundColor:colors.surfaceRaised},
  secondaryText:{color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},
  tokenSection:{marginHorizontal:12,marginTop:10,padding:11,borderRadius:10,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},
  tokenHead:{flexDirection:'row',alignItems:'center',gap:7},
  sectionKicker:{color:colors.brand,fontSize:7,fontWeight:'900',letterSpacing:1.05},
  sectionTitle:{marginTop:1,color:colors.ink,fontSize:12,fontWeight:'900',textTransform:'uppercase'},
  tokenDescription:{marginTop:6,color:colors.muted,fontSize:8,lineHeight:12},
  tokenRow:{marginTop:8,flexDirection:'row',gap:5},
  tokenInput:{flex:1,minHeight:40,paddingHorizontal:10,borderRadius:6,color:colors.ink,backgroundColor:colors.surfaceRaised,borderWidth:1,borderColor:colors.line,fontSize:9,fontWeight:'800'},
  tokenButton:{width:40,minHeight:40,borderRadius:6,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand},
  error:{marginTop:6,color:colors.danger,fontSize:8,fontWeight:'800'},
  sectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:7},
  link:{color:colors.brand,fontSize:8,fontWeight:'900'},
  vacancySection:{marginTop:14},
  vacancyHead:{marginHorizontal:12},
  cards:{marginHorizontal:12,gap:9},
  loading:{minHeight:50,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
  muted:{color:colors.muted,fontSize:9},
  empty:{marginHorizontal:12,padding:10,borderRadius:6,color:colors.muted,backgroundColor:colors.surface,textAlign:'center',fontSize:9,fontWeight:'800'},
})
