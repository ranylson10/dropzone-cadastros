import { useEffect, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { externalUrl } from '@/config/env'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { colors, spacing } from '@/theme/tokens'
import { PLAYER_ROLES } from '@/lib/profileParity'
import { ProfileType, ScreenProps } from '@/types/dropzone'

type Form = { nome:string; username:string; bio:string; imagem:string; pais:string; estado:string; cidade:string; localidade:string; tag:string; id_jogo:string; funcao:string; whatsapp_url:string; nome_publico_vendas:string; papel:string; disponivel_recrutamento:boolean }
const empty:Form={nome:'',username:'',bio:'',imagem:'',pais:'',estado:'',cidade:'',localidade:'',tag:'',id_jogo:'',funcao:'',whatsapp_url:'',nome_publico_vendas:'',papel:'stream',disponivel_recrutamento:false}
const labels:Record<ProfileType,string>={jogador:'Jogador',equipe:'Equipe',produtora:'Produtora',manager:'Manager / vendedor',broadcast:'Transmissão'}

export function ProfileManagementScreen({onNavigate,onSelectPlayer,onSelectTeam}:ScreenProps){
  const auth=useAuth(),account=auth.activeAccount,type=auth.activeProfileType,data:any=account?.data||{}
  const [form,setForm]=useState<Form>(empty),[saving,setSaving]=useState(false),[uploading,setUploading]=useState(false),[feedback,setFeedback]=useState(''),[error,setError]=useState('')
  useEffect(()=>setForm({nome:String(data.nome||account?.name||''),username:String(data.username||account?.username||''),bio:String(data.bio||''),imagem:String(data.logo_url||data.avatar_url||account?.image_url||''),pais:String(data.pais||''),estado:String(data.estado||''),cidade:String(data.cidade||''),localidade:String(data.localidade||''),tag:String(data.tag||''),id_jogo:String(data.id_jogo||''),funcao:String(data.funcao||''),whatsapp_url:String(data.whatsapp_url||''),nome_publico_vendas:String(data.nome_publico_vendas||''),papel:String(data.papel||'stream'),disponivel_recrutamento:Boolean(data.disponivel_recrutamento)}),[account?.id])
  const set=(key:keyof Form)=>(value:string)=>{setForm(current=>({...current,[key]:value}));setFeedback('');setError('')}

  async function uploadPickedImage(asset:ImagePicker.ImagePickerAsset){
    if(!account||uploading)return
    setUploading(true);setError('');setFeedback('')
    try{
      const converted=await ImageManipulator.manipulateAsync(asset.uri,[{resize:{width:800}}],{compress:.86,format:ImageManipulator.SaveFormat.PNG,base64:true})
      if(!converted.base64)throw new Error('Não foi possível preparar a imagem.')
      set('imagem')(`data:image/png;base64,${converted.base64}`)
      setFeedback('Imagem pronta. Ela será enviada somente ao salvar o perfil.')
    }catch(err:any){setError(err?.message||'Não foi possível preparar a imagem.')}finally{setUploading(false)}
  }

  async function chooseFromGallery(){
    const permission=await ImagePicker.requestMediaLibraryPermissionsAsync()
    if(!permission.granted){setError('Permita o acesso às fotos para escolher uma imagem.');return}
    const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.9})
    if(result.canceled||!result.assets[0])return
    await uploadPickedImage(result.assets[0])
  }

  async function takePhoto(){
    const permission=await ImagePicker.requestCameraPermissionsAsync()
    if(!permission.granted){setError('Permita o acesso à câmera para tirar uma foto.');return}
    const result=await ImagePicker.launchCameraAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.9,cameraType:ImagePicker.CameraType.front})
    if(result.canceled||!result.assets[0])return
    await uploadPickedImage(result.assets[0])
  }

  function chooseImage(){
    if(!account||uploading)return
    Alert.alert(type==='equipe'||type==='produtora'?'Alterar logo':'Alterar foto','Escolha a origem da imagem.',[
      {text:'Câmera',onPress:()=>void takePhoto()},
      {text:'Galeria',onPress:()=>void chooseFromGallery()},
      {text:'Cancelar',style:'cancel'},
    ])
  }

  async function save(){
    if(!account||saving)return
    if(!form.nome.trim()){setError('Informe o nome do perfil.');return}
        if(form.estado.trim()&&form.estado.trim().length>2){setError('Use a sigla do estado com 2 letras.');return}
    if(type==='jogador'&&form.id_jogo.trim()&&!/^\d+$/.test(form.id_jogo.trim())){setError('O ID no jogo deve conter apenas números.');return}
    setSaving(true);setError('');setFeedback('')
    let imageUrl=form.imagem
    try{
      if(imageUrl.startsWith('data:image/')){
        const uploaded=await mobileApi.uploadProfileImage({bucket:type,entity_id:account.id,file_name:`${type}-${account.id}.png`,data_url:imageUrl},auth.session?.access_token)
        imageUrl=uploaded.url
        setForm(current=>({...current,imagem:imageUrl}))
      }
    }catch(err:any){setSaving(false);setError(err?.message||'Não foi possível enviar a imagem.');return}
    const body:any={profile_type:type,profile_id:account.id,nome:form.nome,username:form.username,bio:form.bio,pais:form.pais,estado:form.estado,cidade:form.cidade,localidade:form.localidade}
    body[type==='equipe'||type==='produtora'?'logo_url':'avatar_url']=imageUrl
    if(type==='equipe')body.tag=form.tag
    if(type==='jogador'){body.id_jogo=form.id_jogo;body.funcao=form.funcao;body.disponivel_recrutamento=form.disponivel_recrutamento}
    if(type==='manager'){body.whatsapp_url=form.whatsapp_url;body.nome_publico_vendas=form.nome_publico_vendas}
    if(type==='broadcast')body.papel=form.papel
    try{const result=await mobileApi.updateProfile(body,auth.session?.access_token);await auth.refreshAccounts();setFeedback(result.warning||'Perfil atualizado com sucesso.')}
    catch(err:any){setError(err?.message||'Não foi possível atualizar o perfil.')}finally{setSaving(false)}
  }

  function changeStatus(){
    const active=String(data.status||'ativo')!=='inativo'
    Alert.alert(active?'Desativar perfil?':'Reativar perfil?',active?'Ele deixará de aparecer publicamente. Seus dados não serão apagados.':'O perfil voltará a aparecer no sistema.',[
      {text:'Cancelar',style:'cancel'},
      {text:active?'Desativar':'Reativar',style:active?'destructive':'default',onPress:async()=>{try{setSaving(true);await mobileApi.updateProfile({profile_type:type,profile_id:account?.id,status:active?'inativo':'ativo'},auth.session?.access_token);await auth.refreshAccounts();setFeedback(active?'Perfil desativado.':'Perfil reativado.')}catch(err:any){setError(err?.message||'Não foi possível alterar o status.')}finally{setSaving(false)}}},
    ])
  }

  function openPublic(){if(!account)return;if(type==='jogador')onSelectPlayer?.(account.id);else if(type==='equipe')onSelectTeam?.(account.id)}
  const image=form.imagem.startsWith('data:image/')?form.imagem:externalUrl(form.imagem)
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><TouchableOpacity style={styles.back} onPress={()=>onNavigate('dashboard')}><Ionicons name="arrow-back" size={20} color={colors.surface}/></TouchableOpacity><View><Text style={styles.eyebrow}>GESTÃO DE PERFIL</Text><Text style={styles.title}>{labels[type]}</Text></View></View>
    <View style={styles.photoCard}>{image?<Image source={{uri:image}} style={styles.photo}/>:<View style={[styles.photo,styles.photoFallback]}><Ionicons name={type==='equipe'||type==='produtora'?'shield-outline':'person-outline'} size={34} color={colors.brand}/></View>}<View style={styles.photoCopy}><Text style={styles.blockTitle}>{type==='equipe'||type==='produtora'?'Logo do perfil':'Foto do perfil'}</Text><Text style={styles.hint}>PNG quadrado, até 5 MB.</Text><TouchableOpacity style={styles.imageButton} onPress={chooseImage} disabled={uploading}>{uploading?<ActivityIndicator size="small" color={colors.surface}/>:<><Ionicons name="camera-outline" size={16} color={colors.surface}/><Text style={styles.imageButtonText}>Câmera ou galeria</Text></>}</TouchableOpacity></View></View>
    {feedback?<Text style={styles.success}>{feedback}</Text>:null}{error?<Text style={styles.error}>{error}</Text>:null}
    <Section title="Identificação">
      <Field label="Nome público" value={form.nome} onChangeText={set('nome')} />
      {type==='equipe'?<Field label="Tag" value={form.tag} onChangeText={(value:string)=>set('tag')(value.toUpperCase())} maxLength={12} autoCapitalize="characters" placeholder="Ex.: 6B"/>:null}
      {type==='jogador'?<><Field label="ID no jogo" value={form.id_jogo} onChangeText={set('id_jogo')} keyboardType="number-pad" placeholder="ID numérico do Free Fire"/><View><Text style={styles.label}>FUNÇÃO PRINCIPAL</Text><View style={styles.options}>{PLAYER_ROLES.map(item=><TouchableOpacity key={item} style={[styles.option,form.funcao.toLowerCase()===item&&styles.optionActive]} onPress={()=>set('funcao')(item)}><Text style={[styles.optionText,form.funcao.toLowerCase()===item&&styles.optionTextActive]}>{item}</Text></TouchableOpacity>)}</View></View><TouchableOpacity style={[styles.recruitOption,form.disponivel_recrutamento&&styles.recruitOptionActive]} onPress={()=>setForm(current=>({...current,disponivel_recrutamento:!current.disponivel_recrutamento}))}><Ionicons name={form.disponivel_recrutamento?'radio-button-on':'radio-button-off'} size={18} color={form.disponivel_recrutamento?'#166534':colors.muted}/><View style={styles.recruitCopy}><Text style={styles.recruitTitle}>{form.disponivel_recrutamento?'Disponível para recrutamento':'Recrutamento desativado'}</Text><Text style={styles.recruitHint}>Equipes poderão identificar publicamente que você está procurando oportunidades.</Text></View></TouchableOpacity></>:null}
      {type==='manager'?<><Field label="Nome público de vendas" value={form.nome_publico_vendas} onChangeText={set('nome_publico_vendas')}/><Field label="WhatsApp ou link de contato" value={form.whatsapp_url} onChangeText={set('whatsapp_url')} autoCapitalize="none"/></>:null}
      {type==='broadcast'?<View><Text style={styles.label}>PAPEL NA TRANSMISSÃO</Text><View style={styles.options}>{['stream','narrador','comentarista','apresentador'].map(item=><TouchableOpacity key={item} style={[styles.option,form.papel===item&&styles.optionActive]} onPress={()=>set('papel')(item)}><Text style={[styles.optionText,form.papel===item&&styles.optionTextActive]}>{item}</Text></TouchableOpacity>)}</View></View>:null}
      <Field label="Biografia" value={form.bio} onChangeText={set('bio')} multiline maxLength={280} placeholder="Conte um pouco sobre este perfil..."/><Text style={styles.counter}>{form.bio.length}/280</Text>
    </Section>
    <Section title="Localização"><Field label="País" value={form.pais} onChangeText={set('pais')}/><View style={styles.columns}><View style={styles.column}><Field label="Estado" value={form.estado} onChangeText={set('estado')}/></View><View style={styles.column}><Field label="Cidade" value={form.cidade} onChangeText={set('cidade')}/></View></View><Field label="Localidade exibida" value={form.localidade} onChangeText={set('localidade')} placeholder="Ex.: São Paulo, Brasil"/></Section>
    <TouchableOpacity style={[styles.save,saving&&styles.disabled]} onPress={()=>void save()} disabled={saving}>{saving?<ActivityIndicator color={colors.surface}/>:<><Ionicons name="checkmark-circle-outline" size={20} color={colors.surface}/><Text style={styles.saveText}>Salvar alterações</Text></>}</TouchableOpacity>
    {(type==='jogador'||type==='equipe')?<TouchableOpacity style={styles.publicButton} onPress={openPublic}><Ionicons name="eye-outline" size={18} color={colors.ink}/><Text style={styles.publicText}>Ver perfil público</Text></TouchableOpacity>:null}
    <View style={styles.danger}><Text style={styles.dangerTitle}>Status do perfil</Text><Text style={styles.dangerText}>Desativar oculta o perfil público sem apagar histórico, campeonatos ou vínculos.</Text><TouchableOpacity style={styles.dangerButton} onPress={changeStatus} disabled={saving}><Text style={styles.dangerButtonText}>{String(data.status||'ativo')==='inativo'?'Reativar perfil':'Desativar perfil'}</Text></TouchableOpacity></View>
  </ScrollView></KeyboardAvoidingView>
}

function Section({title,children}:{title:string;children:any}){return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>}
function Field(props:any){return <View style={styles.field}><Text style={styles.label}>{props.label}</Text><View style={styles.inputWrap}>{props.prefix?<Text style={styles.prefix}>{props.prefix}</Text>:null}<TextInput {...props} style={[styles.input,props.multiline&&styles.multiline]} placeholderTextColor="#8a857e" textAlignVertical={props.multiline?'top':'center'}/></View></View>}
const styles=StyleSheet.create({sectionLabel:{color:colors.brand,fontSize:7.5,fontWeight:'900',letterSpacing:1,marginTop:3,marginBottom:1},flex:{flex:1},page:{flex:1,backgroundColor:colors.background},content:{paddingBottom:spacing.xxl},header:{minHeight:68,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:spacing.md,paddingVertical:9,backgroundColor:colors.brandDark,borderBottomWidth:2,borderBottomColor:colors.brand},back:{width:34,height:34,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.06)'},eyebrow:{color:colors.brand,fontSize:7,fontWeight:'900',letterSpacing:1.2},title:{marginTop:2,color:colors.surface,fontSize:16,fontWeight:'900',textTransform:'uppercase'},photoCard:{margin:spacing.md,marginBottom:7,flexDirection:'row',alignItems:'center',gap:10,padding:10,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:10},photo:{width:68,height:68,borderRadius:10,backgroundColor:'#ece7df'},photoFallback:{alignItems:'center',justifyContent:'center'},photoCopy:{flex:1},blockTitle:{color:colors.ink,fontSize:10.5,fontWeight:'900',textTransform:'uppercase'},hint:{marginTop:2,color:colors.muted,fontSize:8},imageButton:{alignSelf:'flex-start',marginTop:7,minHeight:32,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,borderRadius:7,backgroundColor:colors.brandDark},imageButtonText:{color:colors.surface,fontSize:7.5,fontWeight:'900',textTransform:'uppercase'},success:{marginHorizontal:spacing.md,marginBottom:7,padding:9,borderRadius:8,color:'#166534',backgroundColor:'#effaf3',fontWeight:'800'},error:{marginHorizontal:spacing.md,marginBottom:7,padding:9,borderRadius:8,color:'#9a3412',backgroundColor:'#fff7ed',fontWeight:'800'},section:{margin:spacing.md,marginBottom:0,gap:9,padding:11,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:10},sectionTitle:{color:colors.brand,fontSize:8.5,fontWeight:'900',letterSpacing:1,textTransform:'uppercase'},field:{gap:4},label:{color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},inputWrap:{minHeight:42,flexDirection:'row',alignItems:'center',backgroundColor:'#f2eee7',borderWidth:1,borderColor:'#d4cdc3',borderRadius:7},prefix:{paddingLeft:10,color:colors.muted,fontWeight:'900'},input:{flex:1,minHeight:40,paddingHorizontal:10,color:colors.ink,fontSize:11,fontWeight:'700'},multiline:{height:84,paddingTop:9},counter:{marginTop:-6,color:colors.muted,fontSize:7.5,textAlign:'right'},recruitOption:{minHeight:52,flexDirection:'row',alignItems:'center',gap:8,padding:9,borderWidth:1,borderColor:colors.line,borderRadius:8,backgroundColor:'#f2eee7'},recruitOptionActive:{borderColor:'#86b89a',backgroundColor:'#effaf3'},recruitCopy:{flex:1},recruitTitle:{color:colors.ink,fontSize:8.5,fontWeight:'900',textTransform:'uppercase'},recruitHint:{marginTop:2,color:colors.muted,fontSize:7.5,lineHeight:11},columns:{flexDirection:'row',gap:7},column:{flex:1},options:{flexDirection:'row',flexWrap:'wrap',gap:5,marginTop:4},option:{paddingHorizontal:8,paddingVertical:7,borderRadius:7,backgroundColor:'#eee9e1',borderWidth:1,borderColor:colors.line},optionActive:{backgroundColor:colors.brandDark},optionText:{color:colors.ink,fontSize:7.5,fontWeight:'900',textTransform:'uppercase'},optionTextActive:{color:colors.surface},save:{margin:spacing.md,marginBottom:7,minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,borderRadius:8,backgroundColor:colors.brand},saveText:{color:colors.surface,fontSize:9,fontWeight:'900',textTransform:'uppercase'},disabled:{opacity:.55},publicButton:{marginHorizontal:spacing.md,minHeight:40,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,borderRadius:8,borderWidth:1,borderColor:colors.ink},publicText:{color:colors.ink,fontSize:9,fontWeight:'900',textTransform:'uppercase'},danger:{margin:spacing.md,marginTop:16,padding:11,borderRadius:9,backgroundColor:'#fff7ed',borderLeftWidth:3,borderLeftColor:'#c2410c'},dangerTitle:{color:'#9a3412',fontSize:9,fontWeight:'900',textTransform:'uppercase'},dangerText:{marginTop:4,color:'#7c2d12',fontSize:9,lineHeight:14},dangerButton:{alignSelf:'flex-start',marginTop:8,paddingHorizontal:10,paddingVertical:8,borderRadius:7,borderWidth:1,borderColor:'#c2410c'},dangerButtonText:{color:'#9a3412',fontSize:8,fontWeight:'900',textTransform:'uppercase'}})
