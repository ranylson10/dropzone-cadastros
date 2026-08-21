import { useEffect, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { LealtMotionBackdrop } from '@/components/LealtMotionBackdrop'
import { mobileApi, QuickTokenResult, resolveQuickToken } from '@/lib/api'
import { MobileAccount } from '@/lib/auth'
import { useChampionshipCommerce } from '@/lib/useChampionshipCommerce'
import { toChampionshipCard, VacancyApiItem } from '@/lib/vacancies'
import { ChampionshipVacancyCard } from '@/screens/ChampionshipVacancyCard'
import { colors, spacing } from '@/theme/tokens'
import { ChampionshipCard, MobileRoute } from '@/types/dropzone'

const dateKey=(item:VacancyApiItem)=>`${item.proxima_data||'9999-12-31'}T${item.proximo_horario||'23:59'}`

export function HomeScreen(props:{onNavigate:(route:MobileRoute)=>void;accounts?:MobileAccount[];accessToken?:string|null;onSelectChampionship?:(championship:ChampionshipCard)=>void;onCreateChampionship?:()=>void;onTokenResolved?:(result:QuickTokenResult)=>void;requireAuth?:(action?:()=>void)=>boolean}){
  const [vacancies,setVacancies]=useState<VacancyApiItem[]>([])
  const [loadingVacancies,setLoadingVacancies]=useState(true)
  const [tokenValue,setTokenValue]=useState('')
  const [tokenLoading,setTokenLoading]=useState(false)
  const [tokenError,setTokenError]=useState('')
  const commerce=useChampionshipCommerce(props.requireAuth)
  const {height}=useWindowDimensions()
  const reduceMotion=useReducedMotion()
  const scrollY=useSharedValue(0)
  const entrance=useSharedValue(reduceMotion?1:0)

  useEffect(()=>{
    entrance.value=reduceMotion?1:0
    if(!reduceMotion){
      entrance.value=withSpring(1,{damping:15,stiffness:88,mass:.8})
    }
  },[entrance,reduceMotion])

  useEffect(()=>{
    let mounted=true
    mobileApi.vacancies()
      .then(payload=>{
        if(!mounted)return
        setVacancies(((payload.announcements as VacancyApiItem[])||[])
          .filter(item=>Number(item.vagas_livres||0)>0)
          .sort((a,b)=>dateKey(a).localeCompare(dateKey(b)))
          .slice(0,5))
      })
      .catch(()=>mounted&&setVacancies([]))
      .finally(()=>mounted&&setLoadingVacancies(false))
    return()=>{mounted=false}
  },[])

  async function submitToken(){
    if(!tokenValue.trim()||tokenLoading)return
    setTokenLoading(true)
    setTokenError('')
    try{
      const result=await resolveQuickToken(tokenValue,props.accessToken)
      props.onTokenResolved?.(result)
      setTokenValue(result.token)
    }catch(error:any){
      setTokenError(error?.message||'Token não reconhecido.')
    }finally{
      setTokenLoading(false)
    }
  }

  const onScroll=useAnimatedScrollHandler({
    onScroll:event=>{scrollY.value=event.contentOffset.y},
  })

  const heroStyle=useAnimatedStyle(()=>{
    const y=scrollY.value
    return {
      opacity:reduceMotion?1:interpolate(y,[0,250,410],[1,.62,.12],Extrapolation.CLAMP)*entrance.value,
      transform:[
        {translateY:reduceMotion?0:interpolate(y,[0,410],[0,-145],Extrapolation.CLAMP)},
        {scale:reduceMotion?1:interpolate(y,[0,410],[1,.82],Extrapolation.CLAMP)},
      ],
    }
  })

  const lineOneStyle=useAnimatedStyle(()=>({
    transform:[
      {translateX:reduceMotion?0:interpolate(scrollY.value,[0,330],[0,-26],Extrapolation.CLAMP)},
      {translateY:reduceMotion?0:interpolate(scrollY.value,[0,330],[0,-30],Extrapolation.CLAMP)},
    ],
  }))

  const lineTwoStyle=useAnimatedStyle(()=>({
    opacity:reduceMotion?1:interpolate(scrollY.value,[0,330],[1,.46],Extrapolation.CLAMP),
    transform:[
      {translateX:reduceMotion?0:interpolate(scrollY.value,[0,330],[0,24],Extrapolation.CLAMP)},
      {translateY:reduceMotion?0:interpolate(scrollY.value,[0,330],[0,-18],Extrapolation.CLAMP)},
      {scale:reduceMotion?1:interpolate(scrollY.value,[0,330],[1,1.12],Extrapolation.CLAMP)},
    ],
  }))

  const lineThreeStyle=useAnimatedStyle(()=>({
    opacity:reduceMotion?1:interpolate(scrollY.value,[0,260],[1,0],Extrapolation.CLAMP),
    transform:[{translateY:reduceMotion?0:interpolate(scrollY.value,[0,260],[0,-12],Extrapolation.CLAMP)}],
  }))

  const entranceStyle=useAnimatedStyle(()=>({
    opacity:entrance.value,
    transform:[{translateY:reduceMotion?0:interpolate(entrance.value,[0,1],[54,0])}],
  }))

  const actionsStyle=useAnimatedStyle(()=>({
    opacity:reduceMotion?1:interpolate(scrollY.value,[0,230],[1,.08],Extrapolation.CLAMP),
    transform:[{translateY:reduceMotion?0:interpolate(scrollY.value,[0,260],[0,-70],Extrapolation.CLAMP)}],
  }))

  const hudStyle=useAnimatedStyle(()=>({
    opacity:reduceMotion ? .72 : interpolate(scrollY.value,[0,260],[.78,.28],Extrapolation.CLAMP),
    transform:[
      {translateY:reduceMotion?0:interpolate(scrollY.value,[0,390],[0,-92],Extrapolation.CLAMP)},
      {scale:reduceMotion?1:interpolate(scrollY.value,[0,390],[1,1.14],Extrapolation.CLAMP)},
    ],
  }))

  const scrollHintStyle=useAnimatedStyle(()=>({
    opacity:reduceMotion ? .7 : interpolate(scrollY.value,[0,90],[.92,0],Extrapolation.CLAMP),
    transform:[{translateY:reduceMotion?0:interpolate(scrollY.value,[0,90],[0,-12],Extrapolation.CLAMP)}],
  }))

  const deckStyle=useAnimatedStyle(()=>({
    opacity:reduceMotion?1:interpolate(scrollY.value,[35,205],[.72,1],Extrapolation.CLAMP),
    transform:[
      {translateY:reduceMotion?0:interpolate(scrollY.value,[0,260],[72,0],Extrapolation.CLAMP)},
      {scale:reduceMotion?1:interpolate(scrollY.value,[0,260],[.965,1],Extrapolation.CLAMP)},
    ],
  }))

  const introHeight=Math.max(470,Math.min(640,height*.72))

  return <View style={styles.page}>
    <LealtMotionBackdrop scrollY={scrollY}/>
    <Animated.ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={onScroll}
    >
      <View style={[styles.intro,{minHeight:introHeight}]}>
        <Animated.View pointerEvents="none" style={[styles.hud,hudStyle]}>
          <Text style={styles.coordinate}>DZ / 01 · LIVE COMPETITIVE</Text>
          <View style={styles.liveRail}><View style={styles.liveDot}/><Text style={styles.liveText}>FIELD ACTIVE</Text><Text style={styles.liveMeta}>SYNC / ON</Text></View>
          <View style={styles.hudAxis}/>
          <View style={styles.hudZone}><View style={styles.hudZoneRingOne}/><View style={styles.hudZoneRingTwo}/><View style={styles.hudZoneCore}/></View>
        </Animated.View>

        <Animated.View style={[styles.heroMotion,heroStyle]}>
          <Animated.View style={entranceStyle}>
            <View style={styles.heroMarker}><View style={styles.heroMarkerLine}/><Text style={styles.kicker}>DROPZONE COMPETITIVE</Text></View>
            <View style={styles.titleBlock} accessibilityLabel="Sua próxima queda começa aqui.">
              <Animated.Text style={[styles.titleLine,lineOneStyle]}>SUA PRÓXIMA</Animated.Text>
              <Animated.Text style={[styles.titleLine,styles.titleAccent,lineTwoStyle]}>QUEDA</Animated.Text>
              <Animated.Text style={[styles.titleLine,lineThreeStyle]}>COMEÇA AQUI.</Animated.Text>
            </View>
            <Text style={styles.subtitle}>Encontre vagas, acompanhe campeonatos e chegue ao próximo passo sem sair do fluxo.</Text>
            <Animated.View style={[styles.heroActions,actionsStyle]}>
              <TouchableOpacity style={styles.primary} activeOpacity={.86} onPress={()=>props.onNavigate('vacancies')}>
                <Ionicons name="ticket-outline" size={23} color={colors.onBrand}/>
                <View style={{flex:1}}><Text style={styles.primaryTitle}>Encontrar vaga</Text><Text style={styles.primaryMeta}>Campeonatos com inscrição aberta</Text></View>
                <Ionicons name="arrow-forward" size={19} color={colors.onBrand}/>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondary} activeOpacity={.82} onPress={()=>props.onCreateChampionship?.()}>
                <Ionicons name="add-circle-outline" size={22} color={colors.brandLight}/>
                <Text style={styles.secondaryText}>Criar campeonato</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.scrollHint,scrollHintStyle]}><Text style={styles.scrollHintText}>DESLIZE PARA ENTRAR</Text><View style={styles.scrollHintLine}/></Animated.View>
      </View>

      <Animated.View style={[styles.contentDeck,deckStyle]}>
        <View style={styles.deckTopline}><Text style={styles.deckCode}>DROP / 02</Text><View style={styles.deckLine}/><Text style={styles.deckCode}>ACESSOS + VAGAS</Text></View>
        <View style={styles.tokenSection}>
          <View style={styles.tokenHead}>
            <View style={styles.iconTile}><Ionicons name="key-outline" size={18} color={colors.brandLight}/></View>
            <View><Text style={styles.sectionKicker}>ACESSO POR TOKEN</Text><Text style={styles.sectionTitle}>Convite ou inscrição guiada</Text></View>
          </View>
          <Text style={styles.tokenDescription}>Cole um token ou link. O app identifica o acesso e leva você para o próximo passo correto.</Text>
          <View style={styles.tokenRow}>
            <TextInput value={tokenValue} onChangeText={value=>{setTokenValue(value);setTokenError('')}} placeholder="Token ou link completo" placeholderTextColor={colors.muted} style={styles.tokenInput} autoCapitalize="characters" autoCorrect={false} onSubmitEditing={()=>void submitToken()}/>
            <TouchableOpacity style={styles.tokenButton} activeOpacity={.84} onPress={()=>void submitToken()} disabled={tokenLoading||!tokenValue.trim()}>
              {tokenLoading?<ActivityIndicator color={colors.onBrand}/>:<Ionicons name="arrow-forward" size={21} color={colors.onBrand}/>}
            </TouchableOpacity>
          </View>
          {tokenError?<Text style={styles.error}>{tokenError}</Text>:null}
        </View>

        <View style={styles.vacancySection}>
          <View style={[styles.sectionHead,styles.vacancyHead]}>
            <View><Text style={styles.sectionKicker}>VAGAS ABERTAS</Text><Text style={styles.sectionTitle}>Próximos campeonatos</Text></View>
            <TouchableOpacity onPress={()=>props.onNavigate('vacancies')}><Text style={styles.link}>Ver todos ›</Text></TouchableOpacity>
          </View>
          {loadingVacancies?<View style={styles.loading}><ActivityIndicator color={colors.brand}/><Text style={styles.muted}>Buscando vagas...</Text></View>:null}
          {!loadingVacancies&&!vacancies.length?<Text style={styles.empty}>Nenhuma vaga aberta agora.</Text>:null}
          <View style={styles.cards}>{vacancies.map(item=>{
            const id=String(item.id||'')
            return <ChampionshipVacancyCard key={id||item.nome} item={item} favorite={commerce.wishlistIds.has(id)} inCart={commerce.cartIds.has(id)} onOpen={()=>props.onSelectChampionship?.(toChampionshipCard(item))} onWishlist={()=>commerce.toggleWishlist(id)} onCart={()=>commerce.addCart(id)}/>
          })}</View>
        </View>
      </Animated.View>
    </Animated.ScrollView>
  </View>
}

const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:colors.background},
  scroll:{flex:1,backgroundColor:'transparent'},
  content:{paddingBottom:spacing.xxl},
  intro:{position:'relative',paddingHorizontal:14,paddingTop:38,paddingBottom:20,justifyContent:'space-between',overflow:'hidden'},
  hud:{...StyleSheet.absoluteFillObject},
  coordinate:{position:'absolute',top:16,left:14,color:'rgba(223,207,133,.72)',fontSize:6,fontWeight:'900',letterSpacing:1.2},
  liveRail:{position:'absolute',right:14,top:14,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:7,paddingVertical:5,borderWidth:1,borderColor:'rgba(223,207,133,.12)',backgroundColor:'rgba(8,10,13,.38)'},
  liveDot:{width:6,height:6,borderRadius:3,backgroundColor:colors.brand},
  liveText:{color:colors.brandLight,fontSize:6,fontWeight:'900',letterSpacing:.8},
  liveMeta:{color:'rgba(255,255,255,.38)',fontSize:5,fontWeight:'900',letterSpacing:.7},
  hudAxis:{position:'absolute',left:-30,right:-30,top:'38%',height:1,backgroundColor:'rgba(223,207,133,.26)',transform:[{rotate:'-8deg'}]},
  hudZone:{position:'absolute',width:250,height:250,borderRadius:125,right:-118,top:48,borderWidth:1,borderColor:'rgba(223,207,133,.28)',alignItems:'center',justifyContent:'center'},
  hudZoneRingOne:{position:'absolute',width:190,height:190,borderRadius:95,borderWidth:1,borderColor:'rgba(223,207,133,.18)'},
  hudZoneRingTwo:{position:'absolute',width:122,height:122,borderRadius:61,borderWidth:14,borderColor:'rgba(201,183,102,.08)'},
  hudZoneCore:{width:54,height:54,borderRadius:27,borderWidth:1,borderColor:'rgba(223,207,133,.44)',backgroundColor:'rgba(201,183,102,.08)'},
  heroMotion:{paddingTop:42,zIndex:2},
  heroMarker:{flexDirection:'row',alignItems:'center',gap:7},
  heroMarkerLine:{width:29,height:2,backgroundColor:colors.brand},
  kicker:{color:colors.brandLight,fontSize:7,fontWeight:'900',letterSpacing:1.65},
  titleBlock:{marginTop:13,paddingVertical:2},
  titleLine:{display:'flex',maxWidth:330,color:colors.ink,fontSize:34,lineHeight:34,fontWeight:'900',textTransform:'uppercase',letterSpacing:-1.05},
  titleAccent:{color:colors.brandLight,textShadowColor:'rgba(201,183,102,.24)',textShadowRadius:12},
  subtitle:{marginTop:12,maxWidth:305,color:'#b9b7b0',fontSize:10,lineHeight:15,fontWeight:'600'},
  heroActions:{marginTop:22,flexDirection:'row',gap:7},
  primary:{minHeight:54,flex:1,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:10,borderRadius:8,backgroundColor:colors.brand},
  primaryTitle:{color:colors.onBrand,fontSize:9,fontWeight:'900',textTransform:'uppercase'},
  primaryMeta:{marginTop:1,color:'#5b5121',fontSize:7},
  secondary:{minHeight:54,maxWidth:126,paddingHorizontal:11,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,borderRadius:6,backgroundColor:'rgba(15,16,19,.82)',borderWidth:1,borderColor:'rgba(223,207,133,.20)'},
  secondaryText:{color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},
  scrollHint:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,zIndex:2},
  scrollHintText:{color:colors.muted,fontSize:6,fontWeight:'900',letterSpacing:1.35},
  scrollHintLine:{width:48,height:1,backgroundColor:'rgba(223,207,133,.50)'},
  contentDeck:{marginTop:-4,paddingTop:10,paddingBottom:4,borderTopLeftRadius:18,borderTopRightRadius:18,backgroundColor:colors.background,borderTopWidth:1,borderTopColor:'rgba(223,207,133,.18)',zIndex:3},
  deckTopline:{marginHorizontal:14,marginBottom:8,flexDirection:'row',alignItems:'center',gap:8},
  deckCode:{color:'rgba(223,207,133,.55)',fontSize:6,fontWeight:'900',letterSpacing:1.15},
  deckLine:{flex:1,height:1,backgroundColor:'rgba(223,207,133,.16)'},
  tokenSection:{marginHorizontal:12,marginTop:6,padding:11,borderRadius:10,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},
  tokenHead:{flexDirection:'row',alignItems:'center',gap:8},
  iconTile:{width:32,height:32,alignItems:'center',justifyContent:'center',borderRadius:8,backgroundColor:'rgba(201,183,102,.10)',borderWidth:1,borderColor:'rgba(201,183,102,.15)'},
  sectionKicker:{color:colors.brand,fontSize:7,fontWeight:'900',letterSpacing:1.05},
  sectionTitle:{marginTop:1,color:colors.ink,fontSize:12,fontWeight:'900',textTransform:'uppercase'},
  tokenDescription:{marginTop:7,color:colors.muted,fontSize:8,lineHeight:12},
  tokenRow:{marginTop:8,flexDirection:'row',gap:5},
  tokenInput:{flex:1,minHeight:40,paddingHorizontal:10,borderRadius:6,color:colors.ink,backgroundColor:colors.surfaceRaised,borderWidth:1,borderColor:colors.line,fontSize:9,fontWeight:'800'},
  tokenButton:{width:40,minHeight:40,borderRadius:6,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand},
  error:{marginTop:6,color:colors.danger,fontSize:8,fontWeight:'800'},
  sectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:7},
  link:{color:colors.brand,fontSize:8,fontWeight:'900'},
  vacancySection:{marginTop:15},
  vacancyHead:{marginHorizontal:12},
  cards:{marginHorizontal:12,gap:9},
  loading:{minHeight:50,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
  muted:{color:colors.muted,fontSize:9},
  empty:{marginHorizontal:12,padding:10,borderRadius:6,color:colors.muted,backgroundColor:colors.surface,textAlign:'center',fontSize:9,fontWeight:'800'},
})
