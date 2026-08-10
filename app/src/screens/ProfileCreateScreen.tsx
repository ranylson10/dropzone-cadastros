import { useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { BROADCAST_ROLES, loginSuggestion, PLAYER_ROLES, profileLabel } from '@/lib/profileParity'
import { colors, spacing } from '@/theme/tokens'
import { ProfileType } from '@/types/dropzone'

type Form={name:string;tag:string;id_jogo:string;funcao:string;papel:string;pais:string;estado:string;cidade:string;localidade:string;image:string}
const initial:Form={name:'',tag:'',id_jogo:'',funcao:'support',papel:'stream',pais:'Brasil',estado:'',cidade:'',localidade:'',image:''}

export function ProfileCreateScreen(props:{profileType:ProfileType;onCancel:()=>void;onCreated:(profileId?:string)=>void}){
  const auth=useAuth(),type=props.profileType
  const [form,setForm]=useState<Form>(initial),[saving,setSaving]=useState(false),[preparing,setPreparing]=useState(false),[error,setError]=useState('')
  const set=(key:keyof Form)=>(value:string)=>{setForm(current=>({...current,[key]:value}));setError('')}

  async function prepare(asset:ImagePicker.ImagePickerAsset){setPreparing(true);setError('');try{const converted=await ImageManipulator.manipulateAsync(asset.uri,[{resize:{width:800}}],{compress:.86,format:ImageManipulator.SaveFormat.PNG,base64:true});if(!converted.base64)throw new Error('Não foi possível preparar a imagem.');set('image')(`data:image/png;base64,${converted.base64}`)}catch(err:any){setError(err?.message||'Não foi possível preparar a imagem.')}finally{setPreparing(false)}}
  async function gallery(){const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted)return setError('Permita o acesso às fotos.');const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.9});if(!result.canceled&&result.assets[0])await prepare(result.assets[0])}
  async function camera(){const permission=await ImagePicker.requestCameraPermissionsAsync();if(!permission.granted)return setError('Permita o acesso à câmera.');const result=await ImagePicker.launchCameraAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.9});if(!result.canceled&&result.assets[0])await prepare(result.assets[0])}
  function chooseImage(){Alert.alert(type==='equipe'||type==='produtora'?'Adicionar logo':'Adicionar foto','Escolha a origem.',[{text:'Câmera',onPress:()=>void camera()},{text:'Galeria',onPress:()=>void gallery()},{text:'Cancelar',style:'cancel'}])}

  async function submit(){
    const token=auth.session?.access_token
    if(!token||saving)return
    if(!form.name.trim())return setError('Informe o nome do perfil.')
    if(type==='equipe'&&!form.tag.trim())return setError('Informe a tag da equipe.')
    if(type==='jogador'&&!form.id_jogo.trim())return setError('Informe o ID de jogo.')
    const username=loginSuggestion(form.name)
    if(!username)return setError('Use um nome com pelo menos 3 caracteres válidos.')
    setSaving(true);setError('')
    try{
      let mediaUrl=''
      if(form.image.startsWith('data:image/')){
        const upload=await mobileApi.uploadProfileImage({bucket:type,file_name:`novo-${type}-${Date.now()}.png`,data_url:form.image,upload_intent:'create_profile'},token)
        mediaUrl=upload.url
      }
      const details:Record<string,unknown>={pais:form.pais,estado:form.estado,cidade:form.cidade,localidade:form.localidade}
      if(type==='equipe')details.tag=form.tag.trim().toUpperCase()
      if(type==='jogador'){details.id_jogo=form.id_jogo.trim();details.funcao=form.funcao}
      if(type==='broadcast')details.papel=form.papel
      const response=await mobileApi.createLinkedProfile({profile_type:type,username,name:form.name.trim(),media_url:mediaUrl,password:'',confirm_password:'',verification_code:'',details},token)
      await auth.refreshAccounts()
      props.onCreated(String(response.account?.id||''))
    }catch(err:any){setError(err?.message||'Não foi possível criar o perfil.')}finally{setSaving(false)}
  }

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><TouchableOpacity style={styles.back} onPress={props.onCancel}><Ionicons name="arrow-back" size={20} color="#fff"/></TouchableOpacity><View><Text style={styles.eyebrow}>PERFIL NECESSÁRIO</Text><Text style={styles.title}>Criar {profileLabel[type]}</Text></View></View>
    <View style={styles.photoCard}>{form.image?<Image source={{uri:form.image}} style={styles.photo}/>:<View style={[styles.photo,styles.photoFallback]}><Ionicons name={type==='equipe'||type==='produtora'?'shield-outline':'person-outline'} size={32} color={colors.muted}/></View>}<View style={{flex:1}}><Text style={styles.blockTitle}>{type==='equipe'||type==='produtora'?'Logo':'Foto'}</Text><Text style={styles.hint}>Mesmo campo usado no cadastro do site.</Text><TouchableOpacity style={styles.imageButton} onPress={chooseImage} disabled={preparing}>{preparing?<ActivityIndicator color="#fff"/>:<Text style={styles.imageButtonText}>Selecionar imagem</Text>}</TouchableOpacity></View></View>
    <View style={styles.form}>
      <Field label={type==='equipe'?'Nome da equipe':type==='jogador'?'Nick':type==='manager'?'Nome do manager':type==='broadcast'?'Nome do broadcast':'Nome da produtora'} value={form.name} onChangeText={set('name')} />
      {type==='equipe'?<Field label="Tag" value={form.tag} onChangeText={(v:string)=>set('tag')(v.toUpperCase())} maxLength={12} autoCapitalize="characters"/>:null}
      {type==='jogador'?<><Field label="ID de jogo" value={form.id_jogo} onChangeText={set('id_jogo')} keyboardType="number-pad"/><Text style={styles.label}>FUNÇÃO</Text><View style={styles.options}>{PLAYER_ROLES.map(role=><Choice key={role} label={role} active={form.funcao===role} onPress={()=>set('funcao')(role)}/>)}</View></>:null}
      {type==='broadcast'?<><Text style={styles.label}>PAPEL</Text><View style={styles.options}>{BROADCAST_ROLES.map(role=><Choice key={role} label={role} active={form.papel===role} onPress={()=>set('papel')(role)}/>)}</View></>:null}
      <Text style={styles.sectionTitle}>Localização</Text>
      <Field label="País" value={form.pais} onChangeText={set('pais')}/><View style={styles.columns}><View style={{flex:1}}><Field label="Estado" value={form.estado} onChangeText={set('estado')} maxLength={2} autoCapitalize="characters"/></View><View style={{flex:1}}><Field label="Cidade" value={form.cidade} onChangeText={set('cidade')}/></View></View><Field label="Localidade exibida" value={form.localidade} onChangeText={set('localidade')} placeholder="Ex.: Belém, Pará, Brasil"/>
      {error?<Text style={styles.error}>{error}</Text>:null}
      <TouchableOpacity style={[styles.submit,saving&&styles.disabled]} disabled={saving} onPress={()=>void submit()}>{saving?<ActivityIndicator color="#fff"/>:<><Ionicons name="checkmark-circle-outline" size={20} color="#fff"/><Text style={styles.submitText}>Criar perfil de {profileLabel[type]}</Text></>}</TouchableOpacity>
    </View>
  </ScrollView>
}
function Field(props:any){return <View style={{gap:5}}><Text style={styles.label}>{props.label}</Text><TextInput {...props} style={styles.input} placeholderTextColor="#8a857e"/></View>}
function Choice({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <TouchableOpacity style={[styles.choice,active&&styles.choiceActive]} onPress={onPress}><Text style={[styles.choiceText,active&&styles.choiceTextActive]}>{label}</Text></TouchableOpacity>}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:colors.background},content:{paddingBottom:spacing.xxl},header:{minHeight:90,flexDirection:'row',alignItems:'center',gap:12,padding:spacing.md,backgroundColor:colors.brandDark,borderBottomWidth:3,borderBottomColor:colors.brand},back:{width:40,height:40,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'rgba(255,255,255,.2)'},eyebrow:{color:colors.brand,fontSize:8,fontWeight:'900',letterSpacing:1.3},title:{marginTop:3,color:'#fff',fontSize:20,fontWeight:'900',textTransform:'uppercase'},photoCard:{margin:spacing.md,marginBottom:0,flexDirection:'row',gap:12,alignItems:'center',padding:12,backgroundColor:'#fff',borderWidth:1,borderColor:colors.line},photo:{width:82,height:82,borderRadius:8,backgroundColor:'#eee9e1'},photoFallback:{alignItems:'center',justifyContent:'center'},blockTitle:{color:colors.ink,fontSize:12,fontWeight:'900',textTransform:'uppercase'},hint:{marginTop:3,color:colors.muted,fontSize:8},imageButton:{alignSelf:'flex-start',marginTop:8,minHeight:34,paddingHorizontal:10,alignItems:'center',justifyContent:'center',backgroundColor:colors.brandDark},imageButtonText:{color:'#fff',fontSize:8,fontWeight:'900',textTransform:'uppercase'},form:{margin:spacing.md,gap:10,padding:13,backgroundColor:'#fff',borderWidth:1,borderColor:colors.line},label:{color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},input:{minHeight:44,paddingHorizontal:11,color:colors.ink,backgroundColor:'#f2eee7',borderWidth:1,borderColor:colors.line,fontSize:12,fontWeight:'700'},sectionTitle:{marginTop:6,color:colors.brand,fontSize:9,fontWeight:'900',letterSpacing:1,textTransform:'uppercase'},columns:{flexDirection:'row',gap:8},options:{flexDirection:'row',flexWrap:'wrap',gap:5},choice:{paddingHorizontal:10,paddingVertical:8,backgroundColor:'#eee9e1'},choiceActive:{backgroundColor:colors.brandDark},choiceText:{color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},choiceTextActive:{color:'#fff'},error:{padding:10,color:'#9a3412',backgroundColor:'#fff7ed',fontSize:10,fontWeight:'800'},submit:{minHeight:50,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:colors.brand},submitText:{color:'#fff',fontSize:10,fontWeight:'900',textTransform:'uppercase'},disabled:{opacity:.55}})
