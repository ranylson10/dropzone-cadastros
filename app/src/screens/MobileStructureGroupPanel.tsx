import {useEffect,useRef,useState} from 'react'
import {ActivityIndicator,Alert,StyleSheet,Text,TextInput,TouchableOpacity,View} from 'react-native'
import {useMobileLifecycleScope} from '../hooks/useMobileLifecycleScope'
import {discardMobileGroup,mobileGroupAttempts,readMobileGroupBoard,retryMobileGroup,writeMobileGroup,type MobileGroupAttempt} from '../lib/structure-group-write'
import {colors} from '../theme/tokens'
type Board=Awaited<ReturnType<typeof readMobileGroupBoard>>
type State={key:string;board:Board|null;pending:MobileGroupAttempt|null;ready:boolean;busy:boolean;error:string;feedback:string;name:string;slots:string;phase:string}
const empty=(key:string):State=>({key,board:null,pending:null,ready:false,busy:false,error:'',feedback:'',name:'Grupo A',slots:'12',phase:''})
export function MobileStructureGroupPanel({championshipId}:{championshipId:string}){
 const scope=useMobileLifecycleScope(championshipId),lease=useRef<number|null>(null),dialog=useRef<object|null>(null)
 const [state,setState]=useState<State>(()=>empty('')),latest=useRef(state);latest.current=state
 const visible=state.key===scope.key?state:empty(scope.key)
 const current=()=>{if(!scope.actor||!scope.isCurrent())throw Error('A conta ou o campeonato mudou. Consulte a tentativa anterior.')}
 useEffect(()=>{if(!scope.actor)return;let alive=true;const controller=new AbortController();void(async()=>{
  const [board,pending]=await Promise.allSettled([readMobileGroupBoard(championshipId,scope.actor!,current,controller.signal),mobileGroupAttempts.read(scope.actor!,championshipId)])
  if(alive&&scope.isCurrent())setState({...empty(scope.key),board:board.status==='fulfilled'?board.value:null,pending:pending.status==='fulfilled'?pending.value:null,ready:pending.status==='fulfilled',phase:board.status==='fulfilled'?board.value.phases.find((row:any)=>row.tipo==='normal')?.id||'':'',error:pending.status==='rejected'?message(pending.reason):board.status==='rejected'?message(board.reason):''})
 })();return()=>{alive=false;controller.abort()}},[scope.key,championshipId])
 async function run(work:()=>Promise<void>){current();if(!visible.ready||lease.current===scope.epoch)return;lease.current=scope.epoch;setState(previous=>({...previous,key:scope.key,busy:true,error:''}));try{await work()}catch(error){if(scope.isCurrent())setState(previous=>({...previous,error:message(error)}))}finally{
  if(scope.isCurrent())try{const pending=await mobileGroupAttempts.read(scope.actor!,championshipId);if(scope.isCurrent())setState(previous=>({...previous,pending,busy:false}))}catch(error){if(scope.isCurrent())setState(previous=>({...previous,ready:false,busy:false,error:message(error)}))}
  if(lease.current===scope.epoch)lease.current=null
 }}
 async function confirmed(retry?:MobileGroupAttempt){await run(async()=>{
  if(retry)await retryMobileGroup(championshipId,scope.actor!,retry,current)
  else await writeMobileGroup(championshipId,scope.actor!,visible.board!.contract,{nome:visible.name,fase_id:visible.phase,slots:Number(visible.slots),whatsapp_url:null},current)
  current();setState(previous=>({...previous,feedback:'Grupo e slots confirmados.'}))
  try{const board=await readMobileGroupBoard(championshipId,scope.actor!,current);if(scope.isCurrent())setState(previous=>({...previous,board}))}catch(error){if(scope.isCurrent())setState(previous=>({...previous,error:'Grupo e slots confirmados. Não foi possível atualizar a estrutura: '+message(error)}))}
 })}
 function create(){if(visible.busy||visible.pending||!available||!scope.isCurrent()||latest.current.key!==scope.key||latest.current.busy||latest.current.pending)return
  const token={};dialog.current=token;Alert.alert('Criar grupo?',`${visible.name.trim()} · ${visible.slots} slots. A criação usa a capacidade atual da fase.`,[{text:'Cancelar',style:'cancel'},{text:'Criar grupo',onPress:()=>{if(dialog.current!==token)return;dialog.current=null;if(scope.isCurrent())void confirmed()}}])
 }
 function discard(){const pending=visible.pending;if(!pending||visible.busy||!scope.isCurrent())return;const token={};dialog.current=token;Alert.alert('Encerrar tentativa local?','O grupo pode já ter sido criado. Isso remove somente a tentativa deste aparelho; não exclui o grupo.',[{text:'Cancelar',style:'cancel'},{text:'Encerrar tentativa local',style:'destructive',onPress:()=>{if(dialog.current!==token)return;dialog.current=null;if(scope.isCurrent())void run(async()=>{await readMobileGroupBoard(championshipId,scope.actor!,current);await discardMobileGroup(championshipId,scope.actor!,pending,current);current();setState(previous=>({...previous,feedback:'Tentativa local encerrada.'}))})}}])}
 const available=visible.ready&&visible.board?.contract.structure_group_write_mode==='atomic',disabled=visible.busy||!available||!!visible.pending
 const field=(label:string,value:string,patch:'name'|'slots')=><View><Text style={styles.text}>{label}</Text><TextInput accessibilityLabel={label} value={value} editable={!disabled} onChangeText={value=>setState(previous=>({...previous,[patch]:value}))} style={styles.input} keyboardType={patch==='slots'?'number-pad':'default'}/></View>
 return <View style={styles.root}><Text style={styles.title}>NOVO GRUPO</Text>
  {visible.error?<Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text>:null}{visible.feedback?<Text style={styles.feedback}>{visible.feedback}</Text>:null}{visible.busy?<ActivityIndicator/>:null}
  {!available?<Text style={styles.text}>Criação de grupo temporariamente indisponível.</Text>:null}
  <Text style={styles.text}>A Grande Final usa o grupo criado automaticamente. Grupos manuais ficam nas demais fases.</Text>
  {field('Nome do grupo',visible.name,'name')}{field('Quantidade de slots',visible.slots,'slots')}
  {visible.board?.phases.filter(row=>row.tipo==='normal').map(row=><Button key={row.id} label={row.nome} disabled={disabled} onPress={()=>setState(previous=>({...previous,phase:row.id}))} selected={visible.phase===row.id}/>)}
  <Button label="Criar grupo" disabled={disabled||!visible.name.trim()||!visible.phase||!Number.isInteger(Number(visible.slots))||Number(visible.slots)<1||Number(visible.slots)>52} onPress={create}/>
  {visible.pending?<View><Text style={styles.text}>Há uma criação pendente neste aparelho. Repita a intenção original para conferir o resultado.</Text><Button label="Repetir criação original" disabled={visible.busy||!visible.ready} onPress={()=>{if(scope.isCurrent())void confirmed(visible.pending!)}}/><Button label="Encerrar tentativa local de grupo" disabled={visible.busy||!visible.ready} onPress={discard}/></View>:null}
 </View>
}
function message(error:unknown){return error instanceof Error?error.message:'Não foi possível confirmar o grupo.'}
function Button({label,disabled,onPress,selected=false}:{label:string;disabled:boolean;onPress:()=>void;selected?:boolean}){return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled,selected}} disabled={disabled} onPress={onPress} style={[styles.button,disabled&&{opacity:0.5}]}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>}
const styles=StyleSheet.create({root:{gap:10,padding:12,backgroundColor:colors.surface},title:{color:colors.ink,fontSize:14,fontWeight:'900'},text:{color:colors.muted,fontSize:12},error:{color:colors.danger,fontSize:12},feedback:{color:colors.success,fontSize:12},input:{minHeight:44,color:colors.ink,fontSize:14,borderWidth:1,borderColor:colors.line,padding:10},button:{minHeight:44,padding:12,backgroundColor:colors.brand,marginTop:8},buttonText:{color:colors.onBrand,fontSize:12,fontWeight:'700'}})
