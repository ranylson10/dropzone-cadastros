import { useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useChampionshipCommerce } from '@/lib/useChampionshipCommerce'
import { toChampionshipCard, VacancyApiItem } from '@/lib/vacancies'
import { ChampionshipVacancyCard } from '@/screens/ChampionshipVacancyCard'
import { DirectoryHero } from '@/screens/DirectoryHero'
import { colors, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

const typeLabels:Record<string,string>={diario:'Diário',copa:'Copa',liga:'Liga',xtreino:'Xtreino'}
const dateKey=(item:VacancyApiItem)=>`${item.proxima_data||'9999-12-31'}T${item.proximo_horario||'23:59'}`

export function ChampionshipDirectoryScreen({onSelectChampionship,requireAuth}:ScreenProps){
  const [items,setItems]=useState<VacancyApiItem[]>([]),[query,setQuery]=useState(''),[type,setType]=useState('todos'),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const commerce=useChampionshipCommerce(requireAuth)
  useEffect(()=>{let mounted=true;mobileApi.championshipsPublic().then(response=>{if(!mounted)return;setItems(((response.announcements||[]) as VacancyApiItem[]).filter(item=>Number(item.vagas_livres||0)>0).sort((a,b)=>dateKey(a).localeCompare(dateKey(b))));setError('')}).catch(err=>mounted&&setError(err?.message||'Não foi possível carregar os campeonatos.')).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[])
  const visible=useMemo(()=>{const term=query.trim().toLowerCase();return items.filter(item=>(type==='todos'||String(item.tipo||'').toLowerCase()===type)&&(!term||[item.nome,item.tipo,item.plataforma,item.servidor].some(value=>String(value||'').toLowerCase().includes(term))))},[items,query,type])
  const types=useMemo(()=>['todos',...Array.from(new Set(items.map(item=>String(item.tipo||'').trim().toLowerCase()).filter(Boolean)))],[items])
  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <DirectoryHero image={require('../../assets/directory-campeonatos.png')} eyebrow="Vagas abertas" title="Campeonatos" description="Do jogo mais próximo para o mais distante. Apenas campeonatos com vaga disponível." compact/>
    <View style={styles.searchBox}><Ionicons name="search-outline" size={19} color="#7c838c"/><TextInput value={query} onChangeText={setQuery} placeholder="Buscar campeonato..." placeholderTextColor="#938d84" style={styles.searchInput}/>{query?<TouchableOpacity onPress={()=>setQuery('')}><Ionicons name="close-circle" size={18} color="#8b857d"/></TouchableOpacity>:null}</View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{types.map(item=><TouchableOpacity key={item} style={[styles.filter,type===item&&styles.filterActive]} onPress={()=>setType(item)}><Text style={[styles.filterText,type===item&&styles.filterTextActive]}>{item==='todos'?'Todos':typeLabels[item]||item}</Text></TouchableOpacity>)}</ScrollView>
    {loading?<View style={styles.loading}><ActivityIndicator color={colors.brand}/><Text style={styles.loadingText}>Carregando campeonatos...</Text></View>:null}{error?<Text style={styles.error}>{error}</Text>:null}
    <View style={styles.list}>{visible.map(item=>{const id=String(item.id||'');return <ChampionshipVacancyCard key={id||item.nome} item={item} favorite={commerce.wishlistIds.has(id)} inCart={commerce.cartIds.has(id)} onOpen={()=>onSelectChampionship?.(toChampionshipCard(item))} onWishlist={()=>commerce.toggleWishlist(id)} onCart={()=>commerce.addCart(id)}/>})}</View>
    {!loading&&!visible.length?<Text style={styles.empty}>Nenhum campeonato com vaga aberta neste filtro.</Text>:null}
  </ScrollView>
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:colors.background},content:{paddingBottom:spacing.xl},searchBox:{margin:spacing.md,marginBottom:8,height:42,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:11,backgroundColor:'#ebe6dd',borderWidth:1,borderColor:'#d2cbc1'},searchInput:{flex:1,color:colors.ink,fontSize:12,fontWeight:'700',paddingVertical:0},filterRow:{paddingHorizontal:spacing.md,paddingBottom:10,gap:6},filter:{minHeight:32,paddingHorizontal:13,alignItems:'center',justifyContent:'center',backgroundColor:'#e5dfd5',borderWidth:1,borderColor:'#d0c9be'},filterActive:{backgroundColor:colors.brandDark,borderColor:colors.brandDark},filterText:{color:colors.ink,fontSize:9,fontWeight:'900',textTransform:'uppercase'},filterTextActive:{color:colors.surface},loading:{minHeight:52,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},loadingText:{color:colors.muted,fontSize:11,fontWeight:'700'},error:{marginHorizontal:spacing.md,marginBottom:8,padding:10,backgroundColor:'#fff7ed',color:'#9a3412',fontSize:11,fontWeight:'800'},list:{marginHorizontal:spacing.md,gap:12},empty:{margin:spacing.md,padding:15,backgroundColor:'#e7e1d8',color:colors.muted,textAlign:'center',fontSize:11,fontWeight:'800'}})
