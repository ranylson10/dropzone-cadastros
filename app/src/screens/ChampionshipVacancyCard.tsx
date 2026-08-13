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
      {item.banner_url ? <Image source={{ uri: item.banner_url }} style={styles.banner} /> : <View style={styles.bannerFallback}><Ionicons name="trophy-outline" size={34} color={colors.ink} /></View>}
      <View style={styles.badge}><Text style={styles.badgeText}>{String(item.tipo || 'Campeonato').toUpperCase()}</Text></View>
      {item.tem_live ? <View style={styles.live}><Text style={styles.liveText}>LIVE</Text></View> : null}
      <TouchableOpacity accessibilityLabel="Lista de desejos" style={styles.heart} onPress={props.onWishlist}><Ionicons name={props.favorite ? 'heart' : 'heart-outline'} size={19} color={colors.ink} /></TouchableOpacity>
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
        <TouchableOpacity accessibilityLabel={props.inCart ? 'Remover do carrinho' : 'Adicionar ao carrinho'} style={[styles.cart, props.inCart && styles.cartActive]} onPress={props.onCart}><Ionicons name={props.inCart ? 'cart' : 'cart-outline'} size={18} color={colors.onBrand} /></TouchableOpacity>
      </View>
    </View>
  </View>
}
function Metric({ icon, value, label }: { icon: any; value: string; label: string }) { return <View style={styles.metric}><Ionicons name={icon} size={14} color={colors.brand} /><Text style={styles.metricValue} numberOfLines={1}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View> }
const styles=StyleSheet.create({
  card:{backgroundColor:colors.surface,borderRadius:10,borderWidth:1,borderColor:colors.line,overflow:'hidden'},
  media:{height:138,backgroundColor:colors.brandDark,position:'relative'},
  banner:{width:'100%',height:'100%',resizeMode:'cover'},
  bannerFallback:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.brandDark},
  badge:{position:'absolute',left:8,top:8,paddingHorizontal:7,paddingVertical:4,borderRadius:6,backgroundColor:colors.brand},
  badgeText:{color:colors.onBrand,fontSize:7,fontWeight:'900'},
  live:{position:'absolute',left:8,bottom:8,paddingHorizontal:7,paddingVertical:4,borderRadius:6,backgroundColor:'rgba(12,13,15,.92)'},
  liveText:{color:colors.ink,fontSize:7,fontWeight:'900'},
  heart:{position:'absolute',right:8,top:8,width:34,height:34,borderRadius:6,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(12,13,15,.78)'},
  body:{padding:10,gap:8},
  titleRow:{flexDirection:'row',gap:8,alignItems:'center'},
  logo:{width:38,height:38,borderRadius:6,backgroundColor:colors.surfaceRaised},
  copy:{flex:1},
  name:{color:colors.ink,fontSize:14,lineHeight:16,fontWeight:'900',textTransform:'uppercase'},
  date:{marginTop:2,color:colors.muted,fontSize:8,fontWeight:'800'},
  metrics:{flexDirection:'row',gap:4},
  metric:{flex:1,minWidth:0,paddingVertical:6,paddingHorizontal:6,borderRadius:6,backgroundColor:colors.surfaceRaised},
  metricValue:{marginTop:2,color:colors.ink,fontSize:9,fontWeight:'900'},
  metricLabel:{marginTop:1,color:colors.muted,fontSize:6.5,fontWeight:'800',textTransform:'uppercase'},
  vacancyLine:{flexDirection:'row',alignItems:'baseline'},
  vacancyStrong:{color:colors.ink,fontSize:14,fontWeight:'900'},
  vacancyText:{color:colors.muted,fontSize:8,fontWeight:'800'},
  progress:{height:5,borderRadius:3,backgroundColor:colors.surfaceRaised,overflow:'hidden'},
  progressFill:{height:'100%',backgroundColor:colors.brand},
  actions:{flexDirection:'row',alignItems:'center',gap:6},
  open:{minHeight:38,flex:1,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:10,borderRadius:6,backgroundColor:colors.surfaceRaised},
  openText:{color:colors.brand,fontSize:9,fontWeight:'900',textTransform:'uppercase'},
  cart:{width:42,minHeight:38,flexDirection:'row',alignItems:'center',justifyContent:'center',borderRadius:6,backgroundColor:colors.brand},
  cartActive:{backgroundColor:colors.brandLight},
})
