import Ionicons from '@expo/vector-icons/Ionicons'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { dateLabel, money, VacancyApiItem } from '@/lib/vacancies'
import { colors } from '@/theme/tokens'

export function ChampionshipVacancyCard(props: {
  item: VacancyApiItem
  favorite?: boolean
  inCart?: boolean
  onOpen: () => void
  onWishlist: () => void
  onCart: () => void
}) {
  const item = props.item
  const free = Math.max(0, Number(item.vagas_livres || 0))
  const total = Math.max(free, Number(item.total_vagas || 0))
  const occupied = Math.max(0, total - free)
  const progress = total > 0 ? Math.min(100, Math.max(0, occupied / total * 100)) : 0
  return <View style={styles.card}>
    <TouchableOpacity activeOpacity={.9} onPress={props.onOpen} style={styles.media}>
      {item.banner_url ? <Image source={{ uri: item.banner_url }} style={styles.banner} /> : <View style={styles.bannerFallback}><Ionicons name="trophy-outline" size={42} color="#fff" /></View>}
      <View style={styles.badge}><Text style={styles.badgeText}>{String(item.tipo || 'Campeonato').toUpperCase()}</Text></View>
      {item.tem_live ? <View style={styles.live}><Text style={styles.liveText}>LIVE</Text></View> : null}
      <TouchableOpacity accessibilityLabel="Lista de desejos" style={styles.heart} onPress={props.onWishlist}><Ionicons name={props.favorite ? 'heart' : 'heart-outline'} size={23} color="#fff" /></TouchableOpacity>
    </TouchableOpacity>
    <View style={styles.body}>
      <View style={styles.titleRow}>
        {item.logo_url ? <Image source={{ uri: item.logo_url }} style={styles.logo} resizeMode="contain" /> : null}
        <View style={styles.copy}><Text style={styles.name} numberOfLines={2}>{item.nome || 'Campeonato'}</Text><Text style={styles.date}>{dateLabel(item)}</Text></View>
      </View>
      <View style={styles.metrics}>
        <Metric icon="ticket-outline" value={money(item.valor_inscricao)} label="Inscrição" />
        <Metric icon="gift-outline" value={item.descricao_premiacao || money(item.premiacao)} label="Premiação" />
        <Metric icon="people-outline" value={String(free)} label="Vagas livres" />
      </View>
      <View style={styles.vacancyLine}><Text style={styles.vacancyStrong}>{free}</Text><Text style={styles.vacancyText}> vagas disponíveis{total ? ` · ${occupied}/${total} ocupadas` : ''}</Text></View>
      <View style={styles.progress}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.open} onPress={props.onOpen}><Text style={styles.openText}>Ver campeonato</Text><Ionicons name="chevron-forward" size={17} color={colors.brand} /></TouchableOpacity>
        <TouchableOpacity style={[styles.cart, props.inCart && styles.cartActive]} onPress={props.onCart}><Ionicons name={props.inCart ? 'cart' : 'cart-outline'} size={19} color="#fff" /><Text style={styles.cartText}>{props.inCart ? 'No carrinho' : 'Adicionar ao carrinho'}</Text></TouchableOpacity>
      </View>
    </View>
  </View>
}
function Metric({ icon, value, label }: { icon: any; value: string; label: string }) { return <View style={styles.metric}><Ionicons name={icon} size={16} color={colors.brand} /><Text style={styles.metricValue} numberOfLines={1}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View> }
const styles=StyleSheet.create({card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#d7d0c5'},media:{height:174,backgroundColor:colors.brandDark,position:'relative'},banner:{width:'100%',height:'100%',resizeMode:'cover'},bannerFallback:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.brandDark},badge:{position:'absolute',left:10,top:10,paddingHorizontal:9,paddingVertical:6,backgroundColor:colors.brand},badgeText:{color:'#fff',fontSize:8,fontWeight:'900'},live:{position:'absolute',left:10,bottom:10,paddingHorizontal:8,paddingVertical:5,backgroundColor:'#0d1624'},liveText:{color:'#fff',fontSize:8,fontWeight:'900'},heart:{position:'absolute',right:10,top:10,width:42,height:42,borderRadius:21,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,77,71,.9)'},body:{padding:12,gap:10},titleRow:{flexDirection:'row',gap:10,alignItems:'center'},logo:{width:44,height:44,backgroundColor:'#f5f1ea',borderWidth:1,borderColor:colors.line},copy:{flex:1},name:{color:colors.ink,fontSize:17,lineHeight:19,fontWeight:'900',textTransform:'uppercase'},date:{marginTop:3,color:colors.muted,fontSize:9,fontWeight:'800'},metrics:{flexDirection:'row',gap:6},metric:{flex:1,minWidth:0,padding:8,backgroundColor:'#f2eee7'},metricValue:{marginTop:4,color:colors.ink,fontSize:10,fontWeight:'900'},metricLabel:{marginTop:2,color:colors.muted,fontSize:7,fontWeight:'800',textTransform:'uppercase'},vacancyLine:{flexDirection:'row',alignItems:'baseline'},vacancyStrong:{color:colors.ink,fontSize:17,fontWeight:'900'},vacancyText:{color:colors.muted,fontSize:9,fontWeight:'800'},progress:{height:7,backgroundColor:'#e3ddd4',overflow:'hidden'},progressFill:{height:'100%',backgroundColor:colors.brand},actions:{gap:7},open:{minHeight:39,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},openText:{color:colors.brand,fontSize:10,fontWeight:'900',textTransform:'uppercase'},cart:{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:colors.brandDark},cartActive:{backgroundColor:'#28384f'},cartText:{color:'#fff',fontSize:10,fontWeight:'900',textTransform:'uppercase'}})
