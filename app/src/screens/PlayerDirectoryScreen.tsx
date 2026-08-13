import { useCallback, useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { externalUrl } from '@/config/env'
import { mobileApi } from '@/lib/api'
import { DirectoryHero } from '@/screens/DirectoryHero'
import { colors, spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

export function PlayerDirectoryScreen({ onSelectPlayer }: ScreenProps) {
  const [items, setItems] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    try { const result = await mobileApi.publicPlayers(); setItems(result.items || []); setError('') }
    catch (err: any) { setError(err?.message || 'Não foi possível carregar os jogadores.') }
    finally { setLoading(false); setRefreshing(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return !term ? items : items.filter((item) => [item.nick, item.nome, item.username, item.id_jogo, item.funcao, item.localidade].some((value) => String(value || '').toLowerCase().includes(term)))
  }, [items, query])
  return <ScrollView style={styles.page} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brand} />}>
    <DirectoryHero image={require('../../assets/directory-rank.png')} eyebrow="Diretório público" title="Jogadores" description="Perfis competitivos cadastrados na DropZone." compact />
    <View style={styles.search}><Ionicons name="search-outline" size={19} color="#77808d" /><TextInput value={query} onChangeText={setQuery} placeholder="Buscar jogador, nick, ID ou função..." placeholderTextColor="#938d84" style={styles.input} /></View>
    {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brand} /><Text style={styles.meta}>Carregando jogadores...</Text></View> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={styles.list}>{visible.map((player) => {
      const image = externalUrl(player.avatar_url || player.foto_url || '')
      const name = player.nick || player.nome || player.username || 'Jogador'
      return <TouchableOpacity key={String(player.id)} style={styles.row} onPress={() => onSelectPlayer?.(String(player.id))}>
        {image ? <Image source={{ uri: image }} style={styles.avatar} /> : <View style={[styles.avatar, styles.fallback]}><Ionicons name="person-outline" size={20} color={colors.brand} /></View>}
        <View style={styles.copy}><Text style={styles.name}>{name}</Text><Text style={styles.meta}>{[player.funcao, player.id_jogo ? `ID ${player.id_jogo}` : '', player.localidade].filter(Boolean).join(' · ') || 'Perfil competitivo'}</Text></View>
        <Ionicons name="chevron-forward" size={18} color="#737c86" />
      </TouchableOpacity>
    })}</View>
    {!loading && !visible.length ? <Text style={styles.empty}>Nenhum jogador encontrado.</Text> : null}
  </ScrollView>
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.background},content:{paddingBottom:spacing.lg},search:{margin:spacing.md,height:44,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:11,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:10},input:{flex:1,color:colors.ink,fontSize:12,fontWeight:'700'},loading:{minHeight:52,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},error:{marginHorizontal:spacing.md,marginBottom:8,padding:10,backgroundColor:'rgba(224, 122, 122, .12)',color:colors.danger,fontWeight:'800'},list:{marginHorizontal:spacing.md,gap:8},row:{minHeight:64,flexDirection:'row',alignItems:'center',gap:10,padding:8,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:10},avatar:{width:46,height:46,backgroundColor:colors.surfaceRaised,borderRadius:8},fallback:{alignItems:'center',justifyContent:'center'},copy:{flex:1},name:{color:colors.ink,fontSize:12.5,fontWeight:'900',textTransform:'uppercase'},meta:{marginTop:3,color:colors.muted,fontSize:9,fontWeight:'700'},empty:{margin:spacing.md,padding:15,textAlign:'center',color:colors.muted,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:10,fontWeight:'800'}
})
