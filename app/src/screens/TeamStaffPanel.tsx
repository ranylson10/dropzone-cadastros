import { useCallback, useEffect, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { externalUrl } from '@/config/env'
import { mobileApi } from '@/lib/api'
import { colors, spacing } from '@/theme/tokens'

type Permissions={
  pode_ver:boolean
  pode_editar:boolean
  pode_escalar:boolean
  pode_gerar_token:boolean
}

const defaultPermissions:Permissions={
  pode_ver:true,
  pode_editar:false,
  pode_escalar:false,
  pode_gerar_token:false,
}

export function TeamStaffPanel({teamId,accessToken,isOwner}:{teamId:string;accessToken?:string|null;isOwner:boolean}){
  const [staff,setStaff]=useState<any[]>([])
  const [invites,setInvites]=useState<any[]>([])
  const [query,setQuery]=useState('')
  const [message,setMessage]=useState('')
  const [validDays,setValidDays]=useState('7')
  const [permissions,setPermissions]=useState<Permissions>(defaultPermissions)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [feedback,setFeedback]=useState('')
  const [error,setError]=useState('')

  const load=useCallback(async()=>{
    if(!accessToken||!teamId)return
    setLoading(true);setError('')
    try{
      const response=await mobileApi.teamStaff(teamId,accessToken)
      setStaff(Array.isArray(response.staff)?response.staff:[])
      setInvites(Array.isArray(response.convites)?response.convites:[])
    }catch(err:any){
      setError(err?.message||'Não foi possível carregar a staff.')
    }finally{setLoading(false)}
  },[accessToken,teamId])

  useEffect(()=>{void load()},[load])

  function toggle(key:keyof Permissions){
    setPermissions(current=>({...current,[key]:key==='pode_ver'?true:!current[key]}))
  }

  async function invite(){
    if(!query.trim()||saving)return
    setSaving(true);setError('');setFeedback('')
    try{
      const response=await mobileApi.inviteTeamStaff(teamId,{
        manager_username:query.trim(),
        mensagem:message.trim()||undefined,
        validade_dias:Math.max(1,Math.min(30,Number(validDays)||7)),
        ...permissions,
      },accessToken)
      setQuery('');setMessage('');setValidDays('7');setPermissions(defaultPermissions)
      setFeedback(response?.mensagem||'Convite enviado.')
      await load()
    }catch(err:any){setError(err?.message||'Não foi possível enviar o convite.')}
    finally{setSaving(false)}
  }

  async function savePermissions(item:any,next:Permissions){
    setSaving(true);setError('');setFeedback('')
    try{
      await mobileApi.updateTeamStaff(teamId,{manager_id:item.manager_id,...next},accessToken)
      setFeedback('Permissões atualizadas.')
      await load()
    }catch(err:any){setError(err?.message||'Não foi possível atualizar as permissões.')}
    finally{setSaving(false)}
  }

  function remove(item:any){
    const name=item.manager?.nome||item.manager?.username||'este manager'
    Alert.alert('Remover da staff?',`${name} perderá o acesso à equipe.`,[
      {text:'Cancelar',style:'cancel'},
      {text:'Remover',style:'destructive',onPress:()=>void (async()=>{
        setSaving(true);setError('');setFeedback('')
        try{
          await mobileApi.removeTeamStaff(teamId,String(item.manager_id),accessToken)
          setFeedback('Manager removido da staff.')
          await load()
        }catch(err:any){setError(err?.message||'Não foi possível remover o manager.')}
        finally{setSaving(false)}
      })()},
    ])
  }

  function cancelInvite(item:any){
    Alert.alert('Cancelar convite?','O convite pendente deixará de poder ser aceito.',[
      {text:'Manter',style:'cancel'},
      {text:'Cancelar convite',style:'destructive',onPress:()=>void (async()=>{
        setSaving(true);setError('');setFeedback('')
        try{
          await mobileApi.cancelTeamStaffInvite(teamId,String(item.id),accessToken)
          setFeedback('Convite cancelado.')
          await load()
        }catch(err:any){setError(err?.message||'Não foi possível cancelar o convite.')}
        finally{setSaving(false)}
      })()},
    ])
  }

  if(loading)return <View style={styles.loading}><ActivityIndicator color={colors.brand}/><Text style={styles.muted}>Carregando staff...</Text></View>

  return <View style={styles.wrap}>
    {feedback?<Text style={styles.success}>{feedback}</Text>:null}
    {error?<Text style={styles.error}>{error}</Text>:null}

    {isOwner?<View style={styles.card}>
      <Text style={styles.eyebrow}>CONVIDAR MANAGER</Text>
      <Text style={styles.title}>Adicionar à staff</Text>
      <Text style={styles.hint}>Busque pelo @username ou ID público do manager. O convite chega pela central de notificações.</Text>
      <TextInput value={query} onChangeText={setQuery} style={styles.input} autoCapitalize="none" placeholder="@username ou ID público" placeholderTextColor={colors.muted}/>
      <TextInput value={message} onChangeText={setMessage} style={[styles.input,styles.message]} multiline maxLength={500} placeholder="Mensagem opcional" placeholderTextColor={colors.muted}/>
      <View style={styles.daysRow}><Text style={styles.label}>VALIDADE (DIAS)</Text><TextInput value={validDays} onChangeText={setValidDays} keyboardType="number-pad" style={styles.daysInput} maxLength={2}/></View>
      <Text style={styles.label}>PERMISSÕES</Text>
      <Permission label="Ver equipe" active={permissions.pode_ver} locked onPress={()=>{}}/>
      <Permission label="Editar equipe e lines" active={permissions.pode_editar} onPress={()=>toggle('pode_editar')}/>
      <Permission label="Gerenciar escalações" active={permissions.pode_escalar} onPress={()=>toggle('pode_escalar')}/>
      <Permission label="Gerar tokens e convites" active={permissions.pode_gerar_token} onPress={()=>toggle('pode_gerar_token')}/>
      <TouchableOpacity disabled={saving||!query.trim()} style={[styles.primary,(saving||!query.trim())&&styles.disabled]} onPress={()=>void invite()}>
        {saving?<ActivityIndicator color="#fff"/>:<><Ionicons name="paper-plane-outline" size={17} color="#fff"/><Text style={styles.primaryText}>Enviar convite</Text></>}
      </TouchableOpacity>
    </View>:<View style={styles.readOnly}><Ionicons name="information-circle-outline" size={18} color={colors.brand}/><Text style={styles.readOnlyText}>Somente o dono da equipe pode convidar, remover ou alterar permissões da staff.</Text></View>}

    <View style={styles.card}>
      <Text style={styles.eyebrow}>STAFF ATIVA</Text>
      <Text style={styles.title}>{staff.length} {staff.length===1?'membro':'membros'}</Text>
      {!staff.length?<Text style={styles.empty}>Nenhum manager adicional na staff.</Text>:staff.map(item=><StaffRow key={item.id} item={item} isOwner={isOwner} disabled={saving} onSave={next=>void savePermissions(item,next)} onRemove={()=>remove(item)}/>)}
    </View>

    {isOwner?<View style={styles.card}>
      <Text style={styles.eyebrow}>CONVITES PENDENTES</Text>
      <Text style={styles.title}>{invites.length} {invites.length===1?'convite':'convites'}</Text>
      {!invites.length?<Text style={styles.empty}>Nenhum convite pendente.</Text>:invites.map(item=><View key={item.id} style={styles.inviteRow}>
        <Avatar source={item.manager}/>
        <View style={styles.copy}><Text style={styles.name}>{item.manager?.nome||item.manager_username||'Manager'}</Text><Text style={styles.meta}>@{item.manager?.username||item.manager_username||'manager'} · aguardando resposta</Text></View>
        <TouchableOpacity style={styles.iconDanger} onPress={()=>cancelInvite(item)} disabled={saving}><Ionicons name="close-outline" size={19} color="#9a3412"/></TouchableOpacity>
      </View>)}
    </View>:null}
  </View>
}

function StaffRow({item,isOwner,disabled,onSave,onRemove}:{item:any;isOwner:boolean;disabled:boolean;onSave:(next:Permissions)=>void;onRemove:()=>void}){
  const current:Permissions={
    pode_ver:item.pode_ver!==false,
    pode_editar:Boolean(item.pode_editar),
    pode_escalar:Boolean(item.pode_escalar),
    pode_gerar_token:Boolean(item.pode_gerar_token),
  }
  const [draft,setDraft]=useState<Permissions>(current)
  useEffect(()=>setDraft(current),[item.pode_ver,item.pode_editar,item.pode_escalar,item.pode_gerar_token])
  const dirty=JSON.stringify(draft)!==JSON.stringify(current)
  return <View style={styles.staffRow}>
    <View style={styles.personRow}><Avatar source={item.manager}/><View style={styles.copy}><Text style={styles.name}>{item.manager?.nome||item.manager?.username||'Manager'}</Text><Text style={styles.meta}>@{item.manager?.username||'manager'}</Text></View>{isOwner?<TouchableOpacity style={styles.iconDanger} onPress={onRemove} disabled={disabled}><Ionicons name="trash-outline" size={17} color="#9a3412"/></TouchableOpacity>:null}</View>
    <View style={styles.permissions}>
      <Permission label="Ver" active={draft.pode_ver} locked onPress={()=>{}}/>
      <Permission label="Editar" active={draft.pode_editar} disabled={!isOwner} onPress={()=>setDraft(v=>({...v,pode_editar:!v.pode_editar}))}/>
      <Permission label="Escalar" active={draft.pode_escalar} disabled={!isOwner} onPress={()=>setDraft(v=>({...v,pode_escalar:!v.pode_escalar}))}/>
      <Permission label="Tokens" active={draft.pode_gerar_token} disabled={!isOwner} onPress={()=>setDraft(v=>({...v,pode_gerar_token:!v.pode_gerar_token}))}/>
    </View>
    {isOwner&&dirty?<TouchableOpacity style={styles.saveSmall} disabled={disabled} onPress={()=>onSave(draft)}><Text style={styles.saveSmallText}>Salvar permissões</Text></TouchableOpacity>:null}
  </View>
}

function Permission({label,active,onPress,locked=false,disabled=false}:{label:string;active:boolean;onPress:()=>void;locked?:boolean;disabled?:boolean}){
  return <TouchableOpacity disabled={locked||disabled} onPress={onPress} style={[styles.permission,active&&styles.permissionActive,(locked||disabled)&&styles.permissionDisabled]}>
    <Ionicons name={active?'checkmark-circle':'ellipse-outline'} size={15} color={active?'#166534':colors.muted}/>
    <Text style={[styles.permissionText,active&&styles.permissionTextActive]}>{label}</Text>
  </TouchableOpacity>
}

function Avatar({source}:{source:any}){
  const uri=source?.avatar_url?externalUrl(source.avatar_url):''
  if(uri)return <Image source={{uri}} style={styles.avatar}/>
  return <View style={[styles.avatar,styles.avatarFallback]}><Text style={styles.avatarText}>{String(source?.nome||source?.username||'M').slice(0,1).toUpperCase()}</Text></View>
}

const styles=StyleSheet.create({
  wrap:{gap:spacing.md},
  loading:{minHeight:120,alignItems:'center',justifyContent:'center',gap:8},
  muted:{color:colors.muted,fontSize:10,fontWeight:'700'},
  card:{padding:13,gap:9,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},
  eyebrow:{color:colors.brand,fontSize:8,fontWeight:'900',letterSpacing:1.3},
  title:{color:colors.ink,fontSize:15,fontWeight:'900',textTransform:'uppercase'},
  hint:{color:colors.muted,fontSize:9,lineHeight:14},
  label:{color:colors.ink,fontSize:8,fontWeight:'900',letterSpacing:.8},
  input:{minHeight:43,paddingHorizontal:10,color:colors.ink,backgroundColor:'#f2eee7',borderWidth:1,borderColor:colors.line,fontSize:11,fontWeight:'700'},
  message:{minHeight:72,paddingTop:10,textAlignVertical:'top'},
  daysRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  daysInput:{width:64,minHeight:38,textAlign:'center',color:colors.ink,backgroundColor:'#f2eee7',borderWidth:1,borderColor:colors.line,fontWeight:'900'},
  primary:{minHeight:47,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,backgroundColor:colors.brand},
  primaryText:{color:'#fff',fontSize:10,fontWeight:'900',textTransform:'uppercase'},
  disabled:{opacity:.5},
  success:{padding:10,color:'#166534',backgroundColor:'#effaf3',fontSize:9,fontWeight:'800'},
  error:{padding:10,color:'#9a3412',backgroundColor:'#fff7ed',fontSize:9,fontWeight:'800'},
  readOnly:{flexDirection:'row',gap:8,padding:10,backgroundColor:'#e9e3d9'},
  readOnlyText:{flex:1,color:colors.ink,fontSize:9,lineHeight:14,fontWeight:'700'},
  empty:{color:colors.muted,fontSize:9,paddingVertical:5},
  staffRow:{gap:8,paddingVertical:10,borderTopWidth:1,borderTopColor:colors.line},
  personRow:{flexDirection:'row',alignItems:'center',gap:9},
  inviteRow:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:8,borderTopWidth:1,borderTopColor:colors.line},
  avatar:{width:38,height:38,borderRadius:19,backgroundColor:'#e8e2d9'},
  avatarFallback:{alignItems:'center',justifyContent:'center'},
  avatarText:{color:colors.brandDark,fontSize:13,fontWeight:'900'},
  copy:{flex:1},name:{color:colors.ink,fontSize:10,fontWeight:'900'},meta:{marginTop:2,color:colors.muted,fontSize:8},
  permissions:{flexDirection:'row',flexWrap:'wrap',gap:5},
  permission:{minHeight:31,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,backgroundColor:'#eee9e1',borderWidth:1,borderColor:colors.line},
  permissionActive:{backgroundColor:'#effaf3',borderColor:'#9bc7aa'},
  permissionDisabled:{opacity:.7},
  permissionText:{color:colors.muted,fontSize:7,fontWeight:'900',textTransform:'uppercase'},
  permissionTextActive:{color:'#166534'},
  saveSmall:{alignSelf:'flex-start',paddingHorizontal:10,paddingVertical:8,backgroundColor:colors.brandDark},
  saveSmallText:{color:'#fff',fontSize:8,fontWeight:'900',textTransform:'uppercase'},
  iconDanger:{width:34,height:34,alignItems:'center',justifyContent:'center',backgroundColor:'#fff7ed',borderWidth:1,borderColor:'#fed7aa'},
})
