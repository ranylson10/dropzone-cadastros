import { useCallback, useEffect, useMemo, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { colors, spacing } from '@/theme/tokens'

type Props={championshipId:string;token?:string|null}
type PrizeType='colocacao'|'mvp'|'outro'

const money=(value:any)=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})

export function ChampionshipFinalizationPanel({championshipId,token}:Props){
  const [structure,setStructure]=useState<any>(null)
  const [ranking,setRanking]=useState<any[]>([])
  const [mvp,setMvp]=useState<any[]>([])
  const [stageId,setStageId]=useState('')
  const [type,setType]=useState<PrizeType>('colocacao')
  const [position,setPosition]=useState('1')
  const [title,setTitle]=useState('')
  const [value,setValue]=useState('')
  const [description,setDescription]=useState('')
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [feedback,setFeedback]=useState('')

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const [advanced,teams,players]=await Promise.all([
        mobileApi.championshipAdvancedStructure(championshipId,token),
        mobileApi.championshipFinalTeams(championshipId),
        mobileApi.championshipFinalMvp(championshipId),
      ])
      setStructure(advanced)
      setRanking(Array.isArray(teams?.equipes)?teams.equipes:[])
      setMvp(Array.isArray(players?.jogadores)?players.jogadores:[])
      const stages=Array.isArray(advanced?.stages)?advanced.stages:[]
      setStageId(current=>current&&stages.some((row:any)=>String(row.id)===current)?current:String(stages[stages.length-1]?.id||''))
      setError('')
    }catch(err:any){setError(err?.message||'Não foi possível carregar o encerramento do campeonato.')}
    finally{setLoading(false)}
  },[championshipId,token])

  useEffect(()=>{void load()},[load])

  const prizes=useMemo(()=>Array.isArray(structure?.prizes)?structure.prizes.filter((row:any)=>!stageId||String(row.etapa_id)===stageId):[],[structure,stageId])
  const editionStatus=String(structure?.edition?.status||'sem edição')
  const isPublished=editionStatus==='encerrada'

  async function action(body:Record<string,unknown>,message:string){
    setBusy(true);setError('');setFeedback('')
    try{const response=await mobileApi.championshipAdvancedAction(championshipId,body,token);setStructure(response);setFeedback(message);await load()}
    catch(err:any){setError(err?.message||'Não foi possível concluir a ação.')}
    finally{setBusy(false)}
  }

  async function createPrize(){
    if(!stageId){setError('Selecione uma etapa para registrar a premiação.');return}
    if(type==='colocacao'&&(!Number.isInteger(Number(position))||Number(position)<1)){setError('Informe uma colocação válida.');return}
    await action({action:'create_prize',stage_id:stageId,prize_type:type,position:type==='colocacao'?Number(position):null,title:title.trim()||null,value:value===''?null:Number(value),description:description.trim()||null},'Premiação registrada.')
    setTitle('');setValue('');setDescription('')
  }

  function removePrize(id:string){Alert.alert('Excluir premiação?','Este item será removido da etapa.',[{text:'Cancelar',style:'cancel'},{text:'Excluir',style:'destructive',onPress:()=>void action({action:'delete',table:'campeonato_etapa_premiacoes',row_id:id},'Premiação removida.')}])}
  function publish(){Alert.alert('Publicar resultado final?','O sistema só encerra se todas as quedas estiverem finalizadas. A edição, etapas e divisões serão marcadas como encerradas, mas o campeonato continuará público para consulta.',[{text:'Cancelar',style:'cancel'},{text:'Publicar final',onPress:()=>void action({action:'publish_final'},'Resultado final publicado.')}])}
  function reopen(){Alert.alert('Reabrir campeonato?','A edição, etapas e divisões encerradas voltarão ao estado ativo. As quedas não serão reabertas automaticamente.',[{text:'Cancelar',style:'cancel'},{text:'Reabrir',onPress:()=>void action({action:'reopen_final'},'Encerramento reaberto.')}])}

  if(loading&&!structure)return <View style={styles.loading}><ActivityIndicator color={colors.brand}/></View>
  return <View style={styles.root}>
    {error?<Text style={[styles.message,styles.error]}>{error}</Text>:null}{feedback?<Text style={styles.message}>{feedback}</Text>:null}
    <View style={styles.statusCard}><View style={{flex:1}}><Text style={styles.eyebrow}>PUBLICAÇÃO FINAL</Text><Text style={styles.statusTitle}>{isPublished?'RESULTADO PUBLICADO':'EM PREPARAÇÃO'}</Text><Text style={styles.meta}>Edição: {editionStatus}</Text></View><Ionicons name={isPublished?'checkmark-circle':'flag-outline'} size={28} color={isPublished?'#166534':colors.brand}/></View>

    <Text style={styles.title}>CLASSIFICAÇÃO FINAL</Text>
    <View style={styles.list}>{ranking.slice(0,12).map((row:any,index:number)=><View key={row.campeonato_equipe_id||row.equipe_id||index} style={styles.rank}><Text style={styles.place}>{row.colocacao||index+1}</Text><View style={{flex:1}}><Text style={styles.rowTitle}>{row.equipe_nome||row.line_nome||row.nome||'Equipe'}</Text><Text style={styles.meta}>{row.booyahs||0} BOOYAH · {row.abates||0} KILLS</Text></View><Text style={styles.points}>{Number(row.pontos_total||0)} PTS</Text></View>)}</View>

    <Text style={styles.title}>MVP</Text>
    <View style={styles.list}>{mvp.slice(0,5).map((row:any,index:number)=><View key={row.campeonato_jogador_id||row.jogador_id||index} style={styles.rank}><Text style={styles.place}>{row.colocacao||index+1}</Text><View style={{flex:1}}><Text style={styles.rowTitle}>{row.nick||'Jogador'}</Text><Text style={styles.meta}>{row.abates||0} K · {row.dano||0} DMG · {row.assistencias||0} AST · {row.revives||0} REV</Text></View></View>)}</View>

    <Text style={styles.title}>PREMIAÇÕES POR ETAPA</Text>
    <View style={styles.chips}>{(structure?.stages||[]).map((stage:any)=><TouchableOpacity key={stage.id} style={[styles.chip,stageId===String(stage.id)&&styles.chipActive]} onPress={()=>setStageId(String(stage.id))}><Text style={[styles.chipText,stageId===String(stage.id)&&styles.chipTextActive]}>{stage.nome}</Text></TouchableOpacity>)}</View>
    {stageId?<View style={styles.form}><View style={styles.chips}>{(['colocacao','mvp','outro'] as PrizeType[]).map(item=><TouchableOpacity key={item} style={[styles.chip,type===item&&styles.chipActive]} onPress={()=>setType(item)}><Text style={[styles.chipText,type===item&&styles.chipTextActive]}>{item}</Text></TouchableOpacity>)}</View>{type==='colocacao'?<Field label="Posição" value={position} onChangeText={setPosition} numeric/>:null}<Field label="Título" value={title} onChangeText={setTitle}/><Field label="Valor" value={value} onChangeText={setValue} numeric/><Field label="Descrição" value={description} onChangeText={setDescription}/><TouchableOpacity style={styles.primary} disabled={busy} onPress={()=>void createPrize()}>{busy?<ActivityIndicator color={colors.surface}/>:<><Ionicons name="gift-outline" size={17} color={colors.surface}/><Text style={styles.primaryText}>Adicionar premiação</Text></>}</TouchableOpacity></View>:<Text style={styles.empty}>Cadastre uma edição/etapa na estrutura avançada para usar premiações detalhadas.</Text>}
    <View style={styles.list}>{prizes.map((prize:any)=><View key={prize.id} style={styles.prize}><View style={{flex:1}}><Text style={styles.rowTitle}>{prize.tipo==='colocacao'?`${prize.posicao}º lugar`:String(prize.tipo||'prêmio').toUpperCase()} {prize.titulo?`· ${prize.titulo}`:''}</Text><Text style={styles.meta}>{prize.valor!=null?money(prize.valor):'Sem valor definido'}{prize.descricao?` · ${prize.descricao}`:''}</Text></View><TouchableOpacity style={styles.danger} onPress={()=>removePrize(String(prize.id))}><Ionicons name="trash-outline" size={16} color="#b42318"/></TouchableOpacity></View>)}</View>

    <View style={styles.finalBox}><Text style={styles.finalTitle}>ENCERRAMENTO</Text><Text style={styles.note}>Publicar o final exige todas as quedas finalizadas. A ação encerra a edição, etapas e divisões e grava a publicação no metadata da edição. O status principal do campeonato não é alterado, preservando a consulta pública e o ranking histórico.</Text>{isPublished?<TouchableOpacity style={styles.secondary} disabled={busy} onPress={reopen}><Text style={styles.secondaryText}>Reabrir encerramento</Text></TouchableOpacity>:<TouchableOpacity style={styles.primary} disabled={busy} onPress={publish}><Ionicons name="flag" size={17} color={colors.surface}/><Text style={styles.primaryText}>Publicar resultado final</Text></TouchableOpacity>}</View>
  </View>
}

function Field({label,value,onChangeText,numeric=false}:{label:string;value:string;onChangeText:(value:string)=>void;numeric?:boolean}){return <View><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={numeric?'numeric':'default'} style={styles.input} placeholderTextColor="#8a857e"/></View>}

const styles=StyleSheet.create({root:{marginHorizontal:spacing.md,gap:8},loading:{minHeight:100,alignItems:'center',justifyContent:'center'},message:{padding:10,color:'#166534',backgroundColor:'#effaf3',fontWeight:'800'},error:{color:'#9a3412',backgroundColor:'#fff7ed'},statusCard:{flexDirection:'row',alignItems:'center',gap:10,padding:12,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},eyebrow:{color:colors.brand,fontSize:7,fontWeight:'900',letterSpacing:1},statusTitle:{color:colors.ink,fontSize:15,fontWeight:'900'},title:{marginTop:8,color:colors.ink,fontSize:10,fontWeight:'900',letterSpacing:1},meta:{color:colors.muted,fontSize:8,fontWeight:'700'},list:{gap:6},rank:{minHeight:50,flexDirection:'row',alignItems:'center',gap:8,padding:8,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},place:{width:30,color:colors.brand,fontSize:18,fontWeight:'900'},rowTitle:{color:colors.ink,fontSize:9,fontWeight:'900',textTransform:'uppercase'},points:{color:colors.ink,fontSize:11,fontWeight:'900'},chips:{flexDirection:'row',flexWrap:'wrap',gap:5},chip:{paddingHorizontal:9,paddingVertical:8,backgroundColor:'#eee9e1'},chipActive:{backgroundColor:colors.brandDark},chipText:{color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},chipTextActive:{color:colors.surface},form:{gap:7,padding:9,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},label:{marginBottom:4,color:colors.ink,fontSize:7,fontWeight:'900',textTransform:'uppercase'},input:{minHeight:38,paddingHorizontal:8,color:colors.ink,backgroundColor:'#f2eee7',borderWidth:1,borderColor:colors.line,fontWeight:'800'},primary:{minHeight:44,flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand},primaryText:{color:colors.surface,fontSize:8,fontWeight:'900',textTransform:'uppercase'},secondary:{minHeight:44,alignItems:'center',justifyContent:'center',backgroundColor:'#eee9e1'},secondaryText:{color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},prize:{flexDirection:'row',alignItems:'center',gap:8,padding:9,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},danger:{width:34,height:34,alignItems:'center',justifyContent:'center',backgroundColor:'#fff1f1'},empty:{padding:12,color:colors.muted,fontSize:8,textAlign:'center',backgroundColor:colors.surface},finalBox:{gap:8,padding:11,backgroundColor:colors.brandDark},finalTitle:{color:colors.surface,fontSize:11,fontWeight:'900'},note:{color:'#d7d4cf',fontSize:8,lineHeight:12}})
