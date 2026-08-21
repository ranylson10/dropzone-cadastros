import { useEffect, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated'
import { LealtMotionBackdrop } from '@/components/LealtMotionBackdrop'
import { useAuth } from '@/lib/auth'
import { colors, spacing, typography } from '@/theme/tokens'

export function LoginScreen(props: { onCancel?: () => void }) {
  const auth = useAuth()
  const [localError,setLocalError]=useState('')
  const busy=auth.authenticating
  const error=localError||auth.authError
  const reduceMotion=useReducedMotion()
  const scrollY=useSharedValue(0)
  const reveal=useSharedValue(reduceMotion?1:0)

  useEffect(()=>{
    reveal.value=reduceMotion?1:0
    if(!reduceMotion)reveal.value=withSpring(1,{damping:15,stiffness:82,mass:.85})
  },[reveal,reduceMotion])

  async function signIn(){
    setLocalError('')
    auth.clearAuthError()
    try{await auth.signInWithGoogle()}
    catch(err:any){setLocalError(err?.message||'Não foi possível iniciar o login.')}
  }

  const onScroll=useAnimatedScrollHandler({onScroll:event=>{scrollY.value=event.contentOffset.y}})
  const heroStyle=useAnimatedStyle(()=>({
    opacity:reveal.value,
    transform:[{translateY:reduceMotion?0:interpolate(reveal.value,[0,1],[54,0])}],
  }))
  const panelStyle=useAnimatedStyle(()=>({
    opacity:reveal.value,
    transform:[
      {translateY:reduceMotion?0:interpolate(reveal.value,[0,1],[82,0])},
      {scale:reduceMotion?1:interpolate(reveal.value,[0,1],[.955,1],Extrapolation.CLAMP)},
    ],
  }))
  const titleOneStyle=useAnimatedStyle(()=>({
    opacity:reveal.value,
    transform:[{translateX:reduceMotion?0:interpolate(reveal.value,[0,1],[-34,0])}],
  }))
  const titleTwoStyle=useAnimatedStyle(()=>({
    opacity:reveal.value,
    transform:[{translateX:reduceMotion?0:interpolate(reveal.value,[0,1],[30,0])}],
  }))
  const titleThreeStyle=useAnimatedStyle(()=>({
    opacity:reveal.value,
    transform:[{translateY:reduceMotion?0:interpolate(reveal.value,[0,1],[24,0])}],
  }))

  return <SafeAreaView style={styles.page}>
    <LealtMotionBackdrop scrollY={scrollY} compact/>
    <Animated.ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={onScroll}
    >
      <View style={styles.topLine}>
        <TouchableOpacity accessibilityLabel="Voltar" style={styles.iconButton} onPress={props.onCancel} disabled={!props.onCancel||busy}>
          <Ionicons name="arrow-back" size={22} color={colors.ink}/>
        </TouchableOpacity>
        <View style={styles.logoFrame}><Image source={require('../../assets/dropzone-icon-accent.png')} style={styles.logo} resizeMode="contain"/></View>
        <View style={styles.iconSpacer}/>
      </View>

      <Animated.View style={[styles.hero,heroStyle]}>
        <View style={styles.heroMarker}><View style={styles.heroMarkerLine}/><Text style={styles.eyebrow}>ACESSO DROPZONE</Text></View>
        <View style={styles.titleBlock} accessibilityLabel="Entre. Escolha. Compita.">
          <Animated.Text style={[styles.titleLine,titleOneStyle]}>ENTRE.</Animated.Text>
          <Animated.Text style={[styles.titleLine,titleTwoStyle]}>ESCOLHA.</Animated.Text>
          <Animated.Text style={[styles.titleLine,styles.titleAccent,titleThreeStyle]}>COMPITA.</Animated.Text>
        </View>
        <Text style={styles.description}>Faça login somente para ações pessoais, compras e gerenciamento.</Text>
        <View style={styles.systemLine}><View style={styles.systemPulse}/><Text style={styles.systemLineText}>UM LOGIN</Text><View style={styles.systemDot}/><Text style={styles.systemLineText}>TODOS OS PERFIS</Text></View>
      </Animated.View>

      <Animated.View style={[styles.panel,panelStyle]}>
        <View style={styles.panelHead}>
          <View><Text style={styles.panelKicker}>IDENTIDADE LEALT</Text><Text style={styles.panelTitle}>Entre para continuar</Text></View>
          <View style={styles.signal}><View style={styles.signalDot}/><Text style={styles.signalText}>SEGURO</Text></View>
        </View>
        <View style={styles.rule}/>

        {!auth.configured?<View style={styles.notice}>
          <Text style={styles.noticeTitle}>CONFIGURAÇÃO PENDENTE</Text>
          <Text style={styles.noticeText}>As variáveis do Supabase ainda não estão configuradas neste app.</Text>
        </View>:null}

        {auth.configured&&!auth.redirectConfigured?<View style={styles.notice}>
          <Text style={styles.noticeTitle}>RETORNO DO LOGIN PENDENTE</Text>
          <Text style={styles.noticeText}>O callback mobile precisa estar configurado antes de usar o Google.</Text>
        </View>:null}

        {error?<View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity onPress={()=>{setLocalError('');auth.clearAuthError()}}><Text style={styles.retry}>TENTAR NOVAMENTE</Text></TouchableOpacity>
        </View>:null}

        <TouchableOpacity style={[styles.googleButton,(!auth.configured||!auth.redirectConfigured||busy)&&styles.disabled]} activeOpacity={.84} onPress={signIn} disabled={busy||!auth.configured||!auth.redirectConfigured}>
          {busy?<ActivityIndicator color={colors.onBrand}/>:<Ionicons name="logo-google" size={21} color={colors.onBrand}/>}
          <Text style={styles.googleText}>{busy?'AGUARDANDO GOOGLE...':'ENTRAR COM GOOGLE'}</Text>
          {!busy?<Ionicons name="arrow-forward" size={18} color={colors.onBrand}/>:null}
        </TouchableOpacity>

        {props.onCancel&&!busy?<TouchableOpacity style={styles.guestButton} activeOpacity={.82} onPress={props.onCancel}><Text style={styles.guestText}>CONTINUAR SEM LOGIN</Text></TouchableOpacity>:null}
        <Text style={styles.helper}>Você pode navegar pelo conteúdo público sem conta. O login será solicitado apenas quando necessário.</Text>
      </Animated.View>
    </Animated.ScrollView>
  </SafeAreaView>
}

const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:colors.background},
  scroll:{flex:1,backgroundColor:'transparent'},
  scrollContent:{flexGrow:1,paddingHorizontal:spacing.md,paddingBottom:spacing.lg},
  topLine:{minHeight:68,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'rgba(255,255,255,.10)'},
  iconButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  iconSpacer:{width:44},
  logoFrame:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:10,borderWidth:1,borderColor:'rgba(223,207,133,.14)',backgroundColor:'rgba(20,21,24,.58)'},
  logo:{width:34,height:34},
  hero:{paddingTop:46,paddingHorizontal:8,paddingBottom:30},
  heroMarker:{flexDirection:'row',alignItems:'center',gap:8},
  heroMarkerLine:{width:27,height:2,backgroundColor:colors.brand},
  eyebrow:{color:colors.brandLight,fontSize:typography.tiny,fontWeight:'900',letterSpacing:2.7},
  titleBlock:{marginTop:10},
  titleLine:{color:colors.ink,fontSize:43,lineHeight:43,fontWeight:'900',letterSpacing:-1.2},
  titleAccent:{color:colors.brandLight,textShadowColor:'rgba(201,183,102,.22)',textShadowRadius:10},
  description:{marginTop:12,maxWidth:310,color:'#b9b7b0',fontSize:13,lineHeight:20,fontWeight:'600'},
  systemLine:{marginTop:18,flexDirection:'row',alignItems:'center',gap:7},
  systemPulse:{width:7,height:7,borderRadius:4,backgroundColor:colors.brand,borderWidth:2,borderColor:'rgba(223,207,133,.24)'},
  systemLineText:{color:colors.muted,fontSize:7,fontWeight:'900',letterSpacing:1.3},
  systemDot:{width:3,height:3,borderRadius:2,backgroundColor:colors.brand},
  panel:{marginTop:'auto',backgroundColor:'rgba(20,21,24,.90)',padding:spacing.lg,gap:12,borderTopWidth:3,borderTopColor:colors.brand,borderWidth:1,borderColor:colors.line,borderBottomWidth:1},
  panelHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
  panelKicker:{color:colors.brand,fontSize:7,fontWeight:'900',letterSpacing:1.05},
  panelTitle:{marginTop:2,color:colors.ink,fontSize:14,fontWeight:'900',textTransform:'uppercase'},
  signal:{flexDirection:'row',alignItems:'center',gap:5},
  signalDot:{width:6,height:6,borderRadius:3,backgroundColor:colors.success},
  signalText:{color:colors.muted,fontSize:7,fontWeight:'900',letterSpacing:.8},
  rule:{width:48,height:2,backgroundColor:'rgba(201,183,102,.45)',marginBottom:2},
  notice:{padding:11,borderWidth:1,borderColor:colors.warning,backgroundColor:'rgba(212,165,87,.13)'},
  noticeTitle:{color:colors.warning,fontSize:10,fontWeight:'900',letterSpacing:.8},
  noticeText:{marginTop:4,color:colors.muted,fontSize:11,lineHeight:16,fontWeight:'700'},
  errorBox:{padding:11,borderWidth:1,borderColor:colors.danger,backgroundColor:'rgba(224,122,122,.13)'},
  error:{color:colors.danger,fontSize:11,lineHeight:17,fontWeight:'800'},
  retry:{marginTop:7,color:colors.ink,fontSize:10,fontWeight:'900'},
  googleButton:{minHeight:54,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,backgroundColor:colors.brand,paddingHorizontal:14},
  disabled:{opacity:.58},
  googleText:{flex:1,color:colors.onBrand,fontSize:12,fontWeight:'900',letterSpacing:.5,textAlign:'center'},
  guestButton:{minHeight:46,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.line,backgroundColor:colors.surfaceRaised},
  guestText:{color:colors.ink,fontSize:11,fontWeight:'900',letterSpacing:.4},
  helper:{color:colors.muted,fontSize:10,lineHeight:15,fontWeight:'700',textAlign:'center'},
})
