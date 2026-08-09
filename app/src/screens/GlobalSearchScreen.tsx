import { useEffect, useMemo, useRef, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { externalUrl } from '@/config/env'
import { mobileApi } from '@/lib/api'
import { toChampionshipCard, VacancyApiItem } from '@/lib/vacancies'
import { colors, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

type SearchKind='todos'|'campeonatos'|'equipes'|'jogadores'
type SearchTeam={id:string;nome?:string;tag?:string|null;username?:string|null;logo_url?:string|null;localidade?:string|null;cidade?:string|null;estado?:string|null;pais?:string|null}
type SearchPlayer={id:string;nick?:string|null;nome?:string|null;username?:string|null;avatar_url?:string|null;foto_url?:string|null;id_jogo?:string|null;funcao?:string|null;localidade?:string|null}

export function GlobalSearchScreen({onSelectChampionship,onSelectTeam,onSelectPlayer}:ScreenProps){
  const [query,setQuery]=useState('')
  const [kind,setKind]=useState<SearchKind>('todos')
  const [championships,setChampionships]=useState<VacancyApiItem[]>([])
  const [teams,setTeams]=useState<SearchTeam[]>([])
  const [players,setPlayers]=useState<SearchPlayer[]>([])
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const requestId=useRef(0)

  useEffect(()=>{
    const term=query.trim()
    if(term.length<2){
      setChampionships([]);setTeams([]);setPlayers([]);setLoading(false);setError('')
      return
    }

    const id=++requestId.current
    const timer=setTimeout(async()=>{
      setLoading(true);setError('')
      try{
        const [champRes,teamRes,playerRes]=await Promise.all([
          mobileApi.championshipsPublic(),
          mobileApi.publicTeams(term),
          mobileApi.publicPlayers(term),
        ])
        if(id!==requestId.current)return
        const lowered=term.toLowerCase()
        setChampionships(((champRes.announcements||[]) as VacancyApiItem[]).filter(item=>
          [item.nome,item.tipo,item.plataforma,item.servidor].some(value=>String(value||'').toLowerCase().includes(lowered))
        ).slice(0,12))
        setTeams(((teamRes.items||[]) as SearchTeam[]).slice(0,12))
        setPlayers(((playerRes.items||[]) as SearchPlayer[]).slice(0,12))
      }catch(err:any){
        if(id!==requestId.current)return
        setError(err?.message||'Não foi possível concluir a busca.')
      }finally{
        if(id===requestId.current)setLoading(false)
      }
    },300)

    return()=>clearTimeout(timer)
  },[query])

  const total=championships.length+teams.length+players.length
  const showChampionships=kind==='todos'||kind==='campeonatos'
  const showTeams=kind==='todos'||kind==='equipes'
  const showPlayers=kind==='todos'||kind==='jogadores'

  const counts=useMemo(()=>({
    todos:total,
    campeonatos:championships.length,
    equipes:teams.length,
    jogadores:players.length,
  }),[championships.length,players.length,teams.length,total])

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>NAVEGAÇÃO RÁPIDA</Text>
      <Text style={styles.heroTitle}>BUSCA GLOBAL</Text>
      <Text style={styles.heroText}>Encontre campeonatos, equipes e jogadores sem sair do fluxo público.</Text>
    </View>

    <View style={styles.searchBox}>
      <Ionicons name="search-outline" size={21} color={colors.brand}/>
      <TextInput
        autoFocus
        value={query}
        onChangeText={setQuery}
        placeholder="Digite nome, nick, tag, ID..."
        placeholderTextColor="#938d84"
        autoCapitalize="none"
        returnKeyType="search"
        style={styles.input}
      />
      {query?<TouchableOpacity onPress={()=>setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={19} color={colors.muted}/></TouchableOpacity>:null}
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {(['todos','campeonatos','equipes','jogadores'] as SearchKind[]).map(value=><TouchableOpacity key={value} style={[styles.filter,kind===value&&styles.filterActive]} onPress={()=>setKind(value)}>
        <Text style={[styles.filterText,kind===value&&styles.filterTextActive]}>{value} {query.trim().length>=2?counts[value]:''}</Text>
      </TouchableOpacity>)}
    </ScrollView>

    {query.trim().length<2?<View style={styles.empty}><Ionicons name="search-outline" size={30} color={colors.muted}/><Text style={styles.emptyTitle}>Digite pelo menos 2 caracteres</Text><Text style={styles.emptyText}>A busca consulta os diretórios públicos oficiais.</Text></View>:null}
    {loading?<View style={styles.loading}><ActivityIndicator color={colors.brand}/><Text style={styles.loadingText}>Buscando...</Text></View>:null}
    {error?<Text style={styles.error}>{error}</Text>:null}

    {!loading&&query.trim().length>=2&&total===0&&!error?<View style={styles.empty}><Ionicons name="file-tray-outline" size={28} color={colors.muted}/><Text style={styles.emptyTitle}>Nenhum resultado</Text><Text style={styles.emptyText}>Tente outro nome, nick, tag ou ID.</Text></View>:null}

    {showChampionships&&championships.length?<Section title="CAMPEONATOS" count={championships.length}>
      {championships.map(item=>{
        const logo=item.logo_url?externalUrl(item.logo_url):''
        return <TouchableOpacity key={String(item.id)} style={styles.row} onPress={()=>onSelectChampionship?.(toChampionshipCard(item))}>
          {logo?<Image source={{uri:logo}} style={styles.logo} resizeMode="contain"/>:<Fallback icon="trophy-outline"/>}
          <View style={styles.copy}><Text style={styles.kicker}>{String(item.tipo||'Campeonato')}</Text><Text style={styles.title} numberOfLines={1}>{item.nome||'Campeonato'}</Text><Text style={styles.meta} numberOfLines={1}>{[item.plataforma,item.servidor,Number(item.vagas_livres||0)>0?`${Number(item.vagas_livres)} vagas`:null].filter(Boolean).join(' · ')||'Competição pública'}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted}/>
        </TouchableOpacity>
      })}
    </Section>:null}

    {showTeams&&teams.length?<Section title="EQUIPES" count={teams.length}>
      {teams.map(team=>{
        const logo=team.logo_url?externalUrl(team.logo_url):''
        const location=team.localidade||[team.cidade,team.estado,team.pais].filter(Boolean).join(' · ')
        return <TouchableOpacity key={team.id} style={styles.row} onPress={()=>onSelectTeam?.(team.id)}>
          {logo?<Image source={{uri:logo}} style={styles.logo} resizeMode="contain"/>:<Fallback icon="shield-outline"/>}
          <View style={styles.copy}><Text style={styles.kicker}>{team.tag||'Equipe'}</Text><Text style={styles.title} numberOfLines={1}>{team.nome||'Equipe'}</Text><Text style={styles.meta} numberOfLines={1}>{[team.username?`@${team.username}`:null,location].filter(Boolean).join(' · ')||'Equipe competitiva'}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted}/>
        </TouchableOpacity>
      })}
    </Section>:null}

    {showPlayers&&players.length?<Section title="JOGADORES" count={players.length}>
      {players.map(player=>{
        const avatar=externalUrl(player.avatar_url||player.foto_url||'')
        const name=player.nick||player.nome||player.username||'Jogador'
        return <TouchableOpacity key={player.id} style={styles.row} onPress={()=>onSelectPlayer?.(player.id)}>
          {avatar?<Image source={{uri:avatar}} style={[styles.logo,styles.avatar]} resizeMode="cover"/>:<Fallback icon="person-outline" round/>}
          <View style={styles.copy}><Text style={styles.kicker}>{player.funcao||'Jogador'}</Text><Text style={styles.title} numberOfLines={1}>{name}</Text><Text style={styles.meta} numberOfLines={1}>{[player.id_jogo?`ID ${player.id_jogo}`:null,player.localidade].filter(Boolean).join(' · ')||'Perfil competitivo'}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted}/>
        </TouchableOpacity>
      })}
    </Section>:null}
  </ScrollView>
}

function Section({title,count,children}:{title:string;count:number;children:any}){
  return <View style={styles.section}><View style={styles.sectionHead}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionCount}>{count}</Text></View><View style={styles.list}>{children}</View></View>
}
function Fallback({icon,round=false}:{icon:any;round?:boolean}){
  return <View style={[styles.logo,styles.fallback,round&&styles.avatar]}><Ionicons name={icon} size={20} color={colors.brand}/></View>
}

const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:colors.background},content:{paddingBottom:spacing.xl},
  hero:{padding:spacing.md,paddingTop:22,paddingBottom:18,backgroundColor:colors.brandDark},
  eyebrow:{color:colors.brand,fontSize:8,fontWeight:'900',letterSpacing:1.6},
  heroTitle:{marginTop:3,color:colors.surface,fontSize:23,fontWeight:'900',letterSpacing:.5},
  heroText:{marginTop:5,color:'#c8ced7',fontSize:9,lineHeight:14,fontWeight:'700'},
  searchBox:{margin:spacing.md,marginBottom:7,height:48,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,backgroundColor:'#ebe6dd',borderWidth:1,borderColor:'#d2cbc1'},
  input:{flex:1,color:colors.ink,fontSize:12,fontWeight:'800',paddingVertical:0},
  filters:{paddingHorizontal:spacing.md,paddingBottom:9,gap:5},
  filter:{minHeight:32,paddingHorizontal:10,alignItems:'center',justifyContent:'center',backgroundColor:'#e5dfd5'},
  filterActive:{backgroundColor:colors.brandDark},filterText:{color:colors.ink,fontSize:7,fontWeight:'900',textTransform:'uppercase'},filterTextActive:{color:colors.surface},
  loading:{minHeight:56,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},loadingText:{color:colors.muted,fontSize:9,fontWeight:'800'},
  error:{marginHorizontal:spacing.md,padding:10,color:'#9a3412',backgroundColor:'#fff7ed',fontSize:9,fontWeight:'800'},
  empty:{margin:spacing.md,minHeight:110,alignItems:'center',justifyContent:'center',gap:6,padding:14,backgroundColor:'#e7e1d8'},
  emptyTitle:{color:colors.ink,fontSize:11,fontWeight:'900',textTransform:'uppercase'},emptyText:{color:colors.muted,fontSize:8.5,fontWeight:'700',textAlign:'center'},
  section:{marginHorizontal:spacing.md,marginTop:8},sectionHead:{minHeight:31,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:9,backgroundColor:colors.brandDark},
  sectionTitle:{color:colors.surface,fontSize:8,fontWeight:'900',letterSpacing:1},sectionCount:{color:colors.brand,fontSize:8,fontWeight:'900'},
  list:{gap:1,backgroundColor:colors.line},row:{minHeight:64,flexDirection:'row',alignItems:'center',gap:9,padding:8,backgroundColor:'#e8e2d8'},
  logo:{width:44,height:44,backgroundColor:'#f7f3ec',borderWidth:1,borderColor:'rgba(17,24,39,.08)'},avatar:{borderRadius:22},fallback:{alignItems:'center',justifyContent:'center'},
  copy:{flex:1,minWidth:0},kicker:{color:colors.brand,fontSize:6.5,fontWeight:'900',textTransform:'uppercase'},title:{marginTop:2,color:colors.ink,fontSize:11.5,fontWeight:'900',textTransform:'uppercase'},
  meta:{marginTop:3,color:'#706b64',fontSize:8.5,fontWeight:'700'},
})
