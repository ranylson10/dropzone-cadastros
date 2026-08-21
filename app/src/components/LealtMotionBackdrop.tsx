import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { colors } from '@/theme/tokens'

const DROPZONE_VIDEO_SOURCE=require('../../assets/media/dropzone-bg-mobile.mp4')

type Props={scrollY?:SharedValue<number>;compact?:boolean}

export function LealtMotionBackdrop({scrollY,compact}:Props){
  const ambient=useSharedValue(0)
  const reduceMotion=useReducedMotion()
  const player=useVideoPlayer(DROPZONE_VIDEO_SOURCE,instance=>{
    instance.loop=true
    instance.muted=true
    instance.volume=0
    instance.playbackRate=.92
    if(!reduceMotion)instance.play()
  })

  useEffect(()=>{
    player.loop=true
    player.muted=true
    player.volume=0
    if(reduceMotion){
      player.pause()
    }else{
      player.play()
    }
  },[player,reduceMotion])

  useEffect(()=>{
    cancelAnimation(ambient)
    ambient.value=0
    if(reduceMotion)return
    ambient.value=withRepeat(
      withTiming(1,{duration:6200,easing:Easing.inOut(Easing.quad)}),
      -1,
      true,
    )
    return()=>cancelAnimation(ambient)
  },[ambient,reduceMotion])

  const layerStyle=useAnimatedStyle(()=>{
    const y=scrollY?.value||0
    return {
      transform:[
        {translateY:interpolate(y,[0,420],[0,-168],Extrapolation.CLAMP)},
        {scale:interpolate(y,[0,360],[1,1.27],Extrapolation.CLAMP)},
      ],
    }
  })

  const orbitStyle=useAnimatedStyle(()=>({
    opacity:reduceMotion ? .28 : interpolate(ambient.value,[0,1],[.16,.34]),
    transform:[
      {translateX:reduceMotion?0:interpolate(ambient.value,[0,1],[-24,32])},
      {translateY:reduceMotion?0:interpolate(ambient.value,[0,1],[-18,28])},
      {rotate:`${reduceMotion?0:interpolate(ambient.value,[0,1],[-12,11])}deg`},
      {scale:reduceMotion?1:interpolate(ambient.value,[0,1],[.97,1.05])},
    ],
  }))

  const coreStyle=useAnimatedStyle(()=>({
    opacity:reduceMotion ? .20 : interpolate(ambient.value,[0,1],[.10,.26]),
    transform:[
      {translateX:reduceMotion?0:interpolate(ambient.value,[0,1],[22,-18])},
      {translateY:reduceMotion?0:interpolate(ambient.value,[0,1],[14,-22])},
      {scale:reduceMotion?1:interpolate(ambient.value,[0,1],[.92,1.08])},
    ],
  }))

  const routeStyle=useAnimatedStyle(()=>{
    const y=scrollY?.value||0
    return {
      opacity:interpolate(y,[0,180,390],[.36,.58,.16],Extrapolation.CLAMP),
      transform:[
        {translateY:interpolate(y,[0,390],[0,-72],Extrapolation.CLAMP)},
        {scaleY:interpolate(y,[0,300],[.76,1.16],Extrapolation.CLAMP)},
        {rotate:'13deg'},
      ],
    }
  })

  const tracerOneStyle=useAnimatedStyle(()=>({
    opacity:reduceMotion ? .12 :interpolate(ambient.value,[0,.14,.7,1],[0,.50,.34,0]),
    transform:[
      {translateX:reduceMotion?0:interpolate(ambient.value,[0,1],[-120,210])},
      {translateY:reduceMotion?0:interpolate(ambient.value,[0,1],[92,-136])},
      {scale:reduceMotion?1:interpolate(ambient.value,[0,1],[.78,1.15])},
    ],
  }))

  const tracerTwoStyle=useAnimatedStyle(()=>({
    opacity:reduceMotion ? .10 :interpolate(ambient.value,[0,.18,.76,1],[0,.38,.28,0]),
    transform:[
      {translateX:reduceMotion?0:interpolate(ambient.value,[0,1],[180,-170])},
      {translateY:reduceMotion?0:interpolate(ambient.value,[0,1],[-74,126])},
      {scale:reduceMotion ? .72 :interpolate(ambient.value,[0,1],[.68,.95])},
    ],
  }))

  const pulseStyle=useAnimatedStyle(()=>({
    opacity:reduceMotion ? .08 :interpolate(ambient.value,[0,.45,1],[.16,.04,.16]),
    transform:[{scale:reduceMotion?1:interpolate(ambient.value,[0,1],[.68,1.42])}],
  }))

  const reversePulseStyle=useAnimatedStyle(()=>({
    opacity:reduceMotion ? .07 :interpolate(ambient.value,[0,.55,1],[.03,.13,.03]),
    transform:[{scale:reduceMotion?1:interpolate(ambient.value,[0,1],[1.32,.72])}],
  }))

  return <View pointerEvents="none" style={styles.root}>
    <VideoView
      player={player}
      style={styles.video}
      contentFit="cover"
      nativeControls={false}
      surfaceType="surfaceView"
    />
    <View style={styles.videoTint}/>
    <View style={styles.base}/>
    <Animated.View style={[styles.parallaxLayer,layerStyle]}>
      <Animated.View style={[styles.coreGlow,compact&&styles.coreGlowCompact,coreStyle]}/>
      <Animated.View style={[styles.pulse,styles.pulseOne,pulseStyle]}/>
      <Animated.View style={[styles.pulse,styles.pulseTwo,reversePulseStyle]}/>
      <Animated.View style={[styles.tracer,styles.tracerOne,tracerOneStyle]}/>
      <Animated.View style={[styles.tracer,styles.tracerTwo,tracerTwoStyle]}/>
    </Animated.View>
    <View style={styles.vignetteTop}/>
    <View style={styles.vignetteBottom}/>
  </View>
}

const styles=StyleSheet.create({
  root:{...StyleSheet.absoluteFillObject,overflow:'hidden',backgroundColor:'#5f2930'},
  video:{...StyleSheet.absoluteFillObject,transform:[{scale:1.06}]},
  videoTint:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(9,10,13,.24)'},
  base:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(8,10,13,.12)'},
  parallaxLayer:{...StyleSheet.absoluteFillObject},
  grid:{position:'absolute',width:'145%',height:'145%',left:'-22%',top:'-18%',borderWidth:1,borderColor:'rgba(223,207,133,.035)',transform:[{rotate:'13deg'}]},
  orbitWrap:{position:'absolute',width:590,height:590,borderRadius:295,right:-236,top:-2,alignItems:'center',justifyContent:'center'},
  orbitWrapCompact:{width:485,height:485,borderRadius:243,right:-210,top:-14},
  orbitOuter:{position:'absolute',width:'100%',height:'100%',borderRadius:999,borderWidth:1.2,borderColor:'rgba(255,238,162,.20)'},
  orbitMiddle:{position:'absolute',width:'78%',height:'78%',borderRadius:999,borderWidth:24,borderColor:'rgba(201,183,102,.07)',backgroundColor:'rgba(201,183,102,.018)'},
  orbitInner:{position:'absolute',width:'45%',height:'45%',borderRadius:999,borderWidth:1.5,borderColor:colors.brand,backgroundColor:'rgba(201,183,102,.055)'},
  coreGlow:{position:'absolute',width:270,height:270,borderRadius:135,right:-12,top:120,backgroundColor:'rgba(201,183,102,.045)',borderWidth:18,borderColor:'rgba(223,207,133,.025)'},
  coreGlowCompact:{width:220,height:220,borderRadius:110,right:-35,top:90},
  networkLine:{position:'absolute',height:1,backgroundColor:'rgba(255,238,162,.12)'},
  networkLineOne:{width:330,left:-58,top:220,transform:[{rotate:'-18deg'}]},
  networkLineTwo:{width:310,right:-70,top:330,transform:[{rotate:'24deg'}]},
  networkLineThree:{width:270,left:62,top:436,transform:[{rotate:'9deg'}],backgroundColor:'rgba(255,255,255,.07)'},
  pulse:{position:'absolute',width:150,height:150,borderRadius:75,borderWidth:1,borderColor:'rgba(223,207,133,.24)'},
  pulseOne:{left:28,top:248},pulseTwo:{right:-8,top:62},
  tracer:{position:'absolute',width:8,height:8,borderRadius:4,backgroundColor:'#fff0a7',borderWidth:2,borderColor:'rgba(223,207,133,.28)'},
  tracerOne:{left:54,top:300},tracerTwo:{right:72,top:158},
  route:{position:'absolute',width:2,height:560,left:'66%',top:24,backgroundColor:'rgba(223,207,133,.46)'},
  routePoint:{position:'absolute',left:-4,width:10,height:10,borderWidth:1,borderColor:colors.brand,backgroundColor:'#0b0c0e',transform:[{rotate:'45deg'}]},
  routePointOne:{top:'8%'},routePointTwo:{top:'35%'},routePointThree:{top:'67%'},routePointFour:{top:'91%'},
  node:{position:'absolute',width:8,height:8,borderWidth:1,borderColor:'rgba(223,207,133,.70)',backgroundColor:'#0b0d10',transform:[{rotate:'45deg'}]},
  nodeOne:{left:'18%',top:'31%'},nodeTwo:{left:'42%',top:'18%'},nodeThree:{right:'14%',top:'44%'},
  horizon:{position:'absolute',height:1,left:-40,right:-40,top:300,backgroundColor:'rgba(255,238,162,.16)',transform:[{rotate:'-7deg'}]},
  horizonCompact:{top:244},
  vignetteTop:{position:'absolute',left:0,right:0,top:0,height:86,backgroundColor:'rgba(5,6,8,.08)'},
  vignetteBottom:{position:'absolute',left:0,right:0,bottom:0,height:128,backgroundColor:'rgba(5,6,8,.24)'},
})
