import { useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Alert, Image, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { externalUrl } from '@/config/env'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { lineupDateLabel, LineupSummary, lineupSubtitle } from '@/lib/lineups'
import { ActionCard, ScreenShell } from '@/screens/components'
import { colors, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

export function LineupScreen({ onBack, onNavigate, selectedLineup }: ScreenProps) {
  const auth = useAuth()
  const accessToken = auth.session?.access_token
  const [lineups, setLineups] = useState<LineupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

  async function load() {
    setLoading(true)
    try {
      const response = await mobileApi.lineups(accessToken)
      setLineups((response.escalacoes as LineupSummary[]) || [])
      setError(null)
    } catch (err:any) {
      setLineups([])
      setError(err?.message || 'Não foi possível carregar as escalações.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [accessToken])

  const visibleLineups = useMemo(() => {
    const selectedId = String(selectedLineup?.campeonato_equipe_id || '')
    if (!selectedId) return lineups
    const focused = lineups.filter((item) => String(item.campeonato_equipe_id || '') === selectedId)
    return focused.length ? focused : lineups
  }, [lineups, selectedLineup?.campeonato_equipe_id])

  const totals = useMemo(() => visibleLineups.reduce((acc, lineup) => {
    const limit = Number(lineup.limite_jogadores || 6)
    const confirmed = Number(lineup.jogadores_confirmados || lineup.jogadores?.length || 0)
    acc.confirmed += confirmed
    acc.limit += limit
    acc.open += Math.max(0, limit - confirmed)
    return acc
  }, { confirmed: 0, limit: 0, open: 0 }), [visibleLineups])

  async function generateInvite(lineup: any) {
    const participationId = String(lineup.campeonato_equipe_id || '')
    if (!participationId) return
    setBusyId(participationId)
    setError(null)
    setFeedback('')
    try {
      const created = await mobileApi.createLineupInvite(participationId, accessToken)
      setFeedback('Novo convite criado. O link anterior foi encerrado.')
      await Share.share({ message: created.texto || created.public_url, url: created.public_url })
      await load()
    } catch (err:any) {
      setError(err?.message || 'Não foi possível gerar o convite de escalação.')
    } finally {
      setBusyId(null)
    }
  }

  async function shareInvite(lineup:any) {
    if (!lineup.link_token) return
    const url = externalUrl(`/escala/${lineup.link_token}`)
    const text = [
      `Escalação · ${lineup.campeonato_nome || 'Campeonato'}`,
      lineup.equipe_nome ? `Equipe: ${lineup.equipe_nome}` : '',
      lineup.line_nome ? `Line: ${lineup.line_nome}` : '',
      `Acesse: ${url}`,
    ].filter(Boolean).join('\n')
    await Share.share({ message:text, url })
  }

  function revokeInvite(lineup:any) {
    const id = String(lineup.link_id || '')
    if (!id) return
    Alert.alert('Encerrar convite?','O link atual deixará de aceitar novos jogadores.',[
      { text:'Manter', style:'cancel' },
      { text:'Encerrar', style:'destructive', onPress:()=>void (async()=>{
        setBusyId(id);setError(null);setFeedback('')
        try {
          await mobileApi.revokeLineupInvite(id, accessToken)
          setFeedback('Convite encerrado.')
          await load()
        } catch (err:any) {
          setError(err?.message || 'Não foi possível encerrar o convite.')
        } finally { setBusyId(null) }
      })() },
    ])
  }

  function removePlayer(player:any) {
    const id = String(player.id || '')
    if (!id) return
    Alert.alert('Remover da escalação?',`${player.nick || 'Jogador'} será removido desta formação.`,[
      { text:'Cancelar', style:'cancel' },
      { text:'Remover', style:'destructive', onPress:()=>void (async()=>{
        setBusyId(id);setError(null);setFeedback('')
        try {
          await mobileApi.removeLineupPlayer(id, accessToken)
          setFeedback('Jogador removido da escalação.')
          await load()
        } catch (err:any) {
          setError(err?.message || 'Não foi possível remover o jogador.')
        } finally { setBusyId(null) }
      })() },
    ])
  }

  return (
    <ScreenShell eyebrow="Campeonato" title={selectedLineup?.campeonato_nome || 'Escalação'} onBack={onBack}>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>{selectedLineup ? 'Formação selecionada' : 'Resumo do elenco'}</Text>
        <Text style={styles.heroTitle}>{totals.confirmed}/{totals.limit || 0}</Text>
        <Text style={styles.heroText}>{totals.open} vaga(s) ainda abertas nas formações exibidas.</Text>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brand}/><Text style={styles.muted}>Carregando escalação...</Text></View> : null}
      {error ? <Text style={styles.warning}>{error}</Text> : null}
      {feedback ? <Text style={styles.success}>{feedback}</Text> : null}

      {!loading && visibleLineups.length === 0 ? (
        <ActionCard title="Nenhuma line inscrita" description="Entre em um campeonato com vaga. Depois a escalação aparece aqui." cta="Buscar vagas" onPress={() => onNavigate('vacancies')} />
      ) : null}

      {visibleLineups.map((lineup:any) => {
        const id = String(lineup.campeonato_equipe_id || lineup.campeonato_nome || '')
        const limit = Number(lineup.limite_jogadores || 6)
        const players = Array.isArray(lineup.jogadores) ? lineup.jogadores : []
        const confirmed = Number(lineup.jogadores_confirmados || players.length || 0)
        const free = Math.max(0, Number(lineup.vagas_disponiveis ?? limit - confirmed))
        const progress = Math.max(4, Math.min(100, (confirmed / Math.max(1, limit)) * 100))
        const hasToken = Boolean(lineup.link_ativo && lineup.link_token)
        return (
          <View key={id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.slotBox}><Text style={styles.slotValue}>{confirmed}</Text><Text style={styles.slotLabel}>/{limit}</Text></View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle} numberOfLines={1}>{lineup.campeonato_nome || 'Campeonato'}</Text>
                <Text style={styles.cardMeta} numberOfLines={2}>{lineupSubtitle(lineup)}</Text>
              </View>
            </View>

            <View style={styles.progress}><View style={[styles.progressFill,{width:`${progress}%`}]} /></View>
            <View style={styles.infoRow}>
              <Info label="jogo" value={lineupDateLabel(lineup)} />
              <Info label="livres" value={String(free)} />
              <Info label="status" value={free ? 'pendente' : 'completa'} />
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>JOGADORES CONFIRMADOS</Text>
              <Text style={styles.sectionCount}>{players.length}</Text>
            </View>
            {!players.length ? <Text style={styles.empty}>Nenhum jogador confirmou participação nesta escalação.</Text> : players.map((player:any)=><View key={String(player.id)} style={styles.playerRow}>
              {player.foto_url ? <Image source={{uri:externalUrl(player.foto_url)}} style={styles.avatar}/> : <View style={[styles.avatar,styles.avatarFallback]}><Text style={styles.avatarText}>{String(player.nick || 'J').slice(0,1).toUpperCase()}</Text></View>}
              <View style={styles.playerCopy}>
                <Text style={styles.playerName}>{player.nick || 'Jogador'}{player.capitao ? ' · CAPITÃO' : ''}</Text>
                <Text style={styles.playerMeta}>{player.funcao || 'Sem função'} · ID {player.id_jogo || 'pendente'}</Text>
              </View>
              <TouchableOpacity disabled={busyId===String(player.id)} style={styles.removeButton} onPress={()=>removePlayer(player)}>
                <Ionicons name="person-remove-outline" size={17} color="#9a3412"/>
              </TouchableOpacity>
            </View>)}

            {hasToken ? <View style={styles.tokenBox}>
              <View style={styles.tokenCopy}>
                <Text style={styles.tokenLabel}>CONVITE ATIVO</Text>
                <Text style={styles.tokenValue} numberOfLines={1}>{lineup.link_token}</Text>
                <Text style={styles.tokenMeta}>{lineup.link_expira_em ? `Validade: ${new Date(lineup.link_expira_em).toLocaleString('pt-BR')}` : 'Validade definida pelas regras do campeonato'}</Text>
              </View>
              <TouchableOpacity style={styles.iconButton} onPress={()=>void shareInvite(lineup)}><Ionicons name="share-social-outline" size={18} color={colors.ink}/></TouchableOpacity>
              <TouchableOpacity style={styles.iconDanger} disabled={busyId===String(lineup.link_id)} onPress={()=>revokeInvite(lineup)}><Ionicons name="close-circle-outline" size={18} color="#9a3412"/></TouchableOpacity>
            </View> : null}

            <TouchableOpacity style={styles.primary} onPress={()=>void generateInvite(lineup)} disabled={busyId===id || free<=0}>
              {busyId===id ? <ActivityIndicator color={colors.surface}/> : <Text style={styles.primaryText}>{hasToken ? 'Gerar novo convite' : 'Gerar convite de escalação'}</Text>}
            </TouchableOpacity>
            {free<=0 ? <Text style={styles.complete}>Formação completa. Remova um jogador antes de gerar nova vaga.</Text> : null}
          </View>
        )
      })}
    </ScreenShell>
  )
}

function Info({label,value}:{label:string;value:string}) {
  return <View style={styles.infoBox}><Text style={styles.infoValue} numberOfLines={1}>{value}</Text><Text style={styles.infoLabel}>{label}</Text></View>
}

const styles=StyleSheet.create({
  hero:{backgroundColor:colors.brandDark,borderBottomWidth:3,borderBottomColor:colors.brand,padding:spacing.lg,gap:spacing.xs},
  heroKicker:{color:colors.gold,fontSize:typography.tiny,fontWeight:'900',letterSpacing:2,textTransform:'uppercase'},
  heroTitle:{color:colors.surface,fontSize:42,fontWeight:'900'},
  heroText:{color:'#cbd5e1',fontSize:typography.caption,fontWeight:'700'},
  loading:{alignItems:'center',backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,gap:spacing.sm,padding:spacing.lg},
  muted:{color:colors.muted,fontSize:typography.caption,fontWeight:'700'},
  warning:{backgroundColor:'#fff7ed',color:'#9a3412',fontWeight:'800',padding:spacing.md},
  success:{backgroundColor:'#effaf3',color:'#166534',fontWeight:'800',padding:spacing.md},
  card:{backgroundColor:colors.surface,borderTopWidth:3,borderTopColor:colors.brand,padding:spacing.md,gap:spacing.sm},
  cardHead:{flexDirection:'row',alignItems:'center',gap:spacing.sm},
  slotBox:{width:54,height:54,alignItems:'center',justifyContent:'center',backgroundColor:colors.brandDark},
  slotValue:{color:colors.surface,fontSize:20,fontWeight:'900'},
  slotLabel:{color:'#cbd5e1',fontSize:9,fontWeight:'900'},
  cardTitleWrap:{flex:1},
  cardTitle:{color:colors.ink,fontSize:typography.subtitle,fontWeight:'900',textTransform:'uppercase'},
  cardMeta:{color:colors.muted,fontSize:typography.caption,fontWeight:'700',marginTop:2},
  progress:{height:6,overflow:'hidden',backgroundColor:'#ece7df'},
  progressFill:{height:'100%',backgroundColor:colors.brand},
  infoRow:{flexDirection:'row',gap:spacing.sm},
  infoBox:{flex:1,backgroundColor:colors.background,padding:spacing.sm},
  infoValue:{color:colors.ink,fontSize:typography.caption,fontWeight:'900'},
  infoLabel:{color:colors.muted,fontSize:8,fontWeight:'900',textTransform:'uppercase'},
  sectionHead:{marginTop:4,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  sectionTitle:{color:colors.ink,fontSize:9,fontWeight:'900',letterSpacing:1},
  sectionCount:{minWidth:26,textAlign:'center',paddingVertical:4,backgroundColor:colors.brandDark,color:colors.surface,fontSize:9,fontWeight:'900'},
  playerRow:{minHeight:56,flexDirection:'row',alignItems:'center',gap:8,paddingVertical:7,borderTopWidth:1,borderTopColor:colors.line},
  avatar:{width:39,height:39,borderRadius:20,backgroundColor:'#e8e2d9'},
  avatarFallback:{alignItems:'center',justifyContent:'center'},
  avatarText:{color:colors.brandDark,fontWeight:'900'},
  playerCopy:{flex:1},
  playerName:{color:colors.ink,fontSize:10,fontWeight:'900'},
  playerMeta:{marginTop:2,color:colors.muted,fontSize:8,fontWeight:'700'},
  removeButton:{width:34,height:34,alignItems:'center',justifyContent:'center',backgroundColor:'#fff7ed',borderWidth:1,borderColor:'#fed7aa'},
  empty:{padding:12,color:colors.muted,textAlign:'center',fontSize:9,fontWeight:'700',backgroundColor:colors.background},
  tokenBox:{flexDirection:'row',alignItems:'center',gap:7,padding:9,backgroundColor:'#eee9e1',borderWidth:1,borderColor:colors.line},
  tokenCopy:{flex:1,minWidth:0},
  tokenLabel:{color:colors.brand,fontSize:8,fontWeight:'900',letterSpacing:1},
  tokenValue:{marginTop:2,color:colors.ink,fontSize:9,fontWeight:'900'},
  tokenMeta:{marginTop:2,color:colors.muted,fontSize:8},
  iconButton:{width:34,height:34,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},
  iconDanger:{width:34,height:34,alignItems:'center',justifyContent:'center',backgroundColor:'#fff7ed',borderWidth:1,borderColor:'#fed7aa'},
  primary:{minHeight:47,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand},
  primaryText:{color:colors.surface,fontSize:9,fontWeight:'900',textTransform:'uppercase'},
  complete:{color:colors.muted,fontSize:8,fontWeight:'700',textAlign:'center'},
})
