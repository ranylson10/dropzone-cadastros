import { useCallback, useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { colors, spacing } from '@/theme/tokens'

type Props = { championshipId:string; token?:string|null }
type TeamDraft = { posicao:string; abates:string; punicao:string; motivo:string }
type PlayerDraft = { abates:string; dano:string; assistencias:string; revives:string }

const key = (fallId:string, teamId:string) => `${fallId}:${teamId}`
const pkey = (fallId:string, playerId:string) => `${fallId}:${playerId}`
const n = (value:any) => String(Number(value || 0))

export function ChampionshipScorerPanel({championshipId,token}:Props){
  const [games,setGames]=useState<any[]>([])
  const [gameId,setGameId]=useState('')
  const [data,setData]=useState<any>(null)
  const [fallId,setFallId]=useState('')
  const [teamDrafts,setTeamDrafts]=useState<Record<string,TeamDraft>>({})
  const [playerDrafts,setPlayerDrafts]=useState<Record<string,PlayerDraft>>({})
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [feedback,setFeedback]=useState('')
  const [view,setView]=useState<'score'|'ranking'|'mvp'>('score')

  const loadGames=useCallback(async()=>{
    setLoading(true)
    try{
      const response=await mobileApi.championshipScorerGames(championshipId,token)
      const rows=Array.isArray(response?.jogos)?response.jogos:[]
      setGames(rows)
      setGameId(current=>current&&rows.some((g:any)=>String(g.id)===current)?current:String(rows[0]?.id||''))
      setError('')
    }catch(err:any){setError(err?.message||'Não foi possível carregar os jogos do pontuador.')}
    finally{setLoading(false)}
  },[championshipId,token])

  const loadGame=useCallback(async(id:string)=>{
    if(!id){setData(null);return}
    setLoading(true)
    try{
      const response=await mobileApi.championshipScorerGame(championshipId,id,token)
      setData(response)
      const falls=Array.isArray(response?.partidas)?response.partidas:[]
      setFallId(current=>current&&falls.some((q:any)=>String(q.id)===current)?current:String(falls[0]?.id||''))
      const td:Record<string,TeamDraft>={}
      for(const row of response?.matriz||[]){
        if(!row?.partida_id||!row?.campeonato_equipe_id)continue
        td[key(String(row.partida_id),String(row.campeonato_equipe_id))]={posicao:row.posicao?String(row.posicao):'',abates:n(row.abates),punicao:n(row.punicao_pontos),motivo:String(row.punicao_motivo||'')}
      }
      const pd:Record<string,PlayerDraft>={}
      for(const row of response?.resultados_jogadores||[]){
        if(!row?.partida_id||!row?.campeonato_jogador_id)continue
        pd[pkey(String(row.partida_id),String(row.campeonato_jogador_id))]={abates:n(row.abates),dano:n(row.dano),assistencias:n(row.assistencias),revives:n(row.revives)}
      }
      setTeamDrafts(td);setPlayerDrafts(pd);setError('')
    }catch(err:any){setError(err?.message||'Não foi possível carregar o pontuador.')}
    finally{setLoading(false)}
  },[championshipId,token])

  useEffect(()=>{void loadGames()},[loadGames])
  useEffect(()=>{if(gameId)void loadGame(gameId)},[gameId,loadGame])

  const fall=useMemo(()=>data?.partidas?.find((q:any)=>String(q.id)===fallId)||null,[data,fallId])
  const teams=useMemo(()=>{
    const by=new Map<string,any>()
    for(const row of data?.slots||[]){if(row?.campeonato_equipe_id&&!row?.slot_vazio)by.set(String(row.campeonato_equipe_id),row)}
    return [...by.values()]
  },[data])
  const playersByTeam=useMemo(()=>{
    const map=new Map<string,any[]>()
    for(const player of data?.jogadores||[]){const id=String(player?.campeonato_equipe_id||'');if(!id)continue;map.set(id,[...(map.get(id)||[]),player])}
    return map
  },[data])

  function teamValue(teamId:string):TeamDraft{return teamDrafts[key(fallId,teamId)]||{posicao:'',abates:'0',punicao:'0',motivo:''}}
  function patchTeam(teamId:string,patch:Partial<TeamDraft>){setTeamDrafts(current=>({...current,[key(fallId,teamId)]:{...teamValue(teamId),...patch}}))}
  function playerValue(playerId:string):PlayerDraft{return playerDrafts[pkey(fallId,playerId)]||{abates:'0',dano:'0',assistencias:'0',revives:'0'}}
  function patchPlayer(playerId:string,patch:Partial<PlayerDraft>){setPlayerDrafts(current=>({...current,[pkey(fallId,playerId)]:{...playerValue(playerId),...patch}}))}

  async function save(){
    if(!fallId)return
    const payload=teams.map((team:any)=>{
      const d=teamValue(String(team.campeonato_equipe_id))
      return {
        campeonato_equipe_id:String(team.campeonato_equipe_id),
        posicao:Number(d.posicao),
        abates:Number(d.abates||0),
        punicao_pontos:Math.min(Number(d.punicao||0),0),
        punicao_motivo:d.motivo.trim()||null,
        jogadores:(playersByTeam.get(String(team.campeonato_equipe_id))||[]).map((player:any)=>{
          const p=playerValue(String(player.campeonato_jogador_id))
          return {
            campeonato_jogador_id:String(player.campeonato_jogador_id),
            abates:Number(p.abates||0),
            dano:Number(p.dano||0),
            assistencias:Number(p.assistencias||0),
            revives:Number(p.revives||0),
          }
        }),
      }
    })
    if(payload.some((item:any)=>!Number.isInteger(item.posicao)||item.posicao<1)){setError('Informe uma posição válida para todas as equipes presentes.');return}
    setBusy(true);setError('');setFeedback('')
    try{await mobileApi.saveChampionshipManualScore(championshipId,{partida_id:fallId,origem:'manual',equipes:payload},token);setFeedback('Súmula salva.');await loadGame(gameId)}catch(err:any){setError(err?.message||'Não foi possível salvar a súmula.')}finally{setBusy(false)}
  }

  async function action(fn:()=>Promise<any>,message:string){setBusy(true);setError('');try{await fn();setFeedback(message);await loadGame(gameId)}catch(err:any){setError(err?.message||'Não foi possível concluir a ação.')}finally{setBusy(false)}}
  function absence(team:any){Alert.alert('Marcar falta?',team.nome_exibicao||team.equipe_nome||'Equipe',[{text:'Cancelar',style:'cancel'},{text:'Confirmar',style:'destructive',onPress:()=>void action(()=>mobileApi.markChampionshipFallAbsence(championshipId,gameId,fallId,String(team.campeonato_equipe_id),null,token),'Falta registrada.')}])}
  function finalize(){Alert.alert('Finalizar queda?','Depois de finalizada, a pontuação fica bloqueada até reabrir.',[{text:'Cancelar',style:'cancel'},{text:'Finalizar',onPress:()=>void action(()=>mobileApi.finalizeChampionshipFall(championshipId,fallId,token),'Queda finalizada.')}])}

  if(loading&&!data)return <View style={styles.loading}><ActivityIndicator color={colors.brand}/></View>
  return <View style={styles.root}>
    {error?<Text style={[styles.message,styles.error]}>{error}</Text>:null}{feedback?<Text style={styles.message}>{feedback}</Text>:null}
    <Text style={styles.title}>JOGO DO PONTUADOR</Text><View style={styles.chips}>{games.map((game:any)=><TouchableOpacity key={game.id} style={[styles.chip,gameId===String(game.id)&&styles.chipActive]} onPress={()=>setGameId(String(game.id))}><Text style={[styles.chipText,gameId===String(game.id)&&styles.chipTextActive]}>{game.nome}</Text></TouchableOpacity>)}</View>
    {data?<><View style={styles.nav}><Nav label="Pontuar" active={view==='score'} onPress={()=>setView('score')}/><Nav label="Classificação" active={view==='ranking'} onPress={()=>setView('ranking')}/><Nav label="MVP" active={view==='mvp'} onPress={()=>setView('mvp')}/></View>
    {view==='score'?<><Text style={styles.title}>QUEDA</Text><View style={styles.chips}>{(data.partidas||[]).map((q:any)=><TouchableOpacity key={q.id} style={[styles.chip,fallId===String(q.id)&&styles.chipActive]} onPress={()=>setFallId(String(q.id))}><Text style={[styles.chipText,fallId===String(q.id)&&styles.chipTextActive]}>Q{q.numero_partida} · {q.mapa_nome||q.mapa_codigo}</Text></TouchableOpacity>)}</View>
    {fall?<View style={styles.toolbar}><Text style={styles.meta}>{String(fall.status||'agendada').replace('_',' ')}</Text><TouchableOpacity style={styles.secondary} disabled={busy} onPress={()=>void action(()=>mobileApi.setChampionshipCurrentFall(championshipId,gameId,fallId,token),'Queda definida como atual.')}><Text style={styles.secondaryText}>Definir atual</Text></TouchableOpacity>{fall.status==='finalizada'?<TouchableOpacity style={styles.secondary} disabled={busy} onPress={()=>void action(()=>mobileApi.reopenChampionshipFall(championshipId,fallId,token),'Queda reaberta.')}><Text style={styles.secondaryText}>Reabrir</Text></TouchableOpacity>:<TouchableOpacity style={styles.primarySmall} disabled={busy} onPress={finalize}><Text style={styles.primaryText}>Finalizar</Text></TouchableOpacity>}</View>:null}
    <View style={styles.list}>{teams.map((team:any)=>{const id=String(team.campeonato_equipe_id);const d=teamValue(id);const players=playersByTeam.get(id)||[];const matrix=(data.matriz||[]).find((row:any)=>String(row.partida_id)===fallId&&String(row.campeonato_equipe_id)===id);return <View key={id} style={styles.card}><View style={styles.teamHead}><View style={styles.copy}><Text style={styles.rowTitle}>{team.nome_exibicao||team.equipe_nome||'Equipe'}</Text><Text style={styles.meta}>Slot {team.slot_numero||'-'} · {matrix?.status_presenca||'sem presença'}</Text></View><TouchableOpacity style={styles.danger} onPress={()=>absence(team)}><Text style={styles.dangerText}>Falta</Text></TouchableOpacity></View><View style={styles.columns}><Field label="Pos." value={d.posicao} onChangeText={(v:string)=>patchTeam(id,{posicao:v})}/><Field label="Kills" value={d.abates} onChangeText={(v:string)=>patchTeam(id,{abates:v})}/><Field label="Punição" value={d.punicao} onChangeText={(v:string)=>patchTeam(id,{punicao:v})}/></View><Field label="Motivo da punição" value={d.motivo} onChangeText={(v:string)=>patchTeam(id,{motivo:v})}/>{players.length?<><Text style={styles.playerTitle}>JOGADORES</Text>{players.map((player:any)=>{const pid=String(player.campeonato_jogador_id);const p=playerValue(pid);return <View key={pid} style={styles.player}><Text style={styles.playerName}>{player.nick||player.id_jogo||'Jogador'}</Text><View style={styles.playerFields}><Mini label="K" value={p.abates} onChangeText={(v:string)=>patchPlayer(pid,{abates:v})}/><Mini label="DMG" value={p.dano} onChangeText={(v:string)=>patchPlayer(pid,{dano:v})}/><Mini label="AST" value={p.assistencias} onChangeText={(v:string)=>patchPlayer(pid,{assistencias:v})}/><Mini label="REV" value={p.revives} onChangeText={(v:string)=>patchPlayer(pid,{revives:v})}/></View></View>})}</>:null}</View>})}</View><TouchableOpacity style={styles.primary} disabled={busy||fall?.status==='finalizada'} onPress={()=>void save()}><Ionicons name="save-outline" size={17} color={colors.surface}/><Text style={styles.primaryText}>Salvar súmula da queda</Text></TouchableOpacity></>:null}
    {view==='ranking'?<Ranking rows={data.classificacao_jogo||[]}/>:null}{view==='mvp'?<Mvp rows={data.mvp_jogo||[]}/>:null}</>:<Text style={styles.empty}>Nenhum jogo disponível para pontuação.</Text>}
    <Text style={styles.note}>O app grava pela súmula manual oficial. Pontos de colocação, pontos por abate, booyah e classificação continuam calculados pelo backend e pelas views do campeonato.</Text>
  </View>
}

function Ranking({rows}:{rows:any[]}){return <View style={styles.list}>{rows.map((r:any,i:number)=><View key={r.campeonato_equipe_id||i} style={styles.rank}><Text style={styles.place}>{r.colocacao||i+1}</Text><View style={styles.copy}><Text style={styles.rowTitle}>{r.equipe_nome||r.nome||'Equipe'}</Text><Text style={styles.meta}>{r.booyahs||0} BOOYAH · {r.abates||0} KILLS</Text></View><View><Text style={styles.points}>{Number(r.pontos_total||0)}</Text><Text style={styles.pointsLabel}>PTS</Text></View></View>)}</View>}
function Mvp({rows}:{rows:any[]}){return <View style={styles.list}>{rows.map((r:any,i:number)=><View key={r.campeonato_jogador_id||i} style={styles.rank}><Text style={styles.place}>{r.colocacao||i+1}</Text><View style={styles.copy}><Text style={styles.rowTitle}>{r.nick||'Jogador'}</Text><Text style={styles.meta}>{r.abates||0} K · {r.dano||0} DMG · {r.assistencias||0} AST · {r.revives||0} REV</Text></View></View>)}</View>}
function Nav({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <TouchableOpacity style={[styles.navItem,active&&styles.navActive]} onPress={onPress}><Text style={[styles.navText,active&&styles.navTextActive]}>{label}</Text></TouchableOpacity>}
function Field(props:any){return <View style={{flex:1}}><Text style={styles.label}>{props.label}</Text><TextInput {...props} keyboardType={props.label==='Motivo da punição'?'default':'numeric'} style={styles.input} placeholderTextColor="#8a857e"/></View>}
function Mini(props:any){return <View style={styles.mini}><Text style={styles.miniLabel}>{props.label}</Text><TextInput {...props} keyboardType="numeric" style={styles.miniInput}/></View>}
const styles=StyleSheet.create({root:{marginHorizontal:spacing.md,gap:8},loading:{minHeight:100,alignItems:'center',justifyContent:'center'},message:{padding:10,color:'#166534',backgroundColor:'#effaf3',fontWeight:'800'},error:{color:'#9a3412',backgroundColor:'#fff7ed'},title:{marginTop:8,color:colors.ink,fontSize:10,fontWeight:'900',letterSpacing:1},chips:{flexDirection:'row',flexWrap:'wrap',gap:5},chip:{paddingHorizontal:9,paddingVertical:8,backgroundColor:'#eee9e1'},chipActive:{backgroundColor:colors.brandDark},chipText:{color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},chipTextActive:{color:colors.surface},nav:{flexDirection:'row',gap:1,backgroundColor:colors.line},navItem:{flex:1,minHeight:38,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface},navActive:{backgroundColor:colors.brandDark},navText:{color:colors.muted,fontSize:8,fontWeight:'900',textTransform:'uppercase'},navTextActive:{color:colors.surface},toolbar:{flexDirection:'row',alignItems:'center',gap:5,padding:8,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},meta:{color:colors.muted,fontSize:8,fontWeight:'700'},secondary:{paddingHorizontal:9,minHeight:34,alignItems:'center',justifyContent:'center',backgroundColor:'#eee9e1'},secondaryText:{color:colors.ink,fontSize:7,fontWeight:'900',textTransform:'uppercase'},primarySmall:{paddingHorizontal:9,minHeight:34,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand},primary:{minHeight:44,flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand},primaryText:{color:colors.surface,fontSize:8,fontWeight:'900',textTransform:'uppercase'},list:{gap:6},card:{gap:7,padding:9,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},teamHead:{flexDirection:'row',alignItems:'center',gap:6},copy:{flex:1},rowTitle:{color:colors.ink,fontSize:10,fontWeight:'900',textTransform:'uppercase'},columns:{flexDirection:'row',gap:5},label:{marginBottom:4,color:colors.ink,fontSize:7,fontWeight:'900',textTransform:'uppercase'},input:{minHeight:38,paddingHorizontal:8,color:colors.ink,backgroundColor:'#f2eee7',borderWidth:1,borderColor:colors.line,fontWeight:'800'},danger:{paddingHorizontal:8,paddingVertical:7,backgroundColor:'#fff1f1'},dangerText:{color:'#b42318',fontSize:7,fontWeight:'900',textTransform:'uppercase'},playerTitle:{marginTop:3,color:colors.ink,fontSize:8,fontWeight:'900'},player:{gap:4,paddingTop:6,borderTopWidth:1,borderTopColor:colors.line},playerName:{color:colors.ink,fontSize:8,fontWeight:'900'},playerFields:{flexDirection:'row',gap:4},mini:{flex:1},miniLabel:{color:colors.muted,fontSize:6,fontWeight:'900'},miniInput:{minHeight:34,paddingHorizontal:6,color:colors.ink,backgroundColor:'#f2eee7',fontSize:9,fontWeight:'800'},rank:{minHeight:54,flexDirection:'row',alignItems:'center',gap:8,padding:8,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},place:{width:30,color:colors.brand,fontSize:18,fontWeight:'900'},points:{color:colors.ink,fontSize:17,fontWeight:'900',textAlign:'right'},pointsLabel:{color:colors.muted,fontSize:6,fontWeight:'900',textAlign:'right'},empty:{padding:16,color:colors.muted,textAlign:'center',backgroundColor:colors.surface},note:{padding:10,color:colors.muted,fontSize:8,lineHeight:12,backgroundColor:'#eee9e1'}})
